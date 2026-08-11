# Knowledge Hub foundation handoff — 2026-08-11

## Mục tiêu nghiệp vụ

Kho hướng dẫn là nguồn sự thật đã được cửa hàng kiểm soát cho agent. Nhân viên
hoặc quản lý tạo bản nháp, người có quyền duyệt mới cho phép agent sử dụng. Khi
một phiên bản không còn đúng, quản lý ngừng sử dụng thay vì xóa lịch sử.

## Phần đã triển khai

- Model `agent_knowledge_chunk` lưu từng đoạn có `document_id`, thứ tự, nội
  dung, checksum, locator và số từ.
- Tạo knowledge document tự chia nội dung theo ranh giới đoạn/câu, có overlap
  nhỏ và locator dạng `<nguồn>#chunk-<n>`.
- Approval kiểm tra checksum tài liệu và bắt buộc có ít nhất một đoạn tìm kiếm.
- Lifecycle đầy đủ `DRAFT -> APPROVED -> RETIRED`; approve và retire có audit,
  locking và idempotency.
- `knowledge.search` tìm trên đoạn, nhưng chỉ xét tài liệu đúng tenant, scope,
  locale, đã duyệt, đã có hiệu lực và chưa hết hạn.
- API Admin: list/create, detail kèm chunks, approve, retire và test search.
- Route Admin `knowledge-hub` có giao diện Việt/Anh để tạo bản nháp, duyệt,
  ngừng dùng, xem từng đoạn và thử câu hỏi. Câu chữ giải thích rõ tác dụng.
- Script `agent:reindex-knowledge` bổ sung chunks cho dữ liệu được tạo trước
  migration; script không sửa nội dung hay trạng thái tài liệu.
- Customer Support Agent tự dùng kết quả tìm kiếm theo đoạn qua contract
  `knowledge.search`; vẫn luôn yêu cầu nhân viên kiểm tra trước khi gửi.
- OpenAI Responses adapter có strict JSON Schema, timeout 15 giây,
  `store=false`, redaction và không gửi customer ID/email. Model chỉ sinh
  `body`; citations, grounded và `requires_human_review=true` do code kiểm soát.
- Model run có idempotency ledger. Provider lỗi/refuse/timeout/schema sai sẽ ghi
  `FAILED` và tự quay về draft deterministic, không làm mất yêu cầu khách.

## Database và bằng chứng

- Migration mới: `Migration20260811052521`.
- Migration chạy thành công trên PostgreSQL local.
- Reindex: 14 tài liệu được quét, 14 tài liệu được lập chỉ mục, 14 chunks được
  tạo.
- `agent:verify-knowledge-hub` xác nhận bản nháp bị loại, bản approved trả đúng
  chunk locator/checksum và bản retired bị loại.
- `agent:verify-customer-support` chạy lại thành công: live order không bị thay
  đổi, draft grounded có citation, event trùng bị chặn, sai chủ order bị từ
  chối, mọi draft vẫn `requires_human_review=true`.
- Unit test: 22 suite, 96 test đạt, gồm Responses adapter giả lập.
- Medusa lint sạch; backend và Admin build thành công.
- Browser chưa xác nhận nội dung sau đăng nhập trong lượt này vì browser kiểm
  thử không có session Admin. Route hoạt động và chuyển đúng đến `/app/login`.

## Tác dụng phụ migration đã xử lý

Migration script chính thức đang chờ của Medusa gán `Super Admin` cho mọi user,
bao gồm hai tài khoản nhân viên demo. Đã chạy lại onboarding least-privilege cho
`nhanvien@agentic.local` và `nhanvien.browser@agentic.local`; cả hai hiện chỉ có
role `customer_support_staff`.

## Chưa phải agent tự trị hoàn chỉnh

- Chưa có connector đồng bộ từ Google Drive/Notion/PDF/web hoặc hệ thống chính
  sách thật; hiện người quản lý nhập nội dung qua Admin.
- Chưa có semantic/vector retrieval; hiện tìm kiếm lexical theo đoạn. Kiến trúc
  citation/chunk đã sẵn sàng để thay retrieval engine mà không đổi workflow.
- Chưa có gap detector, so sánh phiên bản, phát hiện quy định xung đột hoặc
  Knowledge Curator Agent tự đề xuất cập nhật.
- Model provider mặc định vẫn disabled. OpenAI adapter đã code nhưng chưa chạy
  API thật vì chưa có `OPENAI_API_KEY` và `AGENT_MODEL`; trạng thái model path
  là `RUNTIME-PENDING`. Customer Support đang dùng fallback deterministic.

## Lệnh vận hành

```bash
pnpm --dir apps/backend exec medusa db:migrate
pnpm --dir apps/backend run agent:reindex-knowledge
pnpm --dir apps/backend run agent:verify-knowledge-hub
pnpm --dir apps/backend run agent:verify-customer-support
pnpm --dir apps/backend run test:unit
pnpm --dir apps/backend run lint
pnpm --dir apps/backend run build
```

Chỉ sau khi benchmark và security gate đạt yêu cầu mới cấu hình local:

```env
AGENT_MODEL_PROVIDER=openai
AGENT_MODEL=<approved-model-id>
OPENAI_API_KEY=<server-side-secret>
```

Không đặt các giá trị này trong Admin client hoặc database.

## Bước tiếp theo đề xuất

Xây Knowledge Source Connector theo một nguồn thật đầu tiên (ví dụ file Markdown
được quản lý trong repository hoặc Google Drive), thêm review diff và conflict
detection. Sau đó mới cấu hình model adapter và benchmark để agent soạn câu trả
lời tự nhiên hơn nhưng vẫn bị giới hạn bởi citations, schema và human review.
