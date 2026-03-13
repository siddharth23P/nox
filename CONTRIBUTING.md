# Contributing to Nox 🌌

First off, thank you for considering contributing to Nox! It's people like you that make Nox such a powerful tool.

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and professional in all interactions.

## 🚀 How to Contribute

### 1. Reporting Bugs

- Search existing issues to see if the bug has already been reported.
- If not, open a new issue with a clear title and detailed description. Include steps to reproduce the bug and any relevant logs or screenshots.

### 2. Suggesting Enhancements

- Open a new issue and describe the enhancement you'd like to see.
- Explain why it would be useful and how it aligns with the project's goals.

### 3. Pull Requests

1. **Fork the repository** and create your branch from `main`.
2. **Branch Naming**: Use descriptive names like `feat/awesome-feature` or `fix/logic-bug`.
3. **Coding Standards**:
    - **Go**: Follow `gofmt` and standard Go idioms.
    - **Rust**: Use `cargo fmt` and follow Clippy's advice.
    - **React**: Follow the project's ESLint and Prettier configurations.
4. **Testing**: Ensure that your changes pass all existing tests and add new tests if applicable.
5. **Documentation**: Update the README or other documentation if your changes introduce new features or change existing ones.
6. **Submit PR**: Provide a clear description of the changes and link to the relevant issue.

## 🏗️ Technical Architecture

Nox uses a multi-service architecture:

- **Bifrost**: Go/Gin Gateway.
- **Orchestrator**: Rust/Tokio Cognitive Core.
- **Nexus UI**: React/Vite Frontend.

All gRPC communication happens over TLS 1.3, and all data is secured using zero-knowledge principles where applicable.

## 🛠️ Local Development

Please refer to the [README.md](README.md) for detailed local setup instructions.

---

© 2026 Siddartha P. | Built for the future of distributed collaboration.
