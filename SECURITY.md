# Security Features Guide

## Overview

Focal-deploy now includes comprehensive security enhancements designed to make enterprise-level security accessible to users of all experience levels. These features provide guided setup, automated hardening, and continuous monitoring capabilities.

## Security Commands

### 🛡️ Security Setup Wizard
```bash
focal-deploy security-setup
```

Interactive wizard that guides you through configuring all security features:
- **SSH Hardening**: Change to custom port (2847), disable root login, create deployment user
- **SSH Key Authentication**: Generate and deploy SSH keys with key-only authentication
- **UFW Firewall**: Configure minimal required ports with default deny policy
- **Fail2ban Integration**: Install and configure intrusion prevention system
- **Automatic Updates**: Enable unattended security updates

**Novice-Friendly Features:**
- Clear explanations of each security measure
- Educational content about why each feature matters
- Safe defaults with option to customize
- Step-by-step guidance with progress indicators

### 📊 Security Status Dashboard
```bash
focal-deploy security-status
```

Displays comprehensive security overview:
- **Security Score**: 0-100 health rating with color-coded indicators
- **SSH Configuration**: Port, authentication method, user access
- **Firewall Status**: Active rules, default policies, port access
- **Fail2ban Status**: Active jails, banned IPs, recent activity
- **Recommendations**: Actionable steps to improve security posture

### 🔍 Security Audit
```bash
focal-deploy security-audit
```

Performs comprehensive security assessment:
- **Vulnerability Detection**: Identifies security weaknesses
- **Risk Assessment**: Categorizes issues by severity (high/medium/low)
- **Compliance Check**: Validates against security best practices
- **Detailed Recommendations**: Specific steps to address each issue
- **Audit Report**: Timestamped report with security score

### 🔑 SSH Key Management
```bash
focal-deploy ssh-key-setup
```

Interactive SSH key generation and deployment:
- **Key Type Selection**: Ed25519 (recommended) or RSA 4096-bit
- **Automatic Generation**: Creates secure key pairs with proper permissions
- **Deployment Option**: Automatically deploy to EC2 instance
- **Educational Content**: Explains SSH key benefits and security
- **Fingerprint Display**: Shows key fingerprint for verification

### 🔥 Firewall Management
```bash
focal-deploy firewall-status
```

Detailed firewall monitoring:
- **UFW Status**: Active/inactive state with rule count
- **Rule Analysis**: Color-coded rules by type (SSH, web, custom)
- **Port Monitoring**: Shows all listening ports and services
- **Recent Activity**: Displays firewall logs and blocked attempts
- **Policy Overview**: Default incoming/outgoing policies

### 🚫 Fail2ban Monitoring
```bash
focal-deploy fail2ban-status
```

Intrusion prevention system status:
- **Service Status**: Installation and active state
- **Jail Information**: Active jails with ban statistics
- **IP Monitoring**: Currently banned IPs and ban history
- **Activity Logs**: Recent ban/unban events with timestamps
- **Protection Coverage**: Shows protected services (SSH, HTTP, etc.)

## Security Features

### SSH Hardening
- **Custom Port**: Changes SSH from default port 22 to 2847
- **Key-Only Authentication**: Disables password authentication
- **Root Access**: Disables direct root login
- **Deployment User**: Creates dedicated user for deployments
- **Connection Limits**: Configures rate limiting and timeouts

### Firewall Protection (UFW)
- **Default Deny**: Blocks all incoming connections by default
- **Minimal Ports**: Only opens required ports (SSH, HTTP, HTTPS)
- **Custom Rules**: Easy addition of application-specific ports
- **IPv6 Support**: Consistent rules for both IPv4 and IPv6
- **Logging**: Configurable logging levels for monitoring

### Intrusion Prevention (Fail2ban)
- **SSH Protection**: Monitors SSH login attempts
- **Web Protection**: Guards against HTTP/HTTPS attacks
- **Custom Jails**: Configurable protection for specific services
- **IP Banning**: Automatic temporary bans for suspicious activity
- **Whitelist Support**: Protects trusted IPs from accidental bans

### Automatic Updates
- **Security Patches**: Automatic installation of security updates
- **Kernel Updates**: Handles kernel security patches
- **Service Restart**: Manages service restarts when needed
- **Update Notifications**: Logs update activity
- **Rollback Protection**: Maintains system stability

## Security Scoring

The security score (0-100) is calculated based on:

### High Impact (25 points each)
- SSH port changed from default (22 → 2847)
- SSH key-only authentication enabled
- UFW firewall active with proper rules
- Fail2ban installed and protecting services

### Medium Impact (15 points each)
- Root SSH access disabled
- Deployment user configured
- Automatic security updates enabled

### Low Impact (5 points each)
- SSH connection limits configured
- Firewall logging enabled
- Fail2ban custom jails active

### Score Interpretation
- **90-100**: 🛡️ Excellent security posture
- **80-89**: ✅ Good security configuration
- **60-79**: ⚠️ Moderate security - improvements needed
- **40-59**: 🔶 Basic security - significant improvements needed
- **0-39**: 🚨 Poor security - immediate attention required

## Best Practices

### For Novice Users
1. **Start with Security Setup**: Run `focal-deploy security-setup` first
2. **Use Recommended Defaults**: Accept suggested configurations initially
3. **Monitor Regularly**: Check `focal-deploy security-status` weekly
4. **Learn Gradually**: Read explanations provided during setup
5. **Keep Keys Safe**: Backup SSH private keys securely

### For Advanced Users
1. **Customize Configuration**: Modify security settings as needed
2. **Regular Audits**: Run `focal-deploy security-audit` monthly
3. **Monitor Logs**: Review firewall and Fail2ban logs regularly
4. **Update Rules**: Adjust firewall rules for new services
5. **Backup Configuration**: Save security configurations

### Security Maintenance
1. **Regular Updates**: Keep system packages updated
2. **Key Rotation**: Rotate SSH keys periodically
3. **Rule Review**: Audit firewall rules quarterly
4. **Log Analysis**: Monitor security logs for patterns
5. **Backup Strategy**: Include security configurations in backups

## Troubleshooting

### Common Issues

**SSH Connection Refused**
- Check if custom port (2847) is accessible
- Verify SSH key is properly deployed
- Ensure firewall allows SSH port

**Firewall Blocking Services**
- Review UFW rules with `focal-deploy firewall-status`
- Add required ports through security setup
- Check service binding to correct interfaces

**Fail2ban False Positives**
- Review banned IPs in fail2ban status
- Add trusted IPs to whitelist
- Adjust jail sensitivity if needed

**Security Score Issues**
- Run security audit to identify problems
- Follow recommendations in security status
- Ensure all security features are properly configured

### Getting Help

1. **Security Status**: Check current configuration
2. **Security Audit**: Identify specific issues
3. **Documentation**: Review this guide and command help
4. **Logs**: Check system logs for error details
5. **Community**: Consult focal-deploy community resources

## Security Architecture

### Defense in Depth
The security implementation follows defense-in-depth principles:

1. **Network Layer**: UFW firewall controls network access
2. **Access Layer**: SSH hardening controls system access
3. **Authentication Layer**: SSH keys provide strong authentication
4. **Monitoring Layer**: Fail2ban detects and responds to threats
5. **Maintenance Layer**: Automatic updates maintain security patches

### Zero Trust Approach
- Default deny for all network connections
- Explicit allow rules for required services
- Continuous monitoring and logging
- Regular security assessments
- Principle of least privilege

This comprehensive security framework ensures your focal-deploy instances are protected against common threats while remaining accessible and manageable for users of all skill levels.