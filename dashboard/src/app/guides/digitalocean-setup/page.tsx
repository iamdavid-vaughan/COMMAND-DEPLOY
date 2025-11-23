/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Copy, ExternalLink, Cloud, Key, Shield, Server } from 'lucide-react';
import { useState } from 'react';

export default function DigitalOceanSetupGuide() {
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyToClipboard = (text: string, step: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/guides" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Guides
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">
            <Cloud className="w-4 h-4 mr-1" />
            Getting Started
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            DigitalOcean API Setup
          </h1>
          <p className="text-xl text-gray-600">
            Generate a DigitalOcean API token to enable DNS management and droplet deployments
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              5-10 minutes
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              Beginner Friendly
            </span>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-8">
          <div className="flex items-start">
            <Server className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900 font-semibold">Current DigitalOcean Support</p>
              <p className="text-sm text-blue-800 mt-1">
                ✅ DNS Management - Fully supported<br />
                🔄 Droplet Deployments - Coming soon!
              </p>
              <p className="text-xs text-blue-700 mt-2">
                Set up your API credentials now to be ready when droplet deployment support launches.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Prerequisites */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <CheckCircle className="w-6 h-6 mr-2 text-blue-600" />
              Prerequisites
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">DigitalOcean Account</p>
                  <p className="text-sm text-gray-600">
                    Sign up at{' '}
                    <a href="https://www.digitalocean.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      digitalocean.com
                    </a>{' '}
                    if you don't have an account
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Billing Information Added</p>
                  <p className="text-sm text-gray-600">
                    Add a payment method to your DigitalOcean account
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Focal Deploy Account</p>
                  <p className="text-sm text-gray-600">
                    <Link href="/register" className="text-blue-600 hover:underline">Create a Focal Deploy account</Link> if you haven't already
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* Step 1: Access API Settings */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 1: Access DigitalOcean API Settings
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Log in to your{' '}
                    <a href="https://cloud.digitalocean.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">
                      DigitalOcean Control Panel
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Navigate to <strong>API</strong> in the left sidebar
                  </p>
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-600">
                    💡 You can also go directly to:{' '}
                    <a href="https://cloud.digitalocean.com/account/api/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      https://cloud.digitalocean.com/account/api/tokens
                    </a>
                  </div>
                </div>
              </li>
            </ol>
          </section>

          {/* Step 2: Generate API Token */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 2: Generate a Personal Access Token
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Click the <strong>"Generate New Token"</strong> button
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Configure your token:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Token Name:</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                          focal-deploy-api
                        </code>
                        <button
                          onClick={() => copyToClipboard('focal-deploy-api', 'name')}
                          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center text-sm"
                        >
                          {copiedStep === 'name' ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Expiration:</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Choose <strong>No expiration</strong> (or 90 days if you prefer to rotate regularly)
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Scopes:</p>
                      <p className="text-sm text-gray-600 mt-1">
                        ✅ Select <strong>Read</strong> and <strong>Write</strong> permissions
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Click <strong>"Generate Token"</strong>
                  </p>
                  <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-900">
                        <strong>Important:</strong> Copy your token immediately! DigitalOcean will only show it once.
                        If you lose it, you'll need to generate a new one.
                      </p>
                    </div>
                  </div>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  4
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Your token will look like this:
                  </p>
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-green-400 text-sm overflow-x-auto">
                    dop_v1_1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Store this token securely - you'll need it in the next step
                  </p>
                </div>
              </li>
            </ol>
          </section>

          {/* Step 3: Add to Focal Deploy */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 3: Add Credentials to Focal Deploy
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Navigate to{' '}
                    <Link href="/dashboard/credentials" className="text-blue-600 hover:underline">
                      Dashboard → Credentials
                    </Link>
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Click <strong>"Add Cloud Credentials"</strong>
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Select <strong>"DigitalOcean"</strong> as the provider
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  4
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Paste your API token from Step 2
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  5
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Give your credentials a name (e.g., "Production DigitalOcean")
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  6
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Click <strong>"Save Credentials"</strong>
                  </p>
                </div>
              </li>
            </ol>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mt-6">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-900 font-semibold">Success!</p>
                  <p className="text-sm text-green-800 mt-1">
                    Your DigitalOcean credentials are now securely stored and encrypted. You can use them for DNS management
                    and will be ready for droplet deployments when that feature launches.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Security Best Practices */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-green-600" />
              Security Best Practices
            </h2>
            <div className="space-y-3">
              <div className="flex items-start">
                <Key className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Rotate tokens regularly</p>
                  <p className="text-sm text-gray-600">
                    Consider setting a 90-day expiration and rotating your tokens quarterly
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Key className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Use separate tokens for different environments</p>
                  <p className="text-sm text-gray-600">
                    Create different tokens for production, staging, and development
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Key className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Never commit tokens to version control</p>
                  <p className="text-sm text-gray-600">
                    Always use secure credential storage like Focal Deploy's encrypted vault
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Key className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Monitor token usage</p>
                  <p className="text-sm text-gray-600">
                    Regularly check the DigitalOcean audit logs for unexpected API activity
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Key className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Revoke unused tokens</p>
                  <p className="text-sm text-gray-600">
                    Delete old tokens from DigitalOcean when they're no longer needed
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* What's Next */}
          <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Cloud className="w-6 h-6 mr-2 text-blue-600" />
              What's Next?
            </h2>
            <p className="text-gray-700 mb-4">
              With your DigitalOcean credentials configured, you can:
            </p>
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-1">✅ Manage DNS Records</h3>
                <p className="text-sm text-gray-600">
                  Use Focal Deploy to manage your DigitalOcean DNS zones and records
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-1">🔄 Coming Soon: Deploy to Droplets</h3>
                <p className="text-sm text-gray-600">
                  Droplet deployment support is in active development. You'll be notified when it's available!
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-1">📚 Explore Other Guides</h3>
                <p className="text-sm text-gray-600">
                  Set up{' '}
                  <Link href="/guides/aws-iam-setup" className="text-blue-600 hover:underline">AWS</Link>
                  {' '}or{' '}
                  <Link href="/guides/gcp-service-account" className="text-blue-600 hover:underline">Google Cloud</Link>
                  {' '}for immediate deployment options
                </p>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2 text-yellow-600" />
              Troubleshooting
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-1">"Invalid API Token" Error</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Verify that:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-4 space-y-1">
                  <li>You copied the entire token without extra spaces</li>
                  <li>The token hasn't expired (if you set an expiration)</li>
                  <li>You have Read and Write permissions enabled</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Token Not Showing After Generation</h3>
                <p className="text-sm text-gray-600">
                  DigitalOcean only shows tokens once. If you didn't copy it, you'll need to generate a new token.
                  Delete the old one and create a new token following the steps above.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Need to Revoke a Token</h3>
                <p className="text-sm text-gray-600">
                  Go to the{' '}
                  <a href="https://cloud.digitalocean.com/account/api/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    API tokens page
                  </a>
                  , find the token, and click the "Delete" button. Then remove it from Focal Deploy's credentials.
                </p>
              </div>
            </div>

            <div className="bg-gray-100 border-l-4 border-gray-500 p-4 rounded mt-6">
              <p className="text-sm text-gray-900">
                <strong>Need Help?</strong> Contact our support team at{' '}
                <a href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:underline">
                  support@focuswithfocal.com
                </a>
              </p>
            </div>
          </section>

          {/* Related Guides */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Related Guides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/guides/aws-iam-setup" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Cloud className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">AWS IAM Setup</h3>
                  <p className="text-xs text-gray-600">Deploy to AWS EC2 instances</p>
                </div>
              </Link>
              <Link href="/guides/gcp-service-account" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Cloud className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">GCP Service Account</h3>
                  <p className="text-xs text-gray-600">Deploy to Google Cloud VMs</p>
                </div>
              </Link>
            </div>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link href="/guides" className="text-blue-600 hover:underline font-medium">
            ← Back to All Guides
          </Link>
        </div>
      </div>
    </div>
  );
}

// Helper component for clock icon
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
