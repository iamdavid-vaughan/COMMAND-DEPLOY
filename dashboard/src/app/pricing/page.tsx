'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { billingAPI } from '@/lib/api';
import { Check, Rocket, Zap, Star, Crown, ArrowRight } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: {
    deploymentsPerMonth: number;
    maxInstances: number;
    maxS3Buckets: number;
    maxDomains: number;
    teamMembers: number;
    support: string;
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
      // Use fallback plans if API fails
      setPlans(getFallbackPlans());
      setLoading(false);
    }
  };

  const getFallbackPlans = (): PricingPlan[] => [
    {
      id: 'starter',
      name: 'Starter',
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: {
        deploymentsPerMonth: 3,
        maxInstances: 2,
        maxS3Buckets: 2,
        maxDomains: 2,
        teamMembers: 1,
        support: 'Community',
      },
    },
    {
      id: 'professional',
      name: 'Professional',
      monthlyPrice: 99,
      yearlyPrice: 990,
      features: {
        deploymentsPerMonth: -1,
        maxInstances: 10,
        maxS3Buckets: 10,
        maxDomains: 10,
        teamMembers: 5,
        support: 'Email (48h SLA)',
      },
    },
    {
      id: 'max',
      name: 'Max',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      features: {
        deploymentsPerMonth: -1,
        maxInstances: 50,
        maxS3Buckets: 50,
        maxDomains: 50,
        teamMembers: 15,
        support: 'Email & Chat (24h SLA)',
      },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: {
        deploymentsPerMonth: -1,
        maxInstances: -1,
        maxS3Buckets: -1,
        maxDomains: -1,
        teamMembers: -1,
        support: 'Priority (4h SLA) + Phone',
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
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const formatPrice = (plan: PricingPlan) => {
    if (plan.id === 'enterprise') {
      return 'Custom';
    }
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    return `$${price}`;
  };

  const formatPricePerMonth = (plan: PricingPlan) => {
    if (plan.id === 'enterprise') {
      return 'Contact us';
    }
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : Math.floor(plan.yearlyPrice / 12);
    return `$${price}/mo`;
  };

  const formatFeatureValue = (value: number) => {
    if (value === -1) return 'Unlimited';
    return value.toString();
  };

  const getPlanFeatures = (plan: PricingPlan) => {
    const baseFeatures = [
      {
        name: 'Deployments per month',
        value: formatFeatureValue(plan.features.deploymentsPerMonth),
      },
      {
        name: 'EC2 Instances',
        value: formatFeatureValue(plan.features.maxInstances),
      },
      {
        name: 'S3 Buckets',
        value: formatFeatureValue(plan.features.maxS3Buckets),
      },
      {
        name: 'Custom Domains',
        value: formatFeatureValue(plan.features.maxDomains),
      },
      {
        name: 'Team Members',
        value: formatFeatureValue(plan.features.teamMembers),
      },
      {
        name: 'Support',
        value: plan.features.support,
      },
    ];

    // Add enterprise-specific features
    if (plan.id === 'enterprise') {
      baseFeatures.push(
        { name: 'White-label', value: 'Yes' },
        { name: 'On-premises option', value: 'Available' },
        { name: 'Custom integrations', value: 'Included' },
        { name: 'SLA guarantee', value: '99.9%' }
      );
    }

    return baseFeatures;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Rocket className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">Focal Deploy</span>
            </Link>
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

      {/* Pricing Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Choose the plan that fits your needs. All plans include SSL certificates, monitoring, and automatic backups.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="relative inline-flex items-center bg-white rounded-lg shadow-sm p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`relative px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`relative px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {plans.map((plan) => {
            const isPopular = plan.id === 'professional';
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden ${
                  isPopular ? 'ring-2 ring-blue-600' : ''
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                    POPULAR
                  </div>
                )}

                <div className="p-8">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${getPlanColor(plan.id)} text-white mb-4`}>
                    {getPlanIcon(plan.id)}
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>

                  {/* Price */}
                  <div className="mt-4 flex items-baseline">
                    <span className="text-5xl font-extrabold text-gray-900">
                      {formatPrice(plan)}
                    </span>
                    {plan.id !== 'enterprise' && (
                      <span className="ml-1 text-xl text-gray-500">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>

                  {billingCycle === 'yearly' && plan.id !== 'enterprise' && (
                    <p className="mt-1 text-sm text-gray-500">
                      {formatPricePerMonth(plan)} billed annually
                    </p>
                  )}

                  {/* CTA Button */}
                  <Link
                    href={plan.id === 'enterprise' ? '/contact' : user ? '/dashboard/billing' : '/register'}
                    className={`mt-8 block w-full text-center px-6 py-3 rounded-lg font-semibold transition-colors ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {plan.id === 'enterprise' ? 'Contact Sales' : 'Get Started'}
                  </Link>

                  {/* Features */}
                  <ul className="mt-8 space-y-4">
                    {getPlanFeatures(plan).map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="flex-shrink-0 w-5 h-5 text-green-500 mr-3 mt-0.5" />
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{feature.value}</span>
                          <span className="text-gray-500"> {feature.name}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-gray-500">
            All plans include 14-day money-back guarantee. No credit card required for trial.{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact us
            </Link>{' '}
            for enterprise solutions.
          </p>
        </div>
      </div>
    </div>
  );
}
