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

> The OAuth consent screen is **published** (External user type, non-sensitive scopes). Anyone with a Google account can attempt to sign in — our DB-backed invite list is the actual access control. No Test Users list needed.

1. Open https://console.cloud.google.com.
2. Top-left project picker → **New Project** → name it `TMC Tech Hub`.
3. Left nav → **APIs & Services** → **OAuth consent screen** → click **Get started**.
   - User type: **External** (required because some users have personal Gmail).
   - App name: `TMC Tech Hub`
   - User support email: your email
   - Developer contact: your email
   - Save.
4. **Publish the app** — OAuth consent screen → "Publish app" → confirm. Scopes (`openid email profile`) are non-sensitive, so no verification required.
5. Left nav → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**
   - Name: `TMC Tech Hub`
   - Authorized JavaScript origins:
     - `https://portal.tmctechhub.com`
     - `https://tmc-intranet.pages.dev`
   - Authorized redirect URIs:
     - `https://portal.tmctechhub.com/auth/callback`
     - `https://tmc-intranet.pages.dev/auth/callback` *(useful for testing on the .pages.dev URL)*
   - Click **Create**.
6. Copy the **Client ID** and **Client Secret** — paste them into Cloudflare in step 4.

> **Why this is safe:** any random person can complete Google's OAuth dance, but our `/auth/callback` checks the `users` table and rejects unknown emails. The DB is the gate.

## 4. Cloudflare D1 — create database and apply migrations

The `users` table doubles as the invite list. To "invite" someone, an admin inserts a row with their email + role. They can then sign in with Google.

### One-time D1 setup

```bash
# In the project root:
npx wrangler login              # authenticate (opens browser)
npm run db:create               # creates D1, prints database_id
```

The output looks like:
```
[[d1_databases]]
binding = "DB"
database_name = "tmc-intranet-db"
database_id = "abc-def-1234-..."
```

**Copy the `database_id`** and paste it into `wrangler.toml` (replace `PASTE_DATABASE_ID_HERE`). Commit this — the ID is not a secret.

### Apply the schema migration

```bash
npm run db:migrate:remote    # applies migrations/0001_create_users.sql to production D1
```

You should see `✓ migrations applied`. The `users` table now exists in your D1.

### Bootstrap the first admin

This is the only way the first admin gets created — there's no UI for it yet (Stage 5).

```bash
npm run db:console -- "INSERT INTO users (email, role) VALUES ('YOUR_EMAIL@marketingtmc.com', 'admin')"
```

Replace `YOUR_EMAIL@marketingtmc.com` with your real email. Repeat for each team member (use `'user'` instead of `'admin'` for non-admins, or just leave the role default).

To list users:
```bash
npm run db:console -- "SELECT id, email, role, last_signed_in FROM users"
```

To remove someone:
```bash
npm run db:console -- "DELETE FROM users WHERE email = 'someone@example.com'"
```

## 5. Cloudflare — set the auth env vars

In Cloudflare Pages → `tmc-intranet` → **Settings** → **Variables and Secrets** → **Add**:

| Type        | Name                   | Value                                          |
|-------------|------------------------|------------------------------------------------|
| Plaintext   | `GOOGLE_CLIENT_ID`     | _from Google Cloud step 5_                     |
| Plaintext   | `NODE_VERSION`         | `22` (already set in step 1)                   |
| Secret      | `GOOGLE_CLIENT_SECRET` | _from Google Cloud step 5_                     |
| Secret      | `SESSION_SECRET`       | random string — generate with command below   |

Generate `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the output and paste it as the `SESSION_SECRET` value. **Don't share or commit this.**

After saving, **redeploy** the project (Deployments → ⋯ → Retry deployment). Env vars only apply to new deploys.

## 6. Test the auth flow

1. Open `https://portal.tmctechhub.com` (or `https://tmc-intranet.pages.dev`) in an incognito window.
2. You should see the "Sign in with Google" button.
3. Click it → Google login → pick the account you bootstrapped in step 4 → redirects back to home.
4. You should see "Welcome, [your first name]" with your avatar in the top right.
5. Try signing in with a Google account that **isn't** in the `users` table — you should get "isn't on the TMC Tech Hub invite list" error.
6. Click **Sign out** in the header — should return to the sign-in page.

If anything fails, check Cloudflare Pages → Deployments → latest → **Functions logs** for errors.

## 7. Adding new team members later

Single step: add them via the Admin → Users panel (or directly via SQL):
```bash
npm run db:console -- "INSERT INTO users (email, role) VALUES ('newperson@example.com', 'user')"
```

They can now sign in with their Google account. After they sign in once, their name and profile picture auto-populate. (No more Test Users list to manage — the OAuth consent screen is published.)

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
```

Then run `npm run db:migrate:local` to apply the schema to a local SQLite emulator (Miniflare).
