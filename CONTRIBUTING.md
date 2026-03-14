# Contributing to Nox

First off, thank you for considering contributing to Nox! It's people like you that make Nox such a powerful tool.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and professional in all interactions.

## Filing Issues

- **Search first**: Check [existing issues](https://github.com/siddharth23P/nox/issues) before opening a new one.
- **Use issue templates** when available (bug report, feature request).
- **Bug reports** should include:
  - A clear, descriptive title
  - Steps to reproduce the issue
  - Expected vs. actual behavior
  - Environment details (OS, browser, service versions)
  - Relevant logs or screenshots
- **Feature requests** should explain the use case and how it aligns with the project goals.

## Pull Requests

### Branch Naming

Use a prefix that matches the type of change:

| Prefix   | Purpose                        |
| :------- | :----------------------------- |
| `feat/`  | New features                   |
| `fix/`   | Bug fixes                      |
| `docs/`  | Documentation only             |
| `test/`  | Adding or updating tests       |
| `chore/` | Tooling, CI, dependency updates |

Example: `feat/42-websocket-reconnect`, `fix/auth-token-expiry`

### PR Checklist

1. **Fork the repository** and create your branch from `main`.
2. **Link the related issue** in the PR description (e.g., `Closes #42`).
3. **Write or update tests** for any changed behavior.
4. **Update documentation** if your changes introduce new features or modify existing ones.
5. **Ensure CI passes** before requesting review.
6. **Keep PRs focused** -- one logical change per PR.

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description
```

**Types**: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`

**Scope** (optional): the area of the codebase, e.g., `bifrost`, `orchestrator`, `ui`, `db`

**Examples**:
```
feat(bifrost): add WebSocket reconnection with backoff
fix(ui): prevent XSS in markdown renderer
docs(#3): add contribution guide and project badges
test(orchestrator): add session validation benchmarks
```

## Code Style

### Go (Bifrost Gateway)

- Format with `gofmt` (enforced by CI)
- Lint with `golint` / `go vet`
- Follow standard Go idioms and the [Effective Go](https://go.dev/doc/effective_go) guide

### Rust (Orchestrator)

- Format with `cargo fmt` (enforced by CI)
- Lint with `cargo clippy` -- address all warnings
- Follow the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)

### TypeScript / React (Nexus UI)

- Lint with **ESLint** (project config in `ui/.eslintrc.*`)
- Format with **Prettier** (project config in `ui/.prettierrc`)
- Follow the existing component patterns in `ui/src/`

## Development Setup

Please refer to the [README.md](README.md) for detailed local setup and service launch instructions.

---

(c) 2026 Siddartha P. | Built for the future of distributed collaboration.
