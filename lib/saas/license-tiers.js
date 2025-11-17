/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focuswithfocal.com
 * For support: support@focuswithfocal.com
 *
 * @author DNS Publishing, LLC
 * @copyright 2025 DNS Publishing, LLC
 * @license Proprietary
 */

/**
 * License Tier Definitions for Focal Deploy SaaS
 *
 * Defines the four tiers: Starter, Pro, Max, and Enterprise
 * with their respective features, limits, and pricing
 */

const LICENSE_TIERS = {
  STARTER: {
    id: 'starter',
    name: 'Starter',
    displayName: 'Focal Deploy Starter',
    description: 'Perfect for individual developers and small projects',

    pricing: {
      monthly: 29,
      annual: 290, // ~$24/month (2 months free)
      currency: 'USD',
      billingCycle: 'monthly'
    },

    limits: {
      deployments: {
        perMonth: 3,
        concurrent: 1,
        description: 'Up to 3 deployments per month'
      },
      instances: {
        max: 2,
        description: 'Maximum 2 EC2 instances'
      },
      teamMembers: 1,
      apiRateLimit: {
        requestsPerMinute: 30,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      },
      storage: {
        s3Buckets: 2,
        backupRetention: 7, // days
        description: 'Up to 2 S3 buckets, 7-day backup retention'
      },
      domains: {
        max: 2,
        sslCertificates: 2,
        description: 'Up to 2 custom domains with SSL'
      }
    },

    features: {
      core: [
        'AWS deployment automation',
        'Basic security hardening',
        'SSL certificate automation',
        'Docker deployment support',
        'Basic monitoring'
      ],
      support: [
        'Community Discord support',
        'Documentation access',
        'Email support (best effort, no SLA)'
      ],
      integrations: [
        'GitHub integration',
        'DigitalOcean DNS',
        'Cloudflare DNS',
        'Route53 DNS'
      ],
      disabled: [
        'Priority support',
        'Advanced security features',
        'Team collaboration',
        'Custom integrations',
        'White-label capabilities',
        'SLA guarantees'
      ]
    },

    restrictions: {
      commercialUse: false, // Cannot resell as service
      apiAccess: 'limited',
      customBranding: false,
      onPremise: false
    }
  },

  PROFESSIONAL: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Focal Deploy Pro',
    description: 'For professional developers and growing teams',

    pricing: {
      monthly: 99,
      annual: 990, // ~$82.50/month (2 months free)
      currency: 'USD',
      billingCycle: 'monthly'
    },

    limits: {
      deployments: {
        perMonth: -1, // Unlimited
        concurrent: 5,
        description: 'Unlimited deployments'
      },
      instances: {
        max: 10,
        description: 'Maximum 10 EC2 instances'
      },
      teamMembers: 5,
      apiRateLimit: {
        requestsPerMinute: 120,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      },
      storage: {
        s3Buckets: 10,
        backupRetention: 30, // days
        description: 'Up to 10 S3 buckets, 30-day backup retention'
      },
      domains: {
        max: 10,
        sslCertificates: 10,
        wildcardSupport: true,
        description: 'Up to 10 domains with SSL and wildcard support'
      }
    },

    features: {
      core: [
        'Everything in Starter',
        'Advanced security hardening',
        'Custom SSH ports and hardening',
        'Fail2ban integration',
        'Advanced monitoring and alerts',
        'Automatic backups and recovery',
        'Multi-environment support (staging/prod)'
      ],
      support: [
        'Email support with 48-hour SLA',
        'Priority documentation updates',
        'Feature request priority voting',
        'Quarterly strategy calls'
      ],
      integrations: [
        'All Starter integrations',
        'Slack notifications',
        'PagerDuty alerts',
        'Datadog monitoring',
        'Custom webhooks'
      ],
      advanced: [
        'Team collaboration features',
        'Role-based access control (RBAC)',
        'Audit logs and compliance reports',
        'Advanced analytics dashboard',
        'Deployment rollback capabilities'
      ],
      disabled: [
        'White-label capabilities',
        'On-premises deployment',
        'Custom SLA agreements',
        'Dedicated account manager'
      ]
    },

    restrictions: {
      commercialUse: true, // Can use for client projects
      apiAccess: 'full',
      customBranding: false,
      onPremise: false
    }
  },

  MAX: {
    id: 'max',
    name: 'Max',
    displayName: 'Focal Deploy Max',
    description: 'Maximum power for agencies and advanced teams',

    pricing: {
      monthly: 299,
      annual: 2990, // ~$249/month (2 months free)
      currency: 'USD',
      billingCycle: 'monthly'
    },

    limits: {
      deployments: {
        perMonth: -1, // Unlimited
        concurrent: 20,
        description: 'Unlimited deployments'
      },
      instances: {
        max: 50,
        description: 'Maximum 50 EC2 instances'
      },
      teamMembers: 25,
      apiRateLimit: {
        requestsPerMinute: 300,
        requestsPerHour: 15000,
        requestsPerDay: 200000
      },
      storage: {
        s3Buckets: 50,
        backupRetention: 90, // days
        description: 'Up to 50 S3 buckets, 90-day backup retention'
      },
      domains: {
        max: 50,
        sslCertificates: 50,
        wildcardSupport: true,
        description: 'Up to 50 domains with SSL and wildcard support'
      }
    },

    features: {
      core: [
        'Everything in Pro',
        'Multi-region deployments',
        'Load balancing and auto-scaling',
        'Advanced cost optimization',
        'Custom infrastructure templates',
        'Blue-green deployments',
        'Canary releases'
      ],
      support: [
        'Email support with 24-hour SLA',
        'Priority phone support',
        'Dedicated success manager',
        'Monthly strategy calls',
        'Custom training sessions'
      ],
      integrations: [
        'All Pro integrations',
        'Jenkins/CircleCI/Travis CI',
        'GitLab integration',
        'Bitbucket integration',
        'Custom API integrations',
        'Advanced webhooks'
      ],
      advanced: [
        'Advanced team management',
        'Department-level organization',
        'Advanced RBAC with custom roles',
        'Comprehensive audit logs',
        'Advanced compliance reports',
        'Multi-project support',
        'Client portal access'
      ],
      disabled: [
        'White-label capabilities',
        'On-premises deployment',
        'Enterprise SSO',
        'Dedicated infrastructure'
      ]
    },

    restrictions: {
      commercialUse: true,
      resellAsService: false,
      apiAccess: 'full',
      customBranding: false,
      onPremise: false
    }
  },

  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Focal Deploy Enterprise',
    description: 'For large teams and organizations with custom requirements',

    pricing: {
      monthly: null, // Custom pricing
      annual: null,
      currency: 'USD',
      billingCycle: 'custom',
      contactSales: true
    },

    limits: {
      deployments: {
        perMonth: -1, // Unlimited
        concurrent: -1, // Unlimited
        description: 'Unlimited deployments'
      },
      instances: {
        max: -1, // Unlimited
        description: 'Unlimited EC2 instances'
      },
      teamMembers: -1, // Unlimited
      apiRateLimit: {
        requestsPerMinute: -1, // Custom/Unlimited
        requestsPerHour: -1,
        requestsPerDay: -1,
        custom: true
      },
      storage: {
        s3Buckets: -1,
        backupRetention: -1, // Custom
        description: 'Unlimited S3 buckets with custom backup retention'
      },
      domains: {
        max: -1,
        sslCertificates: -1,
        wildcardSupport: true,
        description: 'Unlimited domains with SSL'
      }
    },

    features: {
      core: [
        'Everything in Max',
        'Custom infrastructure templates',
        'Multi-cloud support (AWS, Azure, GCP)',
        'Advanced cost optimization',
        'Compliance and governance tools',
        'Custom security policies'
      ],
      support: [
        'Priority support with 4-hour SLA',
        'Dedicated account manager',
        'Phone support',
        'Dedicated Slack channel',
        'Custom training sessions',
        'On-boarding assistance'
      ],
      integrations: [
        'All Max integrations',
        'Custom API integrations',
        'Enterprise SSO (SAML, OAuth)',
        'LDAP/Active Directory',
        'Custom CI/CD pipelines',
        'Terraform/CloudFormation export'
      ],
      enterprise: [
        'White-label capabilities',
        'Custom branding and domain',
        'On-premises deployment option',
        'Air-gapped environment support',
        'Custom SLA agreements',
        'Dedicated infrastructure',
        'Advanced compliance (HIPAA, SOC 2, etc.)',
        'Custom feature development',
        'Priority bug fixes'
      ]
    },

    restrictions: {
      commercialUse: true,
      resellAsService: true, // Can white-label and resell
      apiAccess: 'unlimited',
      customBranding: true,
      onPremise: true
    }
  }
};

/**
 * Feature flags for each tier
 */
const FEATURE_FLAGS = {
  // Core deployment features
  basicDeployment: ['starter', 'pro', 'max', 'enterprise'],
  advancedDeployment: ['pro', 'max', 'enterprise'],
  multiRegionDeployment: ['max', 'enterprise'],
  multiCloudSupport: ['enterprise'],

  // Security features
  basicSecurity: ['starter', 'pro', 'max', 'enterprise'],
  advancedSecurity: ['pro', 'max', 'enterprise'],
  customSecurityPolicies: ['enterprise'],

  // Team features
  singleUser: ['starter'],
  teamCollaboration: ['pro', 'max', 'enterprise'],
  advancedTeamManagement: ['max', 'enterprise'],
  unlimitedTeam: ['enterprise'],
  rbac: ['pro', 'max', 'enterprise'],
  sso: ['enterprise'],

  // Monitoring and analytics
  basicMonitoring: ['starter', 'pro', 'max', 'enterprise'],
  advancedAnalytics: ['pro', 'max', 'enterprise'],
  customDashboards: ['enterprise'],

  // Support
  communitySupport: ['starter'],
  emailSupport: ['pro', 'max', 'enterprise'],
  prioritySupport: ['max', 'enterprise'],
  dedicatedSupport: ['enterprise'],

  // Branding and customization
  whiteLab: ['enterprise'],
  customBranding: ['enterprise'],
  onPremise: ['enterprise']
};

/**
 * Usage limit definitions
 */
const USAGE_LIMITS = {
  starter: {
    deploymentsPerMonth: 3,
    concurrentDeployments: 1,
    maxInstances: 2,
    apiCallsPerDay: 10000
  },
  pro: {
    deploymentsPerMonth: -1, // unlimited
    concurrentDeployments: 5,
    maxInstances: 10,
    apiCallsPerDay: 50000
  },
  max: {
    deploymentsPerMonth: -1,
    concurrentDeployments: 20,
    maxInstances: 50,
    apiCallsPerDay: 200000
  },
  enterprise: {
    deploymentsPerMonth: -1,
    concurrentDeployments: -1,
    maxInstances: -1,
    apiCallsPerDay: -1
  }
};

/**
 * Get license tier by ID
 */
function getLicenseTier(tierId) {
  const tier = LICENSE_TIERS[tierId.toUpperCase()];
  if (!tier) {
    throw new Error(`Invalid license tier: ${tierId}`);
  }
  return tier;
}

/**
 * Check if a feature is available for a tier
 */
function hasFeature(tierId, featureName) {
  const allowedTiers = FEATURE_FLAGS[featureName];
  if (!allowedTiers) {
    return false;
  }
  return allowedTiers.includes(tierId.toLowerCase());
}

/**
 * Get usage limits for a tier
 */
function getUsageLimits(tierId) {
  return USAGE_LIMITS[tierId.toLowerCase()] || USAGE_LIMITS.starter;
}

/**
 * Check if usage is within limits
 */
function isWithinLimits(tierId, usageType, currentUsage) {
  const limits = getUsageLimits(tierId);
  const limit = limits[usageType];

  // -1 means unlimited
  if (limit === -1) {
    return true;
  }

  return currentUsage < limit;
}

/**
 * Get pricing for a tier
 */
function getPricing(tierId, billingCycle = 'monthly') {
  const tier = getLicenseTier(tierId);
  return tier.pricing[billingCycle];
}

/**
 * Compare tiers
 */
function compareTiers(tier1, tier2) {
  const tierOrder = ['starter', 'pro', 'max', 'enterprise'];
  const index1 = tierOrder.indexOf(tier1.toLowerCase());
  const index2 = tierOrder.indexOf(tier2.toLowerCase());
  return index1 - index2;
}

/**
 * Check if upgrade is available
 */
function canUpgrade(currentTier, targetTier) {
  return compareTiers(currentTier, targetTier) < 0;
}

module.exports = {
  LICENSE_TIERS,
  FEATURE_FLAGS,
  USAGE_LIMITS,
  getLicenseTier,
  hasFeature,
  getUsageLimits,
  isWithinLimits,
  getPricing,
  compareTiers,
  canUpgrade
};
