# Project Nox: Master Agent SSoT 🤖

> [!IMPORTANT]
> This file is the **Sovereign Source of Truth** for the Project Nox build. Every agent window MUST refer to this file to maintain architectural consistency and track current progress.

## Architectural Mandates
- **Ingress**: Go/Gin (Bifrost Gateway)
- **Reasoning**: Rust/Tokio (Orchestrator Proxy)
- **Memory**: TS/Mastra (TraceMem Server)
- **Persistence**: PostgreSQL (Relational), Redis (Ephemeral), Kafka (Audit), SQLite-Vec (Narrative)
- **Design**: Nexus Glassmorphism (Tailwind/CSS Backdrop-Blur)
- **AI**: Mercury 2 (Diffusion LLM)

---

## The iterative Build Cycle
Each module follows:
1. **Architect**: Define exact schemas/contracts.
2. **Execute**: Code implementation.
3. **Verify**: Automated tests (90%+ coverage).
4. **Handoff**: User manual testing & refinement.
5. **Freeze**: Finalize and move to next block.

---

## Practical Issue Resolution Flow
When picking up a new Issue (e.g., #13 Core Messaging), the workflow is:
1. **Planning**: Analyze requirements, draft an `implementation_plan.md` (DB schema, Backend API, Frontend UI), and get user approval. Break down steps into `task.md`.
2. **Database Schema**: Update `schema.sql` (PostgreSQL) and write/execute seed scripts for local testing.
3. **Backend Service (Bifrost)**: Build Go models, SQL query services, and Gin/REST handlers. Register endpoints in `main.go`.
4. **Frontend UI (React)**: Build Nexus Glassmorphic UI components, update Zustand state stores, and wire API calls.
5. **E2E Testing**: Write Playwright regressions (`.spec.ts`), bypassing auth if needed, to test the entire client-to-DB flow locally.
6. **CI/CD Verification**: Commit, push to `origin main`, and watch GitHub Actions. Ensure Go, Rust, React, and E2E jobs all pass.
7. **Completion**: Notify user of success and prepare for the next issue.

---

## The 5-Phase Engineering Roadmap (26 Weeks)

### Phase 1: Discovery & Architecture (Weeks 1-5)
- [x] **Block 0: Workspace Init** (REG-INF-001) - TEE enclaves, Dev Tools.
- [x] **Block 1: Auth & Identity** ([Issue #1](https://github.com/siddharth23P/nox/issues/1)) - RBAC, ZK-Proofs.

### Phase 2: Core Feature Development (Weeks 6-12)
- [ ] **Block 2: Core Messaging** ([Issue #4](https://github.com/siddharth23P/nox/issues/4)) - WebSockets, GFM Editor.
- [ ] **Block 3: Recursive Sync** ([Issue #5](https://github.com/siddharth23P/nox/issues/5)) - Threads, Presence.

### Phase 3: Integration & Optimization (Weeks 13-18)
- [ ] **Block 4: AI Orchestration** ([Issue #6](https://github.com/siddharth23P/nox/issues/6)) - Mercury 2, DiSE Filter.
- [ ] **Block 5: Media & Huddles** ([Issue #7](https://github.com/siddharth23P/nox/issues/7)) - Spatial Audio.
- [ ] **Block 6: Knowledge Hub** ([Issue #8](https://github.com/siddharth23P/nox/issues/8)) - Bento-Wiki, Vector Search.

### Phase 4: Security & Verticals (Weeks 19-22)
- [ ] **Block 7: Security & TEE** ([Issue #9](https://github.com/siddharth23P/nox/issues/9)) - WORM Storage, Attestation.
- [ ] **Block 8: Verticals (FIN)** ([Issue #10](https://github.com/siddharth23P/nox/issues/10)) - Bloomberg Bridge.
- [ ] **Block 9: Verticals (BIO)** ([Issue #11](https://github.com/siddharth23P/nox/issues/11)) - DICOM Viewer.
- [ ] **Block 10: Verticals (IOT)** (IOT-001) - ROS2/DDS Bridge.
- [ ] **Domains 11-20**: Governance, SRE Chaos, Legal, HR, etc. (See `universal_ssot.md`)

### Phase 5: Production Launch (Weeks 23-26)
- [ ] **Nox-Monkey Chaos Testing** (CHS-011).
- [ ] **Operational DR & "Ice-Switch"** (REG-OPS-SRE-V2).
- [ ] **Stage 1 Production Cutover**.

---

## Current Active Focus
**Currently executing Phase 1 (Weeks 1-5): Initializing the Nexus Environment.**
Focus is on **Block 0 & 1**: Provisioning AWS Nitro Enclaves, PostgreSQL RLS schemas, and ZK-Proof identity verification.

See `implementation_plan.md` for specific technical contracts for the active module.
