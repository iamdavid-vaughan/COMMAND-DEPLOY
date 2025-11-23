/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function EULAPage() {
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
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">End User License Agreement</h1>
        <p className="text-gray-600 mb-8">Last Updated: January 20, 2025</p>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6 prose prose-blue max-w-none">

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. ACCEPTANCE OF TERMS</h2>
            <p className="text-gray-700">
              This End User License Agreement ("Agreement") is a legal agreement between you ("User", "you", or "your") and Focal Deploy LLC ("Focal Deploy", "we", "us", or "our") governing your use of the Focal Deploy cloud deployment automation platform and services (collectively, the "Service").
            </p>
            <p className="text-gray-700 font-semibold">
              BY CLICKING "I AGREE," REGISTERING FOR AN ACCOUNT, OR USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THIS AGREEMENT. IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. LICENSE GRANT</h2>
            <p className="text-gray-700">
              Subject to your compliance with this Agreement and payment of applicable fees, Focal Deploy grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes.
            </p>
            <p className="text-gray-700">
              This license does not permit you to: (a) resell, distribute, or sublicense the Service; (b) reverse engineer, decompile, or disassemble the Service; (c) remove or modify any proprietary notices; or (d) use the Service for any illegal or unauthorized purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. BETA SOFTWARE DISCLAIMER</h2>
            <p className="text-gray-700 font-semibold bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              THE SERVICE IS CURRENTLY IN BETA AND PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. You acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>The Service may contain bugs, errors, and defects</li>
              <li>Features may change or be removed without notice</li>
              <li>Service availability is not guaranteed</li>
              <li>Data loss may occur - regular backups are YOUR responsibility</li>
              <li>The Service is NOT suitable for mission-critical applications</li>
              <li>You use the Service at your own risk</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. CLOUD CREDENTIAL SECURITY</h2>
            <p className="text-gray-700">
              You are solely responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li><strong>Security of your AWS, GCP, and other cloud provider credentials</strong></li>
              <li>All costs and charges incurred in your cloud accounts</li>
              <li>Monitoring your cloud resource usage</li>
              <li>Configuring appropriate spending limits and alerts</li>
              <li>Reviewing and approving all deployment configurations before execution</li>
            </ul>
            <p className="text-gray-700 font-semibold bg-red-50 border-l-4 border-red-500 p-4 rounded mt-4">
              FOCAL DEPLOY IS NOT LIABLE FOR ANY UNAUTHORIZED ACCESS TO YOUR CLOUD CREDENTIALS, EXCESSIVE CLOUD CHARGES, DATA LOSS, OR ANY OTHER DAMAGES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. PAYMENT AND FEES</h2>
            <p className="text-gray-700">
              Access to certain features requires payment of subscription fees. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Pay all fees in accordance with the pricing plan you select</li>
              <li>Provide accurate and current billing information</li>
              <li>Authorize automatic recurring charges</li>
              <li>Pay for seat-based licensing as applicable</li>
            </ul>
            <p className="text-gray-700">
              Fees are non-refundable except as required by law. We reserve the right to modify pricing with 30 days' notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. ACCEPTABLE USE POLICY</h2>
            <p className="text-gray-700 font-semibold">You agree NOT to use the Service to:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Violate any laws, regulations, or third-party rights</li>
              <li>Deploy illegal, harmful, or malicious content</li>
              <li>Engage in cryptocurrency mining without explicit authorization</li>
              <li>Launch attacks, spam, or other abusive activities</li>
              <li>Attempt to gain unauthorized access to systems or networks</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Exceed rate limits or abuse API access</li>
              <li>Share your account credentials with unauthorized parties</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Violation of this Acceptable Use Policy may result in immediate termination of your account without refund.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. DATA AND PRIVACY</h2>
            <p className="text-gray-700">
              Our collection, use, and protection of your data is governed by our Privacy Policy. By using the Service, you consent to our data practices as described in the Privacy Policy.
            </p>
            <p className="text-gray-700">
              We encrypt your cloud credentials using industry-standard AES-256-GCM encryption. However, you acknowledge that no system is completely secure, and you assume all risk of data breaches or unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. INTELLECTUAL PROPERTY</h2>
            <p className="text-gray-700">
              Focal Deploy retains all rights, title, and interest in and to the Service, including all software, code, algorithms, user interfaces, documentation, and related intellectual property. This Agreement does not grant you any ownership rights.
            </p>
            <p className="text-gray-700">
              You retain ownership of your deployment configurations, application code, and data. You grant Focal Deploy a limited license to host, process, and transmit your data solely to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. DISCLAIMER OF WARRANTIES</h2>
            <p className="text-gray-700 font-semibold bg-gray-100 p-4 rounded">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </p>
            <p className="text-gray-700 mt-4">
              FOCAL DEPLOY DOES NOT WARRANT THAT:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>The Service will be uninterrupted, secure, or error-free</li>
              <li>Defects will be corrected</li>
              <li>The Service will meet your requirements</li>
              <li>Data stored will be accurate or preserved</li>
              <li>Third-party cloud services will remain available</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. LIMITATION OF LIABILITY</h2>
            <p className="text-gray-700 font-semibold bg-red-50 border-l-4 border-red-600 p-4 rounded">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FOCAL DEPLOY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2 mt-4">
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Cloud provider charges or overruns</li>
              <li>Service interruptions or data loss</li>
              <li>Security breaches or unauthorized access</li>
              <li>Deployment failures or application downtime</li>
              <li>Any other damages arising from your use of the Service</li>
            </ul>
            <p className="text-gray-700 mt-4 font-semibold">
              OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO FOCAL DEPLOY IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. INDEMNIFICATION</h2>
            <p className="text-gray-700">
              You agree to indemnify, defend, and hold harmless Focal Deploy, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including attorney fees) arising from:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Your use or misuse of the Service</li>
              <li>Your violation of this Agreement</li>
              <li>Your violation of any laws or third-party rights</li>
              <li>Your deployment configurations or application code</li>
              <li>Unauthorized access to your cloud accounts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. TERMINATION</h2>
            <p className="text-gray-700">
              You may terminate your account at any time by contacting support. We may suspend or terminate your access immediately, without notice, for:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>Violation of this Agreement</li>
              <li>Non-payment of fees</li>
              <li>Abusive or illegal use of the Service</li>
              <li>At our sole discretion for any reason</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Upon termination, your license ends immediately. We are not obligated to retain your data after termination. Fees paid are non-refundable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. MODIFICATIONS</h2>
            <p className="text-gray-700">
              We reserve the right to modify this Agreement at any time. We will notify you of material changes via email or through the Service. Your continued use after such modifications constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
            <p className="text-gray-700">
              This Agreement is governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.
            </p>
            <p className="text-gray-700 mt-4 font-semibold">
              ARBITRATION: Any dispute arising from this Agreement shall be resolved through binding arbitration in accordance with the American Arbitration Association's Commercial Arbitration Rules. You waive your right to a jury trial and to participate in class actions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. GENERAL PROVISIONS</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Entire Agreement:</strong> This Agreement constitutes the entire agreement between you and Focal Deploy</li>
              <li><strong>Severability:</strong> If any provision is found unenforceable, the remaining provisions remain in effect</li>
              <li><strong>No Waiver:</strong> Our failure to enforce any right does not waive that right</li>
              <li><strong>Assignment:</strong> You may not assign this Agreement without our written consent</li>
              <li><strong>Force Majeure:</strong> We are not liable for delays caused by events beyond our control</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">16. CONTACT INFORMATION</h2>
            <p className="text-gray-700">
              For questions about this Agreement, contact us at:
            </p>
            <div className="bg-gray-50 p-4 rounded mt-4">
              <p className="text-gray-700"><strong>Focal Deploy LLC</strong></p>
              <p className="text-gray-700">Email: legal@focuswithfocal.com</p>
              <p className="text-gray-700">Support: support@focuswithfocal.com</p>
            </div>
          </section>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded mt-8">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              BY USING FOCAL DEPLOY, YOU ACKNOWLEDGE THAT YOU HAVE READ THIS AGREEMENT, UNDERSTAND IT, AND AGREE TO BE BOUND BY ITS TERMS AND CONDITIONS.
            </p>
            <p className="text-xs text-blue-800">
              © 2025 Focal Deploy LLC. All rights reserved. This document is proprietary and confidential.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            Return to Registration →
          </Link>
        </div>
      </div>
    </div>
  );
}
