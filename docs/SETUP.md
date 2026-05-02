# Setup guide

Steps Nick needs to run once in the Cloudflare and Google dashboards. Most of these only need to happen once per project.

---

## 1. Cloudflare Pages — connect repo

1. Open https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize the Cloudflare GitHub app for `nickbrosetmc/tmc-intranet` (only this repo).
3. Configure build:
   - **Project name:** `tmc-intranet`
   - **Production branch:** `main`
   - **Framework preset:** None (or Vite if listed)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Add env var `NODE_VERSION = 22` (Settings → Variables and Secrets)
4. Click **Save and Deploy**.

After it deploys you'll get `https://tmc-intranet.pages.dev` — open and verify the TMC landing page renders.

## 2. Custom domain — `portal.tmctechhub.com`

DNS for `tmctechhub.com` is hosted in **GoHighLevel**, not Cloudflare (because GHL serves `app.tmctechhub.com` to clients).

1. **In GHL** → DNS settings for `tmctechhub.com` → add CNAME:
   ```
   Name:   portal
   Type:   CNAME
   Value:  tmc-intranet.pages.dev
   TTL:    auto / 300
   ```
2. **In Cloudflare Pages** → `tmc-intranet` → **Custom domains** → **Set up a custom domain** → `portal.tmctechhub.com`.
3. Cloudflare validates the CNAME and provisions SSL (~1–2 minutes).
4. Hit `https://portal.tmctechhub.com` — should serve the same landing page.

> **Note:** Because DNS isn't in Cloudflare, we **cannot** use Cloudflare Access. Auth is handled by our own Google OAuth flow (see step 3).

## 3. Google OAuth — set up the OAuth client

1. Open https://console.cloud.google.com (use a Google account with admin rights on the `marketingtmc.com` Workspace, or just any Google account works for client setup).
2. Top-left project picker → **New Project** → name it `TMC Tech Hub`. Pick the existing TMC org if visible.
3. Left nav → **APIs & Services** → **OAuth consent screen** → click **Get started**.
   - User type: **Internal** (only marketingtmc.com users — this is the right choice).
   - App name: `TMC Tech Hub`
   - User support email: your email
   - Developer contact: your email
   - Save.
4. Left nav → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**
   - Name: `TMC Tech Hub`
   - Authorized JavaScript origins:
     - `https://portal.tmctechhub.com`
     - `https://tmc-intranet.pages.dev`
   - Authorized redirect URIs:
     - `https://portal.tmctechhub.com/auth/callback`
     - `https://tmc-intranet.pages.dev/auth/callback` *(useful for testing on the .pages.dev URL)*
   - Click **Create**.
5. Copy the **Client ID** and **Client Secret** — paste them into Cloudflare in step 4.

## 4. Cloudflare — set the auth env vars

In Cloudflare Pages → `tmc-intranet` → **Settings** → **Variables and Secrets** → **Add**:

| Type        | Name                 | Value                                                |
|-------------|----------------------|------------------------------------------------------|
| Plaintext   | `GOOGLE_CLIENT_ID`   | _from Google Cloud step 4_                           |
| Plaintext   | `ALLOWED_DOMAIN`     | `marketingtmc.com`                                   |
| Plaintext   | `NODE_VERSION`       | `22` (already set in step 1)                         |
| Secret      | `GOOGLE_CLIENT_SECRET` | _from Google Cloud step 4_                         |
| Secret      | `SESSION_SECRET`     | random string — generate with command below         |

Generate `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the output and paste it as the `SESSION_SECRET` value. **Don't share or commit this.**

After saving, **redeploy** the project (Deployments → ⋯ → Retry deployment). Env vars only apply to new deploys.

## 5. Test the auth flow

1. Open `https://portal.tmctechhub.com` (or `https://tmc-intranet.pages.dev`) in an incognito window.
2. You should see the "Sign in with Google" button.
3. Click it → Google login → pick your `@marketingtmc.com` account → redirects back to home.
4. You should see "Welcome, [your first name]" with your avatar in the top right.
5. Click **Sign out** in the header — should return to the sign-in page.

If anything fails, check Cloudflare Pages → Deployments → latest → **Functions logs** for errors.

## 6. Stage 3 — D1 database (next PR)

```bash
npx wrangler login
npx wrangler d1 create tmc-intranet-db
# → outputs database_id, paste into wrangler.toml
```

Then we run schema migrations and seed the apps.

---

## Useful commands

```bash
npm run dev                              # local dev (frontend only, no Functions)
npm run build                            # production build
npx wrangler pages dev -- npm run dev    # local dev WITH Pages Functions
npx wrangler pages deploy dist           # manual deploy bypassing GitHub
npx wrangler tail tmc-intranet           # stream production logs
```

For local dev with Pages Functions, create a `.dev.vars` file in the repo root (gitignored):

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
ALLOWED_DOMAIN=marketingtmc.com
```
