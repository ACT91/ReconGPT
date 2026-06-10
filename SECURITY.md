# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them privately via:

1. GitHub Security Advisories (preferred)
2. Email: security@recongpt.io

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Time

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-3 days
  - High: 7-14 days
  - Medium: 30 days
  - Low: Best effort

## Disclosure Policy

- We follow responsible disclosure
- Security issues will be patched before public disclosure
- Credit will be given to reporters (if desired)
- CVE IDs will be requested for significant vulnerabilities

## Security Best Practices

When using ReconGPT:

1. **Never scan unauthorized domains**
2. **Protect your API keys** - Use environment variables
3. **Limit scan scope** - Don't scan entire internet ranges
4. **Rate limit** - Respect target infrastructure
5. **Isolate workers** - Run in sandboxed environments
6. **Audit logs** - Review all scan activities
7. **Update regularly** - Keep dependencies current

## Known Security Considerations

- ReconGPT executes external tools (subfinder, httpx, etc.)
- Scan results may contain sensitive data
- AI analysis sends data to OpenAI (sanitize if needed)
- Workers should run in isolated environments

## Security Features

- Input validation on all API endpoints
- Rate limiting per user
- Audit logging of all scans
- Configurable domain whitelist/blacklist
- Isolated job execution

## Questions?

For security questions, contact: security@recongpt.io
