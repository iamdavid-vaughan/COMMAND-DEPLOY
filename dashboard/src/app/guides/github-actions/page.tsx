/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Copy, Github, Zap, Lock, PlayCircle, FileCode } from 'lucide-react';
import { useState } from 'react';

export default function GitHubActionsGuide() {
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyToClipboard = (text: string, step: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const workflowYaml = `name: Deploy to Focal Deploy

on:
  push:
    branches: [ main, production ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build application
        run: npm run build

      - name: Deploy to Focal Deploy
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        env:
          FOCAL_DEPLOY_API_KEY: \${{ secrets.FOCAL_DEPLOY_API_KEY }}
          FOCAL_DEPLOY_PROJECT_ID: \${{ secrets.FOCAL_DEPLOY_PROJECT_ID }}
        run: |
          curl -X POST https://api.focuswithfocal.io/api/deployments \\
            -H "Authorization: Bearer $FOCAL_DEPLOY_API_KEY" \\
            -H "Content-Type: application/json" \\
            -d '{"projectId": "'"$FOCAL_DEPLOY_PROJECT_ID"'", "branch": "\${{ github.ref_name }}"}'

      - name: Comment PR with preview URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployment ready at: https://pr-' + context.issue.number + '-\${{ secrets.FOCAL_DEPLOY_PROJECT_ID }}.focuswithfocal.com'
            })`;

  const simpleWorkflow = `name: Deploy to Focal Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run build

      - name: Deploy
        env:
          FOCAL_DEPLOY_API_KEY: \${{ secrets.FOCAL_DEPLOY_API_KEY }}
        run: |
          curl -X POST https://api.focuswithfocal.io/api/deployments \\
            -H "Authorization: Bearer $FOCAL_DEPLOY_API_KEY" \\
            -H "Content-Type: application/json" \\
            -d '{"projectName": "my-app"}'`;

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
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm font-medium mb-4">
            <Zap className="w-4 h-4 mr-1" />
            CI/CD Integration
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            GitHub Actions CI/CD
          </h1>
          <p className="text-xl text-gray-600">
            Automate deployments to Focal Deploy with every push to your repository
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              15-20 minutes
            </span>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
              Intermediate
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
            <ul className="space-y-3">
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">GitHub Repository</p>
                  <p className="text-sm text-gray-600">
                    Your application code hosted on GitHub
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Focal Deploy Account & Project</p>
                  <p className="text-sm text-gray-600">
                    An existing project deployed at least once manually (
                    <Link href="/guides/first-deployment" className="text-blue-600 hover:underline">
                      follow this guide
                    </Link>
                    )
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Focal Deploy API Key</p>
                  <p className="text-sm text-gray-600">
                    Generate from{' '}
                    <Link href="/dashboard/api-keys" className="text-blue-600 hover:underline">
                      Dashboard → API Keys
                    </Link>
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* Step 1: Generate API Key */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 1: Generate a Focal Deploy API Key
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Navigate to{' '}
                    <Link href="/dashboard/api-keys" className="text-blue-600 hover:underline">
                      Dashboard → API Keys
                    </Link>
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Click <strong>"Generate New API Key"</strong>
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Give it a descriptive name like "GitHub Actions - My Project"
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  4
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Copy the generated API key - you'll need it in the next step
                  </p>
                  <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded mt-2">
                    <p className="text-sm text-yellow-900">
                      <strong>Important:</strong> The API key will only be shown once. Store it securely!
                    </p>
                  </div>
                </div>
              </li>
            </ol>
          </section>

          {/* Step 2: Add Secrets to GitHub */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 2: Add Secrets to GitHub Repository
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Go to your GitHub repository → <strong>Settings</strong> → <strong>Secrets and variables</strong> → <strong>Actions</strong>
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Click <strong>"New repository secret"</strong> and add:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4 mt-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm mb-1">Secret #1:</p>
                      <div className="bg-white border border-gray-300 rounded p-3">
                        <p className="text-xs text-gray-600 mb-1">Name:</p>
                        <code className="text-sm font-mono">FOCAL_DEPLOY_API_KEY</code>
                        <p className="text-xs text-gray-600 mt-2 mb-1">Value:</p>
                        <p className="text-sm text-gray-700">Your API key from Step 1</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm mb-1">Secret #2 (Optional):</p>
                      <div className="bg-white border border-gray-300 rounded p-3">
                        <p className="text-xs text-gray-600 mb-1">Name:</p>
                        <code className="text-sm font-mono">FOCAL_DEPLOY_PROJECT_ID</code>
                        <p className="text-xs text-gray-600 mt-2 mb-1">Value:</p>
                        <p className="text-sm text-gray-700">Your project ID from Focal Deploy dashboard</p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            </ol>
          </section>

          {/* Step 3: Create Workflow File */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 3: Create GitHub Actions Workflow
            </h2>
            <p className="text-gray-700 mb-4">
              Choose between a simple workflow or an advanced one with testing and PR previews:
            </p>

            {/* Simple Workflow */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <FileCode className="w-5 h-5 text-blue-600 mr-2" />
                Option A: Simple Workflow
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Perfect for getting started. Deploys on every push to main branch.
              </p>
              <div className="relative">
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                  <pre className="whitespace-pre">{simpleWorkflow}</pre>
                </div>
                <button
                  onClick={() => copyToClipboard(simpleWorkflow, 'simple')}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center"
                >
                  {copiedStep === 'simple' ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Workflow */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <Zap className="w-5 h-5 text-orange-600 mr-2" />
                Option B: Advanced Workflow
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Includes testing, build steps, and PR preview deployments.
              </p>
              <div className="relative">
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre">{workflowYaml}</pre>
                </div>
                <button
                  onClick={() => copyToClipboard(workflowYaml, 'advanced')}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center"
                >
                  {copiedStep === 'advanced' ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mt-6">
              <p className="text-sm text-blue-900">
                <strong>📝 To add this workflow:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-blue-800 mt-2 space-y-1">
                <li>Create a new file: <code className="px-1 py-0.5 bg-blue-100 rounded">.github/workflows/deploy.yml</code></li>
                <li>Paste one of the workflows above</li>
                <li>Customize it for your project (change Node version, test commands, etc.)</li>
                <li>Commit and push to your repository</li>
              </ol>
            </div>
          </section>

          {/* Step 4: Test Deployment */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <PlayCircle className="w-6 h-6 mr-2 text-green-600" />
              Step 4: Test Your Workflow
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Push a commit to your main branch (or create a PR if using the advanced workflow)
                  </p>
                  <div className="bg-gray-900 rounded-lg p-3 font-mono text-green-400 text-sm mt-2">
                    git add .<br />
                    git commit -m "Add GitHub Actions deployment"<br />
                    git push origin main
                  </div>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Go to your repository → <strong>Actions</strong> tab to watch the workflow run
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Click on the workflow run to see real-time logs
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  4
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Once completed, verify your deployment in the{' '}
                    <Link href="/dashboard/deployments" className="text-blue-600 hover:underline">
                      Focal Deploy dashboard
                    </Link>
                  </p>
                </div>
              </li>
            </ol>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mt-6">
              <p className="text-sm text-green-900 font-semibold">
                <CheckCircle className="inline w-4 h-4 mr-1" />
                Success!
              </p>
              <p className="text-sm text-green-800 mt-1">
                Your workflow is now active. Every push to main will automatically deploy to Focal Deploy!
              </p>
            </div>
          </section>

          {/* Advanced Configuration */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Advanced Configuration Options
            </h2>
            <div className="space-y-6">
              {/* Deploy on Tag */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Deploy on Git Tag (Releases)</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Trigger deployments only when you create a release tag:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`on:
  push:
    tags:
      - 'v*'  # Triggers on tags like v1.0.0`}</pre>
                </div>
              </div>

              {/* Environment-specific Deployments */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Environment-Specific Deployments</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Deploy to different environments based on branch:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: curl -X POST https://api.focuswithfocal.io/api/deployments -H "Authorization: Bearer $API_KEY" -d '{"env":"production"}'

- name: Deploy to Staging
  if: github.ref == 'refs/heads/develop'
  run: curl -X POST https://api.focuswithfocal.io/api/deployments -H "Authorization: Bearer $API_KEY" -d '{"env":"staging"}'`}</pre>
                </div>
              </div>

              {/* Slack Notifications */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Slack Notifications</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Get notified on Slack when deployments complete:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: \${{ job.status }}
    text: 'Deployment \${{ job.status }}'
    webhook_url: \${{ secrets.SLACK_WEBHOOK }}
  if: always()`}</pre>
                </div>
              </div>
            </div>
          </section>

          {/* Security Best Practices */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Lock className="w-6 h-6 mr-2 text-red-600" />
              Security Best Practices
            </h2>
            <div className="space-y-3">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Never hardcode API keys</p>
                  <p className="text-sm text-gray-600">
                    Always use GitHub Secrets for sensitive values
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Rotate API keys regularly</p>
                  <p className="text-sm text-gray-600">
                    Generate new API keys quarterly and update GitHub Secrets
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Use branch protection rules</p>
                  <p className="text-sm text-gray-600">
                    Require pull request reviews before deploying to production
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Limit workflow permissions</p>
                  <p className="text-sm text-gray-600">
                    Use read-only tokens when possible and scope permissions appropriately
                  </p>
                </div>
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
                <h3 className="font-bold text-gray-900 mb-1">Workflow Fails with "API Key Invalid"</h3>
                <p className="text-sm text-gray-600 mb-2">Check that:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-4 space-y-1">
                  <li>The secret name matches exactly (case-sensitive)</li>
                  <li>No extra spaces were added when copying the API key</li>
                  <li>The API key hasn't been revoked or expired</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Deployment Times Out</h3>
                <p className="text-sm text-gray-600">
                  Increase the timeout in your workflow with <code className="px-1 py-0.5 bg-gray-100 rounded">timeout-minutes: 30</code> in the deploy job.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Build Fails on GitHub but Works Locally</h3>
                <p className="text-sm text-gray-600">
                  Ensure environment variables are set in GitHub Secrets. Check that your build doesn't depend on local files not in git.
                </p>
              </div>
            </div>

            <div className="bg-gray-100 border-l-4 border-gray-500 p-4 rounded mt-6">
              <p className="text-sm text-gray-900">
                <strong>Need Help?</strong> Check the{' '}
                <a href="https://docs.github.com/en/actions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  GitHub Actions documentation
                </a>{' '}
                or contact{' '}
                <a href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:underline">
                  Focal Deploy support
                </a>
              </p>
            </div>
          </section>

          {/* Related Guides */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Related Guides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/guides/gitlab-cicd" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Zap className="w-5 h-5 text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">GitLab CI/CD</h3>
                  <p className="text-xs text-gray-600">Automate with GitLab Pipelines</p>
                </div>
              </Link>
              <Link href="/dashboard/api-keys" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Lock className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">API Keys Management</h3>
                  <p className="text-xs text-gray-600">Generate and manage API keys</p>
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

// Helper components
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
