# Redesign + Angular 22 + Audit Fixes — Design Spec

Date: 2026-10-08 · Status: awaiting user review · Size: Large

## Goal
1. Redesign UX/UI of the whole app: clear information architecture, role-based work inbox, full-page document detail instead of a 1.5k-line modal.
2. Rebuild the frontend on Angular 22 (new workspace, option B) and port the still-good models/logic.
3. Fix the bugs found in the code audit (backend + frontend), proven by failing tests first.

Success: `dotnet test` and `ng build`/`ng test` pass; each page verified on localhost (desktop + mobile, light + dark); every audit finding below has a test or a documented reason it has none.

## Decisions (user-approved)
- Frontend: new Angular 22 workspace at `frontend/app/`, old `frontend/client/` removed after parity.
- Audit scope: frontend + backend, separate PRs.
- Server identity: demo-login JWT (not real auth). Role/user come from claims; `ActorRole/ActorId/ActorName` removed from request DTOs.
- Dual mode kept: browser-only (GitHub Pages) and .NET backend, chosen at build time.

## Audit findings (from code reading, each to be proven by a failing test before fixing)
| # | Finding | Where |
|---|---|---|
| 1 | Role/identity supplied by client; `Admin` passes every gate; `/reanalyze` has no role check | `WorkflowActionDto`, `DocumentWorkflowService`, `DocumentsController` |
| 2 | No submitter ≠ approver rule; one `Admin` can decide L1 and L2 | `DocumentWorkflowService` |
| 3 | `PUT /documents/{id}` edits amounts in any status incl. Approved/Rejected; auto-clears anomaly flag | `DocumentsController.UpdateDocument` |
| 4 | Audit not atomic (separate `SaveChanges`), `Sequence` race can fork chain, hash excludes `ActorName` | `AuditService`, controllers |
| 5 | No concurrency token on Document (double approve) | `Document.cs`, `AppDbContext` |
| 6 | CORS allows any origin with credentials | `Program.cs` |
| 7 | Upload: no size/type limit, Auditor check depends on optional field, role logged as "Staff", random doc number can collide | `DocumentsController.UploadDocument` |
| 8 | Path traversal in dev static server, `ACAO: *` | `frontend/client/serve-spa.js` |
| 9 | `useBrowserStorage = true` hardcoded, `baseUrl` hardcoded, `dto: any`, EF entities returned directly (leaks `StoredFilePath`) | `document.service.ts`, controllers |
| 10 | Browser-mode hash chain is client-computed, so "tamper-evident" claim is overstated; payload differs from backend | `browser-storage.service.ts`, README |
| 11 | `EnsureCreated` instead of migrations; stringly-typed statuses | `Program.cs`, models |

## Frontend design
```
src/app/
  core/    api/ (DocumentApi abstract, BrowserDocumentApi, HttpDocumentApi), auth/ (session signal, interceptor, permissions.ts), config.ts
  shared/  ui/ (button, badge, kpi, table, dialog, toast), pipes
  layout/  shell (sidebar, topbar, "Demo role" switcher)
  features/ inbox | document (tabs: details, line items, AI, history; action panel) | upload | audit (ledger + verify)
```
- Routes: `/inbox` (default), `/documents/:id`, `/upload`, `/audit`; lazy-loaded.
- Standalone components + signals; files ≤ ~300 lines; templates/styles separate.
- API implementation selected by `environment` at build time.
- Permissions = one role→action table (`permissions.ts`), no per-component checks.
- Design tokens as CSS variables; light/dark; keyboard + focus ring + AA contrast.
- Browser mode labelled "demo integrity check (client-side)"; README claims corrected.
- To verify against Angular 22 docs before implementing: zoneless default, Vitest vs Karma, build builder.

## Backend design
- `POST /api/auth/demo-login {personaId}` → JWT (HMAC, short-lived; signing key from config/env, never committed). Adds package `Microsoft.AspNetCore.Authentication.JwtBearer` (**needs user OK before adding**).
- All endpoints `[Authorize]`; identity from claims.
- SoD: no `Admin` bypass; submitter cannot decide own document; same user cannot decide both levels.
- `PUT` only by Staff while PendingLevel1/RevisionRequested; `reanalyze` role- and status-restricted.
- Audit: document change + log in one transaction; unique index on `Sequence` with retry; hash includes `ActorName`.
- `rowVersion` concurrency token; 409 on conflict.
- CORS allowlist from config. Upload: size cap, PDF/PNG/JPG only, duplicate doc number rejected.
- Response DTOs; EF migrations replace `EnsureCreated`.
- Test note: current tests use EF InMemory, which does not enforce unique indexes or concurrency tokens; new tests for #4/#5 use SQLite in-memory.

## Milestones
See `PLAN.md`. M1 backend fixes → M2 Angular 22 shell → M3 feature pages → M4 serve-spa/README/CI. M1 and M2 merge as a pair (API contract change). Stop for user verification on localhost after every milestone; no commit/push/PR/deploy without explicit request.

## Risks
- Breaking API: old frontend incompatible with new backend; mitigated by merging M1+M2 together. Browser-only mode unaffected.
- Large frontend diff; mitigated by page-by-page milestones.
- Demo JWT is not production auth; documented as such.
