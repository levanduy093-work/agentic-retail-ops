# Điều chuyển tồn kho giữa kho HN và HCM

Tài liệu này thuộc phạm vi vận hành nội bộ, không dùng để trả lời khách hàng.

Khi kho HCM thiếu hàng nhưng kho HN còn khả dụng, điều phối viên có thể đề xuất
điều chuyển nội bộ. Chỉ thực hiện khi lượng tồn khả dụng sau điều chuyển tại kho
nguồn vẫn lớn hơn hoặc bằng safety stock, và tổng nhu cầu đơn đã đặt trong 48
giờ không làm âm tồn dự kiến.

Mọi đề xuất có tổng giá trị từ 20.000.000 VND trở lên cần phê duyệt của Operations
Manager. Sau khi được phê duyệt, hệ thống phải revalidate tồn kho và trạng thái
đơn trước khi tạo lệnh chuyển. Nếu dữ liệu thay đổi, đánh dấu `STALE_CONFLICT`
và tạo đề xuất mới; không được thực hiện một phần điều chuyển.

Lệnh chuyển phải mang idempotency key. Không cập nhật trực tiếp bảng tồn kho;
thao tác thực thi qua Action Gateway và phải có audit event.
