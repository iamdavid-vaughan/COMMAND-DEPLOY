/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AcceptableUsePolicyPage() {
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
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Acceptable Use Policy</h1>
        <p className="text-gray-600 mb-8">Last Updated: January 20, 2025</p>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6 prose prose-blue max-w-none">

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. PURPOSE</h2>
            <p className="text-gray-700">
              This Acceptable Use Policy ("AUP") governs your use of Focal Deploy LLC's ("Focal Deploy", "we", "us", or "our") cloud deployment automation platform (the "Service"). This policy is designed to protect Focal Deploy, our users, and the internet community from irresponsible or illegal activities.
            </p>
            <p className="text-gray-700 font-semibold">
              BY USING THE SERVICE, YOU AGREE TO COMPLY WITH THIS AUP. VIOLATION MAY RESULT IN IMMEDIATE TERMINATION OF YOUR ACCOUNT WITHOUT REFUND.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. PROHIBITED ACTIVITIES</h2>
            <p className="text-gray-700 mb-4 font-semibold">You may NOT use the Service to:</p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.1 Illegal Activities</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Violate any local, state, national, or international law or regulation</li>
              <li>Engage in any activity that promotes illegal activities</li>
              <li>Deploy content related to illegal drugs, weapons, or other contraband</li>
              <li>Facilitate gambling, money laundering, or financial fraud</li>
              <li>Distribute child sexual abuse material (CSAM) or child exploitation content</li>
              <li>Engage in human trafficking or exploitation</li>
              <li>Violate export control or sanctions laws</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.2 Malicious or Harmful Content</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Deploy malware, viruses, ransomware, trojans, or other malicious code</li>
              <li>Distribute spyware, adware, or unwanted software</li>
              <li>Create or host phishing sites or fraudulent content</li>
              <li>Deploy keyloggers, rootkits, or other unauthorized monitoring tools</li>
              <li>Host content designed to exploit security vulnerabilities</li>
              <li>Distribute pirated software, media, or content</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.3 Abusive or Harmful Behavior</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Harass, threaten, stalk, or intimidate individuals</li>
              <li>Deploy hate speech, discrimination, or content promoting violence</li>
              <li>Engage in doxxing or unauthorized disclosure of personal information</li>
              <li>Impersonate any person, business, or entity</li>
              <li>Engage in cyberbullying or targeted harassment campaigns</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.4 Network Abuse and Attacks</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Launch denial-of-service (DoS) or distributed denial-of-service (DDoS) attacks</li>
              <li>Conduct port scanning, network probing, or vulnerability scanning without authorization</li>
              <li>Deploy botnets or command-and-control (C2) infrastructure</li>
              <li>Engage in IP spoofing or packet flooding</li>
              <li>Attempt to gain unauthorized access to systems, networks, or accounts</li>
              <li>Intercept or monitor network traffic without authorization</li>
              <li>Deploy honeypots or deceptive infrastructure for malicious purposes</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.5 Spam and Unwanted Communications</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Send unsolicited bulk email (spam)</li>
              <li>Deploy email bombing or SMS flooding attacks</li>
              <li>Harvest email addresses or scrape contact information</li>
              <li>Engage in chain letters, pyramid schemes, or multi-level marketing spam</li>
              <li>Deploy auto-dialers, robocalls, or SMS spamming infrastructure</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.6 Intellectual Property Violations</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Deploy applications that infringe copyrights, trademarks, patents, or trade secrets</li>
              <li>Host pirated software, games, movies, music, or other media</li>
              <li>Circumvent digital rights management (DRM) or copy protection systems</li>
              <li>Deploy unauthorized streaming or download sites</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.7 Resource Abuse</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Engage in cryptocurrency mining without explicit written authorization from Focal Deploy</li>
              <li>Consume excessive bandwidth, CPU, or storage resources</li>
              <li>Run applications designed to degrade service performance</li>
              <li>Deploy bitcoin mining, Ethereum mining, or similar resource-intensive operations</li>
              <li>Operate Tor exit nodes or proxy services for anonymous browsing without authorization</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.8 Fraud and Deception</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Deploy fraudulent websites, scams, or misleading content</li>
              <li>Engage in identity theft or credit card fraud</li>
              <li>Create fake reviews, ratings, or testimonials</li>
              <li>Operate Ponzi schemes, pyramid schemes, or investment fraud</li>
              <li>Deploy fake shopping sites or payment fraud infrastructure</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.9 Privacy Violations</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Collect personal information without consent or proper disclosure</li>
              <li>Violate data protection laws (GDPR, CCPA, etc.)</li>
              <li>Deploy tracking or surveillance tools without user consent</li>
              <li>Engage in unauthorized data scraping or harvesting</li>
              <li>Store or process sensitive data (PII, health records, financial data) without proper security measures</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">2.10 Service Abuse</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Circumvent usage limits, rate limits, or access controls</li>
              <li>Share account credentials with unauthorized parties</li>
              <li>Create multiple accounts to evade restrictions</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Interfere with or disrupt the Service or other users' use of the Service</li>
              <li>Use the Service for competitive analysis or benchmarking without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. CLOUD PROVIDER COMPLIANCE</h2>
            <p className="text-gray-700 mb-4">
              In addition to this AUP, you must comply with the acceptable use policies of all cloud providers you deploy to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>AWS Acceptable Use Policy:</strong>{' '}
                <a href="https://aws.amazon.com/aup/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  aws.amazon.com/aup
                </a>
              </li>
              <li><strong>Google Cloud Acceptable Use Policy:</strong>{' '}
                <a href="https://cloud.google.com/terms/aup" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  cloud.google.com/terms/aup
                </a>
              </li>
              <li><strong>DigitalOcean Terms of Service:</strong>{' '}
                <a href="https://www.digitalocean.com/legal/terms-of-service-agreement" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  digitalocean.com/legal/terms
                </a>
              </li>
            </ul>
            <p className="text-gray-700 mt-4">
              Violations of cloud provider policies may result in suspension or termination of your cloud resources <strong>and</strong> your Focal Deploy account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. SECURITY REQUIREMENTS</h2>
            <p className="text-gray-700 mb-4">You are required to:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Implement appropriate security measures for your applications and deployments</li>
              <li>Keep all software and dependencies up to date with security patches</li>
              <li>Use strong, unique passwords and enable two-factor authentication (2FA)</li>
              <li>Properly configure firewalls, security groups, and access controls</li>
              <li>Encrypt sensitive data in transit and at rest</li>
              <li>Monitor your deployments for security incidents</li>
              <li>Promptly address any security vulnerabilities discovered</li>
              <li>Report security incidents to Focal Deploy within 24 hours</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. REPORTING VIOLATIONS</h2>
            <p className="text-gray-700 mb-4">
              If you become aware of any violations of this AUP, please report them immediately to:
            </p>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-gray-700"><strong>Abuse Team</strong></p>
              <p className="text-gray-700">Email: <a href="mailto:abuse@focuswithfocal.com" className="text-blue-600 hover:underline">abuse@focuswithfocal.com</a></p>
              <p className="text-gray-700 mt-2 text-sm">Please include detailed information about the violation, including:</p>
              <ul className="list-disc list-inside text-gray-700 ml-4 text-sm mt-1">
                <li>Description of the violation</li>
                <li>URLs, IP addresses, or account information</li>
                <li>Date and time of the incident</li>
                <li>Any evidence or screenshots</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. ENFORCEMENT</h2>
            <p className="text-gray-700 mb-4">
              Focal Deploy reserves the right to investigate suspected violations of this AUP. Upon discovery of a violation, we may:
            </p>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">6.1 Immediate Actions</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Suspend or terminate your account without notice</li>
              <li>Remove or disable access to violating content</li>
              <li>Terminate your deployments and cloud resources</li>
              <li>Block your access to the Service</li>
              <li>Refuse future service</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">6.2 Legal Actions</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Report violations to law enforcement authorities</li>
              <li>Cooperate with legal investigations</li>
              <li>Pursue civil or criminal legal action</li>
              <li>Seek damages and injunctive relief</li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6">6.3 No Refunds</h3>
            <p className="text-gray-700">
              Accounts terminated for AUP violations are <strong>not eligible for refunds</strong>. You remain responsible for all fees incurred prior to termination.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. MONITORING AND INVESTIGATION</h2>
            <p className="text-gray-700">
              We reserve the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Monitor usage patterns and resource consumption</li>
              <li>Scan deployed content for malware and prohibited material</li>
              <li>Investigate complaints and abuse reports</li>
              <li>Access deployment logs and configurations when investigating violations</li>
              <li>Cooperate with third-party investigations</li>
            </ul>
            <p className="text-gray-700 mt-4">
              We will make reasonable efforts to notify you of investigations unless prohibited by law or when notification would impede the investigation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. INDEMNIFICATION</h2>
            <p className="text-gray-700">
              You agree to indemnify and hold Focal Deploy harmless from any claims, damages, losses, liabilities, and expenses (including attorney fees) arising from your violation of this AUP or your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. MODIFICATIONS</h2>
            <p className="text-gray-700">
              We reserve the right to modify this AUP at any time. Material changes will be communicated via email or through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated AUP.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. CONTACT INFORMATION</h2>
            <p className="text-gray-700 mb-4">
              For questions about this AUP, contact us at:
            </p>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-gray-700"><strong>Focal Deploy LLC</strong></p>
              <p className="text-gray-700">Email: <a href="mailto:legal@focuswithfocal.com" className="text-blue-600 hover:underline">legal@focuswithfocal.com</a></p>
              <p className="text-gray-700">Abuse Reports: <a href="mailto:abuse@focuswithfocal.com" className="text-blue-600 hover:underline">abuse@focuswithfocal.com</a></p>
              <p className="text-gray-700">Support: <a href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:underline">support@focuswithfocal.com</a></p>
            </div>
          </section>

          <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded mt-8">
            <p className="text-sm text-red-900 font-semibold mb-2">
              IMPORTANT: VIOLATION OF THIS ACCEPTABLE USE POLICY MAY RESULT IN IMMEDIATE TERMINATION OF YOUR ACCOUNT, LEGAL ACTION, AND REPORTING TO LAW ENFORCEMENT.
            </p>
            <p className="text-sm text-red-800 mb-2">
              BY USING FOCAL DEPLOY, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO COMPLY WITH THIS ACCEPTABLE USE POLICY.
            </p>
            <p className="text-xs text-red-700">
              © 2025 Focal Deploy LLC. All rights reserved.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 text-sm">
          <Link href="/legal/terms" className="text-blue-600 hover:underline font-medium">
            Terms of Service →
          </Link>
          <Link href="/legal/privacy" className="text-blue-600 hover:underline font-medium">
            Privacy Policy →
          </Link>
          <Link href="/legal/eula" className="text-blue-600 hover:underline font-medium">
            EULA →
          </Link>
        </div>
      </div>
    </div>
  );
}
