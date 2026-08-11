# Câu hỏi RAG và kết quả kỳ vọng

Chỉ chạy các test positive sau khi các document có `APPROVED_FOR_TEST` đã được
approve. Khi gọi `knowledge.search`, luôn truyền đúng `tenant_id`, `scope` và
`locale` trong manifest.

| Query | Filter | Evidence kỳ vọng |
| --- | --- | --- |
| `Tôi muốn đổi màu sản phẩm vừa nhận thì có mất phí không?` | `default/customer_support/vi` | `CS-RETURN-001`, miễn phí vận chuyển một chiều cho lần đổi đầu nếu đủ điều kiện. |
| `Đơn không cập nhật tracking 2 ngày thì nhân viên cần làm gì?` | `default/customer_support/vi` | `CS-SHIP-002`, mở `CS-DELIVERY-DELAY`; không hứa hoàn tiền/gửi lại. |
| `Can I get a replacement for a wet NovaSound Mini?` | `default/customer_support/en` | `CAT-WARRANTY-004`, liquid damage is excluded; no replacement promise. |
| `Khi nào chuyển hàng từ HN vào HCM cần phê duyệt?` | `default/operations/vi` | `OPS-STOCK-003`, từ 20.000.000 VND và cần revalidate trước thực thi. |

## Negative cases

| Query | Filter | Kết quả đúng |
| --- | --- | --- |
| `Khách VIP có được hoàn tiền trong 24 giờ khi giao chậm không?` | `default/customer_support/vi` | Không trả `CS-VIP-DRAFT-005`; trả lời thiếu chính sách được duyệt và escalate. |
| `Mã FREESHIP-JULY còn dùng được không?` | `default/customer_support/vi` | Không trả `MKT-PROMO-006`; nếu không có tài liệu hiệu lực khác thì nói không có evidence hiện hành. |
| `Cách điều chuyển hàng HN sang HCM?` | `default/customer_support/vi` | Không trả nội dung `OPS-STOCK-003`, vì khác scope. |
| `NovaSound Mini có bảo hành bao lâu?` | `default/customer_support/vi` | Không trả tài liệu English nếu locale filter là `vi`; đây là kiểm tra locale isolation. |

## Đa định dạng

| Query | Filter | Evidence kỳ vọng |
| --- | --- | --- |
| `Tracking không đổi 48 giờ thì tạo case gì?` | `default/customer_support/vi` | DOCX/XLSX trả `CS-DELIVERY-DELAY`. |
| `Chuyển 25 triệu từ HN sang HCM ai duyệt?` | `default/operations/vi` | PDF trả Operations Manager và yêu cầu revalidate. |
| `Does warranty cover liquid damage?` | `default/customer_support/en` | CSV trả không bảo hành liquid damage. |

Mỗi kết quả positive phải có citation locator của chunk liên quan. Kết quả
negative không được suy luận chính sách từ tài liệu bị loại.
