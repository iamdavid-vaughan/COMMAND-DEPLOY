'use client';

import Link from 'next/link';
import Head from 'next/head';
import { useAuthStore } from '@/stores/authStore';
import {
  Book,
  Cloud,
  Lock,
  Rocket,
  Settings,
  Zap,
  ArrowRight,
  Server,
  Code,
  Shield,
} from 'lucide-react';

export default function GuidesPage() {
  const { user } = useAuthStore();

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Focal Deploy Integration Guides",
    "description": "Step-by-step guides for deploying to AWS, Google Cloud, and Microsoft Azure. Learn how to set up cloud credentials, deploy applications, and automate your DevOps workflow.",
    "itemListElement": [
      {
        "@type": "HowTo",
        "position": 1,
        "name": "AWS IAM Setup Guide",
        "description": "Set up an IAM user with the correct permissions for AWS deployments",
        "url": "https://app.focuswithfocal.io/guides/aws-iam-setup"
      },
      {
        "@type": "HowTo",
        "position": 2,
        "name": "Google Cloud Service Account Setup",
        "description": "Create and configure a GCP service account for Focal Deploy",
        "url": "https://app.focuswithfocal.io/guides/gcp-service-account"
      },
      {
        "@type": "HowTo",
        "position": 3,
        "name": "Azure Service Principal Setup",
        "description": "Create an Azure service principal for deploying to Microsoft Azure",
        "url": "https://app.focuswithfocal.io/guides/azure-service-principal"
      },
      {
        "@type": "HowTo",
        "position": 4,
        "name": "Your First Deployment",
        "description": "Deploy your first application step-by-step with Focal Deploy",
        "url": "https://app.focuswithfocal.io/guides/first-deployment"
      }
    ]
  };

  // FAQ structured data for Google rich results and AI answers
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How do I set up AWS credentials for Focal Deploy?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "To set up AWS credentials, you need to create an IAM user in your AWS console with programmatic access. Grant it permissions for EC2, S3, RDS, and VPC. Then add the Access Key ID and Secret Access Key to Focal Deploy in your Cloud Providers settings. Our AWS IAM Setup guide provides detailed step-by-step instructions."
        }
      },
      {
        "@type": "Question",
        "name": "How do I deploy to Google Cloud Platform?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "To deploy to Google Cloud, create a service account in your GCP project with Compute Engine Admin, Storage Admin, and Cloud SQL Admin roles. Download the JSON key file and upload it to Focal Deploy. Our GCP Service Account guide walks you through the complete setup process."
        }
      },
      {
        "@type": "Question",
        "name": "How do I set up Azure credentials?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "For Azure deployments, create a service principal using Azure CLI or the Azure Portal. You'll need the Subscription ID, Tenant ID, Client ID, and Client Secret. Add these credentials to Focal Deploy in the Cloud Providers settings. See our Azure Service Principal guide for detailed instructions."
        }
      },
      {
        "@type": "Question",
        "name": "Can I automate deployments with CI/CD?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Focal Deploy integrates with GitHub Actions, GitLab CI/CD, and other CI/CD platforms. You can trigger deployments programmatically using our REST API or use our pre-built workflow templates. Check our GitHub Actions and GitLab CI/CD guides for setup instructions."
        }
      },
      {
        "@type": "Question",
        "name": "What frameworks and applications can I deploy?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Focal Deploy supports deploying Next.js, React, Vue, Angular, Node.js, Python/Django, Ruby on Rails, PHP/Laravel, WordPress, and Docker containers. We provide pre-configured templates for each framework with optimized settings for production deployments."
        }
      },
      {
        "@type": "Question",
        "name": "How do I secure my cloud deployments?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Focal Deploy automatically configures security groups with minimal required ports, enables HTTPS with Let's Encrypt SSL certificates, and stores credentials with AES-256-GCM encryption. For advanced security, check our VPC & Network Security and SSH Key Management guides."
        }
      },
      {
        "@type": "Question",
        "name": "How long does my first deployment take?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "After setting up cloud credentials (5-15 minutes), your first deployment typically takes 3-5 minutes. This includes provisioning infrastructure, configuring security, setting up SSL certificates, and deploying your application. Follow our First Deployment guide for a step-by-step walkthrough."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need DevOps or cloud experience?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No! Our guides are designed for developers of all experience levels. We provide step-by-step instructions with screenshots for setting up cloud credentials, deploying applications, and configuring CI/CD. Beginner-level guides take 5-15 minutes to complete."
        }
      }
    ]
  };

  const guideCategories = [
    {
      title: 'Getting Started',
      icon: <Rocket className="w-6 h-6" />,
      color: 'blue',
      guides: [
        {
          title: 'AWS IAM Setup',
          description: 'Set up an IAM user with the correct permissions for deployments',
          href: '/guides/aws-iam-setup',
          difficulty: 'Beginner',
          time: '10 minutes',
        },
        {
          title: 'Google Cloud Service Account',
          description: 'Create and configure a GCP service account for Focal Deploy',
          href: '/guides/gcp-service-account',
          difficulty: 'Beginner',
          time: '10 minutes',
        },
        {
          title: 'Azure Service Principal',
          description: 'Create an Azure service principal for deploying to Microsoft Azure',
          href: '/guides/azure-service-principal',
          difficulty: 'Beginner',
          time: '15 minutes',
        },
        {
          title: 'DigitalOcean API Setup',
          description: 'Generate an API token for DNS management and droplet deployments',
          href: '/guides/digitalocean-setup',
          difficulty: 'Beginner',
          time: '5 minutes',
        },
        {
          title: 'Your First Deployment',
          description: 'Deploy your first application step-by-step',
          href: '/guides/first-deployment',
          difficulty: 'Beginner',
          time: '15 minutes',
        },
      ],
    },
    {
      title: 'Security & Best Practices',
      icon: <Shield className="w-6 h-6" />,
      color: 'green',
      guides: [
        {
          title: 'Credential Management',
          description: 'Best practices for storing and rotating cloud credentials',
          href: '/guides/credential-management',
          difficulty: 'Intermediate',
          time: '15 minutes',
        },
        {
          title: 'VPC & Network Security',
          description: 'Configure secure VPCs and firewall rules',
          href: '/guides/network-security',
          difficulty: 'Advanced',
          time: '20 minutes',
        },
        {
          title: 'SSH Key Management',
          description: 'Manage SSH keys securely across deployments',
          href: '/guides/ssh-keys',
          difficulty: 'Intermediate',
          time: '10 minutes',
        },
      ],
    },
    {
      title: 'Framework Guides',
      icon: <Code className="w-6 h-6" />,
      color: 'purple',
      guides: [
        {
          title: 'Deploy Next.js Apps',
          description: 'Deploy Next.js applications with SSR and static export',
          href: '/guides/nextjs-deployment',
          difficulty: 'Beginner',
          time: '12 minutes',
        },
        {
          title: 'Deploy React SPAs',
          description: 'Deploy React single-page applications',
          href: '/guides/react-deployment',
          difficulty: 'Beginner',
          time: '10 minutes',
        },
        {
          title: 'Deploy Python/Django',
          description: 'Deploy Django applications with Gunicorn and Nginx',
          href: '/guides/django-deployment',
          difficulty: 'Intermediate',
          time: '18 minutes',
        },
      ],
    },
    {
      title: 'CI/CD Integration',
      icon: <Zap className="w-6 h-6" />,
      color: 'orange',
      guides: [
        {
          title: 'GitHub Actions',
          description: 'Automate deployments with GitHub Actions workflows',
          href: '/guides/github-actions',
          difficulty: 'Intermediate',
          time: '15 minutes',
        },
        {
          title: 'GitLab CI/CD',
          description: 'Set up GitLab pipelines for automated deployments',
          href: '/guides/gitlab-cicd',
          difficulty: 'Intermediate',
          time: '15 minutes',
        },
        {
          title: 'API-Based Deployments',
          description: 'Trigger deployments programmatically via API',
          href: '/guides/api-deployments',
          difficulty: 'Advanced',
          time: '12 minutes',
        },
      ],
    },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-800';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <>
      <Head>
        <title>Cloud Deployment Guides - AWS, GCP & Azure Setup Tutorials | Focal Deploy</title>
        <meta name="description" content="Comprehensive step-by-step guides for cloud deployment automation. Learn how to set up AWS IAM, Google Cloud service accounts, Azure service principals, GitHub Actions CI/CD, and deploy Node.js, React, Python, and Docker applications to any cloud." />
        <meta name="keywords" content="cloud deployment guides, AWS IAM setup, Google Cloud service account, Azure service principal, cloud deployment tutorial, DevOps guides, CI/CD setup, GitHub Actions deployment, GitLab CI deployment, AWS deployment guide, GCP deployment tutorial, Azure deployment guide, multi-cloud deployment" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://app.focuswithfocal.io/guides" />
        <meta property="og:title" content="Cloud Deployment Guides - AWS, GCP & Azure Tutorials" />
        <meta property="og:description" content="Step-by-step guides for deploying to AWS, Google Cloud, and Microsoft Azure. Learn cloud credential setup, application deployment, and DevOps automation." />
        <meta property="og:site_name" content="Focal Deploy" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://app.focuswithfocal.io/guides" />
        <meta name="twitter:title" content="Cloud Deployment Guides - Multi-Cloud Tutorials" />
        <meta name="twitter:description" content="Free guides for AWS, GCP, and Azure deployment. Learn cloud setup, CI/CD automation, and application deployment." />
        <meta name="twitter:site" content="@focaldeploy" />

        {/* Additional SEO */}
        <link rel="canonical" href="https://app.focuswithfocal.io/guides" />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Focal Deploy" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Rocket className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">Focal Deploy</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/#features" className="text-gray-700 hover:text-blue-600 transition-colors">
                Features
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-blue-600 transition-colors">
                Pricing
              </Link>
              <Link href="/guides" className="text-blue-600 font-medium">
                Guides
              </Link>
              <Link href="/guides" className="text-gray-700 hover:text-blue-600 transition-colors">
                Docs
              </Link>
            </nav>
            <div className="flex items-center space-x-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-lg mb-4">
              <Book className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
              Integration Guides
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Step-by-step guides to help you set up cloud credentials, deploy applications, and automate your workflow
            </p>
          </div>
        </div>
      </div>

      {/* Guides */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {guideCategories.map((category, index) => (
            <div key={index}>
              <div className="flex items-center mb-6">
                <div className={`inline-flex p-2 rounded-lg ${getCategoryColor(category.color)} mr-3`}>
                  {category.icon}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{category.title}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.guides.map((guide, guideIndex) => (
                  <Link
                    key={guideIndex}
                    href={guide.href}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 p-6 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(guide.difficulty)}`}>
                        {guide.difficulty}
                      </span>
                      <span className="text-sm text-gray-500">{guide.time}</span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {guide.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">{guide.description}</p>

                    <div className="flex items-center text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                      Read guide
                      <ArrowRight className="ml-1 w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-blue-50 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Need help with something specific?
          </h3>
          <p className="text-gray-600 mb-6">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <Link
            href="mailto:support@focuswithfocal.com"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Contact Support
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
