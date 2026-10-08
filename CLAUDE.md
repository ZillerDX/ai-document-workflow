# CLAUDE.md

AegisFlow AI: document workflow with 2-level approval, Segregation of Duties, SHA-256 chained audit log. Stack: .NET 10 Minimal/Controllers API + SQLite (EF Core), Angular frontend (moving 19 → 22), Gemini for extraction.

Read `PLAN.md` (`## Next` first) and `CONTEXT.md` (domain glossary) before working.

## Commands
- Backend run: `dotnet run --project backend/AiDocumentWorkflow.Api` (http://localhost:5120)
- Backend test: `dotnet test backend/AiDocumentWorkflow.Tests/AiDocumentWorkflow.Tests.csproj`
- Frontend (Angular 22): `cd frontend/app && npm ci && npm start` (browser mode, http://localhost:4200); `npm start -- --configuration http` (uses the API); `npm run build`; `npm test`
- `frontend/client` is the OLD Angular 19 app, superseded by `frontend/app` (pending deletion; do not edit)
- Docker: `docker compose up` (API on 5120, SQLite volume `workflow_data`)

## Architecture
- `backend/AiDocumentWorkflow.Api`: Controllers → Services (`DocumentWorkflowService` state machine, `AuditService` hash chain, `GeminiDocumentService`) → `AppDbContext`.
- Frontend runs in two modes: browser-only (localStorage + Web Crypto, for GitHub Pages) and HTTP to the API.
- Statuses: PendingLevel1 → PendingLevel2 → Approved; Rejected / RevisionRequested are side states.

## Conventions / gotchas
- Gemini key lives in gitignored `appsettings.Local.json`; CI greps for `AIzaSy…` leaks. Never commit secrets.
- Existing tests use EF InMemory (no unique index / concurrency enforcement); use SQLite in-memory for those.
- Browser-mode hash chain is client-side demo only; do not describe it as tamper-proof.
- Never trust actor role/id from request bodies; identity comes from JWT claims (`ActorContext`). Demo login is not production auth.
- Services stage audit records (`IAuditService.StageAsync`) and the caller saves once; never save audit separately from the change.
- Frontend rules in `core/workflow-rules.ts` mirror `DocumentWorkflowService`; change both together. Data source is a build-time choice (`config.ts` vs `config.http.ts`).
- Conventional Commits; branches `feat/` `fix/` `chore/`. No commit/push/PR unless asked.

## Environment
- Env/config names: `ConnectionStrings__DefaultConnection`, `Gemini` API key (in `appsettings.Local.json`), `Auth__JwtKey` (env, >= 32 chars, required outside Development), `Auth__EnableDemoLogin`, `Cors__AllowedOrigins__N`. Copy `.env.example` to `.env` for docker compose.
