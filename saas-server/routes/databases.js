/**
 * Database Management Routes - Manage RDS, Cloud SQL, and other managed databases
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const rdsService = require('../services/rdsService');
const s3Service = require('../services/s3Service');
const { decrypt } = require('../services/encryption');

/**
 * GET /api/databases
 * List all managed databases for the user
 */
router.get('/',
  authenticate,
  [
    query('deployment_id').optional().isUUID(),
    query('status').optional().isIn(['creating', 'available', 'modifying', 'backing-up', 'deleting', 'deleted', 'failed'])
  ],
  async (req, res) => {
    try {
      const { ManagedDatabase, Deployment } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { deployment_id, status } = req.query;

      // Build query
      const where = { user_id: userId };
      if (deployment_id) {
        where.deployment_id = deployment_id;
      }
      if (status) {
        where.status = status;
      }

      const databases = await ManagedDatabase.findAll({
        where,
        include: [
          {
            model: Deployment,
            as: 'deployment',
            attributes: ['id', 'project_name', 'status', 'region']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      logger.info('Databases: Listed successfully', {
        userId,
        count: databases.length,
        filters: { deployment_id, status }
      });

      res.json({
        success: true,
        databases: databases.map(db => ({
          id: db.id,
          deployment_id: db.deployment_id,
          deployment_name: db.deployment?.project_name,
          provider: db.provider,
          service: db.service,
          instance_identifier: db.instance_identifier,
          instance_class: db.instance_class,
          engine: db.engine,
          engine_version: db.engine_version,
          allocated_storage: db.allocated_storage,
          multi_az: db.multi_az,
          status: db.status,
          region: db.region,
          endpoint: db.connection_info?.endpoint,
          port: db.connection_info?.port,
          database_name: db.connection_info?.database_name,
          cost_estimate_monthly: db.cost_estimate_monthly,
          created_at: db.created_at,
          updated_at: db.updated_at
        }))
      });

    } catch (error) {
      logger.error('Databases: List failed', {
        error: error.message,
        stack: error.stack,
        userId: req.user.userId
      });
      res.status(500).json({ error: 'Failed to fetch databases' });
    }
  }
);

/**
 * GET /api/databases/:id
 * Get detailed information about a specific database
 */
router.get('/:id',
  authenticate,
  [
    param('id').isUUID()
  ],
  async (req, res) => {
    try {
      const { ManagedDatabase, Deployment } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { id } = req.params;

      const database = await ManagedDatabase.findOne({
        where: {
          id,
          user_id: userId
        },
        include: [
          {
            model: Deployment,
            as: 'deployment',
            attributes: ['id', 'project_name', 'status', 'region', 'instance_id', 'public_ip']
          }
        ]
      });

      if (!database) {
        logger.warn('Databases: Database not found', { id, userId });
        return res.status(404).json({ error: 'Database not found' });
      }

      logger.info('Databases: Retrieved successfully', { id, userId });

      res.json({
        success: true,
        database: {
          id: database.id,
          deployment_id: database.deployment_id,
          deployment: database.deployment,
          provider: database.provider,
          service: database.service,
          instance_identifier: database.instance_identifier,
          instance_class: database.instance_class,
          engine: database.engine,
          engine_version: database.engine_version,
          allocated_storage: database.allocated_storage,
          max_allocated_storage: database.max_allocated_storage,
          storage_type: database.storage_type,
          multi_az: database.multi_az,
          backup_retention_days: database.backup_retention_days,
          backup_window: database.backup_window,
          maintenance_window: database.maintenance_window,
          publicly_accessible: database.publicly_accessible,
          connection_info: {
            endpoint: database.connection_info?.endpoint,
            port: database.connection_info?.port,
            database_name: database.connection_info?.database_name,
            username: database.connection_info?.username,
            // Never return password in API response
            connection_string: `${database.engine}://${database.connection_info?.username}:****@${database.connection_info?.endpoint}:${database.connection_info?.port}/${database.connection_info?.database_name}`
          },
          security_group_id: database.security_group_id,
          subnet_group: database.subnet_group,
          status: database.status,
          auto_minor_version_upgrade: database.auto_minor_version_upgrade,
          deletion_protection: database.deletion_protection,
          performance_insights_enabled: database.performance_insights_enabled,
          cost_estimate_monthly: database.cost_estimate_monthly,
          region: database.region,
          arn: database.arn,
          tags: database.tags,
          created_at: database.created_at,
          updated_at: database.updated_at
        }
      });

    } catch (error) {
      logger.error('Databases: Fetch failed', {
        error: error.message,
        stack: error.stack,
        databaseId: req.params.id
      });
      res.status(500).json({ error: 'Failed to fetch database details' });
    }
  }
);

/**
 * POST /api/databases
 * Create a new managed database
 */
router.post('/',
  authenticate,
  [
    body('deployment_id').isUUID(),
    body('service').isIn(['rds_mysql', 'rds_postgres', 'rds_mariadb', 'aurora']),
    body('instance_class').optional().isString(),
    body('allocated_storage').optional().isInt({ min: 20, max: 65536 }),
    body('engine_version').optional().isString(),
    body('multi_az').optional().isBoolean(),
    body('backup_retention_days').optional().isInt({ min: 0, max: 35 })
  ],
  async (req, res) => {
    try {
      const { ManagedDatabase, Deployment, EncryptedCredential } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const {
        deployment_id,
        service,
        instance_class = 'db.t3.micro',
        allocated_storage = 20,
        engine_version,
        multi_az = false,
        backup_retention_days = 7
      } = req.body;

      // Verify deployment belongs to user
      const deployment = await Deployment.findOne({
        where: {
          id: deployment_id,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      // Get user's AWS credentials
      const awsCredential = await EncryptedCredential.findOne({
        where: {
          user_id: userId,
          credential_type: 'aws'
        }
      });

      if (!awsCredential) {
        return res.status(400).json({ error: 'AWS credentials not found. Please add AWS credentials first.' });
      }

      // Decrypt credentials
      const decryptedData = decrypt(
        {
          encrypted: awsCredential.encrypted_data,
          iv: awsCredential.iv,
          authTag: awsCredential.auth_tag,
          salt: awsCredential.salt
        },
        userId
      );

      const awsCredentials = JSON.parse(decryptedData);

      logger.info('Databases: Creating RDS instance', {
        userId,
        deploymentId: deployment_id,
        service,
        instanceClass: instance_class
      });

      // Determine engine type
      const engineMap = {
        rds_mysql: 'mysql',
        rds_postgres: 'postgres',
        rds_mariadb: 'mariadb',
        aurora: 'aurora-mysql'
      };
      const engine = engineMap[service] || 'mysql';

      // Create RDS instance
      const rdsResult = await rdsService.createMySQLInstance({
        projectName: deployment.project_name,
        region: deployment.region,
        awsCredentials: {
          accessKeyId: awsCredentials.accessKeyId,
          secretAccessKey: awsCredentials.secretAccessKey
        },
        vpcId: deployment.configuration?.vpcId || 'default',
        instanceClass: instance_class,
        allocatedStorage: allocated_storage,
        engine: engine,
        engineVersion: engine_version || '8.0.35',
        multiAZ: multi_az,
        backupRetentionDays: backup_retention_days,
        dbName: deployment.project_name.toLowerCase().replace(/[^a-z0-9]/g, '')
      });

      // Save to database
      const database = await ManagedDatabase.create({
        deployment_id,
        user_id: userId,
        provider: 'aws',
        service,
        instance_identifier: rdsResult.instanceIdentifier,
        instance_class,
        engine,
        engine_version: rdsResult.engineVersion,
        allocated_storage,
        storage_type: 'gp3',
        multi_az,
        backup_retention_days,
        backup_window: '03:00-04:00',
        maintenance_window: 'mon:04:00-mon:05:00',
        publicly_accessible: false,
        connection_info: {
          endpoint: rdsResult.endpoint,
          port: rdsResult.port,
          database_name: rdsResult.dbName,
          username: rdsResult.masterUsername,
          password: rdsResult.masterPassword,
          connection_string: rdsResult.connectionString
        },
        security_group_id: rdsResult.securityGroupId,
        subnet_group: rdsResult.subnetGroupName,
        status: 'available',
        region: deployment.region,
        cost_estimate_monthly: instance_class === 'db.t3.micro' ? 15.00 :
                                instance_class === 'db.t3.small' ? 30.00 : 60.00
      });

      logger.info('Databases: RDS instance created successfully', {
        userId,
        databaseId: database.id,
        instanceIdentifier: rdsResult.instanceIdentifier
      });

      res.status(201).json({
        success: true,
        database: {
          id: database.id,
          deployment_id: database.deployment_id,
          instance_identifier: database.instance_identifier,
          endpoint: database.connection_info.endpoint,
          port: database.connection_info.port,
          database_name: database.connection_info.database_name,
          username: database.connection_info.username,
          password: database.connection_info.password, // Only returned on creation
          connection_string: database.connection_info.connection_string,
          status: database.status,
          region: database.region
        },
        message: 'RDS instance created successfully'
      });

    } catch (error) {
      logger.error('Databases: Creation failed', {
        error: error.message,
        stack: error.stack,
        userId: req.user.userId
      });
      res.status(500).json({ error: `Failed to create database: ${error.message}` });
    }
  }
);

/**
 * DELETE /api/databases/:id
 * Delete a managed database
 */
router.delete('/:id',
  authenticate,
  [
    param('id').isUUID(),
    query('skip_final_snapshot').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const { ManagedDatabase } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { id } = req.params;
      const skip_final_snapshot = req.query.skip_final_snapshot === 'true';

      // Find database
      const database = await ManagedDatabase.findOne({
        where: {
          id,
          user_id: userId
        }
      });

      if (!database) {
        return res.status(404).json({ error: 'Database not found' });
      }

      if (database.status === 'deleting' || database.status === 'deleted') {
        return res.status(400).json({ error: 'Database is already being deleted or deleted' });
      }

      logger.info('Databases: Deleting RDS instance', {
        userId,
        databaseId: id,
        instanceIdentifier: database.instance_identifier
      });

      // Update status to deleting
      await database.update({ status: 'deleting' });

      // Delete from AWS RDS (async - don't wait)
      // In production, this would be handled by a worker queue
      const { EncryptedCredential } = getModels();
      const awsCredential = await EncryptedCredential.findOne({
        where: {
          user_id: userId,
          credential_type: 'aws'
        }
      });

      if (awsCredential) {
        const decryptedData = decrypt(
          {
            encrypted: awsCredential.encrypted_data,
            iv: awsCredential.iv,
            authTag: awsCredential.auth_tag,
            salt: awsCredential.salt
          },
          userId
        );

        const awsCredentials = JSON.parse(decryptedData);
        const { RDSClient } = require('@aws-sdk/client-rds');

        const rdsClient = new RDSClient({
          region: database.region,
          credentials: {
            accessKeyId: awsCredentials.accessKeyId,
            secretAccessKey: awsCredentials.secretAccessKey
          }
        });

        // Delete instance asynchronously
        rdsService.deleteInstance(rdsClient, database.instance_identifier, skip_final_snapshot)
          .then(() => {
            logger.info('Databases: RDS instance deleted from AWS', { instanceIdentifier: database.instance_identifier });
            database.update({ status: 'deleted', deleted_at: new Date() });
          })
          .catch((error) => {
            logger.error('Databases: Failed to delete RDS instance from AWS', {
              error: error.message,
              instanceIdentifier: database.instance_identifier
            });
            database.update({ status: 'failed', error_message: error.message });
          });
      }

      res.json({
        success: true,
        message: 'Database deletion initiated',
        database_id: id
      });

    } catch (error) {
      logger.error('Databases: Deletion failed', {
        error: error.message,
        stack: error.stack,
        databaseId: req.params.id
      });
      res.status(500).json({ error: 'Failed to delete database' });
    }
  }
);

/**
 * GET /api/databases/:id/connection-string
 * Get database connection string with credentials
 * This is a separate endpoint because it returns sensitive information
 */
router.get('/:id/connection-string',
  authenticate,
  [
    param('id').isUUID()
  ],
  async (req, res) => {
    try {
      const { ManagedDatabase } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { id } = req.params;

      const database = await ManagedDatabase.findOne({
        where: {
          id,
          user_id: userId
        }
      });

      if (!database) {
        return res.status(404).json({ error: 'Database not found' });
      }

      logger.info('Databases: Connection string retrieved', {
        userId,
        databaseId: id
      });

      res.json({
        success: true,
        connection: {
          host: database.connection_info.endpoint,
          port: database.connection_info.port,
          database: database.connection_info.database_name,
          username: database.connection_info.username,
          password: database.connection_info.password,
          connection_string: database.connection_info.connection_string,
          engine: database.engine
        },
        environment_variables: {
          DB_HOST: database.connection_info.endpoint,
          DB_PORT: database.connection_info.port.toString(),
          DB_NAME: database.connection_info.database_name,
          DB_USER: database.connection_info.username,
          DB_PASSWORD: database.connection_info.password,
          DATABASE_URL: database.connection_info.connection_string
        }
      });

    } catch (error) {
      logger.error('Databases: Connection string fetch failed', {
        error: error.message,
        stack: error.stack,
        databaseId: req.params.id
      });
      res.status(500).json({ error: 'Failed to retrieve connection string' });
    }
  }
);

module.exports = router;
