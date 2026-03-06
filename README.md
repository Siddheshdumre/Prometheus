# Prometheus — Codebase Intelligence Platform

A workspace-style frontend prototype for repository intelligence workflows.

## Included UX Surfaces

- Repository Import (URL / ZIP / GitHub connect + analysis pipeline status)
- Repository Dashboard (core metrics + architecture preview)
- Graph Explorer preview
- AI Codebase Chat preview with file references
- Impact Analyzer preview
- File Explorer preview
- Command Palette hint (`⌘K`)

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- lucide-react icons

## Run locally

```bash
npm install
npm run dev
```

## CI/CD (GitHub Actions)

This repo includes a workflow at `.github/workflows/ci-cd.yml`.

What it does:
- CI on `pull_request` and `push` to `main`: install, type-check, lint, and build.
- CD on `push` to `main`: deploys to Vercel only if required secrets are present.

Required repository secrets for deployment:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Setup steps:
1. In GitHub, open `Settings` -> `Secrets and variables` -> `Actions`.
2. Add the three Vercel secrets above.
3. Push to `main`.

If secrets are missing, deployment is skipped while CI still runs.
