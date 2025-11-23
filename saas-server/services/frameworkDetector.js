/**
 * Framework Detection Service
 * Auto-detects application framework from source code
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class FrameworkDetector {
  /**
   * Detect framework from a local directory
   * @param {string} projectPath - Absolute path to project directory
   * @returns {Promise<Object>} Framework configuration
   */
  async detectFromDirectory(projectPath) {
    try {
      logger.info('FrameworkDetector: Scanning project', { projectPath });

      // Check for package.json (Node.js ecosystem)
      const hasPackageJson = await this.fileExists(path.join(projectPath, 'package.json'));
      if (hasPackageJson) {
        const framework = await this.detectNodeFramework(projectPath);
        if (framework) return framework;
      }

      // Check for WordPress
      const hasWpConfig = await this.fileExists(path.join(projectPath, 'wp-config.php'));
      const hasWpContent = await this.dirExists(path.join(projectPath, 'wp-content'));
      if (hasWpConfig || hasWpContent) {
        return this.getWordPressConfig();
      }

      // Check for Laravel
      const hasArtisan = await this.fileExists(path.join(projectPath, 'artisan'));
      const hasComposer = await this.fileExists(path.join(projectPath, 'composer.json'));
      if (hasArtisan && hasComposer) {
        return this.getLaravelConfig();
      }

      // Check for Django
      const hasManagePy = await this.fileExists(path.join(projectPath, 'manage.py'));
      const hasRequirements = await this.fileExists(path.join(projectPath, 'requirements.txt'));
      if (hasManagePy && hasRequirements) {
        return this.getDjangoConfig();
      }

      // Check for Ruby on Rails
      const hasGemfile = await this.fileExists(path.join(projectPath, 'Gemfile'));
      const hasRailsConfig = await this.dirExists(path.join(projectPath, 'config'));
      if (hasGemfile && hasRailsConfig) {
        return this.getRailsConfig();
      }

      // Check for static HTML
      const hasIndexHtml = await this.fileExists(path.join(projectPath, 'index.html'));
      if (hasIndexHtml) {
        return this.getStaticConfig();
      }

      // Default: Unknown
      logger.warn('FrameworkDetector: Could not detect framework', { projectPath });
      return this.getUnknownConfig();

    } catch (error) {
      logger.error('FrameworkDetector: Error detecting framework', { projectPath, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Detect Node.js framework from package.json
   */
  async detectNodeFramework(projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Next.js
      if (deps.next || await this.fileExists(path.join(projectPath, 'next.config.js'))) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'Next.js' });
        return this.getNextJSConfig(packageJson);
      }

      // Nuxt.js
      if (deps.nuxt || await this.fileExists(path.join(projectPath, 'nuxt.config.js'))) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'Nuxt.js' });
        return this.getNuxtConfig(packageJson);
      }

      // Gatsby
      if (deps.gatsby) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'Gatsby' });
        return this.getGatsbyConfig(packageJson);
      }

      // React (Create React App)
      if (deps['react-scripts']) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'React (CRA)' });
        return this.getReactCRAConfig(packageJson);
      }

      // Vue.js
      if (deps.vue && deps['@vue/cli-service']) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'Vue.js CLI' });
        return this.getVueConfig(packageJson);
      }

      // Angular
      if (deps['@angular/core']) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'Angular' });
        return this.getAngularConfig(packageJson);
      }

      // Express.js
      if (deps.express) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'Express.js' });
        return this.getExpressConfig(packageJson);
      }

      // Nest.js
      if (deps['@nestjs/core']) {
        logger.info('FrameworkDetector: Framework detected', { framework: 'NestJS' });
        return this.getNestJSConfig(packageJson);
      }

      // Generic Node.js
      logger.info('FrameworkDetector: Framework detected', { framework: 'Node.js (generic)' });
      return this.getNodeJSConfig(packageJson);

    } catch (error) {
      logger.error('FrameworkDetector: Error reading package.json', { error: error.message, stack: error.stack });
      return null;
    }
  }

  // ==========================================
  // Framework Configurations
  // ==========================================

  getNextJSConfig(packageJson) {
    return {
      framework: 'nextjs',
      displayName: 'Next.js',
      buildCommand: 'npm install && npm run build',
      startCommand: packageJson?.scripts?.start || 'npm start',
      port: 3000,
      webServer: null, // Uses its own server
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getNuxtConfig(packageJson) {
    return {
      framework: 'nuxt',
      displayName: 'Nuxt.js',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getGatsbyConfig(packageJson) {
    return {
      framework: 'gatsby',
      displayName: 'Gatsby',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npx gatsby serve -p 3000 -H 0.0.0.0',
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getReactCRAConfig(packageJson) {
    return {
      framework: 'react-cra',
      displayName: 'React (Create React App)',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npx serve -s build -l 3000',
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getVueConfig(packageJson) {
    return {
      framework: 'vue',
      displayName: 'Vue.js',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npx serve -s dist -l 3000',
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getAngularConfig(packageJson) {
    return {
      framework: 'angular',
      displayName: 'Angular',
      buildCommand: 'npm install && npm run build --prod',
      startCommand: 'npx serve -s dist -l 3000',
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getExpressConfig(packageJson) {
    const startScript = packageJson?.scripts?.start || 'node index.js';
    return {
      framework: 'express',
      displayName: 'Express.js',
      buildCommand: 'npm install',
      startCommand: startScript,
      port: process.env.PORT || 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production',
        PORT: '3000'
      }
    };
  }

  getNestJSConfig(packageJson) {
    return {
      framework: 'nestjs',
      displayName: 'NestJS',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm run start:prod',
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getNodeJSConfig(packageJson) {
    const startScript = packageJson?.scripts?.start || 'node index.js';
    return {
      framework: 'nodejs',
      displayName: 'Node.js',
      buildCommand: 'npm install',
      startCommand: startScript,
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {
        NODE_ENV: 'production'
      }
    };
  }

  getWordPressConfig() {
    return {
      framework: 'wordpress',
      displayName: 'WordPress',
      buildCommand: null,
      startCommand: null,
      port: 80,
      webServer: 'apache',
      requiresDatabase: true,
      envVars: {
        DB_NAME: 'wordpress',
        DB_USER: 'wp_user',
        DB_PASSWORD: '', // Generated during deployment
        DB_HOST: 'localhost'
      }
    };
  }

  getLaravelConfig() {
    return {
      framework: 'laravel',
      displayName: 'Laravel',
      buildCommand: 'composer install --no-dev --optimize-autoloader && php artisan config:cache && php artisan route:cache',
      startCommand: 'php artisan serve --host=0.0.0.0 --port=8000',
      port: 8000,
      webServer: 'nginx',
      requiresDatabase: true,
      envVars: {
        APP_ENV: 'production',
        APP_DEBUG: 'false',
        DB_CONNECTION: 'mysql',
        DB_DATABASE: 'laravel'
      }
    };
  }

  getDjangoConfig() {
    return {
      framework: 'django',
      displayName: 'Django',
      buildCommand: 'pip3 install -r requirements.txt && python3 manage.py collectstatic --noinput',
      startCommand: 'gunicorn --bind 0.0.0.0:8000 app.wsgi:application',
      port: 8000,
      webServer: 'nginx',
      requiresDatabase: true,
      envVars: {
        DJANGO_SETTINGS_MODULE: 'app.settings',
        DEBUG: 'False'
      }
    };
  }

  getRailsConfig() {
    return {
      framework: 'rails',
      displayName: 'Ruby on Rails',
      buildCommand: 'bundle install --deployment --without development test && bundle exec rails assets:precompile',
      startCommand: 'bundle exec rails server -b 0.0.0.0 -p 3000',
      port: 3000,
      webServer: 'nginx',
      requiresDatabase: true,
      envVars: {
        RAILS_ENV: 'production',
        RACK_ENV: 'production'
      }
    };
  }

  getStaticConfig() {
    return {
      framework: 'static',
      displayName: 'Static HTML',
      buildCommand: null,
      startCommand: null,
      port: 80,
      webServer: 'nginx',
      requiresDatabase: false,
      envVars: {}
    };
  }

  getUnknownConfig() {
    return {
      framework: 'unknown',
      displayName: 'Unknown',
      buildCommand: null,
      startCommand: null,
      port: 3000,
      webServer: null,
      requiresDatabase: false,
      envVars: {}
    };
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async dirExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}

module.exports = new FrameworkDetector();
