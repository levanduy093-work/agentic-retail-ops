# Customer Support Agent handoff — 2026-08-11

## Đã triển khai

- Admin endpoint `POST /admin/agent-operations/support-requests` nhận event
  `support.requested@1`, validate strict schema và yêu cầu policy
  `agent_event:create`.
- Workflow đọc order mới nhất qua typed tool `order.read`; output đã có
  `customer_id` để kiểm tra request đúng chủ sở hữu order.
- Knowledge search giới hạn scope `customer_support`, locale tương ứng và chỉ
  dùng tài liệu `APPROVED` còn hiệu lực.
- Typed tool `response.draft@1.0.0` tạo bản nháp deterministic có citation; đã
  đăng ký trong tool registry, nâng coverage lên 16/24.
- Service tạo incident `CUSTOMER_SUPPORT`, recommendation
  `REVIEW_SUPPORT_RESPONSE` và action `task.create` qua Action Gateway. Task có
  loại `SUPPORT_RESPONSE_REVIEW`, deadline 30 phút và mang bản nháp/citation để
  nhân viên duyệt.
- Event idempotent theo `source + event_id`; customer sai quyền sở hữu bị chặn
  trước khi ghi event.
- Agent không tạo conversation, không gọi `message.send`, không gửi tin cho
  khách và không mutation order.
- Có route Admin riêng `customer-support`, không trộn với `Agent Operations`.
  Màn hình dùng ngôn ngữ nghiệp vụ cho nhân viên cửa hàng: hàng đợi cần xử lý,
  câu hỏi khách, live order, draft, nguồn tham khảo và deadline.
- Nhân viên có thể nhận task, tiếp tục task đang chờ, sửa rồi hoàn tất draft;
  kết quả luôn lưu `message_sent=false`. Nút chuyển quản lý tự bọc
  `task.escalate` qua Action Gateway, không yêu cầu nhập ID hay payload kỹ thuật.
- Đã bổ sung `en.json` và namespace `supportDesk` trong `vi.json`; sidebar và
  toàn bộ nội dung dùng i18n, tương thích nút chuyển `VI/EN` sẵn có.

## Bằng chứng

- Runtime verifier tạo hai customer, một order gắn customer, một knowledge
  document rồi duyệt document bằng workflow thật.
- Luồng thành công tạo đúng 1 event, 1 incident, 1 recommendation, 1 action
  request, 1 task và 1 tool call; action đạt `SUCCEEDED`.
- Gọi lại cùng event trả duplicate và không tạo record thứ hai.
- Dùng customer khác với order bị từ chối và tạo 0 canonical event.
- Bản nháp grounded, có citation và bắt buộc human review.
- Sau xử lý: 0 conversation, 0 action `message.send`; status, version và
  `canceled_at` của order không đổi.
- Medusa lint sạch, backend/Admin build thành công, full unit suite 88/88.
- Route UI và hai resource ngôn ngữ compile thành công. Trình duyệt không có
  session được chuyển về `/app/login`; chưa gọi đây là browser runtime proof sau
  đăng nhập.
- Staff-flow verifier đã chạy qua API thật với User/JWT tạm: có role nhận 201,
  thiếu role nhận 403, chưa đăng nhập nhận 401; hai nhánh bị chặn tạo 0 event.
- Worker đã tạo task thật; luồng nhân viên chạy qua HTTP
  `TODO -> CLAIMED -> IN_PROGRESS -> COMPLETED`, lưu nội dung đã duyệt với
  `reviewed_by_human=true` và `message_sent=false`.
- Nhánh chuyển quản lý chạy qua Action Gateway `task.escalate`, giao cho team
  `operations_manager` và nâng priority lên HIGH.
- Sau toàn bộ luồng vẫn có 0 conversation, 0 action `message.send`; order giữ
  nguyên. Hai User kiểm thử đã được xóa trong `finally`.
- Verifier giữ lại dữ liệu demo để kiểm tra UI: customer
  `cus_01KZPERGCBGXHCTB2KNX1DZWYM`, order `order_01KZPERGDARJXRGKK16CD7P9XQ`
  (display ID `10`), task Việt `agtask_01KZPERH2G4RSVPE50HMS64P8D`
  và task Anh `agtask_01KZPERH5SSJFWDZNHGDNYB8J3`; cả hai task đang `TODO`.
- Bootstrap đã có role `customer_support_staff` với sáu policy tối thiểu:
  `agent_task:read/update`, `agent_action:create/execute`, `customer:read` và
  `order:read`. Script `agent:assign-support-staff` gỡ role `Super Admin` do
  Medusa CLI tự gán và thay bằng role này qua workflow chính thức.
- Tài khoản nhân viên local đã đăng nhập thật nhận HTTP 200 cho task, customer
  và order; truy cập control plane incidents ngoài phạm vi nhận HTTP 403.
- Nội dung UI đã đổi sang câu chỉ rõ hành động và kết quả, ví dụ “Nhận và bắt
  đầu trả lời”, “Lưu câu trả lời đã kiểm tra”, “Nhờ quản lý xử lý”. Citation
  kỹ thuật `policy://...` được thay bằng tên hướng dẫn nghiệp vụ; task đã giao
  quản lý không còn nằm trong hàng đợi nhân viên. Route control plane kỹ thuật
  vẫn truy cập trực tiếp tại `/app/agent-operations` nhưng không hiện ở sidebar.
- Đã bổ sung `POST /admin/agent-operations/tasks/:id/release` và nút “Trả lại
  cho nhân viên khác”. Chỉ user đang phụ trách task `CLAIMED/IN_PROGRESS/WAITING`
  mới được trả; workflow dùng distributed lock, xóa assignee, đưa task về `TODO`
  và ghi audit. Runtime đã xác nhận trả task đạt HTTP 200, assignee thành null;
  gọi lại khi task không còn thuộc user bị chặn HTTP 400.
- Browser đã đăng nhập bằng tài khoản chỉ có role `customer_support_staff` và
  xác nhận trọn checklist: nhận task, sửa/lưu câu trả lời, xem lại ở danh sách
  đã xử lý, nhận rồi trả task về hàng đợi, chuyển quản lý và đổi VI/EN. Câu trả
  lời được lưu với thông báo rõ là chưa gửi cho khách.
- Browser test phát hiện nhánh chuyển quản lý gửi nhầm `incident_id` làm
  `correlation_id`, nên Action Gateway fail-closed với HTTP 409. API task hiện
  trả thêm `incident_correlation_id`; UI dùng đúng correlation này và lần thử
  lại đã chuyển task cho `operations_manager` thành công.
- Lint sạch, 89/89 unit test pass và backend/Admin build thành công sau bản sửa.
- Đã thêm chat simulator nội bộ cho nhân viên tạo câu hỏi thử từ một order gần
  đây. Workflow tạo conversation/tin `INBOUND` kênh `IN_APP`, vẫn đi qua luồng
  `support.requested`, live order, approved knowledge và task review hiện có.
- Sau khi nhân viên tự nhận task và lưu câu trả lời đã kiểm tra, UI hiện nút
  “Xác nhận gửi câu trả lời”. Backend chỉ cho đúng nhân viên phụ trách gửi; mọi
  lần gửi đi qua `message.send` trong Action Gateway, được audit và chống gửi
  trùng. Simulator không kết nối ra khách thật.
- Runtime `agent:verify-support-simulator` đã xác nhận đúng 1 tin vào và 1 tin
  ra; gửi trước khi duyệt bị chặn, nhân viên khác gửi bị chặn và gửi lại không
  tạo bản thứ hai. Role nhân viên đã bổ sung quyền conversation read,
  message create và simulator create.
- Simulator không còn dùng công tắc môi trường riêng. Quyền truy cập được kiểm
  soát thống nhất bằng đăng nhập Admin và RBAC
  `agent_support_simulator:create`; đây vẫn chỉ là kênh `IN_APP` nội bộ.

## Cách chạy lại

```bash
REDIS_INFRASTRUCTURE_ENABLED=true \
REDIS_URL=redis://localhost:6379 \
LOCKING_REDIS_URL=redis://localhost:6379 \
pnpm --dir apps/backend run agent:verify-customer-support

REDIS_INFRASTRUCTURE_ENABLED=true \
REDIS_URL=redis://localhost:6379 \
LOCKING_REDIS_URL=redis://localhost:6379 \
pnpm --dir apps/backend run agent:verify-customer-support-staff-flow

pnpm --dir apps/backend run agent:verify-support-simulator

AGENT_STAFF_EMAIL=<email> \
AGENT_STAFF_FIRST_NAME=<first-name> \
AGENT_STAFF_LAST_NAME=<last-name> \
pnpm --dir apps/backend run agent:assign-support-staff
```

## Gate tiếp theo

- Chốt customer channel identity mapping, webhook signature, consent và
  delivery receipt trước khi thêm email/chat/mobile adapter.
- Giữ `message.send` của simulator tách khỏi delivery thật. Chỉ sau các gate
  trên mới nối action đã được người duyệt vào adapter thật; không cho agent tự
  phát tin.
