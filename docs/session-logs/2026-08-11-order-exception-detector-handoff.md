# Order Exception detector handoff — 2026-08-11

## Đã triển khai

- `detect-order-exceptions` chạy mỗi 5 phút, mặc định bật, quét 5 trang x 100
  order; page size giới hạn cứng 500 và số trang giới hạn cứng 20.
- Chỉ order có `agent_payment_due_at` hoặc `agent_fulfillment_due_at` trong
  metadata mới được xét; thiếu SLA thì bỏ qua, không suy đoán theo tuổi đơn.
- Read live order dùng `order.read`; mutation agent tiếp tục đi qua
  `ingestOrderExceptionEventWorkflow` và Action Gateway.
- Event ID deterministic theo order + exception type + due time. Quét lại cùng
  SLA trả duplicate và không tạo thêm incident, action hay task.
- Payment quá hạn được ưu tiên trước fulfillment. Order terminal, payment đã
  settle hoặc fulfillment đã shipped/delivered không phát cảnh báo tương ứng.
- Lỗi của một order được log riêng và không dừng toàn batch.
- Đoạn re-read, detect và ingest của mỗi order được khóa bằng
  `agent-order-sla:<order_id>`; production switch dùng Redis locking.
- Hook `createOrderWorkflow.orderCreated` gán SLA cho luồng API/OMS. Subscriber
  `order.placed` gọi workflow có lock để gán SLA cho checkout Medusa.
- Draft order được bỏ qua; order chỉ có hàng số không nhận fulfillment SLA;
  deadline OMS hợp lệ được giữ nguyên và metadata sai được chuẩn hóa lại.
- Payment `authorized` được xem là đã qua bước thanh toán, tránh cảnh báo sai.

## Bằng chứng runtime

- Verifier tạo order có payment SLA quá hạn bằng workflow Medusa.
- Scan 1: 2 candidate, 1 scanned, 1 created, 0 error.
- Scan 2: 2 candidate, 1 scanned, 1 duplicate, 0 error.
- Action `SUCCEEDED`, tạo đúng task `ORDER_PAYMENT_REVIEW`; order không đổi
  status, version hoặc canceled state.
- Race test chạy hai tiến trình Medusa thật đồng thời. Cả hai kết nối
  `locking-redis`, đều kết thúc không lỗi; order mục tiêu có đúng 1 event,
  1 incident và 1 action request.
- Runtime SLA assignment xác nhận cả `order-created-hook` và
  `order-placed-event`; deadline tự sinh dẫn tới đúng một incident/action/task,
  action `SUCCEEDED` và agent không thay đổi order.
- TypeScript và Medusa lint sạch; full unit suite 84/84.

## Cấu hình

- `ORDER_EXCEPTION_DETECTOR_ENABLED=true`
- `ORDER_EXCEPTION_DETECTOR_SCAN_LIMIT=100`
- `ORDER_EXCEPTION_DETECTOR_MAX_PAGES=5`
- `ORDER_SLA_ASSIGNMENT_ENABLED=true`
- `ORDER_PAYMENT_SLA_MINUTES=120`
- `ORDER_FULFILLMENT_SLA_MINUTES=2880`
- Job schedule: `*/5 * * * *`

## Gate tiếp theo

- Business owner cần duyệt số phút SLA mặc định theo vận hành thật.
- Volume vượt giới hạn batch cấu hình vẫn cần SLA table/index hoặc durable
  pagination cursor; phân trang hiện vẫn ưu tiên order cập nhật gần nhất.
- Redis race đã được xác nhận ở local; production deployment vẫn cần metrics,
  alerting và kiểm thử tải theo lưu lượng thật.
