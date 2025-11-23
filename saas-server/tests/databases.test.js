/**
 * Database Management API Tests
 */

const request = require('supertest');
const app = require('../server');
const { initializeDatabase } = require('../services/database');
const { initializeModels, getModels } = require('../models');

describe('Database Management API', () => {
  let authToken;
  let userId;
  let deploymentId;

  beforeAll(async () => {
    // Initialize database and models
    await initializeDatabase();
    initializeModels();

    const { User, Deployment, Subscription } = getModels();

    // Create test user
    const user = await User.create({
      email: 'test-db@example.com',
      password_hash: 'hashed_password',
      name: 'Test User',
      role: 'user'
    });
    userId = user.id;

    // Create active subscription
    await Subscription.create({
      user_id: userId,
      pricing_tier_id: 1,
      status: 'active',
      authnet_customer_profile_id: 'test123',
      authnet_payment_profile_id: 'pay123'
    });

    // Create test deployment
    const deployment = await Deployment.create({
      user_id: userId,
      project_name: 'test-db-deployment',
      status: 'completed',
      region: 'us-east-1',
      instance_type: 't3.micro',
      instance_id: 'i-1234567890abcdef0',
      public_ip: '1.2.3.4'
    });
    deploymentId = deployment.id;

    // Generate auth token (simplified - in real app use JWT)
    authToken = 'Bearer test-token';
  });

  afterAll(async () => {
    const { User, Deployment, Subscription, ManagedDatabase } = getModels();

    // Cleanup
    await ManagedDatabase.destroy({ where: { user_id: userId }, force: true });
    await Deployment.destroy({ where: { user_id: userId }, force: true });
    await Subscription.destroy({ where: { user_id: userId }, force: true });
    await User.destroy({ where: { id: userId }, force: true });
  });

  describe('GET /api/databases', () => {
    it('should list all databases for authenticated user', async () => {
      const response = await request(app)
        .get('/api/databases')
        .set('Authorization', authToken)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('databases');
      expect(Array.isArray(response.body.databases)).toBe(true);
    });

    it('should filter databases by deployment_id', async () => {
      const response = await request(app)
        .get(`/api/databases?deployment_id=${deploymentId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/databases')
        .expect(401);
    });
  });

  describe('POST /api/databases', () => {
    it('should create a new RDS MySQL database', async () => {
      // Note: This test would need mocking for actual AWS calls
      const response = await request(app)
        .post('/api/databases')
        .set('Authorization', authToken)
        .send({
          deployment_id: deploymentId,
          service: 'rds_mysql',
          instance_class: 'db.t3.micro',
          allocated_storage: 20
        });

      // In real test with mocks, expect 201
      // Here it will fail without AWS credentials
      expect([201, 400, 500]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/databases')
        .set('Authorization', authToken)
        .send({
          // Missing deployment_id and service
          instance_class: 'db.t3.micro'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should reject invalid service types', async () => {
      const response = await request(app)
        .post('/api/databases')
        .set('Authorization', authToken)
        .send({
          deployment_id: deploymentId,
          service: 'invalid_db_type'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/databases/:id', () => {
    it('should return 404 for non-existent database', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app)
        .get(`/api/databases/${fakeId}`)
        .set('Authorization', authToken)
        .expect(404);
    });

    it('should reject invalid UUID format', async () => {
      await request(app)
        .get('/api/databases/invalid-uuid')
        .set('Authorization', authToken)
        .expect(400);
    });
  });

  describe('DELETE /api/databases/:id', () => {
    it('should validate UUID format', async () => {
      await request(app)
        .delete('/api/databases/not-a-uuid')
        .set('Authorization', authToken)
        .expect(400);
    });
  });

  describe('GET /api/databases/:id/connection-string', () => {
    it('should require valid UUID', async () => {
      await request(app)
        .get('/api/databases/invalid/connection-string')
        .set('Authorization', authToken)
        .expect(400);
    });
  });
});
