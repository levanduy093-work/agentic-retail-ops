# Synapse DTC Starter & Agentic Retail Ops

Nền tảng thương mại điện tử **Direct-to-Consumer (DTC)** thế hệ mới tích hợp sâu hệ thống vận hành tự động và chăm sóc khách hàng bằng **AI Agents**.

Dự án phá bỏ rào cản phân mảnh truyền thống giữa cửa hàng trực tuyến (Storefront), dịch vụ khách hàng (Customer Support), đơn vị vận chuyển (Logistics), quản lý kho bãi (Inventory) và quy trình văn phòng (Back-office) — kết nối tất cả vào một hệ thống vận hành thông minh, tự động và thống nhất.

---

## 📌 Mục đích dự án & Các vấn đề cốt lõi được giải quyết

Trong mô hình bán lẻ D2C truyền thống, doanh nghiệp thường gặp phải các điểm nghẽn:
1. **Dịch vụ khách hàng phân mảnh:** Chatbot thông thường chỉ trả lời kịch bản cứng nhắc, không thể tra cứu đơn hàng theo thời gian thực hay tư vấn sâu theo từng sản phẩm.
2. **Vận hành thụ động:** Đơn hàng bị kẹt, thanh toán lỗi hoặc hết hàng trong kho chỉ được phát hiện khi khách hàng khiếu nại.
3. **Tri thức nội bộ rời rạc:** Chính sách đổi trả, bảo hành, tài liệu sản phẩm nằm rải rác trên Google Drive/Notion/PDF, nhân viên CSKH mất nhiều thời gian tra cứu.
4. **Thiếu hỗ trợ đặc thù cho thị trường Việt Nam:** Khó khăn khi tích hợp đồng bộ các đơn vị vận chuyển nội địa (GHN, GHTK) và phương thức thanh toán VietQR (PayOS, SePay).

**Synapse DTC Starter & Agentic Retail Ops** được xây dựng để giải quyết triệt để các vấn đề trên thông qua 4 trụ cột chính:

### 1. 🤖 Trợ lý AI Bán hàng & CSKH Đa kênh (Omnichannel AI Assistant)
- **Tư vấn sản phẩm thông minh (Product Advisor):** Phân tích nhu cầu, sở thích và ngữ cảnh của khách hàng để gợi ý sản phẩm phù hợp.
- **Tra cứu đơn hàng tức thì (Live Order Lookup):** Khách hàng có thể kiểm tra trạng thái đơn hàng, tiến trình vận chuyển ngay trong khung chat mà không cần liên hệ nhân viên.
- **Giải đáp chính sách & FAQ qua RAG (Knowledge Hub):** Trả lời chính xác các câu hỏi về chính sách giao hàng, đổi trả, bảo hành nhờ cơ chế truy xuất dữ liệu ngữ nghĩa (RAG) từ cơ sở tri thức doanh nghiệp.
- **Bộ nhớ hội thoại bền vững (Persistent Memory):** Ghi nhớ thông tin khách hàng, sở thích và lịch sử trao đổi xuyên suốt các phiên trò chuyện.
- **Đa kênh đồng bộ (Omnichannel):** Hoạt động song song trên **Storefront Live Chat** (Web) và **Telegram Bot**.

### 2. ⚡ Tự động hóa vận hành & Xử lý ngoại lệ (Automated Operations)
- **Phát hiện ngoại lệ đơn hàng (Order Exception Detector):** Tự động quét và phát hiện các đơn hàng bất thường (chờ thanh toán quá lâu, chậm đóng gói, kẹt vận chuyển) dựa trên cấu hình SLA, gắn cờ cảnh báo trước khi khách hàng phàn nàn.
- **Cảnh báo tồn kho thấp (Low Inventory Alerts):** Giám sát mức tồn kho theo thời gian thực, đưa ra khuyến nghị điều chuyển hoặc nhập hàng.
- **Cổng hành động an toàn (Action Gateway & Human-in-the-loop):** Các thao tác nhạy cảm (điều chỉnh kho, hủy đơn, hoàn tiền) được kiểm soát nghiêm ngặt qua chính sách phê duyệt, ngăn chặn AI tự ý thực hiện hành động rủi ro.

### 3. 🧠 Trung tâm tri thức & Tìm kiếm ngữ nghĩa (Knowledge Hub & Semantic RAG)
- **Hỗ trợ Vector Database Qdrant:** Lưu trữ và tìm kiếm vector nhúng (vector embeddings) hiệu năng cao.
- **Đồng bộ tri thức tự động:** Hỗ trợ nạp tài liệu thủ công hoặc đồng bộ trực tiếp từ Google Docs / Google Drive.
- **Quản lý đa nhà cung cấp AI (AI Connections Vault):** Tích hợp linh hoạt các mô hình ngôn ngữ lớn hàng đầu: **OpenAI** (GPT-4o, GPT-4o-mini), **Google Gemini**, **DeepSeek**. Khóa API được mã hóa an toàn chuẩn AES-256 trong cơ sở dữ liệu.

### 4. 🛍️ Trải nghiệm thương mại & Bản địa hóa Việt Nam (Vietnam Commerce Ready)
- **Vận chuyển nội địa chuyên sâu:** Tích hợp trực tiếp với **Giao Hàng Nhanh (GHN)** và **Giao Hàng Tiết Kiệm (GHTK)** qua Shipping Hub — tự động tính phí vận chuyển thời gian thực, đẩy đơn tạo vận đơn tự động.
- **Thanh toán tự động:** Tích hợp cổng thanh toán **PayOS** và **SePay** hỗ trợ quét mã VietQR tự động xác nhận đơn hàng.
- **Storefront hiện đại:** Xây dựng trên Next.js 15 App Router, tối ưu cho thiết bị di động, hỗ trợ đăng nhập 1 chạm nhanh chóng với **Google One Tap (FedCM)**.

---

## 🏗️ Cấu trúc thư mục dự án

Dự án được tổ chức theo mô hình Monorepo (quản lý bởi `pnpm` workspace và `Turborepo`):

```text
agentic-retail-ops/
├── apps/
│   ├── backend/                  # Medusa v2.18 Core + Agentic Platform
│   │   ├── medusa-config.ts      # Cấu hình chính của Medusa (DB, Redis, CORS, Modules)
│   │   ├── src/
│   │   │   ├── admin/            # Giao diện quản trị (AI Connections, Knowledge Hub, CSKH, Shipping, Payments)
│   │   │   ├── api/              # Custom API endpoints (Store & Admin routes)
│   │   │   ├── jobs/             # Các cron jobs chạy ngầm (giám sát đơn hàng, kiểm tra SLA)
│   │   │   ├── modules/          # Custom modules (agent-operations, shipping-hub, payment-hub, ghn, ghtk, payos, sepay...)
│   │   │   ├── subscribers/      # Lắng nghe và xử lý sự kiện trong hệ thống
│   │   │   └── workflows/        # Quy trình kinh doanh chuẩn hóa của Medusa
│   │   ├── .env.template         # Mẫu biến môi trường cho backend
│   │   └── package.json
│   └── storefront/               # Ứng dụng bán hàng Next.js 15 (App Router)
│       ├── src/                  # Giao diện người dùng, giỏ hàng, checkout, chat widget
│       ├── .env.template         # Mẫu biến môi trường cho storefront
│       └── package.json
├── docker-compose.yml            # Docker Compose cho hạ tầng local (PostgreSQL, Redis, Qdrant)
├── docs/                         # Tài liệu kiến trúc và hướng dẫn kỹ thuật chi tiết
├── scripts/                      # Script tự động khởi động các dịch vụ hạ tầng
├── AGENTS.md                     # Hướng dẫn quy chuẩn mã nguồn cho AI coding agents
├── turbo.json                    # Cấu hình pipeline tác vụ Turborepo
└── package.json                  # Root package.json
```

---

## ⚙️ Yêu cầu môi trường (Prerequisites)

Trước khi tiến hành cài đặt, đảm bảo máy của bạn đã cài đặt các công cụ sau:
- **Node.js**: Phiên bản `>= 20.x`
- **pnpm**: Phiên bản `>= 10.x` (phiên bản khuyến nghị: `pnpm@10.11.1`)
- **Docker & Docker Desktop**: Đang chạy trên máy (để chạy PostgreSQL 16, Redis 7, Qdrant)
- **Git**

---

## 📝 Hướng dẫn cấu hình các file môi trường

Dự án gồm 2 file cấu hình môi trường chính nằm ở 2 ứng dụng con: `apps/backend/.env` và `apps/storefront/.env.local`.

### 1. Cấu hình Backend: `apps/backend/.env`

Tạo file `.env` từ file mẫu:
```bash
cp apps/backend/.env.template apps/backend/.env
```

Bảng giải thích chi tiết các biến môi trường quan trọng trong `apps/backend/.env`:

| Biến môi trường | Giá trị mặc định (Local) | Mô tả chi tiết |
| :--- | :--- | :--- |
| **`DATABASE_URL`** | `postgres://postgres:@localhost:5432/medusa-dtc-starter` | Chuỗi kết nối PostgreSQL (khớp với container trong `docker-compose.yml`). |
| **`STORE_CORS`** | `http://localhost:8000,https://docs.medusajs.com` | Danh sách các domain được phép truy cập Store API (phân tách bởi dấu phẩy). |
| **`ADMIN_CORS`** | `http://localhost:5173,http://localhost:9000,https://docs.medusajs.com` | Danh sách domain được phép gọi Admin API. |
| **`AUTH_CORS`** | `http://localhost:5173,http://localhost:9000,https://docs.medusajs.com` | Danh sách domain cho các endpoint xác thực/đăng nhập. |
| **`CUSTOMER_STOREFRONT_BASE_URL`** | `http://localhost:8000` | URL Storefront công khai dùng để AI tạo liên kết sản phẩm khi chat với khách hàng. |
| **`JWT_SECRET`** | `supersecret` | Khóa bí mật dùng để mã hóa JSON Web Token (đổi chuỗi ngẫu nhiên khi lên production). |
| **`COOKIE_SECRET`** | `supersecret` | Khóa bí mật ký cookie phiên làm việc. |
| **`AGENT_CREDENTIAL_ENCRYPTION_KEY`** | *(Tùy chọn / Để trống)* | Khóa bí mật AES-256 dùng để mã hóa API Key của AI và Token tích hợp trong Database. Nếu để trống, hệ thống sẽ tự sinh khóa từ `JWT_SECRET`. |
| **`REDIS_URL`** | `redis://localhost:6379` | Địa chỉ kết nối Redis cho Event Bus và Workflow Engine. |
| **`REDIS_INFRASTRUCTURE_ENABLED`** | `true` | Bật/tắt sử dụng Redis cho hạ tầng (để `true` khi chạy kèm docker-compose). |
| **`LOCKING_REDIS_URL`** | `redis://localhost:6379` | Địa chỉ Redis quản lý khóa phân tán (Distributed Locking). |
| **`QDRANT_URL`** | `http://localhost:6333` | Địa chỉ kết nối Vector Database Qdrant cho Knowledge Hub RAG. |
| **`QDRANT_COLLECTION`** | `agent_knowledge` | Tên collection lưu trữ vector nhúng tri thức trong Qdrant. |
| **`ORDER_EXCEPTION_DETECTOR_ENABLED`** | `true` | Bật/tắt cron job tự động quét phát hiện đơn hàng bị kẹt/lỗi. |
| **`ORDER_PAYMENT_SLA_MINUTES`** | `120` | Thời gian SLA tối đa (phút) chờ khách thanh toán trước khi cảnh báo. |
| **`ORDER_FULFILLMENT_SLA_MINUTES`** | `2880` | Thời gian SLA tối đa (phút, 2880m = 48h) để đóng gói và giao vận đơn. |
| **`GOOGLE_CLIENT_ID`** | *(Tùy chọn)* | Client ID của Google OAuth cho tính năng Google One Tap. |
| **`GOOGLE_CLIENT_SECRET`** | *(Tùy chọn)* | Client Secret cho Google Knowledge Connector (Google Drive / Docs). |
| **`CLOUDFLARE_TUNNEL_TOKEN`** | *(Tùy chọn)* | Token Cloudflare Tunnel khi cần mở cổng webhook công khai cho Telegram Bot trên máy local. |

> [!TIP]
> **Không cần khai báo API Key của AI hoặc Đơn vị vận chuyển vào file `.env`!**
> Các thông tin nhạy cảm như OpenAI API Key, Gemini API Key, DeepSeek API Key, Token Bot Telegram, Token GHN/GHTK, và cấu hình PayOS/SePay được nhập trực tiếp qua giao diện **Admin Dashboard** (`AI Connections`, `Customer Support`, `Shipping`, `Payments`) và được mã hóa lưu an toàn vào PostgreSQL.

---

### 2. Cấu hình Storefront: `apps/storefront/.env.local`

Tạo file `.env.local` từ file mẫu:
```bash
cp apps/storefront/.env.template apps/storefront/.env.local
```

Bảng giải thích chi tiết các biến môi trường trong `apps/storefront/.env.local`:

| Biến môi trường | Giá trị mẫu | Mô tả chi tiết |
| :--- | :--- | :--- |
| **`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`** | `pk_...` | **BẮT BUỘC.** Khóa Publishable API Key lấy từ Medusa Admin (`Cài đặt -> Publishable API Keys`). Storefront không thể gọi API backend nếu thiếu khóa này. |
| **`NEXT_PUBLIC_MEDUSA_BACKEND_URL`** | `http://localhost:9000` | Địa chỉ URL của Medusa Backend API server. |
| **`NEXT_PUBLIC_BASE_URL`** | `http://localhost:8000` | Địa chỉ URL công khai của Storefront. |
| **`NEXT_PUBLIC_DEFAULT_REGION`** | `vn` | Mã quốc gia/vùng mặc định (2 ký tự chữ thường, ví dụ: `vn` cho Việt Nam, `us` cho Mỹ). |
| **`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`** | `false` | Bật (`true`) hoặc tắt (`false`) nút đăng nhập nhanh bằng Google One Tap. |
| **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** | *(Tùy chọn)* | Client ID của Google nếu bật `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. |
| **`NEXT_PUBLIC_STRIPE_KEY`** | *(Tùy chọn)* | Publishable Key của Stripe nếu sử dụng cổng thanh toán quốc tế Stripe. |

---

## 🚀 Hướng dẫn cài đặt và khởi chạy dự án từng bước

Làm theo thứ tự các bước sau để thiết lập dự án từ đầu:

### Bước 1: Cài đặt các gói phụ thuộc (Dependencies)
Tại thư mục gốc của dự án, chạy:
```bash
pnpm install
```

### Bước 2: Khởi động các dịch vụ hạ tầng Docker
Khởi chạy cơ sở dữ liệu PostgreSQL 16, Redis 7 và Qdrant vector database:
```bash
docker compose up -d postgres redis qdrant
```
*Kiểm tra trạng thái container:*
```bash
docker compose ps
```
Đảm bảo cả 3 dịch vụ `postgres`, `redis` và `qdrant` đều ở trạng thái `Up (healthy)`.

### Bước 3: Thiết lập các file cấu hình môi trường
Tạo các file môi trường theo hướng dẫn cấu hình ở trên:
```bash
cp apps/backend/.env.template apps/backend/.env
cp apps/storefront/.env.template apps/storefront/.env.local
```

### Bước 4: Chạy database migration và tạo tài khoản Admin Medusa
Di chuyển vào thư mục backend để tạo cấu trúc bảng trong PostgreSQL và tạo tài khoản quản trị viên:
```bash
cd apps/backend

# Chạy migration khởi tạo cơ sở dữ liệu
pnpm exec medusa db:migrate

# Tạo tài khoản quản trị viên (thay email và mật khẩu của bạn)
pnpm exec medusa user -e admin@example.com -p 'AdminSecret123!'

# Quay trở lại thư mục gốc
cd ../..
```

### Bước 5 (Tùy chọn nhưng khuyến nghị): Nạp dữ liệu sản phẩm mẫu (Seed Data)
Để có sẵn dữ liệu danh mục, sản phẩm và khu vực giao hàng (Region Việt Nam - VNĐ) thử nghiệm:
```bash
pnpm --dir apps/backend run catalog:reseed-test
```
Hoặc nạp bộ dữ liệu ban đầu:
```bash
pnpm run backend:seed
```

### Bước 6: Khởi động Backend để lấy Publishable API Key
Khởi chạy riêng backend:
```bash
pnpm run backend:dev
```
1. Mở trình duyệt và truy cập vào giao diện quản trị Admin: **http://localhost:9000/app**
2. Đăng nhập bằng tài khoản admin vừa tạo ở Bước 4 (`admin@example.com` / `AdminSecret123!`).
3. Truy cập vào mục **Settings (Cài đặt) ⚙️ → Publishable API Keys**.
4. Tạo một khóa mới (hoặc sao chép khóa mặc định có sẵn) và liên kết với Sales Channel mặc định.
5. Mở file `apps/storefront/.env.local` và dán khóa vừa copy vào:
   ```env
   NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_xxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Quay lại terminal backend và bấm `Ctrl + C` để dừng tiến trình backend.

### Bước 7: Khởi chạy toàn bộ hệ thống (Full Stack)
Bây giờ bạn có thể khởi chạy đồng thời cả Backend và Storefront chỉ bằng một câu lệnh duy nhất từ thư mục gốc:
```bash
pnpm dev
```

> [!NOTE]
> Lệnh `pnpm dev` sẽ tự động kiểm tra Docker Desktop và khởi động các container hạ tầng (Postgres, Redis, Qdrant) nếu chưa chạy trước khi khởi động ứng dụng.

Sau khi khởi chạy thành công:
- 🌐 **Storefront (Khách hàng):** [http://localhost:8000](http://localhost:8000)
- ⚙️ **Backend API & Admin Dashboard:** [http://localhost:9000/app](http://localhost:9000/app)
- 🗄️ **Qdrant Vector DB REST API:** [http://localhost:6333](http://localhost:6333)

*(Nếu muốn chạy riêng rẽ từng app trong 2 cửa sổ terminal khác nhau: dùng lệnh `pnpm run backend:dev` và `pnpm run storefront:dev`)*.

---

## 🎯 Cấu hình AI & Các tính năng tích hợp sau khi chạy

Sau khi đăng nhập vào **Admin Dashboard (http://localhost:9000/app)**, bạn có thể kích hoạt các tính năng nâng cao:

### 1. Cấu hình Nhà cung cấp AI (AI Connections)
- Truy cập menu **AI Connections**.
- Nhập API Key của nhà cung cấp bạn muốn sử dụng:
  - **OpenAI:** Khóa API (`sk-...`), chọn model `gpt-4o` hoặc `gpt-4o-mini`.
  - **Google Gemini:** Khóa Gemini API, chọn model `gemini-1.5-pro` hoặc `gemini-1.5-flash`.
  - **DeepSeek:** Khóa DeepSeek API (`sk-...`), chọn model `deepseek-chat`.
- Thiết lập thứ tự ưu tiên mô hình (Fallback Priority). Tất cả khóa đều được mã hóa lưu an toàn vào cơ sở dữ liệu.

### 2. Nạp tri thức vào Knowledge Hub (RAG)
- Truy cập menu **Knowledge Hub**.
- Tải lên tài liệu chính sách cửa hàng, hướng dẫn sử dụng sản phẩm hoặc quy định bảo hành (.txt, .md, .pdf, .docx).
- Nhấn **Sync / Reindex** để hệ thống tự động băm nhỏ (chunking), tạo vector embeddings và lưu vào Qdrant. Trợ lý AI sẽ lập tức sử dụng tri thức này để trả lời khách hàng.

### 3. Cấu hình Bot Telegram CSKH
- Tạo Bot trên Telegram thông qua `@BotFather` để lấy Bot Token.
- Truy cập menu **Customer Support** trên Admin và dán Bot Token vào.
- Để nhận Webhook trên môi trường Local, bạn có thể kích hoạt Cloudflare Tunnel:
  ```bash
  pnpm run tunnel:up
  pnpm run agent:configure-telegram
  ```
  *(Xem hướng dẫn chi tiết tại [docs/TELEGRAM_CLOUDFLARE_TUNNEL.md](docs/TELEGRAM_CLOUDFLARE_TUNNEL.md))*.

### 4. Cấu hình Vận chuyển (GHN / GHTK)
- Truy cập menu **Shipping Hub**.
- Cấu hình thông tin API Token, Shop ID của Giao Hàng Nhanh (hỗ trợ cả môi trường Sandbox và Production).
- Thiết lập địa chỉ kho gửi hàng để tính phí ship động chính xác theo quận/huyện/tỉnh thành.

### 5. Cấu hình Cổng thanh toán (PayOS / SePay)
- Truy cập menu **Payments**.
- Nhập Client ID, API Key, Checksum Key của PayOS hoặc thông tin webhook SePay để kích hoạt thanh toán tự động qua mã VietQR.

---

## 🛠️ Các lệnh tiện ích thường dùng (Common Commands)

### Quản lý phát triển & Build
```bash
# Khởi chạy cả hệ thống (Backend + Storefront)
pnpm dev

# Khởi chạy riêng Backend
pnpm run backend:dev

# Khởi chạy riêng Storefront
pnpm run storefront:dev

# Build toàn bộ workspace
pnpm run build

# Kiểm tra quy chuẩn mã nguồn (Linting)
pnpm run lint
```

### Kiểm thử (Testing)
```bash
# Chạy Unit tests cho backend
pnpm --dir apps/backend run test:unit

# Chạy Integration tests cho các module
pnpm --dir apps/backend run test:integration:modules

# Chạy HTTP API tests (yêu cầu PostgreSQL đang chạy)
pnpm --dir apps/backend run test:integration:http
```

### Vận hành & Xác minh AI Agents
```bash
# Kiểm tra nền tảng Agent Foundation & Tools
pnpm --dir apps/backend run agent:verify-platform

# Chạy quét ngoại lệ đơn hàng thủ công
pnpm --dir apps/backend run agent:scan-order-detector

# Đồng bộ & đánh chỉ mục lại tri thức cho Vector DB
pnpm --dir apps/backend run agent:reindex-knowledge

# Kiểm tra module kết nối vận chuyển GHN
pnpm --dir apps/backend run verify:ghn

# Kiểm tra module thanh toán PayOS
pnpm --dir apps/backend run verify:payos
```

### Quản lý Docker & Dọn dẹp
```bash
# Dừng các dịch vụ hạ tầng (dữ liệu Postgres/Redis/Qdrant vẫn được giữ trong Docker Volume)
docker compose down

# Dừng và xóa toàn bộ dữ liệu Volume nếu muốn làm sạch môi trường từ đầu
docker compose down -v
```

---

## 📄 Bản quyền (License)

Dự án được phát hành theo giấy phép [MIT License](LICENSE).
