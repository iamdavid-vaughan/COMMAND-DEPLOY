'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Copy, ExternalLink, Shield, Key, Lock } from 'lucide-react';
import { useState } from 'react';

export default function AWSIAMSetupGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const policyJSON = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "ec2:RunInstances",
        "ec2:TerminateInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:RebootInstances",
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:CreateKeyPair",
        "ec2:DeleteKeyPair",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:AllocateAddress",
        "ec2:AssociateAddress",
        "ec2:DisassociateAddress",
        "ec2:ReleaseAddress"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:PutBucketWebsite",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": [
        "arn:aws:s3:::*",
        "arn:aws:s3:::*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:CreateHostedZone",
        "route53:DeleteHostedZone",
        "route53:ListHostedZones",
        "route53:GetHostedZone",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:GetChange"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds:CreateDBInstance",
        "rds:DeleteDBInstance",
        "rds:DescribeDBInstances",
        "rds:ModifyDBInstance",
        "rds:CreateDBSubnetGroup",
        "rds:DeleteDBSubnetGroup"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:ListDistributions",
        "cloudfront:UpdateDistribution"
      ],
      "Resource": "*"
    }
  ]
}`;

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
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-2">
                Beginner
              </span>
              <h1 className="text-4xl font-extrabold text-gray-900">AWS IAM Setup Guide</h1>
            </div>
          </div>
          <p className="text-xl text-gray-600">
            Learn how to create an IAM user with the correct permissions for Focal Deploy
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
              <span>How to create an IAM user with programmatic access</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>Required AWS permissions for deployments</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>Best practices for credential security</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>How to connect your AWS account to Focal Deploy</span>
            </li>
          </ul>
        </div>

        {/* Prerequisites */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Prerequisites</h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>An active AWS account (free tier works fine)</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>AWS console access with IAM permissions</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
              <span>A Focal Deploy account (sign up at <Link href="/register" className="text-blue-600 hover:underline">focuswithfocal.com</Link>)</span>
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
              <h2 className="text-2xl font-bold text-gray-900">Sign in to AWS Console</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">
                Navigate to the AWS Management Console and sign in with your AWS account.
              </p>
              <a
                href="https://console.aws.amazon.com/iam"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Open IAM Console
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
              <h2 className="text-2xl font-bold text-gray-900">Create IAM User</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>Click <strong>"Users"</strong> in the left sidebar</li>
                <li>Click <strong>"Add users"</strong> button</li>
                <li>Enter username: <code className="px-2 py-1 bg-gray-100 rounded text-sm">focal-deploy</code></li>
                <li>Select <strong>"Programmatic access"</strong> (Access key - Programmatic access)</li>
                <li>Click <strong>"Next: Permissions"</strong></li>
              </ol>
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Make sure to select "Programmatic access" - this creates an access key for API calls, which Focal Deploy needs.
                  </p>
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
              <h2 className="text-2xl font-bold text-gray-900">Attach Permissions Policy</h2>
            </div>
            <div className="ml-13 space-y-4">
              <p className="text-gray-700">
                You have two options for attaching permissions:
              </p>

              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Option A: Use Managed Policies (Easiest)</h4>
                  <p className="text-sm text-gray-600 mb-3">Quick setup for testing. Grants broad permissions.</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>Select <strong>"Attach existing policies directly"</strong></li>
                    <li>Search and select these policies:
                      <ul className="ml-6 mt-2 space-y-1">
                        <li>✓ <code className="text-xs bg-gray-100 px-2 py-1 rounded">AmazonEC2FullAccess</code></li>
                        <li>✓ <code className="text-xs bg-gray-100 px-2 py-1 rounded">AmazonS3FullAccess</code></li>
                        <li>✓ <code className="text-xs bg-gray-100 px-2 py-1 rounded">AmazonRoute53FullAccess</code></li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <h4 className="font-semibold text-gray-900 mb-2">Option B: Custom Policy (Recommended for Production)</h4>
                  <p className="text-sm text-gray-600 mb-3">More secure - grants only necessary permissions.</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>Select <strong>"Create policy"</strong> (opens new tab)</li>
                    <li>Click <strong>"JSON"</strong> tab</li>
                    <li>Paste the policy below</li>
                    <li>Click <strong>"Next: Tags"</strong> → <strong>"Next: Review"</strong></li>
                    <li>Name it <code className="text-xs bg-gray-100 px-2 py-1 rounded">FocalDeployPolicy</code></li>
                    <li>Click <strong>"Create policy"</strong></li>
                    <li>Go back to the user creation tab and refresh policies</li>
                    <li>Select your <strong>FocalDeployPolicy</strong></li>
                  </ol>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">Custom Policy JSON</h4>
                  <button
                    onClick={() => copyToClipboard(policyJSON, 'policy')}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    {copiedSection === 'policy' ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{policyJSON}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                4
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Review and Create</h2>
            </div>
            <div className="ml-13 space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Add tags (optional): <code className="px-2 py-1 bg-gray-100 rounded text-sm">Environment: Production</code></li>
                <li>Click <strong>"Next: Review"</strong></li>
                <li>Review the user details and permissions</li>
                <li>Click <strong>"Create user"</strong></li>
              </ol>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-lg mr-3">
                5
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Save Your Credentials</h2>
            </div>
            <div className="ml-13 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-2">CRITICAL: This is your only chance to see the secret access key!</p>
                    <p>AWS will never show it again. Save it securely now.</p>
                  </div>
                </div>
              </div>

              <p className="text-gray-700">You'll see two values:</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <Key className="w-5 h-5 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
                  <div>
                    <strong>Access key ID</strong>
                    <br />
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">AKIAIOSFODNN7EXAMPLE</code>
                  </div>
                </li>
                <li className="flex items-start">
                  <Lock className="w-5 h-5 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
                  <div>
                    <strong>Secret access key</strong>
                    <br />
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY</code>
                  </div>
                </li>
              </ul>

              <div className="space-y-2">
                <p className="text-gray-700 font-semibold">Save these credentials:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
                  <li>Click <strong>"Download .csv"</strong> and save to a secure location</li>
                  <li>Or copy both values to a password manager (recommended)</li>
                  <li><strong>Never</strong> share these credentials or commit them to Git</li>
                </ul>
              </div>
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
                <li>Click <strong>"Add AWS Credentials"</strong></li>
                <li>Enter:
                  <ul className="ml-6 mt-2 space-y-1">
                    <li>• Credential name: <code className="text-sm bg-gray-100 px-2 py-1 rounded">Production AWS</code></li>
                    <li>• Access Key ID (paste from step 5)</li>
                    <li>• Secret Access Key (paste from step 5)</li>
                    <li>• Default region: <code className="text-sm bg-gray-100 px-2 py-1 rounded">us-east-1</code></li>
                  </ul>
                </li>
                <li>Click <strong>"Test Connection"</strong> to verify</li>
                <li>Click <strong>"Save"</strong></li>
              </ol>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
                <div className="flex">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-green-800">
                    <strong>Success!</strong> Your AWS credentials are now securely stored and encrypted. You can start deploying!
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
                <li>✓ Use custom policies with minimal permissions</li>
                <li>✓ Rotate access keys every 90 days</li>
                <li>✓ Enable MFA on your AWS root account</li>
                <li>✓ Use separate IAM users for different environments</li>
                <li>✓ Monitor CloudTrail logs for unusual activity</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">✗ DON'T</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>✗ Use your AWS root account credentials</li>
                <li>✗ Share credentials across team members</li>
                <li>✗ Commit credentials to version control</li>
                <li>✗ Email or message credentials in plaintext</li>
                <li>✗ Give more permissions than necessary</li>
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
                Now that your AWS credentials are set up, learn how to deploy your first application.
              </p>
            </Link>
            <Link
              href="/guides/gcp-service-account"
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow group"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                Add Google Cloud →
              </h3>
              <p className="text-gray-600 text-sm">
                Want to deploy to GCP too? Set up your Google Cloud service account.
              </p>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-gray-600">
            Need help? <Link href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:underline">Contact support</Link> or join our{' '}
            <Link href="https://discord.gg/focaldeploy" className="text-blue-600 hover:underline">Discord community</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
