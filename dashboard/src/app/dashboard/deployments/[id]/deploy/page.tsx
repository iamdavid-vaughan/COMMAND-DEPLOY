'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Upload,
  Github,
  FileCode,
  Loader2,
  Settings,
  Rocket,
  AlertCircle,
  Code,
  Terminal,
  Play
} from 'lucide-react';
import { deploymentsAPI } from '@/lib/api';

interface DeploymentTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  framework: string;
  source_url: string | null;
  default_build_command: string | null;
  default_start_command: string | null;
  default_port: number | null;
  default_env_vars: Record<string, string> | null;
  requires_database: boolean;
  requires_redis: boolean;
  min_ram_mb: number;
  min_disk_gb: number;
  icon_url: string | null;
  is_featured: boolean;
}

interface Deployment {
  id: string;
  projectName: string;
  status: string;
  publicIp: string | null;
  connectionInfo: any;
}

type DeploymentSource = 'template' | 'github' | 'zip' | null;

interface DeploymentConfig {
  sourceType: DeploymentSource;
  templateId?: string;
  githubUrl?: string;
  zipFile?: File;
  framework?: string;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  envVars: Record<string, string>;
}

export default function DeployAppWizard() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [templates, setTemplates] = useState<DeploymentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState<string[]>([]);

  // Configuration
  const [config, setConfig] = useState<DeploymentConfig>({
    sourceType: null,
    envVars: {}
  });

  // Load deployment and templates
  useEffect(() => {
    loadData();
  }, [deploymentId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch deployment details
      const deploymentRes = await deploymentsAPI.getById(deploymentId);
      const deploymentData = deploymentRes.data.deployment;
      setDeployment(deploymentData);

      // Check if infrastructure is ready
      if (deploymentData.status !== 'completed') {
        setError('Infrastructure must be in "completed" state before deploying an application');
        return;
      }

      // Fetch templates
      const templatesRes = await fetch('/api/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const templatesData = await templatesRes.json();
      setTemplates(templatesData.templates || []);

    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.response?.data?.message || 'Failed to load deployment wizard');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: DeploymentTemplate) => {
    setConfig({
      sourceType: 'template',
      templateId: template.id,
      framework: template.framework,
      buildCommand: template.default_build_command || '',
      startCommand: template.default_start_command || '',
      port: template.default_port || 3000,
      envVars: template.default_env_vars || {}
    });
    setCurrentStep(2);
  };

  const handleGithubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.githubUrl) {
      alert('Please enter a GitHub repository URL');
      return;
    }
    setCurrentStep(2);
  };

  const handleZipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setConfig({ ...config, sourceType: 'zip', zipFile: file });
      setCurrentStep(2);
    }
  };

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(3);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeploymentProgress(['Starting deployment...']);

    try {
      const formData = new FormData();
      formData.append('sourceType', config.sourceType || '');

      if (config.sourceType === 'template' && config.templateId) {
        formData.append('templateId', config.templateId);
      } else if (config.sourceType === 'github' && config.githubUrl) {
        formData.append('sourceUrl', config.githubUrl);
      } else if (config.sourceType === 'zip' && config.zipFile) {
        formData.append('zipFile', config.zipFile);
      }

      if (config.framework) formData.append('framework', config.framework);
      if (config.buildCommand) formData.append('buildCommand', config.buildCommand);
      if (config.startCommand) formData.append('startCommand', config.startCommand);
      if (config.port) formData.append('port', config.port.toString());
      formData.append('envVars', JSON.stringify(config.envVars));

      setDeploymentProgress(prev => [...prev, 'Connecting to server...']);

      const response = await fetch(`/api/deployments/${deploymentId}/deploy-app`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      setDeploymentProgress(prev => [
        ...prev,
        'Server connected',
        'Downloading source code...',
        'Installing dependencies...',
        'Building application...',
        'Starting application...',
        'Installing monitoring agent...',
        'Deployment complete!'
      ]);

      setTimeout(() => {
        router.push(`/dashboard/deployments/${deploymentId}`);
      }, 2000);

    } catch (err: any) {
      console.error('Deployment error:', err);
      setError(err.message || 'Deployment failed');
      setDeploymentProgress(prev => [...prev, `ERROR: ${err.message}`]);
    } finally {
      setDeploying(false);
    }
  };

  const addEnvVar = () => {
    const key = prompt('Environment variable name:');
    if (key) {
      const value = prompt(`Value for ${key}:`);
      if (value !== null) {
        setConfig({
          ...config,
          envVars: { ...config.envVars, [key]: value }
        });
      }
    }
  };

  const removeEnvVar = (key: string) => {
    const newEnvVars = { ...config.envVars };
    delete newEnvVars[key];
    setConfig({ ...config, envVars: newEnvVars });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !deployment) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => router.push(`/dashboard/deployments/${deploymentId}`)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Back to Deployment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(`/dashboard/deployments/${deploymentId}`)}
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deployment
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Deploy Application
        </h1>
        <p className="text-gray-600">
          Deploy your application to {deployment?.projectName}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['Choose Source', 'Configure', 'Review & Deploy'].map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`flex items-center gap-3 ${index + 1 < currentStep ? 'text-green-600' : index + 1 === currentStep ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  index + 1 < currentStep
                    ? 'bg-green-50 border-green-600'
                    : index + 1 === currentStep
                    ? 'bg-blue-50 border-blue-600'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  {index + 1 < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="font-semibold">{index + 1}</span>
                  )}
                </div>
                <span className="font-medium text-sm hidden sm:inline">{step}</span>
              </div>
              {index < 2 && (
                <div className={`flex-1 h-0.5 mx-4 ${index + 1 < currentStep ? 'bg-green-600' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Choose Source */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Deployment Source</h2>
            <p className="text-gray-600">Select how you want to deploy your application</p>
          </div>

          {/* Templates */}
          {templates.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all text-left"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
                        {template.name.charAt(0)}
                      </div>
                      {template.is_featured && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                          Popular
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{template.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Code className="w-3 h-3" />
                      {template.framework}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GitHub */}
          <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
                <Github className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">GitHub Repository</h3>
                <p className="text-sm text-gray-600">Deploy from a GitHub repository</p>
              </div>
            </div>
            <form onSubmit={handleGithubSubmit} className="space-y-3">
              <input
                type="url"
                placeholder="https://github.com/username/repository"
                value={config.githubUrl || ''}
                onChange={(e) => setConfig({ ...config, sourceType: 'github', githubUrl: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                Continue with GitHub
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* ZIP Upload */}
          <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Upload ZIP File</h3>
                <p className="text-sm text-gray-600">Upload your application as a ZIP archive</p>
              </div>
            </div>
            <label className="block">
              <input
                type="file"
                accept=".zip"
                onChange={handleZipUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {currentStep === 2 && (
        <form onSubmit={handleConfigSubmit} className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Deployment</h2>
            <p className="text-gray-600">Customize build and runtime settings</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            {/* Framework */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Framework (optional - auto-detected if empty)
              </label>
              <input
                type="text"
                value={config.framework || ''}
                onChange={(e) => setConfig({ ...config, framework: e.target.value })}
                placeholder="nextjs, nodejs, wordpress, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Build Command */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Build Command
              </label>
              <input
                type="text"
                value={config.buildCommand || ''}
                onChange={(e) => setConfig({ ...config, buildCommand: e.target.value })}
                placeholder="npm install && npm run build"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Start Command */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Command
              </label>
              <input
                type="text"
                value={config.startCommand || ''}
                onChange={(e) => setConfig({ ...config, startCommand: e.target.value })}
                placeholder="npm start"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Port */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Application Port
              </label>
              <input
                type="number"
                value={config.port || ''}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                placeholder="3000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Environment Variables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Environment Variables
                </label>
                <button
                  type="button"
                  onClick={addEnvVar}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Add Variable
                </button>
              </div>
              {Object.keys(config.envVars).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(config.envVars).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                      <code className="flex-1 text-sm">
                        <span className="font-semibold text-gray-900">{key}</span>
                        <span className="text-gray-500"> = </span>
                        <span className="text-gray-700">{value}</span>
                      </code>
                      <button
                        type="button"
                        onClick={() => removeEnvVar(key)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No environment variables added</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              Continue to Review
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Review & Deploy */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Review & Deploy</h2>
            <p className="text-gray-600">Verify your configuration before deploying</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Source Type</h3>
              <p className="text-gray-900 capitalize">{config.sourceType}</p>
            </div>

            {config.sourceType === 'github' && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">GitHub Repository</h3>
                <p className="text-gray-900 font-mono text-sm">{config.githubUrl}</p>
              </div>
            )}

            {config.sourceType === 'zip' && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">ZIP File</h3>
                <p className="text-gray-900">{config.zipFile?.name}</p>
              </div>
            )}

            {config.framework && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Framework</h3>
                <p className="text-gray-900">{config.framework}</p>
              </div>
            )}

            {config.buildCommand && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Build Command</h3>
                <code className="block text-sm text-gray-900 bg-gray-50 p-2 rounded">{config.buildCommand}</code>
              </div>
            )}

            {config.startCommand && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Start Command</h3>
                <code className="block text-sm text-gray-900 bg-gray-50 p-2 rounded">{config.startCommand}</code>
              </div>
            )}

            {config.port && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Port</h3>
                <p className="text-gray-900">{config.port}</p>
              </div>
            )}

            {Object.keys(config.envVars).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Environment Variables</h3>
                <div className="space-y-1">
                  {Object.entries(config.envVars).map(([key, value]) => (
                    <code key={key} className="block text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {key} = {value}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          {deploying && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Deploying Application...</h3>
                  <p className="text-blue-700 text-sm">This may take a few minutes</p>
                </div>
              </div>
              <div className="space-y-1">
                {deploymentProgress.map((msg, idx) => (
                  <div key={idx} className="text-sm text-blue-800 flex items-center gap-2">
                    <Terminal className="w-3 h-3" />
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">Deployment Error</h4>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={deploying}
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-opacity-90 transition-all inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deploying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Deploy Application
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
