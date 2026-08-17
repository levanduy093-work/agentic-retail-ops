# Synapse DTC Starter & Agentic Retail Ops

Monorepo gồm Medusa backend/Admin, Next.js storefront, PostgreSQL, Redis và
Qdrant. Cần Node.js 20+, pnpm 10+ và Docker Desktop.

## Chạy local

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

Lấy Publishable API Key trong Admin (`Settings → Publishable API Keys`), rồi
điền vào `apps/storefront/.env.local`:

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
  CORS, feature flags, Google/Knowledge Hub, Telegram và live shipping status.
- [Storefront template](apps/storefront/.env.template): URL backend, region,
  publishable key, Google One Tap và Stripe.

`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` là biến bắt buộc cho storefront. Đổi
`JWT_SECRET`, `COOKIE_SECRET` và `AGENT_CREDENTIAL_ENCRYPTION_KEY` trước khi
deploy. Chỉ cấu hình `TELEGRAM_*`, `CLOUDFLARE_TUNNEL_TOKEN` và Google OAuth khi
cần dùng các tích hợp tương ứng.

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
