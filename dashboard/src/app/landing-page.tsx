'use client';

import Link from 'next/link';
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
} from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuthStore();

  const features = [
    {
      icon: <Rocket className="w-6 h-6" />,
      title: 'Instant Deployment',
      description:
        'Deploy your applications to AWS with a single command. No complex configuration required.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Secure by Default',
      description:
        'Built-in SSL certificates, automated security groups, and best practices baked in.',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Lightning Fast',
      description:
        'Optimized deployment pipeline gets your app live in minutes, not hours.',
    },
    {
      icon: <Activity className="w-6 h-6" />,
      title: 'Real-time Monitoring',
      description:
        'Track your deployments, monitor performance, and get instant alerts.',
    },
    {
      icon: <Code className="w-6 h-6" />,
      title: 'Developer Friendly',
      description:
        'Simple CLI interface and API. Integrate with your existing workflow seamlessly.',
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: 'Multi-Cloud Ready',
      description:
        'Start with AWS today, expand to Google Cloud tomorrow. One interface for everything.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Sign Up & Connect AWS',
      description: '7-day free trial. Add your AWS credentials securely in our dashboard.',
      code: null,
    },
    {
      number: '02',
      title: 'Deploy Your App',
      description: 'Use our web dashboard to deploy - no CLI needed. Just point and click.',
      code: null,
    },
    {
      number: '03',
      title: 'Monitor & Manage',
      description: 'Track deployments, SSH into servers, and manage everything from your browser.',
      code: null,
    },
  ];

  return (
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
              <Link href="https://docs.focuswithfocal.io" className="text-gray-700 hover:text-blue-600 transition-colors">
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
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight">
              Deploy to the Cloud
              <span className="block text-blue-600 mt-2">in Seconds</span>
            </h1>
            <p className="mt-6 text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Focal Deploy is the fastest way to deploy your applications to AWS and Google Cloud.
              No DevOps expertise required.
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
              Free 14-day trial • No credit card required • Cancel anytime
            </p>
          </div>

          {/* Hero Image/Demo */}
          <div className="mt-16">
            <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-gray-400 text-sm">Terminal</span>
              </div>
              <div className="font-mono text-sm text-green-400 space-y-2">
                <div>$ focal-deploy deploy</div>
                <div className="text-gray-500">
                  → Building application...
                </div>
                <div className="text-gray-500">
                  → Provisioning AWS resources...
                </div>
                <div className="text-gray-500">
                  → Configuring SSL certificate...
                </div>
                <div className="text-blue-400">
                  ✓ Deployed successfully!
                </div>
                <div className="text-gray-400">
                  🚀 https://your-app.focuswithfocal.io
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">99.9%</div>
              <div className="text-gray-600">Uptime SLA</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">&lt;5min</div>
              <div className="text-gray-600">Average Deploy Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">256-bit</div>
              <div className="text-gray-600">Data Encryption</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-extrabold text-white">
            Ready to deploy faster?
          </h2>
          <p className="mt-4 text-xl text-blue-100">
            Join thousands of developers who trust Focal Deploy for their cloud infrastructure
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
            No credit card required • 14-day free trial • Cancel anytime
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
                The fastest way to deploy your applications to the cloud.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="https://docs.focuswithfocal.io" className="hover:text-white transition-colors">Documentation</Link></li>
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
                <li><Link href="https://twitter.com/focaldeploy" className="hover:text-white transition-colors">Twitter</Link></li>
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
  );
}
