/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Rocket, Cloud, Terminal, Monitor, Globe, PlayCircle, Settings, Code } from 'lucide-react';
import { useState } from 'react';

export default function FirstDeploymentGuide() {
  const [selectedProvider, setSelectedProvider] = useState<'aws' | 'gcp' | 'azure'>('aws');

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
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium mb-4">
            <Rocket className="w-4 h-4 mr-1" />
            Getting Started
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            First Deployment Walkthrough
          </h1>
          <p className="text-xl text-gray-600">
            Deploy your first application to AWS, Google Cloud, or Microsoft Azure in under 10 minutes
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              15-20 minutes
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              Beginner Friendly
            </span>
          </div>
        </div>

        <div className="space-y-8">
          {/* Prerequisites */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <CheckCircle className="w-6 h-6 mr-2 text-blue-600" />
              Prerequisites
            </h2>
            <div className="space-y-3">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Focal Deploy Account</p>
                  <p className="text-sm text-gray-600">
                    <Link href="/register" className="text-blue-600 hover:underline">Create an account</Link> if you haven't already
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Cloud Credentials Connected</p>
                  <p className="text-sm text-gray-600">
                    Follow our <Link href="/guides/aws-iam-setup" className="text-blue-600 hover:underline">AWS IAM Setup</Link>,{' '}
                    <Link href="/guides/gcp-service-account" className="text-blue-600 hover:underline">GCP Service Account</Link>, or{' '}
                    <Link href="/guides/azure-service-principal" className="text-blue-600 hover:underline">Azure Service Principal</Link> guide
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Application Ready to Deploy</p>
                  <p className="text-sm text-gray-600">
                    Your application code in a Git repository or local directory
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Step 1: Set Up Cloud Credentials */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-blue-600" />
              Step 1: Set Up Your Cloud Credentials
            </h2>
            <p className="text-gray-700 mb-4">
              Before you can deploy, you need to connect your cloud provider credentials to Focal Deploy:
            </p>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded mb-6">
              <p className="text-sm text-yellow-900 font-semibold">
                ⚠️ This is a required step - you cannot deploy without cloud credentials!
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">For AWS Deployments:</h3>
                <ol className="list-decimal list-inside text-gray-700 ml-4 space-y-2">
                  <li>Follow our <Link href="/guides/aws-iam-setup" className="text-blue-600 hover:underline font-medium">AWS IAM Setup Guide</Link> to create an IAM user with deployment permissions</li>
                  <li>Copy your AWS Access Key ID and Secret Access Key</li>
                  <li>Go to <Link href="/dashboard/credentials" className="text-blue-600 hover:underline font-medium">Dashboard → Credentials</Link></li>
                  <li>Click "Add Cloud Credentials" and select "AWS"</li>
                  <li>Paste your Access Key ID and Secret Access Key</li>
                  <li>Give it a name (e.g., "Production AWS") and click "Save"</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">For Google Cloud Deployments:</h3>
                <ol className="list-decimal list-inside text-gray-700 ml-4 space-y-2">
                  <li>Follow our <Link href="/guides/gcp-service-account" className="text-blue-600 hover:underline font-medium">GCP Service Account Guide</Link> to create a service account</li>
                  <li>Download your service account JSON key file</li>
                  <li>Go to <Link href="/dashboard/credentials" className="text-blue-600 hover:underline font-medium">Dashboard → Credentials</Link></li>
                  <li>Click "Add Cloud Credentials" and select "Google Cloud"</li>
                  <li>Upload or paste your JSON key</li>
                  <li>Give it a name (e.g., "Production GCP") and click "Save"</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">For Microsoft Azure Deployments:</h3>
                <ol className="list-decimal list-inside text-gray-700 ml-4 space-y-2">
                  <li>Follow our <Link href="/guides/azure-service-principal" className="text-blue-600 hover:underline font-medium">Azure Service Principal Guide</Link> to create credentials</li>
                  <li>Collect your Subscription ID, Tenant ID, Client ID, and Client Secret</li>
                  <li>Go to <Link href="/dashboard/settings" className="text-blue-600 hover:underline font-medium">Dashboard → Settings → Cloud Providers</Link></li>
                  <li>Click "Add Azure Credentials"</li>
                  <li>Enter all four credential values</li>
                  <li>Give it a name (e.g., "Production Azure") and click "Save"</li>
                </ol>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mt-6">
              <p className="text-sm text-blue-900">
                <strong>🔒 Security:</strong> Your credentials are encrypted with AES-256-GCM and stored securely. Focal Deploy will never access your cloud resources without your explicit deployment requests.
              </p>
            </div>
          </section>

          {/* Step 2: Set Up API Key (Optional for CLI) */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Terminal className="w-6 h-6 mr-2 text-green-600" />
              Step 2: Set Up API Key (Required for CLI Access)
            </h2>
            <p className="text-gray-700 mb-4">
              If you plan to use the Focal Deploy CLI, you need to generate an API key:
            </p>

            <ol className="list-decimal list-inside text-gray-700 ml-4 space-y-3">
              <li>
                Navigate to <Link href="/dashboard/api-keys" className="text-blue-600 hover:underline font-medium">Dashboard → API Keys</Link>
              </li>
              <li>
                Click <strong>"Generate New API Key"</strong>
              </li>
              <li>
                Give it a descriptive name (e.g., "My Laptop CLI")
              </li>
              <li>
                <strong>Copy the API key immediately</strong> - it will only be shown once!
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400 mt-2">
                  fd_1234567890abcdef1234567890abcdef
                </div>
              </li>
              <li>
                Store it securely (you'll use it in Step 5 for CLI deployments)
              </li>
            </ol>

            <div className="bg-gray-100 border-l-4 border-gray-500 p-4 rounded mt-6">
              <p className="text-sm text-gray-700">
                <strong>Skip this step</strong> if you only plan to deploy through the web dashboard. You can always generate an API key later if needed.
              </p>
            </div>
          </section>

          {/* Step 3: Choose Your Cloud Provider */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Cloud className="w-6 h-6 mr-2 text-blue-600" />
              Step 3: Choose Your Cloud Provider
            </h2>
            <p className="text-gray-700 mb-4">
              Focal Deploy supports AWS, Google Cloud, and Microsoft Azure. Choose the provider that works best for you:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                onClick={() => setSelectedProvider('aws')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProvider === 'aws'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">Amazon AWS</h3>
                  {selectedProvider === 'aws' && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <p className="text-sm text-gray-600 text-left">
                  Industry leader with global infrastructure
                </p>
              </button>

              <button
                onClick={() => setSelectedProvider('gcp')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProvider === 'gcp'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">Google Cloud</h3>
                  {selectedProvider === 'gcp' && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <p className="text-sm text-gray-600 text-left">
                  Google's infrastructure with competitive pricing
                </p>
              </button>

              <button
                onClick={() => setSelectedProvider('azure')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProvider === 'azure'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">Microsoft Azure</h3>
                  {selectedProvider === 'azure' && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <p className="text-sm text-gray-600 text-left">
                  Enterprise-grade cloud with hybrid support
                </p>
              </button>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm text-blue-900">
                <strong>💡 Pro Tip:</strong> You can deploy to all three providers from the same Focal Deploy account.
                Start with one and expand later!
              </p>
            </div>
          </section>

          {/* Prepare Your Application */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Code className="w-6 h-6 mr-2 text-blue-600" />
              Step 4: Prepare Your Application
            </h2>
            <p className="text-gray-700 mb-4">
              Focal Deploy supports a wide range of application types. Here's what you need:
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Supported Frameworks</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['Node.js/Express', 'Next.js', 'React', 'Vue.js', 'Python/Django', 'Python/Flask', 'Ruby on Rails', 'PHP/Laravel', 'Go'].map((framework) => (
                    <div key={framework} className="px-3 py-2 bg-gray-100 rounded text-sm text-gray-700">
                      {framework}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <p className="text-sm text-yellow-900">
                  <strong>⚠️ Important:</strong> Make sure your application has:
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-900 mt-2 space-y-1">
                  <li>A valid <code className="px-1 py-0.5 bg-yellow-100 rounded">package.json</code> (Node.js) or equivalent</li>
                  <li>Environment variables documented (we'll configure these next)</li>
                  <li>Database requirements listed (if applicable)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Deployment Methods */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-blue-600" />
              Step 5: Choose Your Deployment Method
            </h2>
            <p className="text-gray-700 mb-4">
              You can deploy using either our web dashboard or CLI:
            </p>

            <div className="space-y-6">
              {/* Web Dashboard Method */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-600" />
                  Option A: Web Dashboard (Recommended for First-Time Users)
                </h3>
                <ol className="space-y-3 ml-7">
                  <li className="text-gray-700">
                    <strong>1.</strong> Navigate to <Link href="/dashboard/deployments/new" className="text-blue-600 hover:underline">Create New Deployment</Link>
                  </li>
                  <li className="text-gray-700">
                    <strong>2.</strong> Select your cloud provider ({selectedProvider.toUpperCase()})
                  </li>
                  <li className="text-gray-700">
                    <strong>3.</strong> Choose your region:
                    {selectedProvider === 'aws' && (
                      <ul className="list-disc list-inside ml-4 mt-1 text-sm text-gray-600">
                        <li>us-east-1 (N. Virginia) - Best for US East Coast</li>
                        <li>us-west-2 (Oregon) - Best for US West Coast</li>
                        <li>eu-west-1 (Ireland) - Best for Europe</li>
                      </ul>
                    )}
                    {selectedProvider === 'gcp' && (
                      <ul className="list-disc list-inside ml-4 mt-1 text-sm text-gray-600">
                        <li>us-central1 (Iowa) - Best for US Central</li>
                        <li>us-east1 (South Carolina) - Best for US East Coast</li>
                        <li>europe-west1 (Belgium) - Best for Europe</li>
                      </ul>
                    )}
                    {selectedProvider === 'azure' && (
                      <ul className="list-disc list-inside ml-4 mt-1 text-sm text-gray-600">
                        <li>eastus (East US) - Best for US East Coast</li>
                        <li>westus2 (West US 2) - Best for US West Coast</li>
                        <li>westeurope (West Europe) - Best for Europe</li>
                      </ul>
                    )}
                  </li>
                  <li className="text-gray-700">
                    <strong>4.</strong> Configure your deployment:
                    <ul className="list-disc list-inside ml-4 mt-1 text-sm text-gray-600">
                      <li>Application name (e.g., "my-awesome-app")</li>
                      <li>Instance type (t3.small recommended for testing)</li>
                      <li>Environment variables (API keys, database URLs, etc.)</li>
                      <li>Port your application runs on (default: 3000)</li>
                    </ul>
                  </li>
                  <li className="text-gray-700">
                    <strong>5.</strong> Upload your code:
                    <ul className="list-disc list-inside ml-4 mt-1 text-sm text-gray-600">
                      <li>Connect your Git repository (GitHub, GitLab, Bitbucket)</li>
                      <li>Or upload a ZIP file of your project</li>
                    </ul>
                  </li>
                  <li className="text-gray-700">
                    <strong>6.</strong> Review and click <strong>"Deploy"</strong>
                  </li>
                </ol>
              </div>

              {/* CLI Method */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <Terminal className="w-5 h-5 mr-2 text-green-600" />
                  Option B: API Integration (For Automation)
                </h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded mb-4">
                  <p className="text-sm text-yellow-900">
                    <strong>Note:</strong> The Focal Deploy CLI is coming soon. For now, use the web dashboard or integrate directly with our REST API.
                  </p>
                </div>
                <p className="text-gray-700 mb-4">
                  You can trigger deployments programmatically using our API:
                </p>
                <ol className="space-y-3 ml-7">
                  <li className="text-gray-700">
                    <strong>1.</strong> Generate an API key from <Link href="/dashboard/api-keys" className="text-blue-600 hover:underline">Dashboard → API Keys</Link>
                  </li>
                  <li className="text-gray-700">
                    <strong>2.</strong> Create a deployment via API:
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-green-400 text-sm mt-2 overflow-x-auto">
                      <span className="text-gray-500"># Create deployment</span><br />
                      curl -X POST https://api.focuswithfocal.io/api/deployments \<br />
                      {'  '}-H "Authorization: Bearer YOUR_API_KEY" \<br />
                      {'  '}-H "Content-Type: application/json" \<br />
                      {'  '}-d '{`{"projectName": "my-app", "provider": "${selectedProvider}", "region": "${selectedProvider === 'aws' ? 'us-east-1' : selectedProvider === 'gcp' ? 'us-central1' : 'eastus'}"}`}'
                    </div>
                  </li>
                  <li className="text-gray-700">
                    <strong>3.</strong> Check our <Link href="/dashboard/api-docs" className="text-blue-600 hover:underline">API documentation</Link> for full details
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* Monitor Deployment */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Monitor className="w-6 h-6 mr-2 text-blue-600" />
              Step 6: Monitor Your Deployment
            </h2>
            <p className="text-gray-700 mb-4">
              Once you initiate the deployment, Focal Deploy will:
            </p>

            <div className="space-y-3">
              {[
                { step: 'Provision infrastructure', desc: 'Create VM, configure networking, security groups' },
                { step: 'Install dependencies', desc: 'Install Node.js, Python, or other runtime requirements' },
                { step: 'Deploy your code', desc: 'Upload and extract your application files' },
                { step: 'Configure SSL', desc: 'Generate and install SSL certificate for HTTPS' },
                { step: 'Start your application', desc: 'Run your start command and monitor health' },
                { step: 'Configure DNS', desc: 'Set up your custom domain or subdomain' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm mr-3">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.step}</p>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mt-6">
              <p className="text-sm text-blue-900">
                <strong>📊 Real-Time Logs:</strong> Watch the deployment logs in real-time from your{' '}
                <Link href="/dashboard/deployments" className="underline">deployments dashboard</Link>.
                You'll see exactly what's happening at each step.
              </p>
            </div>
          </section>

          {/* Access Your Application */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <PlayCircle className="w-6 h-6 mr-2 text-green-600" />
              Step 7: Access Your Deployed Application
            </h2>
            <p className="text-gray-700 mb-4">
              Once deployment completes (typically 5-10 minutes), you'll receive:
            </p>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-bold text-green-900 mb-2 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Your Application URL
                </h3>
                <div className="bg-white rounded px-4 py-2 font-mono text-sm text-gray-700 border border-green-200">
                  https://your-app-name.focuswithfocal.com
                </div>
                <p className="text-sm text-green-800 mt-2">
                  ✅ SSL certificate automatically configured
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">Additional Access Options</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <Terminal className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-900">SSH Access:</strong>
                      <p className="text-sm text-gray-600">Connect directly to your server for debugging</p>
                      <div className="bg-gray-900 rounded-lg p-3 font-mono text-green-400 text-sm mt-2">
                        ssh -i ~/.ssh/focal-deploy.pem ubuntu@your-instance-ip
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <Monitor className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-900">Dashboard Monitoring:</strong>
                      <p className="text-sm text-gray-600">
                        View metrics, logs, and manage your deployment from the{' '}
                        <Link href="/dashboard" className="text-blue-600 hover:underline">dashboard</Link>
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Next Steps */}
          <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Rocket className="w-6 h-6 mr-2 text-blue-600" />
              Next Steps
            </h2>
            <p className="text-gray-700 mb-4">
              Congratulations on your first deployment! Here's what to explore next:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/guides/custom-domain" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all">
                <h3 className="font-bold text-gray-900 mb-1">Set Up Custom Domain</h3>
                <p className="text-sm text-gray-600">Use your own domain name instead of focuswithfocal.com</p>
              </Link>
              <Link href="/guides/environment-variables" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all">
                <h3 className="font-bold text-gray-900 mb-1">Manage Environment Variables</h3>
                <p className="text-sm text-gray-600">Securely configure API keys and secrets</p>
              </Link>
              <Link href="/guides/github-actions" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all">
                <h3 className="font-bold text-gray-900 mb-1">Set Up CI/CD</h3>
                <p className="text-sm text-gray-600">Automate deployments with GitHub Actions</p>
              </Link>
              <Link href="/guides/monitoring" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all">
                <h3 className="font-bold text-gray-900 mb-1">Monitor Performance</h3>
                <p className="text-sm text-gray-600">Set up alerts and track application metrics</p>
              </Link>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2 text-yellow-600" />
              Common Issues & Troubleshooting
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Deployment Failed</h3>
                <p className="text-sm text-gray-600 mb-2">Check the deployment logs for specific error messages. Common causes:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-4 space-y-1">
                  <li>Missing environment variables</li>
                  <li>Incorrect start command in package.json</li>
                  <li>Port conflicts (ensure your app listens on PORT environment variable)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-1">Application Won't Start</h3>
                <p className="text-sm text-gray-600 mb-2">Verify your application:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-4 space-y-1">
                  <li>Runs locally with the same Node.js version</li>
                  <li>Has all dependencies listed in package.json</li>
                  <li>Listens on the PORT environment variable (not hardcoded port)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-1">SSL Certificate Issues</h3>
                <p className="text-sm text-gray-600">
                  SSL certificates are generated automatically. If you see certificate errors, wait a few minutes for
                  DNS propagation and try again.
                </p>
              </div>
            </div>

            <div className="bg-gray-100 border-l-4 border-gray-500 p-4 rounded mt-6">
              <p className="text-sm text-gray-900">
                <strong>Need Help?</strong> Contact our support team at{' '}
                <a href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:underline">
                  support@focuswithfocal.com
                </a>{' '}
                or visit our <a href="/guides" className="text-blue-600 hover:underline">documentation</a>.
              </p>
            </div>
          </section>

          {/* Related Guides */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Related Guides</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/guides/aws-iam-setup" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Cloud className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">AWS IAM Setup</h3>
                  <p className="text-xs text-gray-600">Configure AWS credentials</p>
                </div>
              </Link>
              <Link href="/guides/gcp-service-account" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Cloud className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">GCP Service Account</h3>
                  <p className="text-xs text-gray-600">Configure Google Cloud credentials</p>
                </div>
              </Link>
              <Link href="/guides/azure-service-principal" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Cloud className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Azure Service Principal</h3>
                  <p className="text-xs text-gray-600">Configure Azure credentials</p>
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

// Helper component for clock icon (since it wasn't imported)
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
