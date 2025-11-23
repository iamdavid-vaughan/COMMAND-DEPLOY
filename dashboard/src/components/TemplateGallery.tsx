'use client';

import { useState, useEffect } from 'react';
import {
  Server, Globe, Code, Database, Container,
  CheckCircle, AlertCircle, Loader, Clock, DollarSign,
  Package, Zap, Shield
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  category: string;
  framework: string | null;
  provider: 'aws' | 'gcp' | 'azure' | 'all';
  template_type: 'application' | 'infrastructure';
  estimated_setup_time_minutes: number;
  pricing_estimate: {
    aws_t3_micro?: number;
    aws_t3_small?: number;
    aws_t3_medium?: number;
  };
  features: string[];
  tags: string[];
  configuration: {
    default_instance_type?: string;
    default_storage?: number;
    supports_rds?: boolean;
    supports_s3?: boolean;
    required_memory_gb?: number;
  };
  popularity_score: number;
}

interface TemplateGalleryProps {
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template) => void;
  provider?: 'aws' | 'gcp' | 'azure';
}

const categoryIcons: Record<string, any> = {
  cms: Globe,
  application: Code,
  static: Server,
  container: Container,
  framework: Package,
  blog: Globe,
};

const getCategoryIcon = (category: string) => {
  return categoryIcons[category] || Server;
};

export default function TemplateGallery({
  selectedTemplate,
  onSelectTemplate,
  provider = 'aws'
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchTemplates();
  }, [provider]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('focal_auth_token');

      if (!token) {
        throw new Error('You must be logged in to view templates. Please log in and try again.');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      console.log('Fetching templates from:', apiUrl);
      console.log('Token present:', !!token);

      const response = await fetch(
        `${apiUrl}/api/templates?provider=${provider}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      console.error('Template fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(templates.map(t => t.category)));
  const filteredTemplates = filter === 'all'
    ? templates
    : templates.filter(t => t.category === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading templates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <span className="text-red-800">Failed to load templates: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Choose a Deployment Template
        </h2>
        <p className="text-gray-600">
          Pre-configured infrastructure templates to get you started quickly
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Templates
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => {
          const Icon = getCategoryIcon(template.category);
          const isSelected = selectedTemplate?.id === template.id;
          const estimatedCost = template.pricing_estimate.aws_t3_micro ||
                               template.pricing_estimate.aws_t3_small || 0;

          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className={`text-left p-5 rounded-lg border-2 transition-all hover:shadow-md ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    isSelected ? 'bg-blue-600' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      isSelected ? 'text-white' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      isSelected ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {template.name}
                    </h3>
                    <p className="text-xs text-gray-500 capitalize">
                      {template.category}
                      {template.framework && ` • ${template.framework}`}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {template.short_description}
              </p>

              {/* Features */}
              <div className="flex flex-wrap gap-1 mb-3">
                {template.features.slice(0, 3).map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {feature}
                  </span>
                ))}
                {template.features.length > 3 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                    +{template.features.length - 3} more
                  </span>
                )}
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{template.estimated_setup_time_minutes}min
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    From ${estimatedCost}/mo
                  </span>
                </div>
                {template.configuration.supports_rds && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Database className="w-3 h-3" />
                    RDS Ready
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className="flex gap-2 mt-3">
                {template.configuration.supports_s3 && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    S3 Auto-Setup
                  </span>
                )}
                {template.popularity_score >= 90 && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                    Popular
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Server className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No templates found in this category</p>
        </div>
      )}

      {/* Selected Template Details */}
      {selectedTemplate && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-600 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">
                {selectedTemplate.name} Selected
              </h4>
              <p className="text-sm text-blue-800 mb-3">
                {selectedTemplate.description}
              </p>

              {/* Configuration Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-blue-700">
                  <Server className="w-4 h-4" />
                  <span>
                    Recommended: {selectedTemplate.configuration.default_instance_type || 't3.micro'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <Database className="w-4 h-4" />
                  <span>
                    Storage: {selectedTemplate.configuration.default_storage || 20}GB
                  </span>
                </div>
                {selectedTemplate.configuration.supports_rds && (
                  <div className="flex items-center gap-2 text-blue-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>Optional RDS Database</span>
                  </div>
                )}
                {selectedTemplate.configuration.supports_s3 && (
                  <div className="flex items-center gap-2 text-blue-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>Auto S3 Bucket Creation</span>
                  </div>
                )}
              </div>

              {/* Features List */}
              <div className="mt-4">
                <p className="text-xs font-medium text-blue-900 mb-2">
                  Includes:
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white text-blue-800 text-xs rounded border border-blue-200"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
