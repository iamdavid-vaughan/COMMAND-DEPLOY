/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
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
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-600 mb-8">Last Updated: January 20, 2025</p>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6 prose prose-blue max-w-none">

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. AGREEMENT TO TERMS</h2>
            <p className="text-gray-700">
              These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you", or "your") and Focal Deploy LLC ("Focal Deploy", "Company", "we", "us", or "our") concerning your access to and use of the Focal Deploy platform and services (the "Service").
            </p>
            <p className="text-gray-700 font-semibold">
              BY ACCESSING OR USING THE SERVICE, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE TO ALL OF THESE TERMS, DO NOT ACCESS OR USE THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. DESCRIPTION OF SERVICE</h2>
            <p className="text-gray-700">
              Focal Deploy provides a cloud deployment automation platform that enables users to deploy applications to Amazon Web Services (AWS), Google Cloud Platform (GCP), and other cloud providers through a web interface, command-line interface (CLI), and API.
            </p>
            <p className="text-gray-700">
              The Service is currently in <strong>beta</strong> and is provided on an "AS IS" basis. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. ELIGIBILITY</h2>
            <p className="text-gray-700">
              You must be at least 18 years old and able to enter into legally binding contracts to use the Service. By using the Service, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>You are at least 18 years of age</li>
              <li>You have the legal capacity to enter into these Terms</li>
              <li>You are not prohibited from using the Service under applicable law</li>
              <li>All information you provide is accurate and truthful</li>
              <li>You will maintain the accuracy of such information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. ACCOUNT REGISTRATION</h2>
            <p className="text-gray-700">
              To use the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Provide accurate, current, and complete registration information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account credentials</li>
              <li>Accept all risks of unauthorized access to your account</li>
              <li>Notify us immediately of any unauthorized use or security breach</li>
              <li>Be responsible for all activities that occur under your account</li>
            </ul>
            <p className="text-gray-700 mt-4">
              We reserve the right to refuse service, terminate accounts, or remove content at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. USER RESPONSIBILITIES</h2>
            <p className="text-gray-700">
              You are solely responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>Your Content:</strong> All data, code, applications, and content you deploy through the Service</li>
              <li><strong>Cloud Credentials:</strong> Securing and managing your AWS, GCP, and other cloud provider credentials</li>
              <li><strong>Cloud Costs:</strong> All charges incurred on your cloud provider accounts, regardless of whether deployments were successful</li>
              <li><strong>Backups:</strong> Creating and maintaining backups of your data and applications</li>
              <li><strong>Compliance:</strong> Ensuring your use of the Service complies with all applicable laws and regulations</li>
              <li><strong>Security:</strong> Implementing appropriate security measures for your deployments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. PROHIBITED USES</h2>
            <p className="text-gray-700 font-semibold">You agree NOT to use the Service to:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Violate any laws, regulations, or third-party rights</li>
              <li>Deploy illegal, harmful, threatening, abusive, or offensive content</li>
              <li>Engage in cryptocurrency mining without explicit written authorization</li>
              <li>Launch attacks, distribute malware, spam, or conduct denial-of-service attacks</li>
              <li>Attempt to gain unauthorized access to systems, networks, or accounts</li>
              <li>Interfere with or disrupt the Service, servers, or networks</li>
              <li>Circumvent any security features or access controls</li>
              <li>Use the Service for benchmarking or competitive analysis without permission</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Scrape, harvest, or collect user data without consent</li>
              <li>Impersonate any person or entity</li>
              <li>Deploy applications that infringe intellectual property rights</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Violation of these prohibitions may result in immediate termination of your account without refund, and we may report violations to law enforcement authorities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. FEES AND PAYMENT</h2>
            <p className="text-gray-700">
              Certain features of the Service require payment of subscription fees. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Pay all fees according to the pricing plan you select</li>
              <li>Provide accurate billing information</li>
              <li>Authorize automatic recurring charges to your payment method</li>
              <li>Pay all applicable taxes</li>
              <li>Update payment information if your payment method expires</li>
            </ul>
            <p className="text-gray-700 mt-4">
              <strong>Refund Policy:</strong> Fees are generally non-refundable except as required by law or as explicitly stated in your subscription plan. We may offer refunds at our sole discretion.
            </p>
            <p className="text-gray-700 mt-4">
              <strong>Price Changes:</strong> We reserve the right to modify pricing with 30 days' notice to existing customers. New prices will apply to renewals.
            </p>
            <p className="text-gray-700 mt-4">
              <strong>Late Payments:</strong> Failure to pay may result in suspension or termination of your account and access to the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. FREE TRIAL</h2>
            <p className="text-gray-700">
              We may offer a 7-day free trial to new users. Free trial terms:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Requires valid payment method</li>
              <li>Automatically converts to paid subscription unless canceled</li>
              <li>Limited to one trial per user/organization</li>
              <li>May include usage limits or feature restrictions</li>
              <li>Can be canceled anytime during the trial period</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. INTELLECTUAL PROPERTY</h2>
            <p className="text-gray-700">
              <strong>Our IP:</strong> The Service, including all software, code, algorithms, designs, text, graphics, logos, and documentation, is owned by Focal Deploy and protected by copyright, trademark, and other intellectual property laws. You receive no ownership rights through use of the Service.
            </p>
            <p className="text-gray-700 mt-4">
              <strong>Your IP:</strong> You retain all rights to your applications, code, data, and content. By using the Service, you grant us a limited license to host, process, and transmit your content solely to provide the Service.
            </p>
            <p className="text-gray-700 mt-4">
              <strong>Feedback:</strong> Any feedback, suggestions, or ideas you provide about the Service become our property, and we may use them without restriction or compensation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. PRIVACY</h2>
            <p className="text-gray-700">
              Your privacy is important to us. Our collection and use of personal information is governed by our{' '}
              <Link href="/legal/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. DATA SECURITY</h2>
            <p className="text-gray-700">
              We implement industry-standard security measures, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>AES-256-GCM encryption for stored cloud credentials</li>
              <li>TLS/SSL encryption for data in transit</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls and authentication measures</li>
            </ul>
            <p className="text-gray-700 mt-4">
              However, you acknowledge that no system is completely secure, and we cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. SERVICE LEVEL AND UPTIME</h2>
            <p className="text-gray-700">
              While we strive for high availability, the Service is provided "AS IS" during beta. We target 99.9% uptime but do not guarantee it. We are not liable for:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Scheduled maintenance downtime</li>
              <li>Third-party service failures (AWS, GCP, DNS providers, etc.)</li>
              <li>Force majeure events</li>
              <li>Interruptions caused by User actions or violations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. DISCLAIMER OF WARRANTIES</h2>
            <p className="text-gray-700 font-semibold bg-gray-100 p-4 rounded">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </p>
            <p className="text-gray-700 mt-4">
              WE DO NOT WARRANT THAT:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>The Service will meet your requirements</li>
              <li>The Service will be uninterrupted, secure, or error-free</li>
              <li>Results obtained from the Service will be accurate or reliable</li>
              <li>Defects will be corrected</li>
              <li>Your data will not be lost or corrupted</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. LIMITATION OF LIABILITY</h2>
            <p className="text-gray-700 font-semibold bg-red-50 border-l-4 border-red-600 p-4 rounded">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FOCAL DEPLOY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES ARISING FROM YOUR USE OF THE SERVICE.
            </p>
            <p className="text-gray-700 mt-4">
              <strong>OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO FOCAL DEPLOY IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.</strong>
            </p>
            <p className="text-gray-700 mt-4">
              This limitation applies regardless of the legal theory (contract, tort, negligence, strict liability, or otherwise) and even if we were advised of the possibility of such damages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. INDEMNIFICATION</h2>
            <p className="text-gray-700">
              You agree to indemnify, defend, and hold harmless Focal Deploy, its officers, directors, employees, agents, and affiliates from any claims, liabilities, damages, losses, and expenses (including attorney fees) arising from:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Your use or misuse of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any laws or third-party rights</li>
              <li>Your content, applications, or deployments</li>
              <li>Unauthorized access to your cloud accounts</li>
              <li>Cloud provider charges incurred through your use of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">16. TERMINATION</h2>
            <p className="text-gray-700">
              <strong>By You:</strong> You may terminate your account at any time by contacting support at support@focuswithfocal.com. Paid fees are non-refundable.
            </p>
            <p className="text-gray-700 mt-4">
              <strong>By Us:</strong> We may suspend or terminate your access immediately, without notice, for:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Violation of these Terms or our policies</li>
              <li>Non-payment of fees</li>
              <li>Illegal or abusive use of the Service</li>
              <li>At our sole discretion for any reason</li>
            </ul>
            <p className="text-gray-700 mt-4">
              <strong>Effect of Termination:</strong> Upon termination, your right to use the Service ceases immediately. We are not obligated to retain your data after termination.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">17. MODIFICATIONS TO SERVICE AND TERMS</h2>
            <p className="text-gray-700">
              We reserve the right to modify or discontinue the Service or any feature at any time without notice.
            </p>
            <p className="text-gray-700 mt-4">
              We may update these Terms at any time. Material changes will be communicated via email or through the Service. Your continued use after such modifications constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">18. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
            <p className="text-gray-700">
              These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.
            </p>
            <p className="text-gray-700 mt-4 font-semibold">
              <strong>ARBITRATION:</strong> Any dispute arising from these Terms or the Service shall be resolved through binding arbitration in accordance with the American Arbitration Association's Commercial Arbitration Rules, conducted in Delaware.
            </p>
            <p className="text-gray-700 mt-4 font-semibold">
              <strong>CLASS ACTION WAIVER:</strong> You waive your right to participate in class actions, class arbitrations, or representative actions. All disputes must be brought individually.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">19. GENERAL PROVISIONS</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Entire Agreement:</strong> These Terms, together with the EULA, Privacy Policy, and AUP, constitute the entire agreement</li>
              <li><strong>Severability:</strong> If any provision is found unenforceable, the remaining provisions remain in effect</li>
              <li><strong>No Waiver:</strong> Our failure to enforce any right does not waive that right</li>
              <li><strong>Assignment:</strong> You may not assign these Terms without our written consent. We may assign them freely.</li>
              <li><strong>Force Majeure:</strong> We are not liable for delays or failures caused by events beyond our control</li>
              <li><strong>Headings:</strong> Section headings are for convenience only and do not affect interpretation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">20. CONTACT INFORMATION</h2>
            <p className="text-gray-700">
              For questions about these Terms, contact us at:
            </p>
            <div className="bg-gray-50 p-4 rounded mt-4">
              <p className="text-gray-700"><strong>Focal Deploy LLC</strong></p>
              <p className="text-gray-700">Email: legal@focuswithfocal.com</p>
              <p className="text-gray-700">Support: support@focuswithfocal.com</p>
            </div>
          </section>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded mt-8">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              BY USING FOCAL DEPLOY, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM.
            </p>
            <p className="text-xs text-blue-800">
              © 2025 Focal Deploy LLC. All rights reserved.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 text-sm">
          <Link href="/legal/privacy" className="text-blue-600 hover:underline font-medium">
            Privacy Policy →
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
