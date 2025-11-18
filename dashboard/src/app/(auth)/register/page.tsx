'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Rocket, Mail, User, Building, ArrowRight, CheckCircle, AlertCircle, CreditCard, Calendar, Lock, MapPin } from 'lucide-react';

interface PlanDetails {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}

const PLANS: Record<string, PlanDetails> = {
  starter: {
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 290,
    features: ['3 deployments/month', 'In-app features', 'Community support']
  },
  professional: {
    name: 'Professional',
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: ['Unlimited deployments', 'AWS and GCP access', 'Email support']
  },
  max: {
    name: 'Max',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    features: ['Everything in Professional', 'Priority support', 'Advanced features']
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ['Custom pricing', 'Dedicated support', 'Unlimited everything']
  }
};

export default function RegisterPage() {
  const router = useRouter();
  const [signupType, setSignupType] = useState<'free' | 'trial'>('trial'); // Default to trial
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    plan: 'starter' as keyof typeof PLANS,
    billingCycle: 'monthly' as 'monthly' | 'yearly',
    paymentMethod: {
      cardNumber: '',
      expirationDate: '',
      cvv: '',
      billingZip: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [trialInfo, setTrialInfo] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const requestBody: any = {
        email: formData.email.trim(),
        name: formData.name.trim(),
        company: formData.company.trim() || undefined,
      };

      // Add trial fields if trial signup
      if (signupType === 'trial') {
        // Format expiration date as YYYY-MM
        const expiration = formData.paymentMethod.expirationDate.trim();
        const [month, year] = expiration.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const formattedExpiration = `${fullYear}-${month.padStart(2, '0')}`;

        requestBody.plan = formData.plan;
        requestBody.billingCycle = formData.billingCycle;
        requestBody.paymentMethod = {
          cardNumber: formData.paymentMethod.cardNumber.replace(/\s/g, ''),
          expirationDate: formattedExpiration,
          cvv: formData.paymentMethod.cvv,
          billingZip: formData.paymentMethod.billingZip
        };
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setTrialInfo(data.trial);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name.startsWith('paymentMethod.')) {
      const fieldName = name.split('.')[1];
      setFormData({
        ...formData,
        paymentMethod: {
          ...formData.paymentMethod,
          [fieldName]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ');
  };

  // Format expiration date as MM/YY
  const formatExpiration = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setFormData({
      ...formData,
      paymentMethod: {
        ...formData.paymentMethod,
        cardNumber: formatted
      }
    });
  };

  const handleExpirationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiration(e.target.value);
    setFormData({
      ...formData,
      paymentMethod: {
        ...formData.paymentMethod,
        expirationDate: formatted
      }
    });
  };

  const selectedPlan = PLANS[formData.plan];
  const price = formData.billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
  const priceLabel = formData.billingCycle === 'yearly' ? '/year' : '/month';

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {signupType === 'trial' ? 'Trial Started!' : 'Check your email!'}
              </h2>
              <p className="text-gray-600 mb-6">
                We've sent a verification email to <span className="font-semibold text-gray-900">{formData.email}</span>
              </p>

              {trialInfo && (
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6 text-left">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Your 7-Day Trial:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Plan: <strong>{PLANS[formData.plan].name}</strong></li>
                    <li>• Billing: <strong>{formData.billingCycle}</strong></li>
                    <li>• Trial Ends: <strong>{new Date(trialInfo.trialEndsAt).toLocaleDateString()}</strong></li>
                    <li>• In-app features available now</li>
                    <li>• AWS/GCP access after payment</li>
                  </ul>
                </div>
              )}

              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6 text-left">
                <p className="text-sm text-gray-700">
                  <strong className="text-blue-900">Next steps:</strong>
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-700 mt-2 space-y-1">
                  <li>Check your inbox for our verification email</li>
                  <li>Click the verification link in the email</li>
                  <li>Set your password to complete signup</li>
                  <li>Start deploying to the cloud!</li>
                </ol>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                The verification link will expire in <strong>24 hours</strong>.
              </p>
              <div className="space-y-3">
                <Link
                  href="/"
                  className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back to Home
                </Link>
                <Link
                  href="/login"
                  className="block w-full text-center text-sm text-blue-600 hover:text-blue-700"
                >
                  Already verified? Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <Rocket className="h-10 w-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">Focal Deploy</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">Create your account</h2>
          <p className="mt-2 text-gray-600">
            {signupType === 'trial' ? 'Start your 7-day trial with full access' : 'Start deploying to the cloud in minutes'}
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Signup Type Selector */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSignupType('trial')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  signupType === 'trial'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="font-semibold mb-1">7-Day Trial</div>
                <div className="text-xs">Credit card required</div>
              </button>
              <button
                type="button"
                onClick={() => setSignupType('free')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  signupType === 'free'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="font-semibold mb-1">Free Tier</div>
                <div className="text-xs">No credit card</div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Company Field */}
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                  Company <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                    placeholder="Acme Inc"
                  />
                </div>
              </div>
            </div>

            {/* Trial Plan Selection */}
            {signupType === 'trial' && (
              <>
                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Your Plan</h3>

                  {/* Plan Selection */}
                  <div>
                    <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-2">
                      Plan <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="plan"
                      name="plan"
                      value={formData.plan}
                      onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                    >
                      {Object.entries(PLANS).map(([key, plan]) => (
                        <option key={key} value={key}>
                          {plan.name} - ${formData.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}{formData.billingCycle === 'yearly' ? '/year' : '/month'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Billing Cycle */}
                  <div>
                    <label htmlFor="billingCycle" className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Cycle <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="billingCycle"
                      name="billingCycle"
                      value={formData.billingCycle}
                      onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly (Save 17%)</option>
                    </select>
                  </div>

                  {/* Plan Features */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      {selectedPlan.name} Plan - ${price}{priceLabel}
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {selectedPlan.features.map((feature, index) => (
                        <li key={index}>• {feature}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-blue-800 mt-2 font-medium">
                      7-day trial • $0 today • Cancel anytime
                    </p>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Payment Information</h3>
                  <p className="text-sm text-gray-600">Your card won't be charged during the 7-day trial</p>

                  {/* Card Number */}
                  <div>
                    <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CreditCard className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="cardNumber"
                        name="paymentMethod.cardNumber"
                        required
                        value={formData.paymentMethod.cardNumber}
                        onChange={handleCardNumberChange}
                        maxLength={19}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                        placeholder="4242 4242 4242 4242"
                      />
                    </div>
                  </div>

                  {/* Expiration and CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700 mb-2">
                        Expiration <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Calendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="expirationDate"
                          name="paymentMethod.expirationDate"
                          required
                          value={formData.paymentMethod.expirationDate}
                          onChange={handleExpirationChange}
                          maxLength={5}
                          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                          placeholder="MM/YY"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-2">
                        CVV <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="cvv"
                          name="paymentMethod.cvv"
                          required
                          value={formData.paymentMethod.cvv}
                          onChange={handleChange}
                          maxLength={4}
                          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Billing ZIP */}
                  <div>
                    <label htmlFor="billingZip" className="block text-sm font-medium text-gray-700 mb-2">
                      Billing ZIP Code <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="billingZip"
                        name="paymentMethod.billingZip"
                        required
                        value={formData.paymentMethod.billingZip}
                        onChange={handleChange}
                        maxLength={10}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                        placeholder="90210"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Info Box */}
            {signupType === 'free' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong className="text-blue-900">What happens next?</strong>
                  <br />
                  We'll send you a verification email. Click the link to verify your email and set your password.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {signupType === 'trial' ? 'Starting trial...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {signupType === 'trial' ? 'Start 7-Day Trial' : 'Continue'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </button>

            {/* Terms */}
            <p className="text-xs text-center text-gray-500">
              By signing up, you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
                Privacy Policy
              </Link>
            </p>
          </form>
        </div>

        {/* Sign In Link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
