# Setup guide

Steps Nick needs to run once in the Cloudflare and Google Workspace dashboards. Most of these only need to happen once per project.

---

## 1. Connect GitHub repo to Cloudflare Pages

1. Open https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize the Cloudflare GitHub app for `nickbrosetmc/tmc-intranet` (only this repo, not the whole account).
3. Configure build:
   - **Project name:** `tmc-intranet`
   - **Production branch:** `main`
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 22 (set under Environment variables → `NODE_VERSION = 22`)
4. Click **Save and Deploy**. First build takes ~2 minutes.

After it deploys you'll get a URL like `https://tmc-intranet.pages.dev` — open it and verify the TMC landing page renders.

## 2. Add the custom domain

1. In Cloudflare Pages → your `tmc-intranet` project → **Custom domains** → **Set up a custom domain**.
2. Enter `hub.tmctechhub.com` (or whichever subdomain we agreed on).
3. **Prerequisite:** `tmctechhub.com` must be a zone in your Cloudflare account. If it isn't:
   - Go to **Websites** → **Add a domain** → enter `tmctechhub.com`
   - Cloudflare will give you two nameservers — update them at your registrar (likely GoDaddy/Namecheap)
   - DNS propagation takes 5–60 minutes
   - Then come back and add the custom domain to Pages
4. Cloudflare auto-creates the CNAME and provisions an SSL cert.

## 3. Stage 2 — Cloudflare Access (next PR)

Once the site is live on the custom domain, we'll set up Zero Trust:

1. https://one.dash.cloudflare.com → enable Zero Trust (free plan, 50 users).
2. **Settings → Authentication** → add Google as identity provider (uses Google Workspace).
3. **Access → Applications** → **Add an application** → **Self-hosted**:
   - App name: TMC Tech Hub
   - Domain: `hub.tmctechhub.com`
   - Identity provider: Google
   - Access policy: emails ending in `@marketingtmc.com`
4. After setup, hitting the domain redirects to Google login first, then serves the app.

## 4. Stage 3 — D1 database (next PR)

```bash
npx wrangler login
npx wrangler d1 create tmc-intranet-db
# → outputs database_id, paste into wrangler.toml
```

Then we run schema migrations and seed the apps.

---

## Useful commands

```bash
npm run dev                              # local dev (frontend only)
npm run build                            # production build
npx wrangler pages dev -- npm run dev    # local dev with Pages Functions
npx wrangler pages deploy dist           # manual deploy bypassing GitHub
npx wrangler tail                        # stream production logs
```
