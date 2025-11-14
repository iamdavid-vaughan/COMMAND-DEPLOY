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

### 📋 Security Audit Logs
```bash
focal-deploy audit-logs
```

View comprehensive security audit logs that track all sensitive actions:
- **Authentication Events**: SSH logins, API authentication attempts
- **Deployment Actions**: All deployment operations and their outcomes
- **Configuration Changes**: Security setting modifications
- **Credential Access**: When credentials are read, written, or deleted
- **Resource Management**: Creation and deletion of AWS resources
- **Password Changes**: System and application password modifications

**Filtering Options:**
```bash
# View failed actions only
focal-deploy audit-logs --failed

# Filter by category
focal-deploy audit-logs --category authentication

# Filter by severity
focal-deploy audit-logs --severity critical

# View logs from last 7 days
focal-deploy audit-logs --since 7d

# Export to JSON
focal-deploy audit-logs --format json > audit-export.json
```

### 📊 Audit Statistics
```bash
focal-deploy audit-stats
```

Displays comprehensive audit log analytics:
- **Event Summary**: Total events, failed events, success rate
- **Time-based Analysis**: Activity in last 24 hours, 7 days, 30 days
- **Category Breakdown**: Events grouped by category
- **Severity Distribution**: Critical, warning, and info event counts
- **Top Actions**: Most frequently performed actions
- **User Activity**: Events per user

### 🔍 Interactive Audit Viewer
```bash
focal-deploy audit-interactive
```

Interactive menu-driven audit log viewer:
- Browse logs by category (authentication, deployment, security, etc.)
- View recent activity or failed actions
- Apply custom filters
- Export filtered results
- Clear old logs (with backup)

### 🔐 Password Breach Checker
```bash
focal-deploy password-check
```

Check if passwords have been compromised in known data breaches using the Have I Been Pwned API:
- **k-Anonymity Model**: Password never leaves your system
- **Comprehensive Check**: Searches 600+ million compromised passwords
- **Strength Analysis**: Evaluates password complexity and strength
- **Security Score**: Overall security rating (0-100)
- **Recommendations**: Specific steps to improve password security

**Features:**
- Interactive password entry (masked input)
- Breach count and severity level
- Password strength assessment
- Overall security recommendations

### 🔑 Password Generator
```bash
focal-deploy password-generate
```

Generate cryptographically secure random passwords:
- **Customizable Length**: 8-128 characters
- **Character Types**: Configure uppercase, lowercase, numbers, special characters
- **Automatic Breach Check**: Verify generated password isn't compromised
- **Clipboard Integration**: Optional copy to clipboard
- **Education**: Learn about password security best practices

### 📋 Batch Password Check
```bash
focal-deploy password-batch-check passwords.txt
```

Check multiple passwords from a file (one per line):
- **Batch Processing**: Check multiple passwords efficiently
- **Summary Report**: Overview of breached vs. safe passwords
- **Detailed Results**: Individual status for each password
- **Severity Analysis**: Breach severity levels for each password

### 🛡️ Interactive Password Security Tool
```bash
focal-deploy password-security
```

Comprehensive password security menu:
- Check passwords for breaches
- Generate secure passwords
- Batch check password files
- Learn about password security best practices
- Password strength analysis

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

### Security Audit Logging
- **Comprehensive Tracking**: Logs all sensitive security actions
- **Authentication Monitoring**: SSH logins, API access, credential usage
- **Deployment Tracking**: All deployment operations with timestamps
- **Configuration Auditing**: Security setting changes and modifications
- **Resource Tracking**: AWS resource creation and deletion
- **Retention Management**: Configurable log retention (default: 90 days)
- **Query & Filter**: Advanced filtering by action, category, severity, user
- **Export Capabilities**: Export logs for compliance and analysis

### Password Security
- **Breach Detection**: Integration with Have I Been Pwned API
- **k-Anonymity Model**: Passwords never transmitted over network
- **Strength Analysis**: Comprehensive password strength evaluation
- **Secure Generation**: Cryptographically secure password generation
- **Batch Checking**: Check multiple passwords efficiently
- **Education**: Built-in password security best practices guide

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

## Audit Log Features

### What is Logged

The audit logging system tracks:

1. **Authentication Events**
   - SSH login attempts (successful and failed)
   - API authentication to AWS, GitHub, DNS providers
   - Credential access and modifications

2. **Deployment Operations**
   - Application deployments
   - Infrastructure changes
   - Deployment failures and rollbacks

3. **Security Configuration**
   - Firewall rule changes
   - SSH configuration modifications
   - SSL certificate operations
   - Fail2ban configuration

4. **Resource Management**
   - EC2 instance creation/deletion
   - S3 bucket operations
   - Security group modifications
   - IAM role changes

5. **Credential Operations**
   - AWS credential access
   - SSH key generation and deployment
   - API token usage
   - Password changes

### Audit Log Structure

Each audit entry contains:
- **Timestamp**: When the event occurred
- **Action**: What operation was performed
- **Category**: Type of operation (authentication, deployment, security, etc.)
- **Severity**: Event importance (info, warning, critical)
- **User**: Who performed the action
- **Success**: Whether the operation succeeded
- **Details**: Additional context and metadata
- **Error**: Error message if operation failed

### Retention and Rotation

- **Default Retention**: 90 days
- **Maximum Entries**: 10,000 entries (automatically rotates)
- **Automatic Cleanup**: Removes entries older than retention period
- **Export Before Clear**: Automatic backup when manually clearing logs

### Compliance Benefits

Audit logs help with:
- **Security Compliance**: SOC 2, ISO 27001, HIPAA requirements
- **Incident Response**: Track security incidents and breaches
- **Access Control**: Monitor who accessed what and when
- **Change Management**: Track configuration changes
- **Forensic Analysis**: Investigate security events

## Password Breach Checking

### How It Works

The password breach checker uses the k-anonymity model:

1. **Local Hashing**: Password is hashed with SHA-1 locally
2. **Prefix Query**: Only first 5 characters of hash are sent to API
3. **Suffix Matching**: API returns all matching hash suffixes
4. **Local Verification**: Your system checks if full hash is in results

**Key Advantage**: Your actual password NEVER leaves your system.

### Breach Database

- **Source**: Have I Been Pwned (haveibeenpwned.com)
- **Coverage**: 600+ million compromised passwords
- **Data Sources**: Public data breaches and leaks
- **Updates**: Regularly updated with new breach data
- **Privacy**: k-anonymity ensures password privacy

### Security Score Calculation

Overall security score (0-100) is calculated from:

**Strength Score (0-60 points):**
- Length (12+ characters): 10 points
- Uppercase letters: 10 points
- Lowercase letters: 10 points
- Numbers: 10 points
- Special characters: 10 points
- No common patterns: 10 points

**Breach Status (up to 40 points):**
- Not breached: +40 points
- Low severity breach: +30 points
- Medium severity: +20 points
- High severity: +10 points
- Critical severity: 0 points

### Password Strength Guidelines

**Strong Passwords Have:**
- At least 12 characters (longer is better)
- Mix of uppercase and lowercase letters
- Numbers and special characters
- No common patterns or dictionary words
- No personal information
- Unique to each service/account

**Avoid:**
- Common passwords (password123, qwerty, etc.)
- Sequential characters (abc123, 123456)
- Personal information (birthdays, names)
- Dictionary words
- Common substitutions (@ for a, 3 for e)

### Best Practices

1. **Use Password Managers**: 1Password, Bitwarden, LastPass
2. **Enable 2FA**: Two-factor authentication everywhere possible
3. **Unique Passwords**: Never reuse passwords across services
4. **Regular Checks**: Periodically check passwords for breaches
5. **Immediate Action**: Change breached passwords immediately
6. **Education**: Stay informed about password security

### Integration Examples

Check passwords during user creation:
```javascript
const { PasswordBreachChecker } = require('./lib/utils/password-breach-checker');
const checker = new PasswordBreachChecker();

const result = await checker.checkPassword(userPassword);
if (result.isBreached) {
  console.warn(`Warning: Password has been breached ${result.count} times!`);
  // Force user to choose different password
}
```

Log password changes with audit trail:
```javascript
const { auditIntegration } = require('./lib/utils/audit-integration');

await auditIntegration.logPasswordChange(
  'database',      // target
  'manual',        // method
  true,           // success
  false,          // compromised
  { user: 'admin' }
);
```

This comprehensive security framework ensures your focal-deploy instances are protected against common threats while remaining accessible and manageable for users of all skill levels.