# Synapse DTC Starter & Agentic Retail Ops

A monorepo featuring a Medusa backend/Admin, Next.js storefront, PostgreSQL, Redis, and Qdrant. Requires Node.js 20+, pnpm 10+, and Docker Desktop.

## First-time Local Setup

```bash
git clone https://github.com/levanduy093-work/agentic-retail-ops.git
cd agentic-retail-ops
pnpm install

# PostgreSQL :5432, Redis :6379, Qdrant :6333
docker compose up -d postgres redis qdrant

# Create each local env file once; do not commit these files.
cp apps/backend/.env.template apps/backend/.env
cp apps/storefront/.env.template apps/storefront/.env.local

cd apps/backend
pnpm exec medusa db:migrate
pnpm exec medusa user -e admin@example.com -p 'choose-a-strong-password'
cd ../..
```

Start the backend first:

```bash
pnpm run backend:dev
```

Open http://localhost:9000/app, log in with the newly created account, and navigate to `Settings → Publishable API Keys` to create or copy a key. Fill the key into `apps/storefront/.env.local`, then stop the backend (`Ctrl+C`) if you want to run both apps with a single command:

```env
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_your_key_here
```

Start both backend and storefront:

```bash
pnpm dev
```

- Storefront: http://localhost:8000
- Backend API and Admin: http://localhost:9000/app

Alternatively, run each service separately using `pnpm run backend:dev` or `pnpm run storefront:dev`.

## Environment Configuration

Two templates are pre-configured for local Docker environments:

- [Backend template](apps/backend/.env.template): database, Redis, Qdrant, CORS, feature flags, Google/Knowledge Hub, and Telegram.
- [Storefront template](apps/storefront/.env.template): backend URL, region, publishable key, Google One Tap, and Stripe.

Local Docker works out-of-the-box with the default template values. The required environment variables for the backend are `DATABASE_URL`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `JWT_SECRET`, `COOKIE_SECRET`, `REDIS_URL`, and `REDIS_INFRASTRUCTURE_ENABLED`; modify these only when your infrastructure or origins differ from local defaults.
`NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, and `NEXT_PUBLIC_DEFAULT_REGION` must reflect the actual storefront URL/region.
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is required for the storefront.

Before deploying to production, update `JWT_SECRET`, `COOKIE_SECRET`, and `AGENT_CREDENTIAL_ENCRYPTION_KEY`; set `CUSTOMER_STOREFRONT_BASE_URL` to your production HTTPS storefront origin and add that exact origin to `STORE_CORS`. Only configure `TELEGRAM_*`, `CLOUDFLARE_TUNNEL_TOKEN`, and Google OAuth when those integrations are needed.

AI API keys and shipping carrier configurations/tokens are managed securely through the Admin dashboard (`AI Connections` and `Shipping Hub`) and stored encrypted in PostgreSQL; do not commit them to Git or add them to `.env` templates.

## Common Commands

```bash
pnpm run build                         # build the entire workspace
pnpm run lint                          # lint the entire workspace
pnpm --dir apps/backend run test:unit  # run backend unit tests
pnpm --dir apps/backend run test:integration:http  # run HTTP tests (requires PostgreSQL)
pnpm --dir apps/backend run catalog:reseed-test  # seed demo catalog (optional)
```

To stop local infrastructure services, run `docker compose down`. PostgreSQL, Redis, and Qdrant data are preserved in Docker volumes.
