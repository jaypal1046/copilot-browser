# Contributing to Browser Copilot Integration

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/browser-copilot-integration.git
   cd browser-copilot-integration
   ```

3. **Install dependencies:**
   ```bash
   npm install
   cd relay-server && npm install && cd ..
   cd vscode-extension && npm install && cd ..
   ```

4. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Guidelines

### Code Style
- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons
- Follow ESLint rules: `npm run lint`
- Write descriptive commit messages

### Testing
- Test all changes thoroughly
- Run existing tests: `npm test`
- Add tests for new features
- Test on Chrome and Edge browsers

### Documentation
- Update README.md for user-facing changes
- Add JSDoc comments for functions
- Update CHANGELOG.md
- Include code examples

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add new feature
fix: bug fix
docs: documentation changes
style: code style changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

## Pull Request Process

1. **Update documentation** for any user-facing changes
2. **Run linter:** `npm run lint`
3. **Test thoroughly** on your local setup
4. **Update CHANGELOG.md** under [Unreleased]
5. **Create pull request** with clear description
6. **Address review feedback** promptly

## Project Structure

```
browser-copilot-integration/
├── relay-server/          # WebSocket relay server
├── vscode-extension/      # VS Code extension
├── browser-extension/     # Chrome/Edge extension
├── agent-scripts/         # Automation agents
└── docs/                  # Documentation
```

## Need Help?

- Check existing issues and discussions
- Read the documentation in README.md
- Ask questions in GitHub Discussions
- Join our community chat

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards others

## Security

Report security vulnerabilities to [security email] - see SECURITY.md

## License

By contributing, you agree that your contributions will be licensed under the project's license.
