const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { Op, fn, col } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getRedis } = require('../services/redis');

/**
 * GET /api/templates
 * List all available deployment templates
 */
router.get('/',
  authenticate,
  [
    query('provider').optional().isIn(['aws', 'gcp', 'azure', 'all']),
    query('template_type').optional().isIn(['application', 'infrastructure']),
    query('framework').optional().isString(),
    query('search').optional().isString(),
    query('tags').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  async (req, res) => {
    try {
      const { DeploymentTemplate } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        provider,
        template_type,
        framework,
        search,
        tags,
        page = 1,
        limit = 20
      } = req.query;

      // Build cache key
      const cacheKey = `templates:${provider || 'all'}:${template_type || 'all'}:${framework || 'all'}:${search || ''}:${tags || ''}:${page}:${limit}`;

      // Check cache
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.info('Templates: Cache hit', { cacheKey });
          return res.json(JSON.parse(cached));
        }
      }

      // Build query
      const where = {
        is_active: true
      };

      if (provider && provider !== 'all') {
        where.provider = [provider, 'all'];
      }

      if (template_type) {
        where.template_type = template_type;
      }

      if (framework) {
        where.framework = framework;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { short_description: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (tags) {
        const tagArray = tags.split(',').map(t => t.trim());
        where.tags = { [Op.overlap]: tagArray };
      }

      const offset = (page - 1) * limit;

      const { count, rows: templates } = await DeploymentTemplate.findAndCountAll({
        where,
        limit,
        offset,
        order: [
          ['popularity_score', 'DESC'],
          ['name', 'ASC']
        ],
        attributes: {
          exclude: ['userdata_script'] // Don't send full script in list view
        }
      });

      const result = {
        templates,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      };

      // Cache for 5 minutes
      if (redis) {
        await redis.setEx(cacheKey, 300, JSON.stringify(result));
      }

      logger.info('Templates: Listed successfully', {
        count,
        page,
        filters: { provider, template_type, framework }
      });

      res.json(result);

    } catch (error) {
      logger.error('Templates: List failed', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }
);

/**
 * GET /api/templates/:slug
 * Get template details by slug
 */
router.get('/:slug',
  authenticate,
  [
    param('slug').isString().trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const { DeploymentTemplate } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { slug } = req.params;

      // Check cache
      const cacheKey = `template:${slug}`;
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.info('Templates: Cache hit for single template', { slug });
          return res.json(JSON.parse(cached));
        }
      }

      const template = await DeploymentTemplate.findOne({
        where: {
          slug,
          is_active: true
        }
      });

      if (!template) {
        logger.warn('Templates: Template not found', { slug });
        return res.status(404).json({ error: 'Template not found' });
      }

      // Increment popularity score
      await template.increment('popularity_score');

      // Cache for 5 minutes
      if (redis) {
        await redis.setEx(cacheKey, 300, JSON.stringify(template));
      }

      logger.info('Templates: Retrieved successfully', { slug, templateId: template.id });

      res.json(template);

    } catch (error) {
      logger.error('Templates: Fetch failed', {
        error: error.message,
        stack: error.stack,
        slug: req.params.slug
      });
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  }
);

/**
 * GET /api/templates/:slug/userdata
 * Get userdata script for a template
 */
router.get('/:slug/userdata',
  authenticate,
  [
    param('slug').isString().trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const { DeploymentTemplate } = getModels();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { slug } = req.params;

      const template = await DeploymentTemplate.findOne({
        where: {
          slug,
          is_active: true
        },
        attributes: ['id', 'name', 'slug', 'userdata_script']
      });

      if (!template) {
        logger.warn('Templates: Template not found', { slug });
        return res.status(404).json({ error: 'Template not found' });
      }

      if (!template.userdata_script) {
        logger.warn('Templates: No userdata script', { slug });
        return res.status(404).json({ error: 'Template has no userdata script' });
      }

      logger.info('Templates: Userdata retrieved', { slug, templateId: template.id });

      res.json({
        id: template.id,
        name: template.name,
        slug: template.slug,
        userdata: template.userdata_script
      });

    } catch (error) {
      logger.error('Templates: Userdata fetch failed', {
        error: error.message,
        stack: error.stack,
        slug: req.params.slug
      });
      res.status(500).json({ error: 'Failed to fetch userdata' });
    }
  }
);

/**
 * GET /api/templates/frameworks/list
 * Get list of available frameworks
 */
router.get('/frameworks/list',
  authenticate,
  async (req, res) => {
    try {
      const { DeploymentTemplate } = getModels();
      const cacheKey = 'templates:frameworks';

      // Check cache
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      }

      const frameworks = await DeploymentTemplate.findAll({
        where: {
          is_active: true,
          framework: { [Op.not]: null }
        },
        attributes: [[fn('DISTINCT', col('framework')), 'framework']],
        raw: true
      });

      const result = frameworks.map(f => f.framework).filter(Boolean);

      // Cache for 1 hour
      if (redis) {
        await redis.setEx(cacheKey, 3600, JSON.stringify(result));
      }

      res.json(result);

    } catch (error) {
      logger.error('Templates: Framework list failed', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: 'Failed to fetch frameworks' });
    }
  }
);

/**
 * GET /api/templates/tags/list
 * Get list of all tags used in templates
 */
router.get('/tags/list',
  authenticate,
  async (req, res) => {
    try {
      const { DeploymentTemplate } = getModels();
      const cacheKey = 'templates:tags';

      // Check cache
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      }

      const templates = await DeploymentTemplate.findAll({
        where: {
          is_active: true
        },
        attributes: ['tags']
      });

      const allTags = new Set();
      templates.forEach(template => {
        if (template.tags && Array.isArray(template.tags)) {
          template.tags.forEach(tag => allTags.add(tag));
        }
      });

      const result = Array.from(allTags).sort();

      // Cache for 1 hour
      if (redis) {
        await redis.setEx(cacheKey, 3600, JSON.stringify(result));
      }

      res.json(result);

    } catch (error) {
      logger.error('Templates: Tags list failed', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  }
);

module.exports = router;
