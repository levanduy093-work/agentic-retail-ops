# Knowledge Source Connector handoff — 2026-08-11

> Lưu ý: phần service account Google trong tài liệu này đã được thay thế bởi
> OAuth connector + Google Picker. Xem
> `2026-08-11-google-oauth-knowledge-connector-handoff.md` để tiếp tục phát triển.

## Mục đích

Cho quản lý kết nối một tài liệu hướng dẫn bên ngoài vào Knowledge Hub mà không
phải chép tay. Agent không được dùng thẳng nội dung vừa tải: hệ thống chỉ tạo
bản nháp, sau đó quản lý phải đọc và duyệt.

## Đã triển khai

- Model `agent_knowledge_source` lưu tên nguồn, URL, tenant, scope, locale,
  checksum, tài liệu gần nhất và trạng thái lần đồng bộ.
- Workflow `create-knowledge-source` và `sync-knowledge-source` dùng distributed
  lock; route mutation không ghi thẳng qua service.
- API Admin để liệt kê, tạo connection và yêu cầu đồng bộ.
- Knowledge Hub có khu vực “Nguồn hướng dẫn đã kết nối” và modal Việt/Anh để
  nhập tên, địa chỉ HTTPS, ngôn ngữ và công việc áp dụng.
- Đồng bộ nội dung mới tạo knowledge document `DRAFT` cùng chunks/citations.
  Đồng bộ lại nội dung không đổi trả `UNCHANGED` và không tạo draft trùng.
- Lỗi đồng bộ được lưu trên source để giao diện nói rõ connection cần kiểm tra.

## Hàng rào an toàn

- Server phải cấu hình `KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS`; mặc định không tên
  miền nào được phép.
- Chỉ HTTPS, không credential trong URL, không custom port, không private IP.
- Mỗi redirect được kiểm tra lại; tối đa 3 redirect, timeout 10 giây, tối đa
  1 MB, chỉ `text/plain` hoặc `text/markdown`.
- Connector không tự approve, không gửi nội dung cho model và không thay đổi dữ
  liệu commerce.

## Bằng chứng kiểm tra

- Migration `Migration20260811060537` chạy thành công trên PostgreSQL local.
- Runtime tải README Markdown thật từ `raw.githubusercontent.com`, tạo một
  draft gồm 4 chunks, sau đó đồng bộ lần hai trả `UNCHANGED`.
- 22 unit suites, 97 tests đạt; Medusa lint sạch; backend và Admin build thành
  công.
- Browser đăng nhập chưa được kiểm tra trực tiếp trong lượt này. Vì vậy trạng
  thái giao diện là `IMPLEMENTED-STATIC`, còn workflow/database/fetch là
  `RUNTIME-VERIFIED` trên local.

## Cấu hình và lệnh

```env
KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS=raw.githubusercontent.com
```

```bash
pnpm --dir apps/backend exec medusa db:migrate
KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS=raw.githubusercontent.com \
KNOWLEDGE_CONNECTOR_TEST_URL=https://raw.githubusercontent.com/medusajs/medusa/develop/README.md \
pnpm --dir apps/backend run agent:verify-knowledge-connector
```

Không ghi secret vào URL. Google Drive dùng service account chỉ đọc và token
chỉ tồn tại ở backend.

```env
GOOGLE_KNOWLEDGE_CLIENT_EMAIL=<service-account-email>
GOOGLE_KNOWLEDGE_PRIVATE_KEY=<service-account-private-key>
```

Chia sẻ từng Google Docs, Google Sheets hoặc tệp Drive cho email trên với quyền
`Viewer`. Không chia sẻ cả Drive nếu hệ thống chỉ cần đọc một vài tài liệu.

## Việc tiếp theo

1. Thêm lịch đồng bộ qua worker với lease, retry và dead-letter.
2. Hiển thị diff trước/sau để quản lý biết chính xác nội dung nào thay đổi.
3. Phát hiện hướng dẫn trùng hoặc xung đột trước khi cho phép approve.
4. Chạy acceptance bằng Google Docs/Sheets thật sau khi cấp service account;
   tiếp theo mới thêm Notion/PDF adapter.

## Điều chỉnh giao diện sau phản hồi người dùng

- Tách trang thành ba khu độc lập: `Hướng dẫn`, `Tài liệu kết nối` và `Kiểm tra
  tìm kiếm`; không còn hiển thị cả ba công việc trên một màn hình.
- Bỏ ba thẻ thống kê lớn; số lượng nằm ngay trên bộ lọc trạng thái.
- Màn hình chi tiết chỉ hiện nội dung hướng dẫn, mục đích sử dụng, ngôn ngữ và
  thao tác duyệt/ngừng dùng. URL nguồn, locator chunk, version và mã scope không
  còn xuất hiện trên màn hình thường.
- Form thêm hướng dẫn chỉ yêu cầu tên, ngôn ngữ, công việc áp dụng và nội dung;
  mã kỹ thuật, nguồn nội bộ, phiên bản và ngày hiệu lực được hệ thống tự tạo.
- Bản ghi do runtime verifier tạo được giữ trong database làm bằng chứng nhưng
  bị ẩn khỏi giao diện nghiệp vụ dựa trên `owner_id` kết thúc bằng `-verifier`.
- Backend/Admin build và Medusa lint thành công sau thay đổi. Browser tự động
  chỉ tới trang đăng nhập nên chưa xác nhận trực quan trong session Admin thật.

## Google Docs, Sheets và Drive adapter

- Nguồn hỗ trợ: Google Docs, Google Sheets, và tệp TXT/Markdown/CSV trên Drive.
- Google Docs dùng Drive `files.export` thành văn bản; Google Sheets export CSV;
  tệp Drive thường dùng `files.get` với `alt=media`.
- Route `google-status` chỉ trả trạng thái cấu hình và email service account,
  không trả private key hoặc access token.
- Migration `Migration20260811064334` đã chạy trên PostgreSQL local.
- 23 unit suites, 103 tests, Medusa lint và backend/Admin build đều đạt.
- Chưa có credential Google thật trong workspace, nên Google adapter là
  `IMPLEMENTED-STATIC`; connector HTTPS vẫn `RUNTIME-VERIFIED`.
