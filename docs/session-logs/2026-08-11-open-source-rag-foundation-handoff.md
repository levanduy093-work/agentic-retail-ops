# Open-source RAG foundation handoff — 2026-08-11

## Quyết định kiến trúc

- Không tự xây vector database hay embedding pipeline.
- Dùng LangChain.js làm abstraction cho embedding và vector store.
- Dùng Qdrant mã nguồn mở làm derived semantic index.
- PostgreSQL/Medusa vẫn giữ tài liệu gốc, trạng thái duyệt, phiên bản, tenant,
  scope, locale, thời hạn và citation.

## Luồng đã nối

1. Google connector đồng bộ nội dung thành knowledge document và chunks.
2. Quản lý duyệt tài liệu.
3. Workflow approval gọi LangChain để tạo embedding và upsert chunks vào
   Qdrant bằng point ID ổn định theo `chunk_id + checksum`.
4. `knowledge.search` lấy lexical candidates từ PostgreSQL và semantic
   candidates từ Qdrant, hợp nhất điểm, loại chunk trùng và giới hạn tối đa hai
   đoạn trên mỗi tài liệu.
5. Kết quả từ Qdrant chỉ được chấp nhận nếu chunk vẫn thuộc tập tài liệu đúng
   tenant/scope/locale, `APPROVED`, đã có hiệu lực và chưa hết hạn trong
   PostgreSQL.
6. Retire workflow xóa toàn bộ vector của document khỏi Qdrant.
7. Qdrant hoặc embedding provider lỗi/chưa cấu hình thì tự fallback lexical;
   yêu cầu hỗ trợ khách hàng không bị mất.

## Hạ tầng và cấu hình

- Docker Compose có `qdrant/qdrant:v1.19.0`, port `6333`, healthcheck và volume
  `agent-qdrant-data`.
- Backend dùng `@langchain/core`, `@langchain/openai`,
  `@langchain/google-genai` và `@langchain/qdrant`.
- `.env.template` chỉ giữ cấu hình hạ tầng Qdrant:

```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=agent_knowledge
```

OpenAI/Gemini API key được chủ cửa hàng nhập tại trang **AI** trong Admin. Khóa
được mã hóa AES-256-GCM trong PostgreSQL; API chỉ trả trạng thái và bốn ký tự
cuối, không trả ciphertext hay khóa rõ. Runtime không đọc API key, provider hay
model AI từ `.env`; `AGENT_CREDENTIAL_ENCRYPTION_KEY` và cấu hình Qdrant vẫn là
cấu hình hạ tầng do người triển khai quản lý.

## Bổ sung provider và quản trị khóa

- Hỗ trợ OpenAI và Google Gemini cho cả embedding lẫn soạn câu trả lời.
- Mỗi nhiệm vụ chỉ có một provider active; có thể dùng hai provider khác nhau
  cho tìm kiếm và soạn trả lời.
- Thay đổi provider có workflow, lock theo tenant và audit event.
- Sau khi lưu provider, workflow tự reindex toàn bộ tài liệu approved còn hiệu
  lực vào collection riêng theo provider + model, tránh trộn vector khác chiều.
- Qdrant tạo payload index cho tenant/scope/locale/document và bật strict mode
  để filter không quét trường chưa đánh index.
- RBAC `agent_ai_provider:read/configure/delete` chỉ cấp cho vai trò quản lý vận
  hành qua bootstrap.

## Bằng chứng hiện tại

- Qdrant container local healthy và `/readyz` trả `all shards are ready`.
- `agent:verify-rag` dùng LangChain với embedding giả lập cục bộ, upsert hai
  chunks, xác nhận metadata filter không rò tenant, xóa document rồi xác nhận
  không còn kết quả.
- Unit test xác nhận adapter mapping và semantic result có thể tìm được câu hỏi
  dùng cách diễn đạt khác lexical query.
- `agent:verify-ai-provider-vault` xác nhận khóa mã hóa at-rest, status API
  không có secret, runtime giải mã được và chuyển provider theo từng nhiệm vụ.
- Model embedding thật chưa được gọi nên semantic provider path là
  `RUNTIME-PENDING`; đây không phải bằng chứng chất lượng RAG production.

## Lệnh vận hành

```bash
docker compose up -d qdrant
pnpm --dir apps/backend run agent:verify-rag
pnpm --dir apps/backend run agent:reindex-knowledge
pnpm --dir apps/backend run test:unit
pnpm --dir apps/backend run lint
pnpm --dir apps/backend run build
```

Chủ cửa hàng chỉ cần vào Admin > **AI**, chọn OpenAI hoặc Gemini, dán API key và
chọn dùng cho tìm kiếm, chuẩn bị câu trả lời hoặc cả hai. DeepSeek chỉ dùng để
chuẩn bị câu trả lời vì không có embedding API chính thức. Workflow tự reindex;
`agent:reindex-knowledge` vẫn được giữ làm lệnh vận hành khôi phục.

## Prompt hệ thống và model soạn trả lời

- Admin > **AI** hiển thị model embedding, model suy luận/soạn trả lời và prompt
  hệ thống đang hoạt động.
- Prompt mặc định đầy đủ yêu cầu model chỉ dùng dữ liệu đơn hàng thực và
  knowledge đã duyệt, chống instruction injection từ câu hỏi/tài liệu, không
  bịa trạng thái/chính sách/citation, không lộ secret và luôn chờ nhân viên
  kiểm tra trước khi gửi.
- Quản lý có thể tùy chỉnh prompt hoặc khôi phục prompt mặc định. Mỗi lần lưu
  tạo một phiên bản `ACTIVE` mới, phiên bản cũ chuyển `RETIRED`; audit event và
  model-run ledger giữ prompt key/version để truy vết.
- OpenAI Responses và Gemini `generateContent` đều nhận chính prompt đang
  active trong PostgreSQL; không còn prompt runtime hard-code khác với Admin.
- `.env.template` phân biệt rõ cấu hình hạ tầng với cấu hình của chủ cửa hàng.
  API key/provider/model/prompt được quản lý trong Admin; biến env tương ứng
  chỉ còn là fallback tương thích cho deployment server-managed cũ.

Bootstrap ngày 2026-08-11 đã tạo prompt mặc định phiên bản `2.0.0` và nghỉ phiên
bản mặc định cũ. Unit test, Medusa lint và backend/admin build đều đã qua. Chưa
xác nhận thao tác trực tiếp trên trang Admin bằng phiên đăng nhập trình duyệt.

Prompt mặc định phiên bản `2.1.0` bổ sung quy tắc ngôn ngữ: nhận diện ngôn ngữ
trực tiếp từ câu hỏi của khách và trả lời cùng ngôn ngữ; câu hỏi trộn ngôn ngữ
dùng ngôn ngữ chính; `locale` của kênh chỉ là phương án dự phòng khi không xác
định được ngôn ngữ câu hỏi. Tên sản phẩm, mã đơn và danh từ riêng được giữ
nguyên để tránh dịch sai dữ liệu nghiệp vụ.

## Tự động phát hiện model từ provider

- Drawer kết nối AI không còn yêu cầu nhập model ID thủ công. Sau khi API key
  đủ dài và người dùng ngừng nhập 700 ms, Admin tự gọi endpoint bảo vệ để tải
  danh sách; không có nút tải riêng.
- Provider đã kết nối dùng credential đã mã hóa trong database để tự tải ngay
  khi mở drawer. API chỉ trả tên/metadata model, không trả API key.
- Gemini phân loại bằng `embedContent` và `generateContent` do Models API trả
  về. OpenAI lấy `/v1/models`, tách `text-embedding-*` và lọc các model tạo nội
  dung khỏi audio/realtime/image/search/moderation/fine-tune.
- Form giữ nguyên nhãn `Embedding model`; phần model không thuộc mục đích đang
  chọn sẽ được ẩn. Nút lưu chỉ bật sau khi danh sách phù hợp tải thành công.
- Unit test mới xác nhận header chứa key nhưng response catalog không có key và
  hai loại model được tách đúng. Tổng hiện tại: 29 suites, 129 tests passed;
  lint và backend/Admin build passed.

## DeepSeek provider

- Admin > **AI** có thêm DeepSeek; API key được mã hóa trong cùng credential
  vault và model được tải tự động từ `GET https://api.deepseek.com/models`.
- DeepSeek chỉ được bật cho soạn câu trả lời. Backend từ chối cấu hình DeepSeek
  làm embedding provider; giao diện không hiển thị lựa chọn tìm kiếm kiến thức.
- Runtime gọi OpenAI-compatible `POST /chat/completions`, bật JSON mode, tắt
  streaming và ghi provider/model/prompt version vào model-run ledger như các
  provider khác.
- DeepSeek, OpenAI và Gemini đều chỉ nhận API key/model từ Admin; không còn
  fallback key hoặc model trong `.env`.
