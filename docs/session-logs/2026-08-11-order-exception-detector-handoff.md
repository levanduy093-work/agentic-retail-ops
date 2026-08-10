# Order Exception detector handoff — 2026-08-11

## Đã triển khai

- `detect-order-exceptions` chạy mỗi 5 phút, mặc định bật và có scan limit 100
  (giới hạn cứng 500).
- Chỉ order có `agent_payment_due_at` hoặc `agent_fulfillment_due_at` trong
  metadata mới được xét; thiếu SLA thì bỏ qua, không suy đoán theo tuổi đơn.
- Read live order dùng `order.read`; mutation agent tiếp tục đi qua
  `ingestOrderExceptionEventWorkflow` và Action Gateway.
- Event ID deterministic theo order + exception type + due time. Quét lại cùng
  SLA trả duplicate và không tạo thêm incident, action hay task.
- Payment quá hạn được ưu tiên trước fulfillment. Order terminal, payment đã
  settle hoặc fulfillment đã shipped/delivered không phát cảnh báo tương ứng.
- Lỗi của một order được log riêng và không dừng toàn batch.

## Bằng chứng runtime

- Verifier tạo order có payment SLA quá hạn bằng workflow Medusa.
- Scan 1: 2 candidate, 1 scanned, 1 created, 0 error.
- Scan 2: 2 candidate, 1 scanned, 1 duplicate, 0 error.
- Action `SUCCEEDED`, tạo đúng task `ORDER_PAYMENT_REVIEW`; order không đổi
  status, version hoặc canceled state.
- TypeScript và Medusa lint sạch; full unit suite 77/77.

## Cấu hình

- `ORDER_EXCEPTION_DETECTOR_ENABLED=true`
- `ORDER_EXCEPTION_DETECTOR_SCAN_LIMIT=100`
- Job schedule: `*/5 * * * *`

## Gate tiếp theo

- Checkout/OMS phải ghi hai SLA metadata theo UTC ISO-8601.
- Volume lớn cần SLA table/index hoặc durable pagination cursor; batch hiện ưu
  tiên các order vừa cập nhật gần nhất.
- Chạy multi-instance với Redis locking và kiểm tra race trên cùng event ID.
