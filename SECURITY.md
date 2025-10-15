# Security Policy

## Supported Versions

We take security seriously and actively maintain the following versions of Canvas MCP Client:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Canvas MCP Client, please help us protect our users by reporting it responsibly.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing:

**Email**: contact@visona.me (or create a private security advisory on GitHub)

Include as much information as possible:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability
- Any possible mitigations you've identified

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.

2. **Investigation**: We will investigate the issue and determine its impact and severity.

3. **Updates**: We will keep you informed of our progress as we work on a fix.

4. **Resolution**: Once we've developed a fix, we will:
   - Release a security patch
   - Publicly disclose the vulnerability (with credit to you, if desired)
   - Update our security advisory

5. **Timeline**: We aim to resolve critical vulnerabilities within 7 days and other vulnerabilities within 30 days.

## Security Best Practices

When using Canvas MCP Client, we recommend following these security best practices:

### For Self-Hosting

1. **Use HTTPS**: Always use HTTPS in production environments
2. **Strong Secrets**: Use strong, randomly generated secrets for `SECRET_KEY`
3. **Environment Variables**: Never commit API keys or secrets to version control
4. **Regular Updates**: Keep Canvas MCP Client and all dependencies up to date
5. **Firewall Rules**: Configure appropriate firewall rules to restrict access
6. **Database Security**: Use strong passwords for database connections
7. **Backups**: Maintain regular, encrypted backups of your data

### For API Keys and Credentials

1. **Encryption**: API keys and credentials are encrypted at rest using industry-standard encryption
2. **Local Storage**: All credentials are stored locally on your infrastructure
3. **No Transmission**: Credentials are never transmitted to external services except the configured AI providers
4. **Rotation**: Regularly rotate API keys and credentials
5. **Least Privilege**: Use API keys with minimal required permissions

### For MCP Servers

1. **Trusted Sources**: Only configure MCP servers from trusted sources
2. **Review Permissions**: Review what permissions and access each MCP server requires
3. **Isolation**: Consider running MCP servers in isolated environments
4. **Monitoring**: Monitor MCP server connections and activities
5. **Updates**: Keep MCP servers updated to their latest versions

### For Docker Deployments

1. **Official Images**: Use official Docker images when possible
2. **Volume Permissions**: Set appropriate permissions on mounted volumes
3. **Network Isolation**: Use Docker networks to isolate services
4. **Security Scanning**: Regularly scan Docker images for vulnerabilities
5. **Updates**: Keep Docker and Docker Compose updated

## Known Security Considerations

### Data Privacy

- **Local-First**: All user data is stored locally on your infrastructure
- **No Telemetry**: Canvas MCP Client does not collect or transmit telemetry data
- **No Analytics**: No usage analytics are collected
- **API Communication**: The only external communication is with your configured AI providers and MCP servers

### Authentication

Current version (1.x) does not include multi-user authentication as it's designed for single-user, self-hosted deployment. If you need to expose Canvas MCP Client to multiple users:

- Use a reverse proxy with authentication (e.g., Nginx with Basic Auth, OAuth2 Proxy)
- Implement network-level access controls
- Consider VPN access for remote users

### Future Security Enhancements

We are considering the following security enhancements for future releases:

- [ ] Optional multi-user authentication system
- [ ] Role-based access control (RBAC)
- [ ] Audit logging for sensitive operations
- [ ] Two-factor authentication support
- [ ] API rate limiting
- [ ] Content Security Policy (CSP) headers
- [ ] Security headers automation

## Security Updates

Security updates are released as soon as fixes are available. Subscribe to:

- **GitHub Security Advisories**: Watch the repository for security advisories
- **Release Notes**: Check CHANGELOG.md for security-related updates
- **GitHub Releases**: Security patches are tagged with `security` label

## Disclosure Policy

- We follow responsible disclosure practices
- Security issues are addressed with high priority
- Public disclosure occurs only after a fix is available
- Security researchers are credited (with permission) in release notes

## Security Hall of Fame

We appreciate security researchers who help keep Canvas MCP Client secure. Contributors who report valid security vulnerabilities will be listed here (with their permission):

<!-- Security researchers will be listed here -->

*No security vulnerabilities have been publicly disclosed yet.*

## Compliance

Canvas MCP Client is designed to help users maintain compliance with:

- **GDPR**: Data is stored locally, giving users full control
- **Data Sovereignty**: All data remains on user's infrastructure
- **Privacy Regulations**: No data is shared with third parties (except configured AI providers)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

## Questions?

If you have questions about security that don't involve reporting a vulnerability, please:

- Open a GitHub Discussion
- Check existing documentation
- Review this security policy

---

**Last Updated**: October 2025
**Version**: 1.0

