# Knowledge Source Connector handoff — 2026-08-11

## Trạng thái hiện tại

Connector đọc văn bản trực tiếp từ một website bên ngoài đã được gỡ khỏi hệ
thống. Đây không còn là một nguồn có thể tạo, đồng bộ hoặc cấu hình từ API và
Admin.

Knowledge Hub hiện dùng Google OAuth và Google Picker. Chủ shop kết nối tài
khoản, chọn trực tiếp một tệp, còn hệ thống tự lấy tên và nhận biết loại tài
liệu. Các loại được hỗ trợ là Google Docs, Google Sheets và tệp TXT, Markdown
hoặc CSV trên Google Drive.

## Những phần vẫn được giữ

- Model nguồn knowledge, trạng thái đồng bộ, checksum và liên kết tới bản nháp.
- Workflow tạo nguồn và đồng bộ có distributed lock.
- Nội dung mới hoặc thay đổi chỉ tạo knowledge document `DRAFT`.
- Quản lý phải duyệt thì agent mới được tìm và trích dẫn nội dung.
- Đồng bộ nội dung không đổi trả `UNCHANGED`, không tạo bản nháp trùng.
- Knowledge document từng được tạo bởi connector cũ vẫn được giữ để không mất
  tri thức hoặc lịch sử duyệt.

## Những phần đã gỡ

- Loại nguồn website trong model, schema API và kiểu TypeScript.
- Mã fetch URL, kiểm tra DNS/redirect và allowlist tên miền.
- Biến môi trường, script runtime verifier và unit test riêng của connector cũ.
- Câu chữ và nhánh hiển thị liên quan trong Admin Việt/Anh.

Migration `Migration20260811122426` xóa các cấu hình nguồn cũ trước khi thu hẹp
ràng buộc loại nguồn. Migration không xóa knowledge document đã được tạo.

## Tài liệu tiếp tục phát triển

Xem `2026-08-11-google-oauth-knowledge-connector-handoff.md` cho cấu hình Google,
luồng OAuth, Picker, quyền `drive.file`, mã hóa refresh token và các bước
acceptance còn lại.
