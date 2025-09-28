# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security bugs seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

### How to Report a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@exitzero.com**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Include

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

After you submit a report, we will:

1. Confirm receipt of your vulnerability report within 48 hours
2. Provide regular updates on our progress
3. Credit you in our security advisories (unless you prefer to remain anonymous)

## Security Best Practices

### For Users

- Always use the latest version of ExitZero
- Keep your API keys secure and rotate them regularly
- Use environment variables for sensitive configuration
- Enable Row Level Security (RLS) in your Supabase project
- Regularly audit your webhook endpoints
- Monitor your API usage for unusual patterns

### For Developers

- Follow secure coding practices
- Validate all input data
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Keep dependencies up to date
- Use HTTPS for all communications
- Implement rate limiting
- Log security-relevant events

## Security Features

ExitZero includes several security features:

- **HMAC Signature Verification**: All webhooks are verified using HMAC signatures
- **Row Level Security (RLS)**: Database access is controlled at the row level
- **PII Anonymization**: Personal data is anonymized before AI processing
- **Rate Limiting**: API endpoints are protected against abuse
- **Input Validation**: All inputs are validated and sanitized
- **Secure Headers**: Security headers are set on all responses
- **Environment Isolation**: Development and production environments are isolated

## Vulnerability Disclosure Timeline

- **Day 0**: Vulnerability reported
- **Day 1**: Initial response and triage
- **Day 7**: Status update and timeline
- **Day 30**: Fix development and testing
- **Day 45**: Fix release and disclosure

## Security Advisories

Security advisories are published in the following locations:

- GitHub Security Advisories
- Our blog: https://blog.exitzero.com/security
- Email notifications to registered users

## Bug Bounty Program

We're working on establishing a bug bounty program. Stay tuned for updates!

## Contact

For security-related questions or concerns, please contact:

- **Email**: security@exitzero.com
- **PGP Key**: [Available upon request]

## Acknowledgments

We would like to thank the following security researchers who have responsibly disclosed vulnerabilities:

- [To be added as reports come in]

Thank you for helping keep ExitZero and our users safe!
