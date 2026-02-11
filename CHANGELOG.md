# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.4] - 2026-02-11

### Added
- **Integrated Browser Agent View**: New sidebar panel for real-time connection status and quick actions.
- **Dynamic Port Selection**: Relay server now automatically finds a free port (starting 11800) to avoid EADDRINUSE errors.
- **Chrome Extension Configuration**: Extension Options page now allows configuring the Relay Server URL.

### Changed
- **Consolidated Architecture**: `relay-server` is now bundled within the VS Code extension as a local dependency.
- **Unified Build Process**: `npm run package:all` builds both VS Code (`.vsix`) and Chrome (`.zip`) extensions to `dist/`.
- **Project Structure**: Documentation moved to `docs/` and build artifacts strictly output to `dist/`.

### Fixed
- Fixed EADDRINUSE errors by implementing dynamic port scanning.
- Fixed extension activation issues by resolving `relay-server` dependency via `require.resolve`.

## [1.0.0] - 2026-02-10

### Added
- Initial release
- WebSocket relay server for VS Code ↔ Browser communication
- VS Code extension for GitHub Copilot integration
- Chrome/Edge browser extension with Manifest V3
- Autonomous agent with learning capabilities
- Smart agent with caching and memory
- Self-healing test capabilities
- Screenshot capture and comparison
- DOM inspection and manipulation
- Real-time dashboard for monitoring
- Comprehensive security guidelines
- Rate limiting and error handling
- Graceful shutdown handling

### Security
- Local-only communication by default
- Message validation and rate limiting
- CSP-compliant browser extension
- Maximum message size limits

## [Unreleased]

### Planned
- [ ] Firefox extension support
- [ ] Advanced AI-powered element selection
- [ ] Visual regression testing
- [ ] Performance monitoring
- [ ] Multi-browser session management
- [ ] Cloud relay server option (with auth)
- [ ] Chrome DevTools Protocol integration
- [ ] Playwright/Puppeteer compatibility layer
