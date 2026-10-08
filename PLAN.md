# PLAN.md — Redesign + Angular 22 + Audit Fixes

Spec: `docs/superpowers/specs/2026-10-08-redesign-design.md`. Everything below is on branch `feat/redesign-angular22`, **uncommitted**.

## Milestones
- [x] **M0** Spec, PLAN.md, CLAUDE.md reviewed and approved; `JwtBearer` package approved.
- [x] **M1** Backend fixes (findings #1–#7, #11 and extras). Repro tests failed first (5/5 red), then fixed. `dotnet test`: 24/24 pass (7 old + 17 new). Smoke-tested over HTTP: 401 without token, forged body role ignored, SoD, locked fields, 409, CORS allowlist, upload 201/415/403.
- [x] **M2** Angular 22 workspace `frontend/app` (zoneless, Vitest, TS 6 strict): shell, `DocumentApi` (Browser + Http), session/JWT, build configs `http`, `http-production`.
- [x] **M3** Pages: inbox, document detail, upload, audit ledger. Verified in browser pane: browser mode (dark + light, desktop + mobile 375px) and HTTP mode against the real API (login, preflight, list, approve = 200). `ng build` (both configs) and `ng test` (19/19) pass.
  - [ ] **Pending your OK:** delete the old `frontend/client` (my `rm -rf` was declined, so it is still there; nothing references it except CLAUDE.md's "legacy" line).
- [x] **M4** (partly) README, CI (`frontend/app`, Node 24, http-production build, Vitest) and `.env.example`/docker-compose updated. The old `serve-spa.js` traversal bug (#8) disappears with `frontend/client`; no replacement script was added (use `ng serve`).
  - [ ] README screenshots under `docs/assets/screenshots` still show the OLD UI; retake them (needs your OK to use Playwright or manual capture).

## Audit findings status
| # | Status |
|---|---|
| 1 Client-supplied role/identity | Fixed: JWT claims only, `Admin` bypass removed |
| 2 No submitter ≠ approver | Fixed (+ same person cannot decide both levels) |
| 3 Edit after approval | Fixed: Staff only, only PendingLevel1/RevisionRequested; omitted fields no longer zeroed |
| 4 Audit not atomic / sequence race / ActorName unhashed | Fixed: staged + single save, unique `Sequence`, seed sequences fixed (was all 0), ledger ordered by Sequence, hash includes ActorName |
| 5 No concurrency token | Fixed: `Version` token, 409 |
| 6 CORS any origin | Fixed: allowlist |
| 7 Upload validation, role from field, random doc number | Fixed (10 MB, PDF/PNG/JPEG, role from claims, Guid-based fallback number, duplicate rejected) |
| 8 serve-spa traversal | Moot once `frontend/client` is deleted |
| 9 Hardcoded mode/baseUrl, `any`, entity leakage | Fixed (build-time config, typed API, DTOs) |
| 10 Browser hash chain overstated | Fixed in wording (README, ledger banner); chain is demo-only in browser mode |
| 11 `EnsureCreated`, string statuses | Migration `InitialCreate` added; constants for statuses/roles (DB columns still strings) |
| New: browser mode enforced no rules at all; `reanalyze` no-op; sync throw in `getDocument` | Fixed in the new `BrowserDocumentApi` (same rules as server, tested) |

## Known limits (not done, deliberately)
- Demo JWT is not production auth (documented in README).
- Concurrent audit writes on the same ledger head: the second writer gets 409 and must retry (no auto-retry).
- Existing `workflow.db` created by `EnsureCreated` will fail `Migrate()` (tables exist) and its old hash chain would not verify (hash format changed). Delete the dev DB or back up and recreate.
- Uploaded files are not served back by the API (no "open original" in API mode).
- Browser-mode data from the old app (`*_v1` keys) is ignored.

## Local verification
- Backend: `cd backend/AiDocumentWorkflow.Api && dotnet run` (http://localhost:5120, demo login on in Development).
- Frontend browser mode: `cd frontend/app && npm start` → http://localhost:4200.
- Frontend API mode: `npm start -- --configuration http` (backend must be running).
- Tests: `dotnet test backend/AiDocumentWorkflow.Tests` and `cd frontend/app && npm test`.
- Personas (top-right "Demo role"): Staff (Elena), Manager (Sarah), Finance (David), Auditor (Morgan). Try: Staff → Upload → sample with tax error → Manager approves L1 → Finance approves L2 → Auditor verifies chain.

## Production checklist
- `Auth__JwtKey` (>= 32 chars) via env; `Auth__EnableDemoLogin` explicitly decided; `Cors__AllowedOrigins__0..n` set to the real origin.
- Docker: copy `.env.example` to `.env`; existing SQLite volume created before this change must be backed up and recreated (see Known limits).
- Pages deploy: build with `npx ng build --base-href /ai-document-workflow/` (browser mode, hash routing). Only on your explicit go-ahead.
- Rollback: previous image + DB backup; Pages build is independent of the API.

## Decisions log
- 2026-10-08: Option B (new Angular 22 workspace); demo-login JWT; audit scope frontend + backend.
- 2026-10-08: Hash routing for static hosting; document detail is one page with sections (not tabs).
- 2026-10-08: Work stays uncommitted on `feat/redesign-angular22` (split into PRs when you ask to commit).

## Next
1. You review locally (backend + `npm start -- --configuration http`) and tell me what to change in the UI.
2. Decide: delete `frontend/client`? Retake README screenshots?
3. When approved: split into commits/PRs by area (backend fixes; Angular 22 app + CI/README), per the Conventional Commits rule. Command to resume: `git status` on `feat/redesign-angular22`.
