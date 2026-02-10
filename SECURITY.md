# Security Guidelines

## 🔒 Security Best Practices

### 1. **Local-Only Communication**
- All communication happens over `localhost` by default
- WebSocket server binds to `127.0.0.1` to prevent external access
- Never expose the relay server to public internet without authentication

### 2. **Message Validation**
- All incoming messages are validated for structure
- Rate limiting prevents DoS attacks (100 requests/minute per client)
- Maximum message size limited to 10MB

### 3. **Browser Extension Security**
- Uses Manifest V3 for enhanced security
- Content scripts run in isolated worlds
- No inline JavaScript execution
- CSP (Content Security Policy) compliant

### 4. **Data Privacy**
- No data sent to external servers
- Screenshots and logs stored locally
- Session data cleared on disconnect

### 5. **Code Execution Safety**
- `executeJS` command should be used carefully
- Validate all user inputs before execution
- Avoid executing untrusted code in browser context

## 🚨 Security Checklist

- [ ] Keep relay server on localhost only
- [ ] Review all `executeJS` commands for safety
- [ ] Regularly update dependencies
- [ ] Enable rate limiting in production
- [ ] Monitor for suspicious activity
- [ ] Use HTTPS if exposing server (not recommended)
- [ ] Implement authentication tokens for remote access

## 🔍 Vulnerability Reporting

If you discover a security vulnerability, please email: security@yourproject.com

**Do not** open public GitHub issues for security vulnerabilities.
