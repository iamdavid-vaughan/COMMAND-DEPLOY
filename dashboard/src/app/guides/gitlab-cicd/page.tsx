/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Copy, GitBranch, Zap, Lock, PlayCircle, FileCode } from 'lucide-react';
import { useState } from 'react';

export default function GitLabCICDGuide() {
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyToClipboard = (text: string, step: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const gitlabCIYaml = `# GitLab CI/CD Pipeline for Focal Deploy

stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "20"

# Cache node_modules for faster builds
cache:
  paths:
    - node_modules/

# Run tests
test:
  stage: test
  image: node:\${NODE_VERSION}
  script:
    - npm ci
    - npm run lint
    - npm test
  only:
    - merge_requests
    - main
    - develop

# Build application
build:
  stage: build
  image: node:\${NODE_VERSION}
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - build/
      - dist/
      - .next/
    expire_in: 1 hour
  only:
    - main
    - develop

# Deploy to production
deploy_production:
  stage: deploy
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST https://api.focuswithfocal.io/api/deployments \\
        -H "Authorization: Bearer $FOCAL_DEPLOY_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '{"projectId": "'"$FOCAL_DEPLOY_PROJECT_ID"'", "environment": "production", "branch": "'"$CI_COMMIT_REF_NAME"'"}'
  environment:
    name: production
    url: https://\${FOCAL_DEPLOY_PROJECT_ID}.focuswithfocal.com
  only:
    - main
  when: manual

# Deploy to staging automatically
deploy_staging:
  stage: deploy
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST https://api.focuswithfocal.io/api/deployments \\
        -H "Authorization: Bearer $FOCAL_DEPLOY_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '{"projectId": "'"$FOCAL_DEPLOY_PROJECT_ID"'", "environment": "staging", "branch": "'"$CI_COMMIT_REF_NAME"'"}'
  environment:
    name: staging
    url: https://staging-\${FOCAL_DEPLOY_PROJECT_ID}.focuswithfocal.com
  only:
    - develop

# Preview deployments for merge requests
deploy_preview:
  stage: deploy
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST https://api.focuswithfocal.io/api/deployments \\
        -H "Authorization: Bearer $FOCAL_DEPLOY_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '{"projectId": "'"$FOCAL_DEPLOY_PROJECT_ID"'", "environment": "preview-mr-'"$CI_MERGE_REQUEST_IID"'", "branch": "'"$CI_COMMIT_REF_NAME"'"}'
    - echo "Preview URL https://mr-$CI_MERGE_REQUEST_IID-\${FOCAL_DEPLOY_PROJECT_ID}.focuswithfocal.com"
  environment:
    name: preview/mr-$CI_MERGE_REQUEST_IID
    url: https://mr-$CI_MERGE_REQUEST_IID-\${FOCAL_DEPLOY_PROJECT_ID}.focuswithfocal.com
    on_stop: stop_preview
  only:
    - merge_requests

# Stop preview deployments when MR is closed
stop_preview:
  stage: deploy
  image: curlimages/curl:latest
  script:
    - curl -X DELETE "https://api.focuswithfocal.io/api/deployments/preview-mr-$CI_MERGE_REQUEST_IID" -H "Authorization: Bearer $FOCAL_DEPLOY_API_KEY"
  environment:
    name: preview/mr-$CI_MERGE_REQUEST_IID
    action: stop
  when: manual
  only:
    - merge_requests`;

  const simpleGitLabCI = `# Simple GitLab CI/CD for Focal Deploy

stages:
  - deploy

deploy:
  stage: deploy
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST https://api.focuswithfocal.io/api/deployments \\
        -H "Authorization: Bearer $FOCAL_DEPLOY_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '{"projectName": "my-app"}'
  only:
    - main`;

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
            GitLab CI/CD Pipeline
          </h1>
          <p className="text-xl text-gray-600">
            Automate deployments to Focal Deploy with GitLab Pipelines
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
                  <p className="font-medium text-gray-900">GitLab Repository</p>
                  <p className="text-sm text-gray-600">
                    Your application code hosted on GitLab.com or self-hosted GitLab
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
                    Give it a descriptive name like "GitLab CI - My Project"
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

          {/* Step 2: Add CI/CD Variables */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 2: Add CI/CD Variables to GitLab
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Go to your GitLab project → <strong>Settings</strong> → <strong>CI/CD</strong> → <strong>Variables</strong>
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Click <strong>"Add variable"</strong> and create the following variables:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4 mt-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm mb-1">Variable #1:</p>
                      <div className="bg-white border border-gray-300 rounded p-3">
                        <p className="text-xs text-gray-600 mb-1">Key:</p>
                        <code className="text-sm font-mono">FOCAL_DEPLOY_API_KEY</code>
                        <p className="text-xs text-gray-600 mt-2 mb-1">Value:</p>
                        <p className="text-sm text-gray-700">Your API key from Step 1</p>
                        <p className="text-xs text-gray-600 mt-2">
                          ✅ Check <strong>"Protect variable"</strong> and <strong>"Mask variable"</strong>
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm mb-1">Variable #2 (Optional):</p>
                      <div className="bg-white border border-gray-300 rounded p-3">
                        <p className="text-xs text-gray-600 mb-1">Key:</p>
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

          {/* Step 3: Create Pipeline File */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step 3: Create GitLab CI/CD Pipeline
            </h2>
            <p className="text-gray-700 mb-4">
              Choose between a simple pipeline or an advanced one with staging, previews, and manual production deployment:
            </p>

            {/* Simple Pipeline */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <FileCode className="w-5 h-5 text-blue-600 mr-2" />
                Option A: Simple Pipeline
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Perfect for getting started. Deploys on every push to main branch.
              </p>
              <div className="relative">
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                  <pre className="whitespace-pre">{simpleGitLabCI}</pre>
                </div>
                <button
                  onClick={() => copyToClipboard(simpleGitLabCI, 'simple')}
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

            {/* Advanced Pipeline */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <Zap className="w-5 h-5 text-orange-600 mr-2" />
                Option B: Advanced Pipeline
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Includes testing, multiple environments, preview deployments for MRs, and manual production deployment.
              </p>
              <div className="relative">
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre">{gitlabCIYaml}</pre>
                </div>
                <button
                  onClick={() => copyToClipboard(gitlabCIYaml, 'advanced')}
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
                <strong>📝 To add this pipeline:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-blue-800 mt-2 space-y-1">
                <li>Create a new file in your repository root: <code className="px-1 py-0.5 bg-blue-100 rounded">.gitlab-ci.yml</code></li>
                <li>Paste one of the pipelines above</li>
                <li>Customize it for your project (change Node version, test commands, etc.)</li>
                <li>Commit and push to your repository</li>
              </ol>
            </div>
          </section>

          {/* Step 4: Test Pipeline */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <PlayCircle className="w-6 h-6 mr-2 text-green-600" />
              Step 4: Test Your Pipeline
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">
                    Push a commit to your main branch (or create a merge request if using the advanced pipeline)
                  </p>
                  <div className="bg-gray-900 rounded-lg p-3 font-mono text-green-400 text-sm mt-2">
                    git add .gitlab-ci.yml<br />
                    git commit -m "Add GitLab CI/CD deployment"<br />
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
                    Go to your repository → <strong>CI/CD</strong> → <strong>Pipelines</strong> to watch the pipeline run
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Click on the pipeline to see the job logs and track progress
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  4
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    If using the advanced pipeline, manually trigger the production deployment from the pipeline view
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                  5
                </span>
                <div className="flex-1">
                  <p className="text-gray-700 mb-2">
                    Verify your deployment in the{' '}
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
                Your pipeline is now active. Every push will trigger automated tests, builds, and deployments!
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
                <h3 className="text-lg font-bold text-gray-900 mb-2">Deploy Only on Git Tags</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Trigger deployments only when you create a release tag:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`deploy:
  stage: deploy
  script:
    - curl -X POST https://api.focuswithfocal.io/api/deployments -H "Authorization: Bearer $API_KEY"
  only:
    - tags  # Runs only on git tags
  except:
    - branches`}</pre>
                </div>
              </div>

              {/* Parallel Jobs */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Parallel Test Jobs</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Speed up testing by running tests in parallel:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`test:
  stage: test
  parallel: 3  # Run 3 instances in parallel
  script:
    - npm run test:$CI_NODE_INDEX`}</pre>
                </div>
              </div>

              {/* Artifacts */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Save Build Artifacts</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Keep build artifacts for debugging:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
      - coverage/
    expire_in: 1 week`}</pre>
                </div>
              </div>

              {/* Slack Notifications */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Slack Notifications</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Get notified on Slack when deployments complete:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`deploy:
  stage: deploy
  script:
    - curl -X POST https://api.focuswithfocal.io/api/deployments -H "Authorization: Bearer $API_KEY"
  after_script:
    - 'curl -X POST -H "Content-type: application/json" --data "{\\"text\\":\\"Deployment $CI_JOB_STATUS\\"}" $SLACK_WEBHOOK'`}</pre>
                </div>
              </div>
            </div>
          </section>

          {/* GitLab-Specific Features */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              GitLab-Specific Features
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center">
                  <GitBranch className="w-5 h-5 text-blue-600 mr-2" />
                  Environment Management
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  GitLab's environment tracking lets you see deployment history and URLs:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
                  View environments in your project → <strong>Deployments</strong> → <strong>Environments</strong>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">Protected Environments</h3>
                <p className="text-sm text-gray-600">
                  Restrict who can deploy to production by setting up protected environments in{' '}
                  <strong>Settings</strong> → <strong>CI/CD</strong> → <strong>Protected Environments</strong>
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">Merge Request Approvals</h3>
                <p className="text-sm text-gray-600">
                  Require approvals before deploying to production by configuring merge request approval rules
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">Dynamic Environments</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Create temporary environments for each merge request that auto-delete when merged:
                </p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre">{`environment:
  name: review/$CI_COMMIT_REF_SLUG
  url: https://$CI_COMMIT_REF_SLUG.focuswithfocal.com
  on_stop: stop_review
  auto_stop_in: 1 day`}</pre>
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
                  <p className="font-medium text-gray-900">Always use masked and protected variables</p>
                  <p className="text-sm text-gray-600">
                    Enable "Mask variable" and "Protect variable" for all sensitive values
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Use manual deployments for production</p>
                  <p className="text-sm text-gray-600">
                    Add <code className="px-1 py-0.5 bg-gray-100 rounded">when: manual</code> to production jobs to prevent accidental deployments
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Limit variable scope</p>
                  <p className="text-sm text-gray-600">
                    Set variables to specific environments when possible (production, staging, etc.)
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Enable protected branches</p>
                  <p className="text-sm text-gray-600">
                    Protect main/production branches and require merge requests for all changes
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
                <h3 className="font-bold text-gray-900 mb-1">Pipeline Fails with "Variable not set"</h3>
                <p className="text-sm text-gray-600 mb-2">Check that:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-4 space-y-1">
                  <li>Variable names match exactly (case-sensitive)</li>
                  <li>Variables are not set to "protected" only if you're testing on a non-protected branch</li>
                  <li>No extra spaces in variable values</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Pipeline Never Starts</h3>
                <p className="text-sm text-gray-600">
                  Verify <code className="px-1 py-0.5 bg-gray-100 rounded">.gitlab-ci.yml</code> syntax at{' '}
                  <strong>CI/CD</strong> → <strong>Editor</strong> → <strong>Validate</strong>
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Deployment Job Skipped</h3>
                <p className="text-sm text-gray-600">
                  Check the <code className="px-1 py-0.5 bg-gray-100 rounded">only</code> and{' '}
                  <code className="px-1 py-0.5 bg-gray-100 rounded">except</code> rules match your branch or tag
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Artifact Download Fails</h3>
                <p className="text-sm text-gray-600">
                  Ensure the build job completes successfully and artifacts haven't expired
                </p>
              </div>
            </div>

            <div className="bg-gray-100 border-l-4 border-gray-500 p-4 rounded mt-6">
              <p className="text-sm text-gray-900">
                <strong>Need Help?</strong> Check{' '}
                <a href="https://docs.gitlab.com/ee/ci/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  GitLab CI/CD documentation
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
              <Link href="/guides/github-actions" className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                <Zap className="w-5 h-5 text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">GitHub Actions</h3>
                  <p className="text-xs text-gray-600">Automate with GitHub Actions</p>
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

function Shield({ className }: { className?: string}) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
