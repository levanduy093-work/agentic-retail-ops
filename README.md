# Synapse DTC Starter & Agentic Retail Ops

Monorepo gồm Medusa backend/Admin, Next.js storefront, PostgreSQL, Redis và
Qdrant. Cần Node.js 20+, pnpm 10+ và Docker Desktop.

## Chạy local lần đầu

```bash
git clone https://github.com/levanduy093-work/agentic-retail-ops.git
cd agentic-retail-ops
pnpm install

# PostgreSQL :5432, Redis :6379, Qdrant :6333
docker compose up -d postgres redis qdrant

# Mỗi file local chỉ tạo một lần; không commit các file này.
cp apps/backend/.env.template apps/backend/.env
cp apps/storefront/.env.template apps/storefront/.env.local

cd apps/backend
pnpm exec medusa db:migrate
pnpm exec medusa user -e admin@example.com -p 'choose-a-strong-password'
cd ../..
```

Khởi động backend trước:

```bash
pnpm run backend:dev
```

Mở http://localhost:9000/app, đăng nhập bằng tài khoản vừa tạo, vào
`Settings → Publishable API Keys` để tạo hoặc lấy key. Điền key vào
`apps/storefront/.env.local`, sau đó dừng backend (`Ctrl+C`) nếu muốn chạy cả
hai app bằng một lệnh:

```env
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_your_key_here
```

Khởi động cả backend và storefront:

```bash
pnpm dev
```

- Storefront: http://localhost:8000
- Backend API và Admin: http://localhost:9000/app

Hoặc chạy riêng `pnpm run backend:dev` hay `pnpm run storefront:dev`.

## Cấu hình môi trường

Hai template có sẵn cấu hình Docker local:

- [Backend template](apps/backend/.env.template): database, Redis, Qdrant,
  CORS, feature flags, Google/Knowledge Hub và Telegram.
- [Storefront template](apps/storefront/.env.template): URL backend, region,
  publishable key, Google One Tap và Stripe.

Local Docker dùng sẵn các giá trị mặc định trong template. Các key bắt buộc để
backend chạy là `DATABASE_URL`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`,
`JWT_SECRET`, `COOKIE_SECRET`, `REDIS_URL` và
`REDIS_INFRASTRUCTURE_ENABLED`; chỉ cần thay khi hạ tầng hoặc origin khác local.
`NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL` và
`NEXT_PUBLIC_DEFAULT_REGION` phải phản ánh URL/region storefront thực tế.
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` là biến bắt buộc cho storefront.

Trước khi deploy, đổi `JWT_SECRET`, `COOKIE_SECRET` và
`AGENT_CREDENTIAL_ENCRYPTION_KEY`; đặt `CUSTOMER_STOREFRONT_BASE_URL` là origin
HTTPS storefront và thêm đúng origin đó vào `STORE_CORS`. Chỉ cấu hình
`TELEGRAM_*`, `CLOUDFLARE_TUNNEL_TOKEN` và Google OAuth khi cần các tích hợp
tương ứng.

API key của AI và cấu hình/token hãng vận chuyển được quản lý qua Admin
(`AI Connections` và `Shipping Hub`) và được lưu mã hóa trong PostgreSQL; không
đưa chúng vào Git hoặc template.

## Lệnh thường dùng

```bash
pnpm run build                         # build toàn bộ workspace
pnpm run lint                          # lint toàn bộ workspace
pnpm --dir apps/backend run test:unit  # test unit backend
pnpm --dir apps/backend run test:integration:http  # test HTTP (cần PostgreSQL)
pnpm --dir apps/backend run catalog:reseed-test  # seed catalog demo (tùy chọn)
```

Khi dừng hạ tầng local, dùng `docker compose down`. Dữ liệu PostgreSQL/Redis/
Qdrant được Docker giữ lại trong volumes.
