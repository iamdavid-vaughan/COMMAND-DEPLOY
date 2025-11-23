/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">Last Updated: January 20, 2025</p>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6 prose prose-blue max-w-none">

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. INTRODUCTION</h2>
            <p className="text-gray-700">
              Focal Deploy LLC ("Focal Deploy", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our cloud deployment automation platform (the "Service").
            </p>
            <p className="text-gray-700 font-semibold">
              BY USING THE SERVICE, YOU CONSENT TO THE DATA PRACTICES DESCRIBED IN THIS POLICY.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. INFORMATION WE COLLECT</h2>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.1 Information You Provide Directly</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, company name, password</li>
              <li><strong>Billing Information:</strong> Credit card details, billing address (processed by our payment processor Stripe)</li>
              <li><strong>Cloud Credentials:</strong> AWS access keys, GCP service account keys, DigitalOcean API tokens (encrypted with AES-256-GCM)</li>
              <li><strong>Deployment Configurations:</strong> Application code, environment variables, server configurations</li>
              <li><strong>Support Communications:</strong> Messages, attachments, and metadata when you contact support</li>
              <li><strong>Profile Information:</strong> Avatar images, preferences, settings</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>Usage Data:</strong> Deployment logs, API calls, feature usage, session duration</li>
              <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
              <li><strong>Log Data:</strong> Access times, pages viewed, errors, performance metrics</li>
              <li><strong>Cookies and Tracking:</strong> Session cookies, authentication tokens, analytics data</li>
              <li><strong>Location Data:</strong> Geographic location based on IP address</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.3 Information from Third Parties</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>OAuth Providers:</strong> When you sign in with Google or GitHub, we receive your name, email, and profile picture</li>
              <li><strong>Cloud Providers:</strong> Metadata about your cloud resources (instance IDs, regions, IP addresses)</li>
              <li><strong>Payment Processors:</strong> Transaction confirmations and payment status from Stripe</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. HOW WE USE YOUR INFORMATION</h2>
            <p className="text-gray-700 mb-4">We use your information to:</p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">3.1 Provide and Improve the Service</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Create and manage your account</li>
              <li>Deploy applications to cloud providers on your behalf</li>
              <li>Process payments and maintain billing records</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Monitor, analyze, and improve Service performance</li>
              <li>Develop new features and functionality</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">3.2 Communication</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Send deployment notifications and status updates</li>
              <li>Provide technical support and service announcements</li>
              <li>Send marketing communications (with your consent)</li>
              <li>Request feedback and conduct surveys</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">3.3 Security and Compliance</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Enforce our Terms of Service and policies</li>
              <li>Comply with legal obligations and law enforcement requests</li>
              <li>Protect our rights, property, and safety</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">3.4 Analytics and Research</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Analyze usage patterns and trends</li>
              <li>Conduct research and development</li>
              <li>Create aggregated, de-identified statistics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. DATA SECURITY</h2>
            <p className="text-gray-700 mb-4">We implement robust security measures to protect your information:</p>

            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>Encryption at Rest:</strong> Cloud credentials encrypted with AES-256-GCM</li>
              <li><strong>Encryption in Transit:</strong> All data transmitted over TLS 1.3</li>
              <li><strong>Access Controls:</strong> Role-based access control (RBAC) and least privilege principle</li>
              <li><strong>Authentication:</strong> Password hashing with bcrypt, optional two-factor authentication (2FA)</li>
              <li><strong>Infrastructure Security:</strong> Regular security audits, penetration testing, and vulnerability scanning</li>
              <li><strong>Monitoring:</strong> 24/7 security monitoring and intrusion detection</li>
              <li><strong>Data Isolation:</strong> Multi-tenant architecture with logical data separation</li>
            </ul>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded mt-4">
              <p className="text-sm text-yellow-900">
                <strong>Important:</strong> No security system is impenetrable. While we use industry-standard measures, we cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. DATA SHARING AND DISCLOSURE</h2>
            <p className="text-gray-700 mb-4">We share your information only in the following circumstances:</p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">5.1 Service Providers</h3>
            <p className="text-gray-700 mb-2">We share data with trusted third parties who assist us:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>Cloud Infrastructure:</strong> AWS, Google Cloud (hosting and storage)</li>
              <li><strong>Payment Processing:</strong> Stripe (credit card processing)</li>
              <li><strong>Email Services:</strong> SendGrid (transactional emails)</li>
              <li><strong>Analytics:</strong> Google Analytics, Plausible (usage analytics)</li>
              <li><strong>Error Tracking:</strong> Sentry (error monitoring)</li>
              <li><strong>Customer Support:</strong> Zendesk or similar (support tickets)</li>
            </ul>
            <p className="text-gray-700 mt-2 text-sm">
              These providers are bound by confidentiality agreements and may only use your data to perform services on our behalf.
            </p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">5.2 Legal Requirements</h3>
            <p className="text-gray-700">We may disclose your information if required by law or in response to:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Subpoenas, court orders, or legal processes</li>
              <li>Requests from law enforcement or government agencies</li>
              <li>National security or public safety requirements</li>
              <li>Protection of our rights, property, or safety</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">5.3 Business Transfers</h3>
            <p className="text-gray-700">
              In the event of a merger, acquisition, bankruptcy, or sale of assets, your information may be transferred to the successor entity. We will notify you of any such change in ownership.
            </p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">5.4 With Your Consent</h3>
            <p className="text-gray-700">
              We may share your information for other purposes with your explicit consent.
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mt-4">
              <p className="text-sm text-blue-900">
                <strong>We do NOT sell your personal information to third parties.</strong>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. DATA RETENTION</h2>
            <p className="text-gray-700">We retain your information for as long as necessary to:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Provide the Service and fulfill our contractual obligations</li>
              <li>Comply with legal, tax, and accounting requirements (typically 7 years)</li>
              <li>Resolve disputes and enforce our agreements</li>
              <li>Maintain security and prevent fraud</li>
            </ul>
            <p className="text-gray-700 mt-4">
              <strong>Deletion:</strong> When you close your account, we delete or anonymize your personal information within 90 days, except where retention is required by law. Backup copies may persist for up to 30 additional days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. YOUR RIGHTS AND CHOICES</h2>
            <p className="text-gray-700 mb-4">Depending on your location, you may have the following rights:</p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">7.1 Access and Portability</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Request a copy of your personal information</li>
              <li>Export your deployment configurations and data</li>
              <li>Receive your data in a portable format</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">7.2 Correction and Deletion</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Update or correct your account information</li>
              <li>Request deletion of your personal information</li>
              <li>Close your account</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">7.3 Opt-Out and Restrictions</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Unsubscribe from marketing emails (via link in emails)</li>
              <li>Disable cookies (though some features may not work)</li>
              <li>Restrict processing of your data</li>
              <li>Object to automated decision-making</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">7.4 How to Exercise Your Rights</h3>
            <p className="text-gray-700">
              To exercise any of these rights, contact us at <a href="mailto:privacy@focuswithfocal.com" className="text-blue-600 hover:underline">privacy@focuswithfocal.com</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. COOKIES AND TRACKING TECHNOLOGIES</h2>
            <p className="text-gray-700 mb-4">We use cookies and similar technologies to:</p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">8.1 Types of Cookies</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for authentication and security (cannot be disabled)</li>
              <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
              <li><strong>Analytics Cookies:</strong> Track usage and performance (Google Analytics, Plausible)</li>
              <li><strong>Session Cookies:</strong> Temporary cookies deleted when you close your browser</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">8.2 Managing Cookies</h3>
            <p className="text-gray-700">
              You can control cookies through your browser settings. Note that disabling cookies may limit Service functionality. Visit{' '}
              <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                www.allaboutcookies.org
              </a>{' '}
              for instructions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. INTERNATIONAL DATA TRANSFERS</h2>
            <p className="text-gray-700">
              Your information may be transferred to and processed in the United States and other countries where our service providers operate. These countries may have different data protection laws than your country of residence.
            </p>
            <p className="text-gray-700 mt-4">
              <strong>EU/EEA Users:</strong> We rely on Standard Contractual Clauses approved by the European Commission for transfers outside the EU/EEA.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. CHILDREN'S PRIVACY</h2>
            <p className="text-gray-700">
              The Service is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, contact us immediately at{' '}
              <a href="mailto:privacy@focuswithfocal.com" className="text-blue-600 hover:underline">privacy@focuswithfocal.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. CALIFORNIA PRIVACY RIGHTS (CCPA)</h2>
            <p className="text-gray-700 mb-4">California residents have additional rights under the California Consumer Privacy Act (CCPA):</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Right to know what personal information we collect, use, and share</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of the sale of personal information (we do not sell your information)</li>
              <li>Right to non-discrimination for exercising your rights</li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise these rights, email <a href="mailto:privacy@focuswithfocal.com" className="text-blue-600 hover:underline">privacy@focuswithfocal.com</a> with "California Privacy Rights" in the subject line.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. EUROPEAN PRIVACY RIGHTS (GDPR)</h2>
            <p className="text-gray-700 mb-4">If you are in the EU/EEA, you have additional rights under the General Data Protection Regulation (GDPR):</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Right to access your personal data</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Right to withdraw consent</li>
              <li>Right to lodge a complaint with a supervisory authority</li>
            </ul>
            <p className="text-gray-700 mt-4">
              <strong>Legal Basis for Processing:</strong> We process your data based on:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Performance of a contract (providing the Service)</li>
              <li>Legitimate interests (improving the Service, security)</li>
              <li>Compliance with legal obligations</li>
              <li>Your consent (marketing communications)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. DO NOT TRACK SIGNALS</h2>
            <p className="text-gray-700">
              Some browsers support "Do Not Track" (DNT) signals. Because there is no industry standard for DNT, we do not currently respond to DNT signals. We will update this policy if standards are established.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. CHANGES TO THIS PRIVACY POLICY</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. Material changes will be communicated via email or a prominent notice on the Service. The "Last Updated" date at the top indicates when the policy was last revised.
            </p>
            <p className="text-gray-700 mt-4">
              Your continued use of the Service after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. CONTACT US</h2>
            <p className="text-gray-700 mb-4">
              For questions, concerns, or to exercise your privacy rights, contact us at:
            </p>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-gray-700"><strong>Focal Deploy LLC</strong></p>
              <p className="text-gray-700">Privacy Officer</p>
              <p className="text-gray-700">Email: <a href="mailto:privacy@focuswithfocal.com" className="text-blue-600 hover:underline">privacy@focuswithfocal.com</a></p>
              <p className="text-gray-700">Support: <a href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:underline">support@focuswithfocal.com</a></p>
            </div>
          </section>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded mt-8">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              BY USING FOCAL DEPLOY, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THIS PRIVACY POLICY.
            </p>
            <p className="text-xs text-blue-800">
              © 2025 Focal Deploy LLC. All rights reserved. This document is proprietary and confidential.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 text-sm">
          <Link href="/legal/terms" className="text-blue-600 hover:underline font-medium">
            Terms of Service →
          </Link>
          <Link href="/legal/eula" className="text-blue-600 hover:underline font-medium">
            EULA →
          </Link>
          <Link href="/legal/aup" className="text-blue-600 hover:underline font-medium">
            Acceptable Use Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
