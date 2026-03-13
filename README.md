# PostForge AI

[![Live Demo](https://img.shields.io/badge/Live%20Demo-postforge--ai.vercel.app-black?logo=vercel)](https://postforge-ai.vercel.app)
[![CI](https://github.com/mouadhhhallem/postforge-ai/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/mouadhhhallem/postforge-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/mouadhhhallem/postforge-ai?style=social)](https://github.com/mouadhhhallem/postforge-ai/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/mouadhhhallem/postforge-ai?style=social)](https://github.com/mouadhhhallem/postforge-ai/network/members)

[![PostForge AI website preview](public/images/preview.png)](https://postforge-ai.vercel.app)

PostForge AI is a modern SaaS marketing site and dashboard prototype for an AI-powered social media content generator. The site is designed for startups, creators, agencies, gyms, and ecommerce brands that want to generate posts, captions, ad copy, and promotions faster.

## Live Demo

- Website: https://postforge-ai.vercel.app
- Repository: https://github.com/mouadhhhallem/postforge-ai
- Community hub: https://postforge-ai.vercel.app/community
- GitHub discussions: https://github.com/mouadhhhallem/postforge-ai/discussions
- Good first issues: https://github.com/mouadhhhallem/postforge-ai/labels/good%20first%20issue

## Play With The Code

- Open in GitHub Codespaces: https://codespaces.new/mouadhhhallem/postforge-ai
- Open in StackBlitz: https://stackblitz.com/github/mouadhhhallem/postforge-ai
- Run locally: clone repo, create `.env.local`, then run `npm install && npm run dev`

## Community Sprint

The first contributor sprint is live now.

- Pick an issue: https://github.com/mouadhhhallem/postforge-ai/issues
- Start with beginner tasks: https://github.com/mouadhhhallem/postforge-ai/labels/good%20first%20issue
- Join discussions: https://github.com/mouadhhhallem/postforge-ai/discussions

## Pages

- `/` — landing page with hero, problem/solution, feature sections, pricing preview, testimonials, revenue goal, and final CTA
- `/pricing` — three-tier SaaS pricing page with the Pro plan highlighted
- `/dashboard` — interactive app-style generator UI for posts, captions, ads, gym promos, and streetwear content

## Tech

- Next.js App Router
- TypeScript
- Tailwind CSS
- Modern dark UI with neon-accent styling

## Local development

```bash
npm run dev
```

VS Code task available: `Run PostForge AI Dev Server`

### Environment variables

Create a `.env.local` file (or copy from `.env.example`) with:

```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="a-long-random-secret-at-least-32-characters"
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_yyy
STRIPE_PRICE_BUSINESS=price_zzz
APIFY_TOKEN=apify_api_xxx
```

Validate your environment before deploy:

```bash
npm run env:check
```

## Authentication & Database

This app now includes a basic user system backed by Prisma and SQLite (or another SQL provider).

1. Install Prisma CLI (already added as dependency).
2. Set your database URL in `.env.local`, for example:
   ```
   DATABASE_URL="file:./dev.db"
   ```
3. Run migrations and generate client:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```
4. Signup and login forms post JSON to `/api/auth/signup` and `/api/auth/login`. Passwords are hashed with bcrypt.
5. Auth now uses signed, `httpOnly` cookies for session integrity.
6. Dashboard features are persisted in Prisma tables (notes, campaigns, calendar events, settings, and AI generation history).

You can use any SQL database instead of SQLite by updating `datasource` in the Prisma schema and `DATABASE_URL` accordingly.

The `STRIPE_PRICE_*` values should be the IDs of your Stripe price objects for each plan. If these are not set the checkout form will still render a mock message.

## Verification

```bash
npm run env:check
npm run lint
npm run build
```

## Product notes

- SEO targets include `AI social media generator`, `AI caption generator`, `AI marketing copy tool`, and `AI Instagram post generator`
- The pricing funnel is structured around a $39 Pro plan to support a $2k MRR goal
- Basic OpenAI generation and Stripe checkout routes are wired and environment-driven.
- Do not commit `.env` files; keep secrets in deployment provider environment settings.

## Contributing

Contributions are welcome. See `CONTRIBUTING.md` for setup, branch naming, and PR flow.

Community standards are documented in `CODE_OF_CONDUCT.md`.

If you like the project, please star it on GitHub and share the live demo.

## License

This project is open source under the MIT License. See the `LICENSE` file.
