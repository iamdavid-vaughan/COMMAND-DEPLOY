# FOCAL DEPLOY END USER LICENSE AGREEMENT (EULA)

**Effective Date:** November 11, 2025
**Version:** 1.0

## PLEASE READ CAREFULLY

This End User License Agreement ("Agreement") is a legal agreement between you (either an individual or a single entity, "You" or "User") and DNS Publishing, LLC ("Company", "We", "Us", "Focal Deploy") for the use of Focal Deploy software, services, and related materials (collectively, the "Service").

**BY CLICKING "I ACCEPT", INSTALLING, OR USING THE SERVICE, YOU AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT USE THE SERVICE.**

---

## 1. DEFINITIONS

- **Service**: The Focal Deploy CLI tool, API, web dashboard, and all related software and services
- **Account**: Your registered user account with credentials and license information
- **Deployment**: The act of provisioning and configuring AWS infrastructure using the Service
- **License Tier**: The subscription level (Basic, Professional, or Enterprise) you have purchased

---

## 2. LICENSE GRANT

Subject to your compliance with this Agreement and payment of applicable fees:

### 2.1 Grant
We grant you a limited, non-exclusive, non-transferable, revocable right to:
- Install and use the Focal Deploy CLI on your devices
- Access the Focal Deploy API and web dashboard
- Deploy applications to your AWS account using the Service

### 2.2 License Scope
Your license is limited to the tier you have purchased:

**BASIC ($29/month)**
- Up to 3 deployments per month
- Community support via Discord
- Single user account
- Standard features

**PROFESSIONAL ($99/month)**
- Unlimited deployments
- Email support (48-hour response SLA)
- Up to 5 team members
- Advanced security features
- Priority feature requests

**ENTERPRISE (Custom Pricing)**
- Unlimited deployments
- Priority support (4-hour response SLA)
- Unlimited team members
- Custom integrations and white-labeling
- On-premises deployment option
- Dedicated account manager

---

## 3. RESTRICTIONS

You agree NOT to:

### 3.1 Prohibited Uses
- Reverse engineer, decompile, or disassemble the Service
- Remove or modify any copyright or proprietary notices
- Use the Service for illegal purposes
- Attempt to bypass usage limitations or security measures
- Share account credentials with unauthorized users
- Resell or sublicense the Service without an Enterprise license

### 3.2 Service Resale
You may NOT use the Service to provide deployment services to third parties unless you have an active Enterprise license with white-label rights.

### 3.3 Abuse Prevention
We reserve the right to suspend accounts that:
- Exceed reasonable API usage limits (rate limiting)
- Engage in malicious activity or attacks
- Violate AWS terms of service
- Fail to pay subscription fees

---

## 4. ACCOUNT AND SECURITY

### 4.1 Account Creation
You must:
- Provide accurate registration information
- Maintain the security of your account credentials
- Promptly notify us of any unauthorized use
- Be responsible for all activity under your account

### 4.2 AWS Credentials
By using this Service, you acknowledge:
- You are providing your AWS credentials voluntarily
- Credentials are encrypted using AES-256-GCM before storage
- We never access your AWS resources without explicit deployment commands
- You retain full ownership of all AWS resources created
- You are responsible for AWS charges incurred

### 4.3 Data Collection
We collect:
- Account information (email, name, company)
- Usage analytics (deployments, commands used, errors)
- Encrypted AWS credentials (for Just-In-Time deployment)
- Billing and payment information

We do NOT collect:
- Your application source code
- Application secrets or environment variables
- AWS resource data beyond what's needed for deployment

---

## 5. PAYMENT AND BILLING

### 5.1 Subscription Fees
- Fees are charged monthly or annually based on your chosen billing cycle
- All fees are in USD unless otherwise specified
- You authorize us to charge your payment method on file

### 5.2 Payment Processing
- We use Authorize.Net for secure payment processing
- Credit card information is never stored on our servers
- You agree to Authorize.Net's terms and privacy policy

### 5.3 Refunds
- **14-Day Money-Back Guarantee**: Full refund if requested within 14 days of initial purchase
- No refunds for partial months or annual subscriptions after 14 days
- Enterprise contracts have separate refund terms

### 5.4 Price Changes
- We may change pricing with 30 days advance notice
- Existing subscribers are grandfathered at their current rate for 12 months
- You may cancel before price change takes effect

### 5.5 Late Payment
- Accounts with failed payments are suspended after 5 days
- Reactivation requires payment of outstanding balance
- Accounts deleted after 30 days of non-payment

---

## 6. SERVICE AVAILABILITY

### 6.1 Uptime
We strive for 99.9% uptime but do not guarantee uninterrupted access. Scheduled maintenance will be announced 48 hours in advance.

### 6.2 Service Limitations
- API rate limits apply (varies by tier)
- Large deployments may require additional time
- We reserve the right to throttle excessive usage

### 6.3 No SLA (Basic/Pro)
Basic and Professional tiers do not include uptime SLAs. Enterprise customers receive SLA guarantees in their contract.

---

## 7. SUPPORT

### 7.1 Support Channels
- **Basic**: Community Discord, documentation
- **Professional**: Email support (support@focuswithfocal.com), 48-hour response
- **Enterprise**: Priority email + phone, 4-hour response, dedicated Slack channel

### 7.2 Support Scope
Support covers:
- Focal Deploy software bugs and issues
- Deployment configuration assistance
- Best practices guidance

Support does NOT cover:
- Your application code debugging
- AWS account setup or billing issues
- Third-party integrations (unless Enterprise)

---

## 8. TERMINATION

### 8.1 Termination by You
You may cancel your subscription at any time:
- Cancellation takes effect at end of current billing period
- No refunds for partial periods (except 14-day guarantee)
- You retain access until subscription expires

### 8.2 Termination by Us
We may suspend or terminate your account if:
- You violate this Agreement
- Payment fails and remains unpaid for 30 days
- You engage in abusive or illegal activity
- We discontinue the Service (with 60 days notice)

### 8.3 Effect of Termination
Upon termination:
- Your access to the Service is revoked
- Encrypted credentials are deleted from our systems
- Your AWS resources remain untouched (you retain full control)
- You must cease using the Focal Deploy CLI and API

---

## 9. INTELLECTUAL PROPERTY

### 9.1 Our IP
Focal Deploy retains all rights to:
- The Service source code and algorithms
- Trademarks, logos, and branding
- Documentation and tutorials
- API designs and architectures

### 9.2 Your IP
You retain all rights to:
- Your application source code
- Your AWS infrastructure and data
- Your business logic and secrets
- Your deployments and configurations

### 9.3 Feedback
If you provide feedback or suggestions, we may use them freely without compensation or attribution.

---

## 10. WARRANTIES AND DISCLAIMERS

### 10.1 Limited Warranty
We warrant that the Service will substantially conform to our documentation under normal use.

### 10.2 DISCLAIMER
**THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.**

We do NOT warrant that:
- The Service will be error-free or uninterrupted
- Deployments will always succeed
- AWS resources will function as expected
- The Service meets your specific requirements

---

## 11. LIMITATION OF LIABILITY

### 11.1 Liability Cap
**IN NO EVENT SHALL FOCAL DEPLOY'S TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID IN THE 12 MONTHS PRECEDING THE CLAIM.**

### 11.2 Excluded Damages
**WE SHALL NOT BE LIABLE FOR:**
- Indirect, incidental, special, or consequential damages
- Lost profits, data, or business opportunities
- AWS charges resulting from Service use
- Damages from service interruptions or data loss
- Third-party actions or integrations

### 11.3 AWS Responsibility
You acknowledge that:
- AWS charges are your responsibility
- We are not liable for unexpected AWS costs
- You should monitor your AWS billing dashboard
- You can set AWS billing alerts to prevent overages

---

## 12. INDEMNIFICATION

You agree to indemnify and hold Focal Deploy harmless from any claims, damages, or expenses arising from:
- Your violation of this Agreement
- Your violation of AWS terms of service
- Your application code or deployments
- Unauthorized use of your account

---

## 13. PRIVACY AND DATA PROTECTION

### 13.1 Privacy Policy
Our Privacy Policy (https://focuswithfocal.com/privacy) explains how we collect, use, and protect your data.

### 13.2 Data Processing
For EU users, we comply with GDPR:
- You may request data export or deletion
- We process data only as necessary for service delivery
- Data is stored in SOC 2 compliant data centers

### 13.3 Data Retention
- Account data retained while subscription is active
- Credentials deleted within 30 days of termination
- Billing records retained for 7 years (legal requirement)
- Analytics data anonymized after 90 days

---

## 14. CHANGES TO THIS AGREEMENT

### 14.1 Modifications
We may update this Agreement:
- Changes announced 30 days in advance via email
- Continued use after change date constitutes acceptance
- Material changes require explicit acceptance

### 14.2 Notification
We will notify you of changes via:
- Email to your registered address
- In-app notifications
- Website banner announcements

---

## 15. GOVERNING LAW

This Agreement is governed by the laws of [Your State/Country], without regard to conflict of law principles. Any disputes shall be resolved in the courts of [Your Jurisdiction].

---

## 16. MISCELLANEOUS

### 16.1 Entire Agreement
This Agreement, together with our Privacy Policy and any order forms, constitutes the entire agreement between you and Focal Deploy.

### 16.2 Severability
If any provision is found invalid, the remaining provisions continue in full effect.

### 16.3 No Waiver
Our failure to enforce any right does not constitute a waiver of that right.

### 16.4 Assignment
You may not assign this Agreement without our consent. We may assign this Agreement to an acquirer or successor.

### 16.5 Force Majeure
We are not liable for delays or failures due to circumstances beyond our reasonable control (natural disasters, war, pandemics, internet outages, etc.).

---

## 17. CONTACT INFORMATION

**DNS Publishing, LLC (Focal Deploy)**
Email: legal@focuswithfocal.com
Support: support@focuswithfocal.com
Website: https://focuswithfocal.com

For Enterprise licensing: enterprise@focuswithfocal.com
For billing questions: billing@focuswithfocal.com

---

## ACCEPTANCE

By clicking "I Accept", creating an account, or using the Service, you acknowledge that you have read, understood, and agree to be bound by this End User License Agreement.

**Last Updated:** November 11, 2025
**Version:** 1.0

---

© 2025 DNS Publishing, LLC. All Rights Reserved.
