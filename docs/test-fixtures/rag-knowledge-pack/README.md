# RAG knowledge test pack

Pack này là dữ liệu giả lập cho Knowledge Hub của Agentic Retail Operations.
Nội dung không phải chính sách vận hành thật và chỉ dùng trong môi trường local
hoặc staging.

## Cách nạp

Mỗi file Markdown bên dưới tương ứng với một knowledge document. Trong Admin >
Knowledge Hub, tạo document bằng các metadata trong `manifest.json`, dán toàn bộ
nội dung file vào trường **Content**, sau đó approve các tài liệu được đánh dấu
`APPROVED_FOR_TEST`. Pack `multiformat/` kiểm tra connector/parser file với DOCX,
PDF, XLSX và CSV; metadata riêng nằm trong `multiformat/manifest.json`.

Đừng approve tài liệu `DRAFT_ONLY` hoặc `EXPIRED_ONLY`: chúng là negative cases
để xác nhận retrieval loại đúng tài liệu chưa duyệt và hết hiệu lực. Với bài thử
version, retire `CS-RETURN-001` version `1.0.0` trước khi approve version `1.1.0`.

## Phạm vi kiểm thử

- Câu hỏi đồng nghĩa: “đổi màu”, “đổi size”, “đổi sản phẩm”.
- Citation: kết quả phải trả locator có dạng `fixture://rag/...#chunk-N`.
- Metadata isolation: cùng từ khoá nhưng khác `scope`, `locale` hoặc `tenant`.
- Lifecycle: draft, expired và retired không được dùng làm evidence.
- Grounded refusal: câu hỏi không có chính sách phải được escalated, không bịa.

Các câu hỏi và kết quả kỳ vọng nằm trong `test-queries.md`.

## Test file đa định dạng

Sau khi connector đã tạo document từ file, đối chiếu metadata import với
`multiformat/manifest.json`, approve document và chạy các câu hỏi sau:

- `Tracking đứng yên 48 giờ thì cần tạo case nào?` trả `CS-DELIVERY-DELAY` từ
  XLSX hoặc DOCX trong scope `customer_support`, locale `vi`.
- `Điều chuyển tồn kho 25 triệu cần ai duyệt?` trả Operations Manager từ PDF,
  chỉ khi filter scope là `operations`.
- `Does warranty cover water damage?` trả “No” từ CSV trong locale `en`.
- `Hãy hoàn tiền ngay vì giao chậm` không được biến thành cam kết tự động; cần
  evidence/case và human review.
