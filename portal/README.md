# Pellora Portal (MERN)

Sells the Python skin-analysis engine as an API: landing, pricing, docs, signup/login,
API keys, usage metering, Cashfree billing, and a camera playground with auto-capture.

```
customer app --X-API-Key--> Express gateway (:4000) --ENGINE_KEY--> Python engine (:8000, private)
browser (React) ----------> Express (:4000)  /api/*   (cookie session)
```

## Run (development)
```bash
# 1. MongoDB
mongod --dbpath ~/data-skin-db --bind_ip 127.0.0.1
# 2. Python engine (reads ../.env: SKIN_API_KEYS must equal ENGINE_KEY below)
cd .. && source .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --env-file .env
# 3. Portal API
cd portal/server && cp .env.example .env   # first time; then edit
npm install && npm run dev
# 4. React app (hot reload)  ->  http://localhost:5173
cd portal/client && npm install && npm run dev
```

## Run (production, single server)
```bash
cd portal/client && npm run build        # Express serves client/dist
cd ../server && NODE_ENV=production npm start   # http://localhost:4000
```
Put it behind HTTPS (nginx/Caddy/Cloudflare). Production refuses to start without a strong `JWT_SECRET`.

## Payments (Cashfree)
Set `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` and `CASHFREE_ENV` (`sandbox` for test keys, `production` for live keys)
in `server/.env` (on the live server: `/opt/pellora/.env`, then `docker compose up -d server`).
Without keys the portal runs a **test mode** where "Upgrade" activates a plan with no payment (disabled in production).
Every payment is confirmed server-side with Cashfree before a plan is activated. Webhook (recommended, so a plan
activates even if the customer closes the tab): Cashfree dashboard -> Developers -> Webhooks ->
`https://apipellora.cmcloud.online/api/billing/webhook`, event `PAYMENT_SUCCESS_WEBHOOK`.

## Edit plans / prices
`server/src/plans.js` (INR, scan limits, rate limits, AI access). Brand name: `client/src/components/Layout.jsx`
and `BRAND_NAME` / `index.html`. The contact email shown on the site is `SALES_EMAIL` in `client/src/brand.js`.

## Rules implemented
- Keys are stored hashed (SHA-256); the full key is shown once.
- Quota is a per-month atomic counter; failed scans (bad photo, engine error) are refunded.
- Paid plans last 30 days then fall back to Free. Payments are idempotent (verify + webhook safe).
- HTTP 402 when the quota is used up, 429 on per-minute rate limit, 403 for AI on lower plans.
