'use client';

import { useState } from 'react';
import { passwordSecurityAPI } from '@/lib/api';
import {
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Copy,
  RefreshCw,
  Lock,
  AlertCircle,
} from 'lucide-react';

interface PasswordCheckResult {
  breached: boolean;
  breachCount: number;
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  score: number;
  strength: {
    score: number;
    level: string;
    feedback: string[];
  };
  recommendations: string[];
}

interface GenerateResult {
  password: string;
  strength: {
    score: number;
    level: string;
    feedback: string[];
  };
}

export default function PasswordSecurityPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PasswordCheckResult | null>(null);
  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCheckPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setChecking(true);
    setResult(null);
    setMessage(null);

    try {
      const response = await passwordSecurityAPI.check(password);
      setResult(response.data);

      if (response.data.breached) {
        setMessage({
          type: 'error',
          text: `Warning: This password has been found in ${response.data.breachCount.toLocaleString()} data breaches!`,
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Good news! This password has not been found in any known data breaches.',
        });
      }
    } catch (err: any) {
      console.error('Error checking password:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to check password security',
      });
    } finally {
      setChecking(false);
    }
  };

  const handleGeneratePassword = async () => {
    setGenerating(true);
    setGenerated(null);
    setMessage(null);

    try {
      const response = await passwordSecurityAPI.generate({
        length: 16,
        includeSymbols: true,
        includeNumbers: true,
        includeUppercase: true,
        includeLowercase: true,
      });

      setGenerated(response.data);
      setMessage({
        type: 'success',
        text: 'Secure password generated successfully!',
      });
    } catch (err: any) {
      console.error('Error generating password:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to generate password',
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({
      type: 'success',
      text: 'Password copied to clipboard!',
    });
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <XCircle className="w-6 h-6" />;
      case 'medium':
        return <AlertTriangle className="w-6 h-6" />;
      case 'low':
        return <Info className="w-6 h-6" />;
      default:
        return <CheckCircle className="w-6 h-6" />;
    }
  };

  const getStrengthColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'very strong':
      case 'strong':
        return 'bg-green-500';
      case 'moderate':
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-red-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          Password Security
        </h1>
        <p className="mt-2 text-gray-600">
          Check if your passwords have been compromised in data breaches and generate secure passwords
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">How it works (k-anonymity):</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your password is hashed locally using SHA-1</li>
              <li>Only the first 5 characters of the hash are sent to the API</li>
              <li>Your actual password never leaves your device</li>
              <li>The service returns all hashes matching those 5 characters</li>
              <li>We check locally if your full hash is in the results</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Password Checker */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-6 h-6 text-blue-600" />
            Check Password Security
          </h2>

          <form onSubmit={handleCheckPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Password to Check
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={checking || !password}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {checking ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Check Password
                </>
              )}
            </button>
          </form>

          {/* Check Result */}
          {result && (
            <div className="mt-6 space-y-4">
              {/* Breach Status */}
              <div
                className={`p-4 rounded-lg border ${getSeverityColor(result.severity)} flex items-start gap-3`}
              >
                {getSeverityIcon(result.severity)}
                <div className="flex-1">
                  <h3 className="font-bold mb-1">
                    {result.breached ? 'Password Compromised!' : 'Password Safe'}
                  </h3>
                  <p className="text-sm">
                    {result.breached
                      ? `This password has appeared in ${result.breachCount.toLocaleString()} data breaches.`
                      : 'This password has not been found in any known data breaches.'}
                  </p>
                </div>
              </div>

              {/* Security Score */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Security Score</span>
                  <span className="text-2xl font-bold text-gray-900">{result.score}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      result.score >= 80
                        ? 'bg-green-500'
                        : result.score >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>

              {/* Strength Analysis */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Password Strength</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      result.strength.level === 'Very Strong' || result.strength.level === 'Strong'
                        ? 'bg-green-100 text-green-800'
                        : result.strength.level === 'Moderate'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {result.strength.level}
                  </span>
                </div>
                {result.strength.feedback.length > 0 && (
                  <ul className="mt-2 text-sm text-gray-600 space-y-1">
                    {result.strength.feedback.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-bold text-yellow-900 mb-2">Recommendations</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Generator */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-green-600" />
            Generate Secure Password
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            Generate a cryptographically secure random password with customizable options.
          </p>

          <button
            onClick={handleGeneratePassword}
            disabled={generating}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Generate Password
              </>
            )}
          </button>

          {/* Generated Password */}
          {generated && (
            <div className="mt-6 space-y-4">
              {/* Password Display */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <label className="block text-sm font-medium text-green-900 mb-2">
                  Generated Password
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-white border border-green-300 rounded-lg font-mono text-lg break-all">
                    {generated.password}
                  </code>
                  <button
                    onClick={() => copyToClipboard(generated.password)}
                    className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Strength Analysis */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-900">Password Strength</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      generated.strength.level === 'Very Strong' ||
                      generated.strength.level === 'Strong'
                        ? 'bg-green-100 text-green-800'
                        : generated.strength.level === 'Moderate'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {generated.strength.level}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Score</span>
                    <span className="font-medium">{generated.strength.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getStrengthColor(
                        generated.strength.level
                      )}`}
                      style={{ width: `${generated.strength.score}%` }}
                    />
                  </div>
                </div>

                {generated.strength.feedback.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-900 mb-1">Details:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {generated.strength.feedback.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Best Practices */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Best Practices
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    Use a different password for each account
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    Store passwords in a secure password manager
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    Enable two-factor authentication (2FA) when available
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    Change passwords regularly, especially if compromised
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
