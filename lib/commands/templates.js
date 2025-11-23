const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const inquirer = require('inquirer');
const { Logger } = require('../utils/logger');
const { ErrorHandler } = require('../utils/errors');

const API_URL = process.env.FOCAL_API_URL || 'https://api.focuswithfocal.io';

/**
 * Get authentication token from environment or config
 */
function getAuthToken() {
  // Check environment variable first
  if (process.env.FOCAL_AUTH_TOKEN) {
    return process.env.FOCAL_AUTH_TOKEN;
  }

  // TODO: Check local config file for stored token
  // For now, return null and show helpful message
  return null;
}

/**
 * List all available deployment templates
 */
async function listTemplates(options = {}) {
  try {
    const token = getAuthToken();

    if (!token) {
      Logger.error('Authentication required. Please set FOCAL_AUTH_TOKEN environment variable.');
      Logger.info('Get your token from: https://app.focuswithfocal.io/dashboard/settings');
      process.exit(1);
    }

    const params = {
      provider: options.provider || 'all',
      limit: options.limit || 50,
    };

    if (options.category) {
      params.template_type = options.category;
    }

    if (options.framework) {
      params.framework = options.framework;
    }

    if (options.search) {
      params.search = options.search;
    }

    Logger.info(`📦 Fetching templates from ${API_URL}...`);

    const response = await axios.get(`${API_URL}/api/templates`, {
      params,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const { templates, pagination } = response.data;

    if (!templates || templates.length === 0) {
      Logger.warn('No templates found matching your criteria.');
      return;
    }

    console.log('\n' + chalk.bold.cyan(`📦 Available Deployment Templates (${pagination.total} total)`));
    console.log(chalk.gray(`Showing ${templates.length} templates`));
    console.log('');

    // Create table
    const table = new Table({
      head: [
        chalk.white.bold('Name'),
        chalk.white.bold('Slug'),
        chalk.white.bold('Category'),
        chalk.white.bold('Provider'),
        chalk.white.bold('Setup Time'),
        chalk.white.bold('Features')
      ],
      colWidths: [25, 25, 15, 10, 12, 30],
      wordWrap: true,
    });

    templates.forEach(template => {
      const features = template.features.slice(0, 2).join(', ');
      const moreFeatures = template.features.length > 2 ? ` +${template.features.length - 2}` : '';

      table.push([
        chalk.cyan(template.name),
        template.slug,
        template.category,
        template.provider === 'all' ? 'All' : template.provider.toUpperCase(),
        `~${template.estimated_setup_time_minutes}min`,
        features + moreFeatures,
      ]);
    });

    console.log(table.toString());
    console.log('');

    // Show helpful next steps
    Logger.info(chalk.bold('\n💡 Next steps:'));
    Logger.info(`  • View template details: ${chalk.cyan('focal-deploy templates info <slug>')}`);
    Logger.info(`  • Create deployment: ${chalk.cyan('focal-deploy new --template <slug>')}`);

    if (pagination.totalPages > 1) {
      Logger.info(`\n📄 Page ${pagination.page} of ${pagination.totalPages}`);
      Logger.info(`Use --page <number> to see more templates`);
    }

  } catch (error) {
    if (error.response?.status === 401) {
      Logger.error('Authentication failed. Please check your FOCAL_AUTH_TOKEN.');
      Logger.info('Get your token from: https://app.focuswithfocal.io/dashboard/settings');
    } else if (error.response?.status === 404) {
      Logger.error('API endpoint not found. Please check API_URL configuration.');
    } else {
      ErrorHandler.handle(error);
    }
    process.exit(1);
  }
}

/**
 * Show detailed information about a specific template
 */
async function templateInfo(slug, options = {}) {
  try {
    if (!slug) {
      Logger.error('Template slug is required.');
      Logger.info('Usage: focal-deploy templates info <slug>');
      Logger.info('Example: focal-deploy templates info wordpress-lamp');
      process.exit(1);
    }

    const token = getAuthToken();

    if (!token) {
      Logger.error('Authentication required. Please set FOCAL_AUTH_TOKEN environment variable.');
      Logger.info('Get your token from: https://app.focuswithfocal.io/dashboard/settings');
      process.exit(1);
    }

    Logger.info(`📦 Fetching template details for: ${chalk.cyan(slug)}...`);

    const response = await axios.get(`${API_URL}/api/templates/${slug}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const template = response.data;

    console.log('\n' + chalk.bold.cyan(`📦 ${template.name}`));
    console.log(chalk.gray('─'.repeat(60)));

    console.log('\n' + chalk.bold('Description:'));
    console.log(template.description);

    console.log('\n' + chalk.bold('Details:'));
    const detailsTable = new Table({
      colWidths: [20, 40],
    });

    detailsTable.push(
      ['Slug', template.slug],
      ['Category', template.category],
      ['Provider', template.provider === 'all' ? 'All Cloud Providers' : template.provider.toUpperCase()],
      ['Template Type', template.template_type],
      ['Setup Time', `~${template.estimated_setup_time_minutes} minutes`],
      ['Popularity', `${template.popularity_score}/100`]
    );

    if (template.framework) {
      detailsTable.push(['Framework', template.framework]);
    }

    console.log(detailsTable.toString());

    // Configuration
    console.log('\n' + chalk.bold('Default Configuration:'));
    const configTable = new Table({
      colWidths: [30, 30],
    });

    if (template.configuration.default_instance_type) {
      configTable.push(['Instance Type', template.configuration.default_instance_type]);
    }
    if (template.configuration.default_storage) {
      configTable.push(['Storage', `${template.configuration.default_storage} GB`]);
    }
    if (template.configuration.required_memory_gb) {
      configTable.push(['Memory Required', `${template.configuration.required_memory_gb} GB`]);
    }
    if (template.configuration.supports_rds) {
      configTable.push(['RDS Support', '✓ Auto-provision database']);
    }
    if (template.configuration.supports_s3) {
      configTable.push(['S3 Support', '✓ Auto-create bucket']);
    }

    console.log(configTable.toString());

    // Features
    if (template.features && template.features.length > 0) {
      console.log('\n' + chalk.bold('Features:'));
      template.features.forEach(feature => {
        console.log(`  ${chalk.green('✓')} ${feature}`);
      });
    }

    // Tags
    if (template.tags && template.tags.length > 0) {
      console.log('\n' + chalk.bold('Tags:'));
      console.log(`  ${template.tags.map(tag => chalk.blue(`#${tag}`)).join('  ')}`);
    }

    // Pricing estimate
    if (template.pricing_estimate) {
      console.log('\n' + chalk.bold('Estimated Monthly Cost:'));
      const pricingTable = new Table({
        head: ['Instance Type', 'Monthly Cost'],
        colWidths: [20, 20],
      });

      if (template.pricing_estimate.aws_t3_micro) {
        pricingTable.push(['t3.micro', `$${template.pricing_estimate.aws_t3_micro}`]);
      }
      if (template.pricing_estimate.aws_t3_small) {
        pricingTable.push(['t3.small', `$${template.pricing_estimate.aws_t3_small}`]);
      }
      if (template.pricing_estimate.aws_t3_medium) {
        pricingTable.push(['t3.medium', `$${template.pricing_estimate.aws_t3_medium}`]);
      }

      console.log(pricingTable.toString());
      console.log(chalk.gray('  * AWS costs only. Does not include domain, SSL, or additional services.'));
    }

    // Next steps
    console.log('\n' + chalk.bold('💡 Next steps:'));
    console.log(`  • Create deployment: ${chalk.cyan(`focal-deploy new --template ${template.slug}`)}`);
    console.log(`  • View all templates: ${chalk.cyan('focal-deploy templates list')}`);
    console.log('');

  } catch (error) {
    if (error.response?.status === 401) {
      Logger.error('Authentication failed. Please check your FOCAL_AUTH_TOKEN.');
      Logger.info('Get your token from: https://app.focuswithfocal.io/dashboard/settings');
    } else if (error.response?.status === 404) {
      Logger.error(`Template "${slug}" not found.`);
      Logger.info('Run "focal-deploy templates list" to see available templates.');
    } else {
      ErrorHandler.handle(error);
    }
    process.exit(1);
  }
}

/**
 * Interactive template selector
 * Returns the selected template object
 */
async function selectTemplateInteractive(provider = 'aws') {
  try {
    const token = getAuthToken();

    if (!token) {
      Logger.warn('Authentication not configured. Skipping template selection.');
      Logger.info('Set FOCAL_AUTH_TOKEN to use templates from the gallery.');
      return null;
    }

    Logger.info('📦 Loading templates...');

    const response = await axios.get(`${API_URL}/api/templates`, {
      params: {
        provider,
        limit: 50,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const { templates } = response.data;

    if (!templates || templates.length === 0) {
      Logger.warn('No templates available.');
      return null;
    }

    // Group templates by category
    const categories = {};
    templates.forEach(template => {
      if (!categories[template.category]) {
        categories[template.category] = [];
      }
      categories[template.category].push(template);
    });

    // Create choices for inquirer
    const choices = [];
    Object.keys(categories).forEach(category => {
      choices.push(new inquirer.Separator(`\n${chalk.bold.cyan(category.toUpperCase())} templates:`));
      categories[category].forEach(template => {
        choices.push({
          name: `${template.name} - ${template.short_description}`,
          value: template,
          short: template.name,
        });
      });
    });

    choices.push(new inquirer.Separator('\n'));
    choices.push({
      name: chalk.gray('Skip template selection (configure manually)'),
      value: null,
      short: 'Manual setup',
    });

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Select a deployment template:',
        choices,
        pageSize: 15,
      },
    ]);

    if (answers.template) {
      console.log('');
      Logger.success(`✓ Selected template: ${chalk.cyan(answers.template.name)}`);
      Logger.info(answers.template.description);
      console.log('');
    }

    return answers.template;

  } catch (error) {
    Logger.warn('Failed to load templates. Continuing with manual setup.');
    if (error.response?.status === 401) {
      Logger.info('Tip: Set FOCAL_AUTH_TOKEN to access the template gallery.');
    }
    return null;
  }
}

module.exports = {
  listTemplates,
  templateInfo,
  selectTemplateInteractive,
};
