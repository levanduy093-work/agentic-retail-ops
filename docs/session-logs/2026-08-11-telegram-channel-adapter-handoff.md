# Telegram channel adapter handoff — 2026-08-11

## Phạm vi đã triển khai

- `TelegramChannelAdapter` gọi Bot API `sendMessage`, parse receipt và không ghi
  bot token vào log/database.
- Secret resolver chỉ chấp nhận `env:VARIABLE_NAME`. Connection lưu
  `env:TELEGRAM_BOT_TOKEN` và `env:TELEGRAM_WEBHOOK_SECRET`.
- `agent:configure-telegram` kiểm tra bot bằng `getMe`, đăng ký webhook HTTPS
  bằng `setWebhook`, giới hạn update ở `message` và chỉ bật connection sau khi
  Telegram xác nhận thành công.
- Public webhook:
  `POST /webhooks/agent-operations/telegram/:connection_id`.
- Webhook kiểm tra header `X-Telegram-Bot-Api-Secret-Token` bằng so sánh
  constant-time, chỉ nhận private text, bỏ qua bot/chat ngoài allowlist và chống
  update trùng theo `connection_id + update_id`.
- Mỗi chat được ánh xạ rõ ràng tới một Medusa user qua
  `TELEGRAM_IDENTITIES_JSON`; không suy đoán danh tính từ username.
- Tin vào tạo conversation `TELEGRAM/OPERATOR_CHAT`, inbound message và audit.
- `message.send` trên conversation ngoài `IN_APP` tạo delivery `PENDING`.
  Scheduled worker claim bằng lease, gửi qua adapter, lưu external message ID;
  lỗi dùng exponential backoff và quá số lần thử chuyển `DEAD`.

## Bằng chứng

- Medusa lint sạch.
- 94/94 unit test đạt, gồm adapter success/failure, secret reference,
  constant-time token, identity allowlist và delivery retry/dead-letter.
- Backend và Admin build thành công.
- `agent:verify-telegram` chạy qua API/backend/database thật với Telegram API
  giả lập: secret sai nhận 401, chat ngoài allowlist bị bỏ qua, update trùng
  không tạo message thứ hai, outbound delivery đạt `DELIVERED`, receipt
  `external_message_id` được lưu và dispatch lại bị skip.
- Chưa gửi tin tới Telegram thật vì workspace chưa được cấp bot token và public
  HTTPS URL. Trạng thái live là `RUNTIME-PENDING`, không phải production proof.

## Cấu hình bot thật

Không gửi token trong chat hoặc commit vào git. Điền biến môi trường local:

```env
TELEGRAM_BOT_TOKEN=<token từ BotFather>
TELEGRAM_WEBHOOK_SECRET=<secret-token-hop-le>
TELEGRAM_PUBLIC_BASE_URL=https://<public-domain>
TELEGRAM_BOT_ACCOUNT_REF=primary
TELEGRAM_IDENTITIES_JSON=[{"chat_id":"<telegram-chat-id>","user_id":"<medusa-user-id>"}]
```

Sau đó chạy:

```bash
pnpm --dir apps/backend run agent:configure-telegram
```

Restart backend với cùng `TELEGRAM_BOT_TOKEN` và
`TELEGRAM_WEBHOOK_SECRET`, nhắn bot từ chat đã allowlist rồi kiểm tra
conversation/message/delivery trong Agent Operations.

## Gate tiếp theo

- Acceptance với bot thật và HTTPS endpoint thật.
- UI quản lý connection/identity thay cho JSON env.
- Cú pháp lệnh deterministic như `/approve` và `/reject`; hiện text chỉ được
  lưu, không tự thực thi lệnh.
- Consent/identity riêng nếu dùng Telegram làm kênh khách hàng thay vì kênh
  admin/nhân viên.
