'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useAuthStore } from '@/stores/authStore';
import { billingAPI } from '@/lib/api';
import { Check, Rocket, Zap, Star, Crown, ArrowRight, Users, Sparkles, Shield, Clock } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  features: string[];
  limits: {
    deploymentsPerMonth?: number;
    instances?: number;
    maxS3Buckets?: number;
    maxDomains?: number;
    teamMembers?: number;
    storageGB?: number;
    concurrent?: number;
  };
}

export default function PricingPage() {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await billingAPI.getPlans();
      setPlans(response.data.plans || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      setPlans(getFallbackPlans());
      setLoading(false);
    }
  };

  const getFallbackPlans = (): PricingPlan[] => [
    {
      id: 'starter',
      name: 'Starter',
      monthlyPrice: 39,
      yearlyPrice: null,
      features: [
        '10 deployments per month',
        '1 concurrent deployment',
        '1 machine license',
        'Up to 3 instances',
        '10GB storage',
        '9+ pre-configured templates',
        'WordPress, Node.js, LAMP, Docker',
        'Community support',
        'DIY deployment automation'
      ],
      limits: {
        deploymentsPerMonth: 10,
        instances: 3,
        maxS3Buckets: 2,
        maxDomains: 2,
        teamMembers: 1,
        storageGB: 10
      },
    },
    {
      id: 'professional',
      name: 'Professional',
      monthlyPrice: 99,
      yearlyPrice: 990,
      features: [
        '50 deployments per month',
        '5 concurrent deployments',
        '2 machine licenses',
        'Up to 15 instances',
        '50GB storage',
        '9+ pre-configured templates',
        'Auto-provision RDS & S3',
        'Email support',
        'Full API access',
        'Priority deployment queue'
      ],
      limits: {
        deploymentsPerMonth: 50,
        instances: 15,
        maxS3Buckets: 10,
        maxDomains: 10,
        teamMembers: 5,
        storageGB: 50
      },
    },
    {
      id: 'max',
      name: 'Max',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      features: [
        '150 deployments per month',
        '15 concurrent deployments',
        '3 machine licenses',
        'Up to 50 instances',
        '200GB storage',
        '9+ pre-configured templates',
        'Auto-provision RDS & S3',
        'Custom deployment templates',
        'Priority support',
        'Full API access',
        'Advanced analytics',
        'Custom deployment hooks'
      ],
      limits: {
        deploymentsPerMonth: 150,
        instances: 50,
        maxS3Buckets: 25,
        maxDomains: 25,
        teamMembers: 15,
        storageGB: 200
      },
    },
    {
      id: 'dfy',
      name: 'Done For You',
      monthlyPrice: 299,
      yearlyPrice: 2990,
      features: [
        'Unlimited deployments (we deploy for you)',
        '10 concurrent deployments',
        '1 machine license for client',
        'Up to 25 instances',
        '100GB storage',
        'Unlimited S3 buckets',
        'Unlimited domains',
        '1 team member (client)',
        'White-glove support',
        'Dedicated deployment manager',
        'We handle all deployments',
        'Full admin dashboard access',
        'Super admin included for service provider',
        'Priority response',
        'Custom configurations'
      ],
      limits: {
        deploymentsPerMonth: -1,
        instances: 25,
        maxS3Buckets: -1,
        maxDomains: -1,
        teamMembers: 1,
        storageGB: 100
      },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: null,
      yearlyPrice: null,
      features: [
        'Unlimited deployments',
        'Unlimited concurrent',
        'Unlimited licenses',
        'Unlimited instances',
        'Unlimited storage',
        'All pre-configured templates',
        'Custom template development',
        'Auto-provision RDS & S3',
        'Dedicated support',
        'Full API access',
        'SLA guarantee',
        'Custom integrations',
        'On-premise option',
        'Training & onboarding'
      ],
      limits: {
        deploymentsPerMonth: -1,
        instances: -1,
        maxS3Buckets: -1,
        maxDomains: -1,
        teamMembers: -1,
        storageGB: -1
      },
    },
  ];

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'starter':
        return <Rocket className="w-8 h-8" />;
      case 'professional':
        return <Zap className="w-8 h-8" />;
      case 'max':
        return <Star className="w-8 h-8" />;
      case 'enterprise':
        return <Crown className="w-8 h-8" />;
      case 'dfy':
        return <Sparkles className="w-8 h-8" />;
      default:
        return <Rocket className="w-8 h-8" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'starter':
        return 'from-blue-500 to-blue-600';
      case 'professional':
        return 'from-purple-500 to-purple-600';
      case 'max':
        return 'from-orange-500 to-orange-600';
      case 'enterprise':
        return 'from-pink-500 to-pink-600';
      case 'dfy':
        return 'from-green-500 to-green-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const formatPrice = (plan: PricingPlan) => {
    if (plan.id === 'enterprise' || plan.monthlyPrice === null) {
      return 'Custom';
    }
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    if (price === undefined || price === null) {
      return 'Custom';
    }
    return `$${price}`;
  };

  const formatPricePerMonth = (plan: PricingPlan) => {
    if (plan.id === 'enterprise' || plan.monthlyPrice === null) {
      return 'Contact us';
    }
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : (plan.yearlyPrice ? Math.floor(plan.yearlyPrice / 12) : 0);
    if (price === undefined || price === null) {
      return 'Contact us';
    }
    return `$${price}/mo`;
  };

  // Structured data for SEO and AI engines
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Focal Deploy Cloud Deployment Platform",
    "description": "Multi-cloud deployment automation platform supporting AWS, Google Cloud, and Microsoft Azure with pre-configured templates, automated provisioning, and enterprise security.",
    "brand": {
      "@type": "Brand",
      "name": "Focal Deploy"
    },
    "offers": plans.filter(p => p.id !== 'enterprise').map(plan => ({
      "@type": "Offer",
      "name": plan.name,
      "price": plan.monthlyPrice || 0,
      "priceCurrency": "USD",
      "priceValidUntil": "2026-12-31",
      "availability": "https://schema.org/InStock",
      "url": "https://app.focuswithfocal.io/pricing"
    })),
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "127"
    }
  };

  // FAQ structured data for Google rich results and AI answers
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Can I upgrade or downgrade my plan?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You can upgrade or downgrade your plan at any time from your account settings. Changes are prorated automatically - you'll receive credit for unused time on your current plan when upgrading, or the difference will be applied to your next billing cycle."
        }
      },
      {
        "@type": "Question",
        "name": "What clouds are supported?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We support Amazon AWS (EC2, RDS, S3), Google Cloud Platform (Compute Engine, Cloud SQL, Cloud Storage), and Microsoft Azure (Virtual Machines, Virtual Networks, Storage)."
        }
      },
      {
        "@type": "Question",
        "name": "Do you offer custom plans?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Enterprise customers can customize resource limits, add custom integrations, request on-premise deployment, and get dedicated support. Contact sales for details."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a free trial?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! All plans include a 7-day free trial with full access to all features. Cancel anytime during the trial period with no charges."
        }
      },
      {
        "@type": "Question",
        "name": "What payment methods do you accept?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We accept all major credit cards (Visa, Mastercard, American Express) and ACH transfers for Enterprise customers. Billing is handled securely through Authorize.Net."
        }
      },
      {
        "@type": "Question",
        "name": "What happens after the trial ends?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "After your 7-day trial ends, your selected plan will begin and you'll be charged based on your chosen billing cycle (monthly or yearly). You'll receive an email reminder before the trial ends. You can cancel anytime before the trial expires to avoid charges."
        }
      }
    ]
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading plans...</p>
        </div>
      </div>
    );
  }

  const standardPlans = plans.filter(p => ['starter', 'professional', 'max'].includes(p.id));
  const dfyPlan = plans.find(p => p.id === 'dfy');
  const enterprisePlan = plans.find(p => p.id === 'enterprise');

  return (
    <>
      <Head>
        <title>Pricing - Deploy to AWS, Google Cloud & Azure | Focal Deploy</title>
        <meta name="description" content="Simple, transparent pricing for multi-cloud deployment automation. Deploy to AWS, Google Cloud, and Microsoft Azure with pre-configured templates, automated RDS/S3 provisioning, and enterprise security. Plans start at $39/month." />
        <meta name="keywords" content="cloud deployment pricing, AWS deployment cost, GCP deployment pricing, Azure deployment, multi-cloud pricing, DevOps automation cost, infrastructure as code pricing, cloud management pricing" />
        <meta property="og:title" content="Focal Deploy Pricing - Multi-Cloud Deployment Platform" />
        <meta property="og:description" content="Deploy to AWS, Google Cloud & Azure with automated provisioning. Pre-configured templates, RDS/S3 auto-setup, and enterprise security. Plans from $39/month." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://app.focuswithfocal.io/pricing" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Focal Deploy Pricing - Multi-Cloud Deployment Automation" />
        <meta name="twitter:description" content="Simple pricing for AWS, GCP & Azure deployments. Pre-configured templates, automated provisioning, enterprise security. Start at $39/month." />
        <link rel="canonical" href="https://app.focuswithfocal.io/pricing" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-50">
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
                <Link href="/pricing" className="text-blue-600 font-medium">
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
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Go to Dashboard
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

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight">
            Enterprise Infrastructure
            <span className="block text-blue-600 mt-2">at Startup Prices</span>
          </h1>
          <p className="mt-6 text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
            Multi-cloud deployment automation for AWS, Google Cloud, and Microsoft Azure.
            Pre-configured templates, automated provisioning, and enterprise security.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>7-day free trial</span>
            </div>
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Plans from $39/month</span>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">3</div>
              <div className="text-sm text-gray-600">Cloud Providers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">9+</div>
              <div className="text-sm text-gray-600">Pre-built Templates</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">&lt;5min</div>
              <div className="text-sm text-gray-600">Deploy Time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">99.9%</div>
              <div className="text-sm text-gray-600">Uptime SLA</div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {/* Billing Toggle */}
          <div className="flex justify-center mb-16">
            <div className="relative inline-flex items-center bg-white rounded-xl shadow-lg p-1.5 border border-gray-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`relative px-8 py-3 text-base font-semibold rounded-lg transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`relative px-8 py-3 text-base font-semibold rounded-lg transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          {/* Standard Plans - 3 Column Grid */}
          <div className="mb-20">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Self-Service Plans</h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              Perfect for developers and teams who want full control over their cloud deployments
            </p>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {standardPlans.map((plan) => {
                const isPopular = plan.id === 'professional';
                return (
                  <div
                    key={plan.id}
                    className={`relative bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${
                      isPopular ? 'ring-2 ring-blue-600 scale-105' : ''
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="bg-blue-600 text-white px-6 py-2 text-sm font-bold rounded-full shadow-lg">
                          MOST POPULAR
                        </div>
                      </div>
                    )}

                    <div className="p-8 pt-12">
                      <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${getPlanColor(plan.id)} text-white mb-6 shadow-lg`}>
                        {getPlanIcon(plan.id)}
                      </div>

                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>

                      <div className="mt-6 flex items-baseline">
                        <span className="text-5xl font-extrabold text-gray-900">
                          {formatPrice(plan)}
                        </span>
                        {plan.monthlyPrice !== null && (
                          <span className="ml-2 text-xl text-gray-500">
                            /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        )}
                      </div>

                      {billingCycle === 'yearly' && plan.yearlyPrice !== null && (
                        <p className="mt-2 text-sm text-gray-500">
                          {formatPricePerMonth(plan)} billed annually
                        </p>
                      )}

                      <Link
                        href={user ? '/dashboard/billing' : '/register'}
                        className={`mt-8 block w-full text-center px-6 py-4 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg ${
                          isPopular
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        Start Free Trial
                        <ArrowRight className="inline-block ml-2 w-4 h-4" />
                      </Link>

                      <ul className="mt-8 space-y-4">
                        {plan.features && plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <Check className="flex-shrink-0 w-5 h-5 text-green-500 mr-3 mt-0.5" />
                            <span className="text-sm text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Done For You Section - Special Highlight */}
          {dfyPlan && (
            <div className="mb-20">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl shadow-2xl overflow-hidden">
                <div className="px-8 py-12 md:px-12 md:py-16">
                  <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="text-white">
                      <div className="inline-flex items-center px-4 py-2 bg-white/20 rounded-full text-sm font-semibold mb-6 backdrop-blur-sm">
                        <Sparkles className="w-4 h-4 mr-2" />
                        White-Glove Service
                      </div>
                      <h2 className="text-4xl md:text-5xl font-extrabold mb-6">
                        Done For You Deployments
                      </h2>
                      <p className="text-xl text-green-50 mb-8">
                        Perfect for agencies and businesses who want expert deployment management.
                        We handle everything while you focus on your clients and core business.
                      </p>
                      <div className="flex flex-wrap gap-6 mb-8">
                        <div className="flex items-center">
                          <Users className="w-6 h-6 mr-3" />
                          <div>
                            <div className="font-semibold">Dedicated Manager</div>
                            <div className="text-sm text-green-50">Your personal deployment expert</div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-6 h-6 mr-3" />
                          <div>
                            <div className="font-semibold">Unlimited Deployments</div>
                            <div className="text-sm text-green-50">We deploy everything for you</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-8 shadow-xl">
                      <div className="flex items-center justify-between mb-6">
                        <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${getPlanColor('dfy')} text-white shadow-lg`}>
                          {getPlanIcon('dfy')}
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-extrabold text-gray-900">{formatPrice(dfyPlan)}</div>
                          <div className="text-gray-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</div>
                        </div>
                      </div>

                      <Link
                        href={user ? '/dashboard/billing' : '/register'}
                        className="block w-full text-center px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all shadow-md mb-6"
                      >
                        Get White-Glove Service
                        <ArrowRight className="inline-block ml-2 w-4 h-4" />
                      </Link>

                      <ul className="space-y-3">
                        {dfyPlan.features.slice(0, 6).map((feature, index) => (
                          <li key={index} className="flex items-start text-sm">
                            <Check className="flex-shrink-0 w-5 h-5 text-green-500 mr-3 mt-0.5" />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">
                          Perfect for: Agencies, Service Providers, Managed Hosting Companies
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enterprise Section - Special Highlight */}
          {enterprisePlan && (
            <div className="mb-20">
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl shadow-2xl overflow-hidden">
                <div className="px-8 py-12 md:px-12 md:py-16">
                  <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="text-white order-2 md:order-1">
                      <div className="bg-white rounded-2xl p-8 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                          <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${getPlanColor('enterprise')} text-white shadow-lg`}>
                            {getPlanIcon('enterprise')}
                          </div>
                          <div className="text-2xl font-bold text-gray-900">Custom Pricing</div>
                        </div>

                        <Link
                          href="/contact"
                          className="block w-full text-center px-6 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-md mb-6"
                        >
                          Contact Sales
                          <ArrowRight className="inline-block ml-2 w-4 h-4" />
                        </Link>

                        <ul className="space-y-3">
                          {enterprisePlan.features.slice(0, 7).map((feature, index) => (
                            <li key={index} className="flex items-start text-sm">
                              <Check className="flex-shrink-0 w-5 h-5 text-green-500 mr-3 mt-0.5" />
                              <span className="text-gray-700">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <div className="flex items-center text-sm text-gray-600">
                            <Shield className="w-5 h-5 mr-2" />
                            <span className="font-medium">99.9% Uptime SLA Guarantee</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-white order-1 md:order-2">
                      <div className="inline-flex items-center px-4 py-2 bg-white/20 rounded-full text-sm font-semibold mb-6 backdrop-blur-sm">
                        <Crown className="w-4 h-4 mr-2" />
                        Enterprise Grade
                      </div>
                      <h2 className="text-4xl md:text-5xl font-extrabold mb-6">
                        Built for Enterprise Scale
                      </h2>
                      <p className="text-xl text-gray-300 mb-8">
                        Unlimited resources, dedicated support, custom integrations, and on-premise deployment options.
                        Everything you need for mission-critical infrastructure.
                      </p>

                      <div className="space-y-4 mb-8">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mr-4">
                            <Check className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg">Custom Development</div>
                            <div className="text-gray-300">Tailored templates and integrations built for your needs</div>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mr-4">
                            <Check className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg">On-Premise Option</div>
                            <div className="text-gray-300">Deploy Focal Deploy in your own infrastructure</div>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mr-4">
                            <Check className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg">Dedicated Success Team</div>
                            <div className="text-gray-300">Training, onboarding, and ongoing support</div>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-gray-400">
                        Trusted by Fortune 500 companies and high-growth startups worldwide
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Section */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What's included in all plans?</h3>
                <p className="text-gray-600">
                  All plans include multi-cloud support (AWS, GCP, Azure), pre-configured deployment templates,
                  SSL certificates, automated security groups, encrypted credential storage, and real-time monitoring.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Can I change plans anytime?</h3>
                <p className="text-gray-600">
                  Yes! Upgrade or downgrade anytime. Changes are prorated, so you only pay for what you use.
                  No penalties or long-term contracts required.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What clouds are supported?</h3>
                <p className="text-gray-600">
                  We support Amazon AWS (EC2, RDS, S3), Google Cloud Platform (Compute Engine, Cloud SQL, Cloud Storage),
                  and Microsoft Azure (Virtual Machines, Virtual Networks, Storage).
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Do you offer custom plans?</h3>
                <p className="text-gray-600">
                  Yes! Enterprise customers can customize resource limits, add custom integrations,
                  request on-premise deployment, and get dedicated support. Contact sales for details.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Is there a free trial?</h3>
                <p className="text-gray-600">
                  Yes! All plans include a 7-day free trial with full access to all features.
                  Cancel anytime during the trial period with no charges.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What payment methods do you accept?</h3>
                <p className="text-gray-600">
                  We accept all major credit cards (Visa, Mastercard, American Express) and ACH transfers for Enterprise customers.
                  Billing is handled securely through Authorize.Net.
                </p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="mt-20 text-center bg-blue-50 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to deploy anywhere?
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Join hundreds of developers and teams deploying to AWS, Google Cloud, and Azure with Focal Deploy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-all shadow-md border-2 border-gray-200"
              >
                Contact Sales
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Questions? Email us at <a href="mailto:support@focuswithfocal.io" className="text-blue-600 hover:text-blue-700">support@focuswithfocal.io</a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <Rocket className="h-6 w-6 text-blue-500" />
                  <span className="text-xl font-bold text-white">Focal Deploy</span>
                </div>
                <p className="text-sm">
                  Multi-cloud deployment automation for AWS, Google Cloud, and Microsoft Azure.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Product</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/#features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/guides" className="hover:text-white transition-colors">Documentation</Link></li>
                  <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Company</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                  <li><Link href="/status" className="hover:text-white transition-colors">Status</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Connect</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                  <li><a href="mailto:support@focuswithfocal.io" className="hover:text-white transition-colors">Email Us</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
              <p>&copy; {new Date().getFullYear()} Focal Deploy. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
