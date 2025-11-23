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

export default function AzureServicePrincipalGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const azCliCommand = `az ad sp create-for-rbac --name "focal-deploy" --role contributor \\
  --scopes /subscriptions/{subscription-id} \\
  --sdk-auth`;

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
              <h1 className="text-4xl font-extrabold text-gray-900">Azure Service Principal Setup</h1>
            </div>
          </div>
          <p className="text-xl text-gray-600">
            Create and configure an Azure service principal for deploying to Microsoft Azure
          </p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span className="mr-4">15 minutes</span>
            <span>Last updated: November 2025</span>
          </div>
        </div>

        {/* Overview */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">What you'll learn</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>How to create an Azure service principal</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>Required roles for deployment automation</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>How to get Client ID, Client Secret, Tenant ID, and Subscription ID</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>How to connect Azure to Focal Deploy</span>
            </li>
          </ul>
        </div>

        {/* Prerequisites */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Prerequisites</h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>A Microsoft Azure account (free tier available)</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>An active Azure subscription with billing enabled</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>Owner or Contributor permissions on the subscription</span>
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
              <h2 className="text-2xl font-bold text-gray-900">Open Azure Portal</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">
                Navigate to the Azure Portal and sign in with your Microsoft account.
              </p>
              <a
                href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Open App Registrations
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
              <h2 className="text-2xl font-bold text-gray-900">Register a New Application</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>In the Azure Portal, search for <strong>"App registrations"</strong></li>
                <li>Click <strong>"+ New registration"</strong></li>
                <li>Enter name: <code className="px-2 py-1 bg-gray-100 rounded text-sm">focal-deploy</code></li>
                <li>Select <strong>"Accounts in this organizational directory only"</strong></li>
                <li>Leave Redirect URI empty (not needed)</li>
                <li>Click <strong>"Register"</strong></li>
              </ol>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r mt-4">
                <div className="flex">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                  <div className="text-sm text-green-800">
                    <p><strong>Note:</strong> After registration, you'll see the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong>. Copy these - you'll need them later!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                3
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create a Client Secret</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>In your app registration, go to <strong>"Certificates & secrets"</strong></li>
                <li>Click <strong>"+ New client secret"</strong></li>
                <li>Enter description: <code className="px-2 py-1 bg-gray-100 rounded text-sm">Focal Deploy Secret</code></li>
                <li>Select expiration: <strong>24 months</strong> (recommended)</li>
                <li>Click <strong>"Add"</strong></li>
              </ol>

              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-2">CRITICAL: Copy Secret Value Immediately!</p>
                    <p>The secret value is only shown once. Copy it immediately and store it securely.</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Never commit to Git</li>
                      <li>Never share publicly</li>
                      <li>Store in a password manager</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                4
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Get Your Subscription ID</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>In Azure Portal, search for <strong>"Subscriptions"</strong></li>
                <li>Click on your subscription</li>
                <li>Copy the <strong>Subscription ID</strong> from the overview page</li>
              </ol>

              <a
                href="https://portal.azure.com/#view/Microsoft_Azure_Billing/SubscriptionsBlade"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                Open Subscriptions
                <ExternalLink className="ml-2 w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                5
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Assign Contributor Role</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">Grant the service principal access to your subscription:</p>

              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>Go to your <strong>Subscription</strong> in Azure Portal</li>
                <li>Click <strong>"Access control (IAM)"</strong> in the left menu</li>
                <li>Click <strong>"+ Add"</strong> → <strong>"Add role assignment"</strong></li>
                <li>Select role: <strong>"Contributor"</strong></li>
                <li>Click <strong>"Next"</strong></li>
                <li>Click <strong>"+ Select members"</strong></li>
                <li>Search for <code className="px-2 py-1 bg-gray-100 rounded text-sm">focal-deploy</code></li>
                <li>Select it and click <strong>"Select"</strong></li>
                <li>Click <strong>"Review + assign"</strong></li>
              </ol>

              <div className="space-y-3 mt-4">
                <div className="flex items-start">
                  <Shield className="w-5 h-5 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                  <div>
                    <strong>Contributor Role</strong>
                    <p className="text-sm text-gray-600">Allows creating and managing VMs, VNets, NSGs, and storage</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r mt-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    <strong>Optional:</strong> For more restrictive access, you can create a custom role with only the permissions needed for VM deployments.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 6 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                6
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Collect Your Credentials</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">You should now have the following four pieces of information:</p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div>
                    <strong className="text-gray-900">Subscription ID</strong>
                    <p className="text-sm text-gray-600">From Step 4</p>
                  </div>
                  <code className="text-sm bg-white px-3 py-1 rounded border border-gray-200">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div>
                    <strong className="text-gray-900">Tenant ID (Directory ID)</strong>
                    <p className="text-sm text-gray-600">From Step 2 - App Overview</p>
                  </div>
                  <code className="text-sm bg-white px-3 py-1 rounded border border-gray-200">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div>
                    <strong className="text-gray-900">Client ID (Application ID)</strong>
                    <p className="text-sm text-gray-600">From Step 2 - App Overview</p>
                  </div>
                  <code className="text-sm bg-white px-3 py-1 rounded border border-gray-200">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-gray-900">Client Secret</strong>
                    <p className="text-sm text-gray-600">From Step 3</p>
                  </div>
                  <code className="text-sm bg-white px-3 py-1 rounded border border-gray-200">••••••••••••••••••••</code>
                </div>
              </div>
            </div>
          </div>

          {/* Step 7 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                7
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Add to Focal Deploy</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>Log in to your <Link href="/dashboard" className="text-blue-600 hover:underline">Focal Deploy dashboard</Link></li>
                <li>Navigate to <strong>Settings</strong> → <strong>Cloud Providers</strong></li>
                <li>Click <strong>"Add Azure Credentials"</strong></li>
                <li>Enter your <strong>Subscription ID</strong></li>
                <li>Enter your <strong>Tenant ID</strong></li>
                <li>Enter your <strong>Client ID</strong></li>
                <li>Enter your <strong>Client Secret</strong></li>
                <li>Click <strong>"Test Connection"</strong> to verify</li>
                <li>Click <strong>"Save Credentials"</strong></li>
              </ol>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
                <div className="flex">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-green-800">
                    <strong>Success!</strong> Your Azure credentials are securely stored and encrypted. Ready to deploy to Microsoft Azure!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Azure CLI Alternative */}
        <div className="mt-12 bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Alternative: Azure CLI Method
          </h2>
          <p className="text-gray-300 mb-4">
            If you have Azure CLI installed, you can create a service principal with a single command:
          </p>
          <div className="relative">
            <pre className="bg-gray-800 rounded-lg p-4 text-sm text-green-400 overflow-x-auto">
              <code>{azCliCommand}</code>
            </pre>
            <button
              onClick={() => copyToClipboard(azCliCommand, 'cli')}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white"
            >
              {copiedSection === 'cli' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-4">
            Replace <code className="text-yellow-400">{'{subscription-id}'}</code> with your actual subscription ID.
            This command outputs all credentials in JSON format.
          </p>
        </div>

        {/* Best Practices */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Shield className="w-6 h-6 mr-2 text-blue-600" />
            Security Best Practices
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">DO</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>Use separate service principals per environment</li>
                <li>Rotate client secrets every 12-24 months</li>
                <li>Use the principle of least privilege</li>
                <li>Enable Azure AD audit logging</li>
                <li>Monitor service principal sign-ins</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">DON'T</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>Use your personal Azure credentials</li>
                <li>Share service principal credentials</li>
                <li>Commit credentials to Git repositories</li>
                <li>Give Owner role (Contributor is sufficient)</li>
                <li>Use the same credentials across apps</li>
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
                Deploy Your First App
              </h3>
              <p className="text-gray-600 text-sm">
                Now that your Azure credentials are set up, deploy your first application to Microsoft Azure.
              </p>
            </Link>
            <Link
              href="/guides/aws-iam-setup"
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow group"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                Add AWS Too
              </h3>
              <p className="text-gray-600 text-sm">
                Deploy to multiple clouds? Set up your AWS IAM credentials for maximum flexibility.
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
            2025 Focal Deploy. All rights reserved. Licensed under the Focal Deploy Proprietary License.
          </p>
        </div>
      </div>
    </div>
  );
}
