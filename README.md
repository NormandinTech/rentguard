# RentGuard AI — Complete Deployment Guide

> Your AI property manager. Always on.
> Built for landlords with 1–10 units.

---

## Product Overview

RentGuard AI is an AI-first property management platform with 5 core modules:
1. **AI Assistant** — Ask any landlord question, 24/7
2. **Maintenance Triage** — Urgency level, cost estimate, tenant message, vendor type
3. **Tenant Screening** — Fair Housing-compliant scoring with consistent criteria
4. **Cash Flow Analyzer** — NOI, cap rate, cash-on-cash, recommendations
5. **Lease Tools** — 10 professional document templates generated instantly

---

## Project Structure

```
rentguard/
├── landing/index.html       ← Launch page
├── app/index.html           ← PWA application
├── backend/
│   ├── server.js            ← Express API (Railway)
│   ├── package.json
│   └── railway.toml
├── pwa/
│   ├── manifest.json        ← PWA manifest
│   └── sw.js                ← Service worker
└── README.md
```

---

## Deploy in 4 steps

### Step 1 — Railway backend

1. Push `backend/` to a new GitHub repo: `rentguard-api`
2. railway.app → New Project → Deploy from GitHub
3. Add environment variables:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - `ADMIN_SECRET` = random string for key generation
   - `NODE_ENV` = `production`
4. Copy your Railway URL — e.g. `https://rentguard-api.up.railway.app`

### Step 2 — Update API URL in app

In `app/index.html`, find:
```js
const API = 'https://rentguard-api.up.railway.app';
```
Replace with your Railway URL.

### Step 3 — Deploy frontend

Push these files to GitHub Pages or Vercel:
```
/rentguard/
  landing/index.html → serves as /rentguard/index.html
  app/index.html     → serves as /rentguard/app/index.html
  pwa/manifest.json  → serves as /rentguard/manifest.json
  pwa/sw.js          → serves as /rentguard/sw.js
  icons/             → PWA icons (generate at realfavicongenerator.net)
```

### Step 4 — Gumroad products

Create 3 products:

| Product | Price | Key prefix | Units |
|---------|-------|-----------|-------|
| RentGuard Starter | $19/mo | RG-STAR- | 3 |
| RentGuard Landlord | $39/mo | RG-LAND- | 10 |
| RentGuard Portfolio | $79/mo | RG-PORT- | unlimited |

**Generate keys via API:**
```bash
curl -X POST https://your-url/api/admin/generate-key \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"tier":"landlord","units":10,"name":"Jane Smith"}'
```

**Add keys directly to server.js:**
```js
const KEY_DB = new Map([
  ['RG-DEMO-00000000', { tier: 'landlord', units: 3, name: 'Demo', active: true }],
  ['RG-STAR-A1B2C3D4', { tier: 'starter', units: 3, name: 'John D.', active: true }],
]);
```

---

## Demo key

`RG-DEMO-00000000` — pre-loaded in the app for testing.

---

## Pricing logic

| Tier | Price | Units | Monthly AI queries |
|------|-------|-------|--------------------|
| Starter | $19 | 1–3 | 100 |
| Landlord | $39 | 1–10 | Unlimited |
| Portfolio | $79 | Unlimited | Unlimited, priority |

---

## API cost estimate

Each module makes 1 Claude API call. At Sonnet pricing (~$0.003/call):
- 50 users × avg 40 queries/mo = 2,000 calls = ~$6/mo
- Revenue at 50 users (avg $39/user) = ~$1,950 MRR
- API costs: < 0.5% of revenue

---

## Launch checklist

- [ ] Backend deployed to Railway
- [ ] API URL updated in app/index.html
- [ ] Frontend deployed (GitHub Pages or Vercel)
- [ ] PWA icons generated and placed in /rentguard/icons/
- [ ] manifest.json linked in app/index.html
- [ ] sw.js registered in app/index.html
- [ ] Demo key RG-DEMO-00000000 tested end-to-end
- [ ] All 5 modules tested (assistant, maintenance, screening, cashflow, lease)
- [ ] Mobile PWA install tested on Android Chrome
- [ ] Gumroad Starter ($19) product created
- [ ] Gumroad Landlord ($39) product created
- [ ] Gumroad Portfolio ($79) product created
- [ ] Launch posts written for r/landlord, BiggerPockets, REI Facebook groups

---

## Key differences from PropScribe

- **Different market**: landlords vs real estate agents
- **Different API port**: use 3002 to avoid conflicts if running locally
- **Different key prefix**: RG- instead of PS-
- **Different Gumroad**: separate seller profile or separate products

Both products share the same Anthropic API key and Railway account structure.
