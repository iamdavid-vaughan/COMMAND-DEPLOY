'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  FileText,
  Copy,
  Check,
  Code,
  Lock,
  Zap,
  AlertCircle,
} from 'lucide-react';

export default function APIDocsPage() {
  const { user, token } = useAuthStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.focuswithfocal.io';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({
    code,
    language,
    id,
  }: {
    code: string;
    language: string;
    id: string;
  }) => (
    <div className="relative">
      <div className="absolute top-2 right-2">
        <button
          onClick={() => copyToClipboard(code, id)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          {copiedCode === id ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4 text-gray-300" />
          )}
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
        <code className="text-sm font-mono">{code}</code>
      </pre>
    </div>
  );

  const hasAPIAccess = user?.licenseTier === 'pro' || user?.licenseTier === 'max' || user?.licenseTier === 'enterprise';

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">API Documentation</h1>
        <p className="mt-1 text-gray-500">
          Integrate Focal Deploy into your workflow
        </p>
      </div>

      {/* API Access Notice */}
      {!hasAPIAccess && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <Lock className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-900">
              API Access Not Included in Your Plan
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Upgrade to Pro, Max, or Enterprise to access the API. You can still view
              the documentation below.
            </p>
            <a
              href="/dashboard/billing"
              className="text-sm font-medium text-yellow-800 hover:text-yellow-900 mt-2 inline-block"
            >
              Upgrade Plan →
            </a>
          </div>
        </div>
      )}

      {/* Quick Start */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="h-6 w-6 text-blue-600 mr-2" />
          Quick Start
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Base URL</h3>
            <CodeBlock
              id="base-url"
              language="text"
              code={apiUrl}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Your API Token
            </h3>
            <CodeBlock
              id="api-token"
              language="text"
              code={token || 'Login to view your token'}
            />
            <p className="text-xs text-gray-500 mt-2">
              This token expires in 7 days. Keep it secure and never share it publicly.
            </p>
          </div>
        </div>
      </div>

      {/* Authentication */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication</h2>
        <p className="text-gray-600 mb-4">
          All API requests require a JWT token in the Authorization header.
        </p>

        <h3 className="font-medium text-gray-900 mb-2">Login</h3>
        <p className="text-sm text-gray-600 mb-2">
          POST <code className="bg-gray-100 px-2 py-1 rounded">/api/auth/login</code>
        </p>
        <CodeBlock
          id="auth-login"
          language="bash"
          code={`curl -X POST ${apiUrl}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "your@email.com",
    "password": "your-password"
  }'`}
        />

        <h3 className="font-medium text-gray-900 mb-2 mt-6">Using the Token</h3>
        <CodeBlock
          id="auth-header"
          language="bash"
          code={`curl ${apiUrl}/api/deployments \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}"`}
        />
      </div>

      {/* Deployments API */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Deployments</h2>

        <div className="space-y-6">
          {/* List Deployments */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">List Deployments</h3>
            <p className="text-sm text-gray-600 mb-2">
              GET <code className="bg-gray-100 px-2 py-1 rounded">/api/deployments</code>
            </p>
            <CodeBlock
              id="list-deployments"
              language="bash"
              code={`curl ${apiUrl}/api/deployments \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}"`}
            />
          </div>

          {/* Get Deployment */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Get Deployment</h3>
            <p className="text-sm text-gray-600 mb-2">
              GET <code className="bg-gray-100 px-2 py-1 rounded">/api/deployments/:id</code>
            </p>
            <CodeBlock
              id="get-deployment"
              language="bash"
              code={`curl ${apiUrl}/api/deployments/DEPLOYMENT_ID \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}"`}
            />
          </div>

          {/* Create Deployment */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Create Deployment</h3>
            <p className="text-sm text-gray-600 mb-2">
              POST <code className="bg-gray-100 px-2 py-1 rounded">/api/deployments</code>
            </p>
            <CodeBlock
              id="create-deployment"
              language="bash"
              code={`curl -X POST ${apiUrl}/api/deployments \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectName": "my-app",
    "region": "us-east-1",
    "instanceType": "t3.micro",
    "domains": ["example.com"],
    "configuration": {
      "ssl": true,
      "autoBackup": true
    }
  }'`}
            />
          </div>

          {/* Delete Deployment */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Delete Deployment</h3>
            <p className="text-sm text-gray-600 mb-2">
              DELETE <code className="bg-gray-100 px-2 py-1 rounded">/api/deployments/:id</code>
            </p>
            <CodeBlock
              id="delete-deployment"
              language="bash"
              code={`curl -X DELETE ${apiUrl}/api/deployments/DEPLOYMENT_ID \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}"`}
            />
          </div>
        </div>
      </div>

      {/* Credentials API */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Credentials</h2>

        <div className="space-y-6">
          {/* List Credentials */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">List Credentials</h3>
            <p className="text-sm text-gray-600 mb-2">
              GET <code className="bg-gray-100 px-2 py-1 rounded">/api/credentials</code>
            </p>
            <CodeBlock
              id="list-credentials"
              language="bash"
              code={`curl ${apiUrl}/api/credentials \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}"`}
            />
          </div>

          {/* Create Credential */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Create Credential</h3>
            <p className="text-sm text-gray-600 mb-2">
              POST <code className="bg-gray-100 px-2 py-1 rounded">/api/credentials</code>
            </p>
            <CodeBlock
              id="create-credential"
              language="bash"
              code={`curl -X POST ${apiUrl}/api/credentials \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "aws",
    "data": {
      "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
      "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "region": "us-east-1"
    },
    "metadata": {
      "name": "Production AWS"
    }
  }'`}
            />
          </div>
        </div>
      </div>

      {/* Usage API */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage & Limits</h2>

        <div className="space-y-6">
          {/* Current Usage */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Get Current Usage</h3>
            <p className="text-sm text-gray-600 mb-2">
              GET <code className="bg-gray-100 px-2 py-1 rounded">/api/usage</code>
            </p>
            <CodeBlock
              id="get-usage"
              language="bash"
              code={`curl ${apiUrl}/api/usage?period=month \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}"`}
            />
          </div>

          {/* Get Limits */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Get Limits</h3>
            <p className="text-sm text-gray-600 mb-2">
              GET <code className="bg-gray-100 px-2 py-1 rounded">/api/usage/limits</code>
            </p>
            <CodeBlock
              id="get-limits"
              language="bash"
              code={`curl ${apiUrl}/api/usage/limits \\
  -H "Authorization: Bearer ${token || 'YOUR_JWT_TOKEN'}"`}
            />
          </div>
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Rate Limiting</h2>
        <div className="space-y-3">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                General API: 100 requests per 15 minutes
              </p>
              <p className="text-sm text-gray-500">
                For Pro, Max, and Enterprise tiers with API access
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Authentication: 5 requests per 15 minutes
              </p>
              <p className="text-sm text-gray-500">
                Login attempts are strictly limited for security
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-700">
            Rate limit information is included in response headers:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600 font-mono">
            <li>X-RateLimit-Limit</li>
            <li>X-RateLimit-Remaining</li>
            <li>X-RateLimit-Reset</li>
          </ul>
        </div>
      </div>

      {/* SDK Examples */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">SDK Examples</h2>

        <div className="space-y-6">
          {/* JavaScript/Node.js */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">JavaScript / Node.js</h3>
            <CodeBlock
              id="sdk-js"
              language="javascript"
              code={`const axios = require('axios');

const api = axios.create({
  baseURL: '${apiUrl}',
  headers: {
    'Authorization': 'Bearer ${token || 'YOUR_JWT_TOKEN'}',
    'Content-Type': 'application/json'
  }
});

// List deployments
const deployments = await api.get('/api/deployments');
console.log(deployments.data);

// Create deployment
const newDeployment = await api.post('/api/deployments', {
  projectName: 'my-app',
  region: 'us-east-1',
  instanceType: 't3.micro'
});
console.log(newDeployment.data);`}
            />
          </div>

          {/* Python */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Python</h3>
            <CodeBlock
              id="sdk-python"
              language="python"
              code={`import requests

headers = {
    'Authorization': 'Bearer ${token || 'YOUR_JWT_TOKEN'}',
    'Content-Type': 'application/json'
}

# List deployments
response = requests.get('${apiUrl}/api/deployments', headers=headers)
deployments = response.json()
print(deployments)

# Create deployment
data = {
    'projectName': 'my-app',
    'region': 'us-east-1',
    'instanceType': 't3.micro'
}
response = requests.post('${apiUrl}/api/deployments', json=data, headers=headers)
new_deployment = response.json()
print(new_deployment)`}
            />
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">Need Help?</h3>
        <p className="text-gray-600 mt-2">
          Check out our full documentation or contact support
        </p>
        <div className="mt-4 flex items-center justify-center space-x-4">
          <a
            href="mailto:support@focuswithfocal.io"
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Email Support
          </a>
        </div>
      </div>
    </div>
  );
}
