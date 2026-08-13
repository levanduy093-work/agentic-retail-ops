# Telegram webhook through Cloudflare Tunnel

This setup runs only the Cloudflare connector in Docker. The Medusa backend
continues to run on the Mac at `http://localhost:9000`. The connector reaches
it from Docker through `http://host.docker.internal:9000`.

## 1. Create the remotely managed tunnel

1. Open Cloudflare Dashboard.
2. Go to **Networking > Tunnels**.
3. Select **Create tunnel** and choose **Cloudflared**.
4. Name it `synapse-telegram`.
5. Select the Docker environment.
6. Copy only the `eyJ...` value after `--token`. Treat it as a secret.

Do not paste the complete Docker command into the terminal because that would
store the tunnel token in shell history.

## 2. Store the token in the backend environment

Edit `apps/backend/.env` and set the tunnel token:

```env
CLOUDFLARE_TUNNEL_TOKEN=eyJ...
```

The existing backend `.env` is already ignored by Git. Docker Compose reads
this file for interpolation but passes only `CLOUDFLARE_TUNNEL_TOKEN` into the
connector as `TUNNEL_TOKEN`; other backend and Telegram secrets are not exposed
to the cloudflared container. No Cloudflare certificate or tunnel token is
stored in a Docker volume.

## 3. Publish the webhook hostname

Open the `synapse-telegram` tunnel in Cloudflare Dashboard and add a
**Published application** route:

- Subdomain: `telegram-api`
- Domain: the store domain
- Path: `^/webhooks/agent-operations/telegram/.*$`
- Service type: `HTTP`
- Service URL: `host.docker.internal:9000`

The resulting public base URL is similar to:

```text
https://telegram-api.example.com
```

Do not put this webhook route behind Cloudflare Access authentication because
Telegram cannot complete an interactive Access login. The application verifies
Telegram's webhook secret itself.

## 4. Start and inspect the connector

Start the Medusa backend first:

```bash
pnpm run backend:dev
```

Then start only the tunnel profile:

```bash
pnpm run tunnel:up
pnpm run tunnel:status
pnpm run tunnel:logs
```

Cloudflare Dashboard should report the connector as Healthy.

## 5. Register the Telegram webhook

Set this key in `apps/backend/.env` using the real hostname, without a trailing
slash:

```env
TELEGRAM_PUBLIC_BASE_URL=https://telegram-api.example.com
```

Register or refresh the webhook:

```bash
pnpm run agent:configure-telegram
```

Keep the backend and `cloudflared` container running while testing Telegram.

## 6. Remove the local connector

Stop and remove only the tunnel container:

```bash
pnpm run tunnel:down
```

This does not stop or delete PostgreSQL, Redis, Qdrant, or their volumes. Clear
`CLOUDFLARE_TUNNEL_TOKEN` in `apps/backend/.env` to remove the local token. To
revoke remote access too, delete the Published application/DNS route and the
tunnel in Cloudflare Dashboard.
