# CONTEXT.md — brief-studio Domain Glossary

> Authoritative vocabulary for brief-studio. Use these exact terms in all plans, PRDs, commits, and code.
> Reference this file when writing prompts, naming variables, or writing user-facing copy.


## Core Entities

| Term | Definition |
|------|-----------|
| **Brand** | A client profile — SifuTutor or NakNgaji. Contains guidelines (tone, audience, dont_say, tagline, colours) editable via admin UI. |
| **Brand Context** | The structured brand data injected into every AI generation call. Must include: tone, audience, dont_say, tagline. |
| **Brief** | The structured input collected from a user before generation. Answers: what to make, for whom, key message, references. |
| **Brief Intake** | The question-by-question flow used to collect a brief. Uses Cara C — structured template questions as base, AI adds follow-up questions based on answers. |
| **Output Type** | The category of content being generated. Four types in MVP: Poster, Hook & Copy, Storyboard, Video Script. |
| **FeatureRun** | A single generation session — one brief → one output. Stored in DB with brand, output type, input, output, and feedback. |
| **Generation Call** | The OpenAI API call that produces output. Always includes brand context + brief answers as structured input. |
| **Session** | A user's login session. JWT-based. Scoped to team role. |


## Output Types

| Type | Model | Output Format |
|------|-------|---------------|
| **Poster** | gpt-image-2 | PNG image — stored as file path |
| **Hook & Copy** | gpt-4o | Text variations (3–5 hooks + copy) |
| **Storyboard** | gpt-4o + gpt-image-2 | Scene-by-scene text + reference images |
| **Video Script** | gpt-4o | Structured doc — scenes, dialogue, direction notes |


## Team Roles

| Role | Slug | Access |
|------|------|--------|
| **Marketing** | `marketing` | Hook & Copy, Content Plan, Virality, Ideas |
| **Creative** | `creative` | Poster, Storyboard, Video Script, Shooting Plan |
| **Admin** | `admin` | All features + Brand Management + User Management |


## Brands

| Brand | Slug | Audience |
|-------|------|----------|
| **SifuTutor** | `sifututor` | Parents seeking home tutors, students |
| **NakNgaji** | `nakngaji` | Muslim families seeking Quran/Islamic education |


## Prisma Models (key)

| Model | Purpose |
|-------|---------|
| `User` | Team member — has `teamRole` (marketing/creative/admin) and `isAdmin` |
| `Brand` | Brand profile + guidelines |
| `FeatureRun` | Generation history — linked to Brand + User, has feedback field |
| `Stats` | Instagram/Meta engagement stats |
| `Campaign` | Campaign tracker |
| `CalendarEvent` | Content calendar |
| `Note` | Free-form notes |
| `UserPreference` | Default tone, default brand |


## Inherited Features (from PostForge fork)

These features exist and are kept as-is unless explicitly in scope:
- Instagram OAuth + Meta API
- Virality analysis
- Content plan
- Campaign tracker
- Content calendar
- Notes

**Removed from fork:** Stripe billing, checkout, pricing pages.


## Key Conventions

- Brand slugs are always lowercase: `sifututor`, `nakngaji`
- Output type slugs: `poster`, `hook-copy`, `storyboard`, `video-script`
- Team role slugs: `marketing`, `creative`, `admin`
- Generated image files: stored in `public/uploads/generated/` — never in DB as blob
- Brief answers: stored in `FeatureRun.input` as JSON
- AI output: stored in `FeatureRun.output` as text or JSON
