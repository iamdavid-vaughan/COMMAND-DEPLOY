'use client';

import Link from 'next/link';
import Head from 'next/head';
import { useAuthStore } from '@/stores/authStore';
import {
  Rocket,
  Zap,
  Shield,
  Cloud,
  Code,
  Activity,
  Check,
  ArrowRight,
  Github,
  Terminal,
  Lock,
  Gauge,
  Globe,
  Server,
  Package,
} from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuthStore();

  // Structured data for SEO and AI engines
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Focal Deploy",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "description": "Multi-cloud deployment automation platform for AWS, Google Cloud, and Microsoft Azure. Deploy applications in under 5 minutes with pre-configured templates, automated SSL, and enterprise security.",
    "offers": {
      "@type": "Offer",
      "price": "39",
      "priceCurrency": "USD",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "39",
        "priceCurrency": "USD",
        "unitText": "MONTH"
      },
      "availability": "https://schema.org/InStock",
      "url": "https://app.focuswithfocal.io/pricing"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "127",
      "bestRating": "5",
      "worstRating": "1"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Focal Deploy",
      "url": "https://app.focuswithfocal.io",
      "logo": {
        "@type": "ImageObject",
        "url": "https://app.focuswithfocal.io/logo.png"
      }
    },
    "featureList": [
      "Multi-cloud deployment (AWS, Google Cloud, Azure)",
      "One-click application templates",
      "Automated SSL certificate provisioning",
      "Pre-configured security groups",
      "Real-time deployment monitoring",
      "Team collaboration features",
      "API access for automation",
      "25+ global regions"
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Focal Deploy",
    "url": "https://app.focuswithfocal.io",
    "logo": "https://app.focuswithfocal.io/logo.png",
    "description": "Multi-cloud deployment automation platform supporting AWS, Google Cloud, and Microsoft Azure",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Support",
      "email": "support@focuswithfocal.com"
    },
    "sameAs": [
      "https://x.com/focaldeploy",
      "https://github.com/focaldeploy"
    ]
  };

  // FAQ structured data for Google rich results and AI answers
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Focal Deploy?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Focal Deploy is a multi-cloud deployment automation platform that lets you deploy applications to AWS, Google Cloud, or Microsoft Azure in under 5 minutes. It provides pre-configured templates for WordPress, Node.js, LAMP, Docker, and more, with automated SSL certificates, security groups, and infrastructure provisioning."
        }
      },
      {
        "@type": "Question",
        "name": "Which cloud providers does Focal Deploy support?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Focal Deploy supports three major cloud providers: Amazon AWS (EC2, RDS, S3), Google Cloud Platform (Compute Engine, Cloud SQL, Cloud Storage), and Microsoft Azure (Virtual Machines, Virtual Networks, Storage). You can deploy to any of these platforms from a single unified interface."
        }
      },
      {
        "@type": "Question",
        "name": "How long does it take to deploy an application?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "With Focal Deploy's pre-configured templates, you can deploy a complete application stack in under 5 minutes. This includes provisioning infrastructure, configuring security groups, setting up SSL certificates, and deploying your application code."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need DevOps expertise to use Focal Deploy?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No! Focal Deploy is designed to make cloud deployment accessible to developers without DevOps expertise. Our pre-configured templates and automated workflows handle the complex infrastructure setup, security configuration, and deployment process for you."
        }
      },
      {
        "@type": "Question",
        "name": "What deployment templates are available?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Focal Deploy offers 9+ pre-configured templates including WordPress with RDS, Node.js with PM2, LAMP stack, Docker host, Python/Django, React SPA, Next.js, and more. Each template includes automated RDS database provisioning, S3 bucket setup, SSL certificates, and security group configuration."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a free trial?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Focal Deploy offers a 7-day free trial with full access to all features. You can cancel anytime during the trial period with no charges. Plans start at $39/month after the trial ends."
        }
      },
      {
        "@type": "Question",
        "name": "How is Focal Deploy different from AWS Console or Google Cloud Console?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Focal Deploy provides a unified interface for deploying to AWS, Google Cloud, and Azure, whereas native consoles are provider-specific. It automates complex tasks like security group configuration, SSL certificate provisioning, and application deployment that would require manual setup in native consoles. You can deploy a complete stack in under 5 minutes versus hours of manual configuration."
        }
      },
      {
        "@type": "Question",
        "name": "Can I manage multiple deployments across different clouds?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Focal Deploy lets you manage all your deployments across AWS, Google Cloud, and Azure from a single dashboard. You can track deployment status, view real-time logs, monitor performance, and manage resources across all three cloud providers in one place."
        }
      }
    ]
  };

  const features = [
    {
      icon: <Cloud className="w-6 h-6" />,
      title: 'True Multi-Cloud',
      description:
        'Deploy to AWS, Google Cloud, or Microsoft Azure. Choose any provider, switch anytime, one unified experience.',
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: 'One-Click Templates',
      description:
        'WordPress, Node.js, LAMP, Docker, and more. Pre-configured stacks with automated RDS and S3 provisioning.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Enterprise Security',
      description:
        'Built-in SSL certificates, automated security groups, encrypted credentials, and cloud-native best practices.',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Lightning Fast',
      description:
        'Optimized deployment pipeline gets your app live in under 5 minutes on any cloud provider.',
    },
    {
      icon: <Activity className="w-6 h-6" />,
      title: 'Real-time Monitoring',
      description:
        'Track deployments across all clouds, monitor performance, and get instant alerts from one dashboard.',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Global Reach',
      description:
        'Deploy to 25+ regions worldwide. Choose the best location for your users across any cloud.',
    },
    {
      icon: <Server className="w-6 h-6" />,
      title: 'Full Control',
      description:
        'SSH access, custom configurations, environment variables, and domain management all in one place.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Connect Your Cloud Accounts',
      description: 'Start your 7-day free trial. Securely connect AWS, Google Cloud, or Microsoft Azure credentials. Add multiple providers and choose the best fit for each deployment.',
      code: null,
    },
    {
      number: '02',
      title: 'Pick a Template or Configure Manually',
      description: 'Choose from pre-configured templates like WordPress + RDS, Node.js + PM2, LAMP stack, or Docker host. Or customize everything yourself. Select your cloud (AWS, GCP, Azure), region, and instance size.',
      code: null,
    },
    {
      number: '03',
      title: 'Manage Everything in One Place',
      description: 'Track all deployments across AWS, GCP, and Azure from one dashboard. View real-time metrics, SSH into any server, manage DNS and domains - unified cloud management.',
      code: null,
    },
  ];

  return (
    <>
      <Head>
        <title>Focal Deploy - Multi-Cloud Deployment Automation for AWS, GCP & Azure</title>
        <meta name="description" content="Deploy applications to AWS, Google Cloud, or Microsoft Azure in under 5 minutes. Pre-configured templates for WordPress, Node.js, Docker & more. Automated SSL, security groups, and enterprise-grade infrastructure. Start your 7-day free trial today." />
        <meta name="keywords" content="cloud deployment, AWS deployment automation, Google Cloud deployment, Azure deployment, multi-cloud platform, DevOps automation, infrastructure as code, cloud management, application deployment, EC2 deployment, GCP Compute Engine, Azure Virtual Machines, automated cloud provisioning, cloud deployment tool, deploy to AWS, deploy to GCP, deploy to Azure" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://app.focuswithfocal.io/" />
        <meta property="og:title" content="Focal Deploy - Deploy to AWS, Google Cloud & Azure in Seconds" />
        <meta property="og:description" content="Multi-cloud deployment automation platform. Deploy applications to AWS, GCP, or Azure with pre-configured templates, automated SSL, and enterprise security. Try free for 7 days." />
        <meta property="og:image" content="https://app.focuswithfocal.io/og-image.png" />
        <meta property="og:site_name" content="Focal Deploy" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://app.focuswithfocal.io/" />
        <meta name="twitter:title" content="Focal Deploy - Multi-Cloud Deployment Automation" />
        <meta name="twitter:description" content="Deploy to AWS, Google Cloud & Azure in under 5 minutes. Pre-configured templates, automated SSL, enterprise security. Start free trial today." />
        <meta name="twitter:image" content="https://app.focuswithfocal.io/twitter-image.png" />
        <meta name="twitter:site" content="@focaldeploy" />

        {/* Additional SEO */}
        <link rel="canonical" href="https://app.focuswithfocal.io/" />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Focal Deploy" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
      </Head>

      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Rocket className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">Focal Deploy</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-700 hover:text-blue-600 transition-colors">
                Features
              </Link>
              <Link href="#how-it-works" className="text-gray-700 hover:text-blue-600 transition-colors">
                How It Works
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-blue-600 transition-colors">
                Pricing
              </Link>
              <Link href="/guides" className="text-gray-700 hover:text-blue-600 transition-colors">
                Docs
              </Link>
            </nav>
            <div className="flex items-center space-x-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-medium mb-6">
              <span className="animate-pulse mr-2">🎉</span> Now supporting AWS, Google Cloud & Microsoft Azure
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight">
              Deploy Anywhere
              <span className="block text-blue-600 mt-2">in Seconds</span>
            </h1>
            <p className="mt-6 text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Focal Deploy is the fastest way to deploy your applications to AWS, Google Cloud, or Microsoft Azure.
              One platform. Three clouds. Zero DevOps expertise required.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:border-blue-600 hover:text-blue-600 transition-all"
              >
                View Pricing
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              7-day free trial • No commitment • Cancel anytime
            </p>
          </div>

          {/* Cloud Providers */}
          <div className="mt-12 flex flex-wrap justify-center items-center gap-8">
            <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-xl shadow-sm border border-gray-200">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#FF9900">
                <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.296.072-.583.16-.863.279a2.06 2.06 0 0 1-.263.103.455.455 0 0 1-.12.024c-.104 0-.16-.08-.16-.255v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.415-.287-.806-.399l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z"/>
              </svg>
              <span className="font-semibold text-gray-700">AWS</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-xl shadow-sm border border-gray-200">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#4285F4">
                <path d="M12.5 7.25a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5zm0 8.75a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/>
                <path fill="#EA4335" d="M20.25 12.5a7.75 7.75 0 01-2.27 5.48l1.24 1.24A9.5 9.5 0 0022 12.5h-1.75z"/>
                <path fill="#FBBC05" d="M12.5 20.25a7.73 7.73 0 01-5.48-2.27l-1.24 1.24A9.5 9.5 0 0012.5 22v-1.75z"/>
                <path fill="#34A853" d="M4.75 12.5a7.73 7.73 0 012.27-5.48L5.78 5.78A9.5 9.5 0 003 12.5h1.75z"/>
                <path fill="#4285F4" d="M12.5 4.75a7.73 7.73 0 015.48 2.27l1.24-1.24A9.5 9.5 0 0012.5 3v1.75z"/>
              </svg>
              <span className="font-semibold text-gray-700">Google Cloud</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-xl shadow-sm border border-gray-200">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#0078D4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="font-semibold text-gray-700">Microsoft Azure</span>
            </div>
          </div>

          {/* Hero Image/Demo */}
          <div className="mt-16">
            <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-gray-400 text-sm">Focal Deploy Dashboard</span>
              </div>
              <div className="font-mono text-sm space-y-2">
                <div className="text-blue-400">? Select your cloud provider:</div>
                <div className="text-green-400 pl-4">❯ Amazon AWS (EC2, S3)</div>
                <div className="text-gray-500 pl-4">  Google Cloud (Compute Engine)</div>
                <div className="text-gray-500 pl-4">  Microsoft Azure (Virtual Machines)</div>
                <div className="mt-4 text-gray-500">
                  → Provisioning infrastructure...
                </div>
                <div className="text-gray-500">
                  → Creating security groups...
                </div>
                <div className="text-gray-500">
                  → Configuring SSL certificate...
                </div>
                <div className="text-green-400">
                  ✓ Deployed successfully in 3m 24s!
                </div>
                <div className="text-blue-400">
                  🚀 https://your-app.focuswithfocal.com
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900">
              Everything you need to deploy with confidence
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Powerful features that make deployment simple and reliable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow border border-gray-200"
              >
                <div className="inline-flex p-3 rounded-lg bg-blue-100 text-blue-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900">How It Works</h2>
            <p className="mt-4 text-xl text-gray-600">
              Get your application live in three simple steps
            </p>
          </div>

          <div className="space-y-12">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row items-center gap-8"
              >
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 mb-4">{step.description}</p>
                  {step.code && (
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-green-400 text-sm">
                      $ {step.code}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
            >
              Start Deploying Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <p className="mt-6 text-sm text-gray-500">
              <Terminal className="inline-block w-4 h-4 mr-1" />
              Power users: CLI available with <code className="px-2 py-1 bg-gray-100 rounded">npm install -g focal-deploy</code>
            </p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Built for Scale</h2>
            <p className="mt-2 text-gray-600">Enterprise-ready infrastructure across three major clouds</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">3</div>
              <div className="text-gray-600">Cloud Providers</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">9+</div>
              <div className="text-gray-600">Templates</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">25+</div>
              <div className="text-gray-600">Global Regions</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">&lt;5min</div>
              <div className="text-gray-600">Deploy Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">256-bit</div>
              <div className="text-gray-600">Encryption</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-extrabold text-white">
            Ready to deploy to any cloud?
          </h2>
          <p className="mt-4 text-xl text-blue-100">
            AWS, Google Cloud, or Azure - deploy your applications in minutes with one unified platform
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-blue-600 bg-white hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
          <p className="mt-6 text-sm text-blue-100">
            7-day free trial • No commitment • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Rocket className="h-6 w-6 text-blue-500" />
                <span className="text-xl font-bold text-white">Focal Deploy</span>
              </div>
              <p className="text-sm">
                Deploy to AWS, Google Cloud, or Microsoft Azure from one unified platform.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/guides" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Connect</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="https://x.com/focaldeploy" className="hover:text-white transition-colors inline-flex items-center" aria-label="Follow us on X">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </Link>
                </li>
                <li><Link href="https://github.com/focaldeploy" className="hover:text-white transition-colors">GitHub</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                <li><Link href="/status" className="hover:text-white transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-sm text-center">
            © 2025 Focal Deploy. All rights reserved.
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
