# Google OAuth Knowledge Connector handoff — 2026-08-11

## Trải nghiệm đã chọn

Chủ shop không tải service-account JSON và không mở code. Trong Knowledge Hub,
họ bấm **Kết nối Google**, đăng nhập, cấp quyền, sau đó bấm **Chọn từ Google
Drive**. Google Picker chỉ cấp quyền cho tệp được chọn qua scope `drive.file`.

## Nền tảng đã triển khai

- Model `agent_connector_credential` lưu email, scopes và refresh token đã mã
  hóa AES-256-GCM; không API nào trả refresh token.
- OAuth authorize/callback dùng authorization-code flow với offline access.
- State được ký HMAC, gắn admin actor, tenant, nonce cookie HttpOnly và hạn dùng
  10 phút để chống callback giả/replay từ phiên khác.
- Callback đổi code và cấu hình connector qua workflow; token thô không xuất
  hiện trong workflow response hoặc audit.
- Disconnect cố gọi Google revoke, sau đó xóa credential local qua workflow và
  ghi audit kể cả khi revoke từ xa thất bại.
- Picker-token route chỉ trả access token ngắn hạn và public Picker config cho
  Admin đã đăng nhập.
- Google Drive fetch adapter nhận Bearer token từ OAuth; nguồn thay đổi vẫn chỉ
  tạo knowledge draft và cần quản lý duyệt.
- Admin có trạng thái kết nối, email tài khoản, đổi/ngắt tài khoản và Google
  Picker; câu chữ Việt/Anh dành cho chủ shop.

## Cấu hình hạ tầng một lần

Đây là cấu hình của bên triển khai nền tảng, không phải thông số chủ shop nhập:

```text
GOOGLE_KNOWLEDGE_OAUTH_CLIENT_ID
GOOGLE_KNOWLEDGE_OAUTH_CLIENT_SECRET
GOOGLE_KNOWLEDGE_OAUTH_REDIRECT_URI
GOOGLE_KNOWLEDGE_PICKER_API_KEY
GOOGLE_KNOWLEDGE_CLOUD_PROJECT_NUMBER
AGENT_CREDENTIAL_ENCRYPTION_KEY
```

Trong Google Cloud phải bật Drive API và Picker API, khai báo đúng redirect URI
và giới hạn Picker API key theo origin/API. Production nên đặt khóa mã hóa riêng;
local có thể dùng fallback `JWT_SECRET`.

## Bằng chứng hiện tại

- Migration `Migration20260811080525` đã generate và migrate thành công trên
  PostgreSQL local.
- `pnpm run build`: đạt cả backend và Admin frontend.
- `pnpm run lint`: không lỗi/cảnh báo.
- `pnpm run test:unit`: 26 suites, 112 tests đạt.
- Trình duyệt local mở được ứng dụng nhưng phiên in-app chưa đăng nhập Admin, nên
  chưa có runtime screenshot của card connector.
- Không có OAuth Client thật trong workspace; đăng nhập, consent, Picker và đọc
  tệp Google thật là `RUNTIME-PENDING`, không được coi là đã acceptance.

## Việc tiếp theo

1. Tạo/cấu hình Google OAuth web app và Picker API key cho localhost.
2. Đăng nhập Admin, bấm Kết nối Google, kiểm tra consent chỉ có `drive.file`.
3. Chọn một Docs và một Sheets bằng Picker, sync, duyệt draft và tìm kiếm.
4. Ngắt kết nối, xác nhận picker-token/sync bị từ chối và audit có bản ghi.
5. Sau acceptance mới thêm lịch sync, retry/dead recovery và connector Notion,
   OneDrive/SharePoint theo cùng contract.
