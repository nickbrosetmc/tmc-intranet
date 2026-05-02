# TMC Tech Hub

Internal launchpad for TMC Marketing — a single page that lets the team open every tool we use (Teams, Canva, GoHighLevel, Drive, ChatGPT, etc.) with one click.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind v4 + shadcn/ui
- **Hosting:** Cloudflare Pages
- **Backend:** Cloudflare Pages Functions (in `functions/`)
- **Database:** Cloudflare D1 (added in stage 3)
- **Auth:** Cloudflare Access (Google Workspace SSO, added in stage 2)

## Local development

```bash
npm install
npm run dev      # Vite dev server (frontend only, no Pages Functions)
```

To run with Pages Functions (D1 + auth simulation), once those are wired up:

```bash
npx wrangler pages dev -- npm run dev
```

## Deployment

Pushing to `main` deploys automatically once the GitHub repo is connected to Cloudflare Pages.

- Build command: `npm run build`
- Build output: `dist`

## Project structure

```
src/             React app
functions/       Cloudflare Pages Functions (API routes)
public/          Static assets served as-is
wrangler.toml    Cloudflare config (D1 bindings, vars)
```
