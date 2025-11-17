/**
 * Migration: Seed initial pricing tiers
 * Populates the pricing_tiers table with default pricing data
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('pricing_tiers', [
      {
        id: 'starter',
        name: 'Starter',
        description: 'Perfect for individuals getting started with automated deployments',
        monthly_price: 39.00,
        yearly_price: null,
        features: JSON.stringify([
          '10 deployments per month',
          '1 concurrent deployment',
          '1 machine license',
          'Up to 3 instances',
          '10GB storage',
          'Community support',
          'DIY deployment automation'
        ]),
        limits: JSON.stringify({
          deploymentsPerMonth: 10,
          concurrent: 1,
          licenses: 1,
          instances: 3,
          storageGB: 10,
          maxS3Buckets: 2,
          maxDomains: 2,
          teamMembers: 1
        }),
        display_order: 1,
        is_active: true,
        api_access: false,
        popular: false,
        contact_sales: false,
        dfy: false,
        super_admin_included: false,
        billing_options: JSON.stringify(['monthly']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'For growing teams who need more power and API access',
        monthly_price: 99.00,
        yearly_price: 990.00,
        features: JSON.stringify([
          '50 deployments per month',
          '5 concurrent deployments',
          '2 machine licenses',
          'Up to 15 instances',
          '50GB storage',
          'Email support',
          'Full API access',
          'Priority deployment queue'
        ]),
        limits: JSON.stringify({
          deploymentsPerMonth: 50,
          concurrent: 5,
          licenses: 2,
          instances: 15,
          storageGB: 50,
          maxS3Buckets: 10,
          maxDomains: 10,
          teamMembers: 5
        }),
        display_order: 2,
        is_active: true,
        api_access: true,
        popular: true,
        contact_sales: false,
        dfy: false,
        super_admin_included: false,
        billing_options: JSON.stringify(['monthly', 'yearly']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'max',
        name: 'Max',
        description: 'Maximum power for teams managing multiple production environments',
        monthly_price: 199.00,
        yearly_price: 1990.00,
        features: JSON.stringify([
          '150 deployments per month',
          '15 concurrent deployments',
          '3 machine licenses',
          'Up to 50 instances',
          '200GB storage',
          'Priority support',
          'Full API access',
          'Advanced analytics',
          'Custom deployment hooks'
        ]),
        limits: JSON.stringify({
          deploymentsPerMonth: 150,
          concurrent: 15,
          licenses: 3,
          instances: 50,
          storageGB: 200,
          maxS3Buckets: 25,
          maxDomains: 25,
          teamMembers: 15
        }),
        display_order: 3,
        is_active: true,
        api_access: true,
        popular: false,
        contact_sales: false,
        dfy: false,
        super_admin_included: false,
        billing_options: JSON.stringify(['monthly', 'yearly']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Custom solutions for enterprise-scale deployment needs',
        monthly_price: null,
        yearly_price: null,
        features: JSON.stringify([
          'Unlimited deployments',
          'Unlimited concurrent',
          'Unlimited licenses',
          'Unlimited instances',
          'Unlimited storage',
          'Dedicated support',
          'Full API access',
          'SLA guarantee',
          'Custom integrations',
          'On-premise option',
          'Training & onboarding'
        ]),
        limits: JSON.stringify({
          deploymentsPerMonth: -1,
          concurrent: -1,
          licenses: -1,
          instances: -1,
          storageGB: -1,
          maxS3Buckets: -1,
          maxDomains: -1,
          teamMembers: -1
        }),
        display_order: 4,
        is_active: true,
        api_access: true,
        popular: false,
        contact_sales: true,
        dfy: false,
        super_admin_included: false,
        billing_options: JSON.stringify(['contact']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'dfy',
        name: 'Done For You',
        description: 'We handle all deployments for you - fully managed white-glove service',
        monthly_price: 299.00,
        yearly_price: 2990.00,
        features: JSON.stringify([
          'Unlimited deployments',
          '10 concurrent deployments',
          '1 machine license for you',
          'Up to 25 instances',
          '100GB storage',
          'White-glove support',
          'Dedicated deployment manager',
          'We deploy for you',
          'Full admin dashboard access',
          'Priority response',
          'Custom configurations'
        ]),
        limits: JSON.stringify({
          deploymentsPerMonth: -1,
          concurrent: 10,
          licenses: 1,
          instances: 25,
          storageGB: 100,
          maxS3Buckets: -1,
          maxDomains: -1,
          teamMembers: 1
        }),
        display_order: 5,
        is_active: true,
        api_access: false,
        popular: false,
        contact_sales: false,
        dfy: true,
        super_admin_included: true,
        billing_options: JSON.stringify(['monthly', 'yearly']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('pricing_tiers', null, {});
  }
};
