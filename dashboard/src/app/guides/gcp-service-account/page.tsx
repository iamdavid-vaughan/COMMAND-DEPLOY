/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Copy, ExternalLink, Cloud, Key, Shield } from 'lucide-react';
import { useState } from 'react';

export default function GCPServiceAccountGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const roles = `roles/compute.admin
roles/storage.admin
roles/dns.admin
roles/iam.serviceAccountUser`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/guides"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Guides
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex p-3 rounded-lg bg-blue-100 text-blue-600">
              <Cloud className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-2">
                Beginner
              </span>
              <h1 className="text-4xl font-extrabold text-gray-900">Google Cloud Service Account Setup</h1>
            </div>
          </div>
          <p className="text-xl text-gray-600">
            Create and configure a GCP service account for deploying to Google Cloud
          </p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span className="mr-4">⏱️ 10 minutes</span>
            <span>📅 Last updated: January 2025</span>
          </div>
        </div>

        {/* Overview */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">What you'll learn</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>How to create a GCP service account</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>Required roles for deployment automation</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>How to generate and download JSON keys</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>How to connect GCP to Focal Deploy</span>
            </li>
          </ul>
        </div>

        {/* Prerequisites */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Prerequisites</h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>A Google Cloud Platform account (free tier available)</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>A GCP project with billing enabled</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>Owner or Editor permissions on the project</span>
            </li>
          </ul>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          {/* Step 1 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                1
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Open GCP Console</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">
                Navigate to the Google Cloud Console and select your project.
              </p>
              <a
                href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Open Service Accounts
                <ExternalLink className="ml-2 w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                2
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create Service Account</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>Click <strong>"+ CREATE SERVICE ACCOUNT"</strong> at the top</li>
                <li>Enter service account name: <code className="px-2 py-1 bg-gray-100 rounded text-sm">focal-deploy</code></li>
                <li>Add description: <code className="px-2 py-1 bg-gray-100 rounded text-sm">Service account for Focal Deploy automation</code></li>
                <li>Click <strong>"CREATE AND CONTINUE"</strong></li>
              </ol>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                3
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Grant Roles</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">Add the following roles to the service account:</p>

              <div className="space-y-3">
                <div className="flex items-start">
                  <Shield className="w-5 h-5 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                  <div>
                    <strong>Compute Admin</strong>
                    <p className="text-sm text-gray-600">Manage Compute Engine instances and resources</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">roles/compute.admin</code>
                  </div>
                </div>

                <div className="flex items-start">
                  <Shield className="w-5 h-5 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                  <div>
                    <strong>Storage Admin</strong>
                    <p className="text-sm text-gray-600">Manage Cloud Storage buckets and objects</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">roles/storage.admin</code>
                  </div>
                </div>

                <div className="flex items-start">
                  <Shield className="w-5 h-5 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                  <div>
                    <strong>DNS Administrator</strong>
                    <p className="text-sm text-gray-600">Manage Cloud DNS zones and records</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">roles/dns.admin</code>
                  </div>
                </div>

                <div className="flex items-start">
                  <Shield className="w-5 h-5 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                  <div>
                    <strong>Service Account User</strong>
                    <p className="text-sm text-gray-600">Allows acting as service accounts</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">roles/iam.serviceAccountUser</code>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r mt-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Click <strong>"+ ADD ANOTHER ROLE"</strong> for each role above
                  </p>
                </div>
              </div>

              <p className="text-gray-700 mt-4">After adding all roles, click <strong>"CONTINUE"</strong></p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                4
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create JSON Key</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>Skip "Grant users access" (optional) and click <strong>"DONE"</strong></li>
                <li>Find your new service account in the list</li>
                <li>Click the three dots menu (⋮) on the right</li>
                <li>Select <strong>"Manage keys"</strong></li>
                <li>Click <strong>"ADD KEY"</strong> → <strong>"Create new key"</strong></li>
                <li>Select <strong>"JSON"</strong> as the key type</li>
                <li>Click <strong>"CREATE"</strong></li>
              </ol>

              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-2">CRITICAL: Secure Your JSON Key!</p>
                    <p>The JSON file downloads automatically. This key grants full access to your GCP resources.</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Never commit to Git</li>
                      <li>Never share publicly</li>
                      <li>Store securely (password manager recommended)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                5
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Enable Required APIs</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">Enable these APIs in your GCP project:</p>

              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>
                  <strong>Compute Engine API</strong>
                  <a
                    href="https://console.cloud.google.com/apis/library/compute.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline text-sm"
                  >
                    Enable →
                  </a>
                </li>
                <li>
                  <strong>Cloud Storage API</strong>
                  <a
                    href="https://console.cloud.google.com/apis/library/storage.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline text-sm"
                  >
                    Enable →
                  </a>
                </li>
                <li>
                  <strong>Cloud DNS API</strong>
                  <a
                    href="https://console.cloud.google.com/apis/library/dns.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline text-sm"
                  >
                    Enable →
                  </a>
                </li>
              </ol>
            </div>
          </div>

          {/* Step 6 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                6
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Add to Focal Deploy</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>Log in to your <Link href="/dashboard" className="text-blue-600 hover:underline">Focal Deploy dashboard</Link></li>
                <li>Navigate to <strong>Credentials</strong> page</li>
                <li>Click <strong>"Add GCP Credentials"</strong></li>
                <li>Enter credential name: <code className="text-sm bg-gray-100 px-2 py-1 rounded">Production GCP</code></li>
                <li>Upload the JSON key file you downloaded in Step 4</li>
                <li>Click <strong>"Test Connection"</strong> to verify</li>
                <li>Click <strong>"Save"</strong></li>
              </ol>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
                <div className="flex">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-green-800">
                    <strong>Success!</strong> Your GCP credentials are securely stored and encrypted. Ready to deploy to Google Cloud!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Shield className="w-6 h-6 mr-2 text-blue-600" />
            Security Best Practices
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">✓ DO</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>✓ Use separate service accounts per environment</li>
                <li>✓ Rotate keys every 90 days</li>
                <li>✓ Use principle of least privilege</li>
                <li>✓ Enable audit logging</li>
                <li>✓ Monitor service account activity</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">✗ DON'T</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>✗ Use your personal GCP credentials</li>
                <li>✗ Share service account keys</li>
                <li>✗ Commit JSON keys to Git repositories</li>
                <li>✗ Give more permissions than needed</li>
                <li>✗ Use the same key across multiple apps</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Next Steps</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/guides/first-deployment"
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow group"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                Deploy Your First App →
              </h3>
              <p className="text-gray-600 text-sm">
                Now that your GCP credentials are set up, deploy your first application to Google Cloud.
              </p>
            </Link>
            <Link
              href="/guides/aws-iam-setup"
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow group"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                Add AWS Too →
              </h3>
              <p className="text-gray-600 text-sm">
                Deploy to both AWS and GCP? Set up your AWS IAM credentials as well.
              </p>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
          <p>
            Need help? <Link href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:underline">Contact support</Link> or{' '}
            <Link href="https://discord.gg/focaldeploy" className="text-blue-600 hover:underline">join our Discord</Link>
          </p>
          <p className="mt-4 text-xs text-gray-500">
            © 2025 Focal Deploy. All rights reserved. Licensed under the Focal Deploy Proprietary License.
          </p>
        </div>
      </div>
    </div>
  );
}
