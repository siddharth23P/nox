# Project Nox — CLAUDE.md

> Agent workflow configuration for Claude Code. This file defines the default issue resolution workflow, coding standards, and project conventions.

## Architecture

- **Frontend**: React 19 + Vite 7 + Tailwind v4 + Zustand 5 (`/ui`)
- **Backend API**: Go 1.25 + Gin (`/services/bifrost`)
- **Orchestrator**: Rust 2021 + Tokio + Tonic gRPC (`/services/orchestrator`)
- **Memory**: Node.js/Mastra TraceMem (`/services/tracemem`)
- **Database**: PostgreSQL 15 + RLS (`/infra/db/schema.sql`)
- **AI Engine**: Mercury 2 (Diffusion LLM)
- **Tests**: Playwright E2E (`/ui/e2e/`)

## Default Issue Resolution Workflow

When asked to work on an issue, follow these steps **in order**:

### 1. Select the Most Critical Issue
- Check open issues: `gh issue list --state open --json number,title,labels`
- Pick the highest priority issue whose **dependencies are all resolved**
- Priority order: `priority: critical` > `priority: high` > `priority: medium` > `priority: low`
- Verify dependencies by checking the issue body for "Depends on:" references
- Confirm all referenced issues are closed before starting

### 2. Create a Feature Branch
```bash
git checkout main && git pull origin main
git checkout -b feat/<issue-number>-<short-name>
# Example: git checkout -b feat/28-channel-crud
```

### 3. Implement the Issue
Follow the build order for each issue:

#### a) Database Schema (if needed)
- Update `/infra/db/schema.sql` — add tables, columns, indexes
- Update seed scripts in `/infra/db/` if new test data needed
- Run: `psql -U postgres -f infra/db/schema.sql` to verify

#### b) Backend (Bifrost — Go)
- Models: Add structs in `/services/bifrost/internal/`
- Repository: SQL queries in `/services/bifrost/internal/db/`
- Service: Business logic in `/services/bifrost/internal/<domain>/service.go`
- Handler: HTTP handlers in `/services/bifrost/internal/<domain>/handler.go`
- Routes: Register in `/services/bifrost/cmd/gateway/main.go`
- WebSocket: Add events in `/services/bifrost/internal/messaging/hub.go`

#### c) Frontend (Nexus UI — React)
- Components: `/ui/src/components/` (use glassmorphic design with Tailwind backdrop-blur)
- Stores: Zustand stores in `/ui/src/stores/`
- Hooks: Custom hooks in `/ui/src/hooks/`
- Routes: Update `/ui/src/App.tsx` if new pages needed

### 4. Write E2E Tests
- Create `/ui/e2e/<feature>_regression.spec.ts`
- Use Playwright with the existing auth bypass pattern
- Test full flow: UI action → API call → DB verification → real-time update
- Test file naming: `<feature>.spec.ts` or `<feature>_regression.spec.ts`

### 5. Run CI/CD Tests Locally
```bash
# Backend
cd services/bifrost && go vet ./... && go build ./...

# Frontend
cd ui && npm run lint && npm run build

# E2E (requires running servers)
cd ui && npx playwright test
```
**ALL previous tests + new tests must pass.** Do not merge with failing tests.

### 6. Fix Lint Errors
```bash
cd services/bifrost && go vet ./...
cd services/orchestrator && cargo clippy
cd ui && npm run lint
```
Fix all warnings and errors before committing.

### 7. Commit and Create Pull Request
```bash
git add <specific-files>
git commit -m "feat(#<issue>): <description>"
git push -u origin feat/<issue-number>-<short-name>
gh pr create --title "feat(#<issue>): <description>" --body "Closes #<issue>"
```

### 8. Merge After CI Passes
- Wait for GitHub Actions to pass (all jobs: backend-go, backend-rust, frontend, e2e-auth, e2e-messaging)
- If CI fails, fix and push again
- Merge via: `gh pr merge <pr-number> --squash --delete-branch`

### 9. Resolve Merge Conflicts
- If conflicts arise after merge:
  ```bash
  git checkout main && git pull origin main
  git checkout feat/<branch> && git rebase main
  # Resolve conflicts, then: git rebase --continue
  git push --force-with-lease
  ```

## Coding Standards

### Go (Bifrost)
- Follow standard Go project layout
- Handler → Service → Repository pattern
- All SQL queries use parameterized `$1, $2` placeholders (no string concat)
- Use `pgx` for PostgreSQL, `gin` for HTTP
- Error handling: wrap with context, never swallow errors

### React (Nexus UI)
- Functional components with hooks only
- Zustand for state (no Redux, no Context for global state)
- Tailwind CSS classes — use glassmorphic design tokens:
  - `bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl`
- TypeScript strict mode
- No `any` types — define interfaces for all data structures

### Rust (Orchestrator)
- Async-first with Tokio
- `cargo clippy` must pass with zero warnings
- Use `tonic` for gRPC, `prost` for protobuf

### Database
- All tables must have `created_at TIMESTAMPTZ DEFAULT NOW()`
- Use UUIDs for primary keys (`gen_random_uuid()`)
- Foreign keys with appropriate `ON DELETE` behavior
- Enable RLS on multi-tenant tables

### Testing
- E2E tests use Playwright with `expect` assertions
- Test timeout: 60s global, 15s expect
- Use `test.describe` blocks for grouping
- Auth bypass: seed test users, login programmatically

## Key File Paths

| What | Path |
|------|------|
| DB Schema | `/infra/db/schema.sql` |
| Backend Routes | `/services/bifrost/cmd/gateway/main.go` |
| Backend Auth | `/services/bifrost/internal/auth/` |
| Backend Messaging | `/services/bifrost/internal/messaging/` |
| Backend Presence | `/services/bifrost/internal/presence/` |
| Frontend App | `/ui/src/App.tsx` |
| Frontend Components | `/ui/src/components/` |
| Frontend Stores | `/ui/src/stores/` |
| E2E Tests | `/ui/e2e/` |
| CI/CD | `/.github/workflows/main.yml` |
| Proto Definitions | `/shared/proto/auth/v1/auth.proto` |

## Issue Dependency Map (Current Priority)

### Phase 2 Critical Path (do these first):
1. **#1** Auth completion (org switching, RLS) — no deps
2. **#64** RBAC System — depends on #30
3. **#30** Org Settings — no deps
4. **#62** Org Invitations — depends on #30
5. **#63** Member Management — depends on #30, #62
6. **#28** Channel CRUD — depends on #29
7. **#29** Channel Permissions — depends on #28
8. **#31** Direct Messages — depends on #4
9. **#33** Notifications — depends on #4
10. **#19** Read Receipts (frontend) — backend exists
11. **#13** Rich Text Editor — frontend only
12. **#53** Infinite Scroll — depends on #4
13. **#52** Message Deletion — depends on #4
14. **#35** Full-Text Search — depends on #4
15. **#61** Friend System — depends on #31
