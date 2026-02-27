# Repository Guidelines

## Project Structure & Module Organization
This repository is split into two apps plus deployment assets.
- `backend/`: Go API server (`cmd/server` entry), business handlers in `internal/api`, DB access in `internal/store`, SQL migrations in `internal/db/migrations`.
- `frontend/`: React + TypeScript UI (`src/components`, `src/hooks`, `src/stores`, `src/utils`).
- `deploy/telegram-bot-api/`: runtime entrypoint for self-hosted Telegram Bot API credential reload.
- Root files: `docker-compose.yml`, `.env.example`, and top-level docs.

## Build, Test, and Development Commands
Run from repository root unless noted.
- `docker compose up --build`: start full stack (Postgres, bot-api, backend, frontend).
- `docker compose up --build frontend`: preferred frontend build check after completing frontend changes.
- `cd backend && go run ./cmd/server`: run backend locally.
- `cd backend && go build ./cmd/server`: compile backend binary.
- `cd backend && go test ./...`: run backend/unit tests.
- `cd frontend && npm install && npm run dev`: start Vite dev server.
- `cd frontend && npm run lint`: run ESLint checks.

## Coding Style & Naming Conventions
- Go: follow `gofmt` defaults (tabs, idiomatic naming, exported identifiers in PascalCase).
- TypeScript/React: use existing component/hook patterns (`PascalCase` for components, `useXxx` for hooks, `camelCase` for variables/functions).
- Keep modules focused; add comments only for non-obvious logic.
- Reuse existing DTO and API naming patterns (e.g., `accessMethod`, `tgApiId`).

## Testing Guidelines
- Backend tests use Go’s `testing` package; files end with `_test.go`.
- Prefer table-driven tests for parsing/decision logic.
- Add/adjust tests when touching upload routing, Telegram client behavior, or range/download logic.
- Frontend currently has lint/type checks but no dedicated test runner in scripts.
- For post-change frontend build validation, use `docker compose up --build frontend` instead of `cd frontend && npm run build`.

## Commit & Pull Request Guidelines
- Current branch has no historical commits yet; adopt Conventional Commits (e.g., `feat:`, `fix:`, `docs:`).
- Keep commits scoped (one concern per commit).
- PRs should include: purpose, key changes, verification commands, and screenshots for UI changes.
- Mention migration or config impact explicitly (especially `system_config`/upload behavior).

## Security & Configuration Tips
- Do not commit real Telegram tokens, API hash, or production `.env` values.
- Self-hosted Bot API credentials are written at runtime; verify volume mounts before debugging switch failures.
- Validate setup/switch behavior via `/api/setup/status` and `/api/settings/access` before release.
