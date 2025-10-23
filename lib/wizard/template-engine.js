const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const { Logger } = require('../utils/logger');

/**
 * Template Engine - Generates project files and configurations
 */
class TemplateEngine {
  constructor() {
    this.logger = Logger;
    this.templatesDir = path.join(__dirname, '../../templates');
  }

  /**
   * Generate project scaffolding
   */
  async generateProject(projectPath, config) {
    console.log(chalk.bold.white('\n🏗️  Generating Project Files'));
    console.log(chalk.gray('━'.repeat(50)));

    try {
      // Ensure project directory exists
      await fs.ensureDir(projectPath);

      // Generate base project structure
      await this.generateBaseStructure(projectPath, config);

      // Generate application-specific files
      await this.generateApplicationFiles(projectPath, config);

      // Generate Docker files if enabled
      if (config.application.useDocker) {
        await this.generateDockerFiles(projectPath, config);
      }

      // Generate CI/CD files if GitHub Actions enabled
      if (config.repository.enabled && config.repository.features.actions) {
        await this.generateCIFiles(projectPath, config);
      }

      // Generate configuration files
      await this.generateConfigFiles(projectPath, config);

      // Generate documentation
      await this.generateDocumentation(projectPath, config);

      console.log(chalk.green('✅ Project files generated successfully'));
      return true;

    } catch (error) {
      this.logger.error('Failed to generate project files:', error);
      throw error;
    }
  }

  /**
   * Generate base project structure
   */
  async generateBaseStructure(projectPath, config) {
    console.log(chalk.cyan('📁 Creating project structure...'));

    const directories = [
      'src',
      'config',
      'scripts',
      'docs',
      '.focal-deploy'
    ];

    // Create additional directories based on app type
    if (config.application.type.includes('nodejs') || config.application.type.includes('express')) {
      directories.push('src/routes', 'src/middleware', 'src/utils', 'src/models');
    }

    if (config.application.type.includes('react') || config.application.type.includes('vue')) {
      directories.push('src/components', 'src/pages', 'src/assets', 'public');
    }

    for (const dir of directories) {
      await fs.ensureDir(path.join(projectPath, dir));
    }

    // Create .gitignore
    await this.generateGitignore(projectPath, config);

    // Create package.json
    await this.generatePackageJson(projectPath, config);
  }

  /**
   * Generate application-specific files
   */
  async generateApplicationFiles(projectPath, config) {
    console.log(chalk.cyan('⚙️  Generating application files...'));

    const appType = config.application.type;

    switch (appType) {
      case 'nodejs-web':
      case 'nodejs-api':
        await this.generateNodeJSFiles(projectPath, config);
        break;
      case 'express-api':
        await this.generateExpressFiles(projectPath, config);
        break;
      case 'react-spa':
        await this.generateReactFiles(projectPath, config);
        break;
      case 'vue-spa':
        await this.generateVueFiles(projectPath, config);
        break;
      case 'nextjs':
        await this.generateNextJSFiles(projectPath, config);
        break;
      case 'static':
        await this.generateStaticFiles(projectPath, config);
        break;
      default:
        await this.generateGenericFiles(projectPath, config);
    }
  }

  /**
   * Generate Node.js application files
   */
  async generateNodeJSFiles(projectPath, config) {
    // Main application file
    const appContent = `const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || ${config.application.port};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('${config.application.healthCheckPath}', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to ${config.projectName}',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(\`🚀 ${config.projectName} is running on port \${PORT}\`);
  console.log(\`📊 Health check: http://localhost:\${PORT}${config.application.healthCheckPath}\`);
});

module.exports = app;
`;

    await fs.writeFile(path.join(projectPath, 'src/app.js'), appContent);

    // Server entry point
    const serverContent = `#!/usr/bin/env node

const app = require('./app');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
`;

    await fs.writeFile(path.join(projectPath, 'src/server.js'), serverContent);
  }

  /**
   * Generate Express.js API files
   */
  async generateExpressFiles(projectPath, config) {
    await this.generateNodeJSFiles(projectPath, config);

    // Add API routes structure
    const routesContent = `const express = require('express');
const router = express.Router();

// API routes
router.get('/', (req, res) => {
  res.json({ 
    message: '${config.projectName} API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health - Health check',
      'GET /api/ - API information'
    ]
  });
});

module.exports = router;
`;

    await fs.writeFile(path.join(projectPath, 'src/routes/api.js'), routesContent);

    // Update main app to use API routes
    const appPath = path.join(projectPath, 'src/app.js');
    let appContent = await fs.readFile(appPath, 'utf8');
    
    // Add API routes
    appContent = appContent.replace(
      '// Routes',
      `// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Routes`
    );

    await fs.writeFile(appPath, appContent);
  }

  /**
   * Generate React SPA files
   */
  async generateReactFiles(projectPath, config) {
    // Basic React structure
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.projectName}</title>
</head>
<body>
    <div id="root"></div>
    <script src="/src/main.jsx" type="module"></script>
</body>
</html>`;

    await fs.writeFile(path.join(projectPath, 'index.html'), indexHtml);

    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;

    await fs.writeFile(path.join(projectPath, 'src/main.jsx'), mainJsx);

    const appJsx = `import React from 'react'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to ${config.projectName}</h1>
        <p>Your React application is ready!</p>
      </header>
    </div>
  )
}

export default App`;

    await fs.writeFile(path.join(projectPath, 'src/App.jsx'), appJsx);

    // Basic CSS
    const appCss = `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  border-radius: 8px;
}

.App-header h1 {
  margin: 0 0 1rem 0;
}`;

    await fs.writeFile(path.join(projectPath, 'src/App.css'), appCss);

    const indexCss = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`;

    await fs.writeFile(path.join(projectPath, 'src/index.css'), indexCss);
  }

  /**
   * Generate static website files
   */
  async generateStaticFiles(projectPath, config) {
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.projectName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Welcome to ${config.projectName}</h1>
    </header>
    <main>
        <p>Your static website is ready!</p>
        <p>Edit this file to customize your content.</p>
    </main>
    <footer>
        <p>&copy; 2024 ${config.projectName}. Deployed with focal-deploy.</p>
    </footer>
</body>
</html>`;

    await fs.writeFile(path.join(projectPath, 'src/index.html'), indexHtml);

    const css = `body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
}

header {
    background-color: #333;
    color: white;
    text-align: center;
    padding: 1rem;
}

main {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 2rem;
}

footer {
    text-align: center;
    padding: 1rem;
    color: #666;
}`;

    await fs.writeFile(path.join(projectPath, 'src/styles.css'), css);
  }

  /**
   * Generate generic application files
   */
  async generateGenericFiles(projectPath, config) {
    const readmeContent = `# ${config.projectName}

A custom application deployed with focal-deploy.

## Getting Started

1. Install dependencies
2. Configure your application
3. Run your application on port ${config.application.port}

## Health Check

Your application should respond to health checks at: \`${config.application.healthCheckPath}\`

## Deployment

This project is configured for deployment with focal-deploy.
`;

    await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
  }

  /**
   * Generate Docker files
   */
  async generateDockerFiles(projectPath, config) {
    console.log(chalk.cyan('🐳 Generating Docker files...'));

    const nodeVersion = config.application.nodeVersion || '20';
    const packageManager = config.application.packageManager || 'npm';

    let dockerfile = '';

    if (config.application.type.includes('nodejs') || config.application.type.includes('express')) {
      dockerfile = `FROM node:${nodeVersion}-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
${packageManager === 'yarn' ? 'COPY yarn.lock ./' : ''}
${packageManager === 'pnpm' ? 'COPY pnpm-lock.yaml ./' : ''}

# Install dependencies
RUN ${packageManager === 'npm' ? 'npm ci --only=production' : packageManager === 'yarn' ? 'yarn install --frozen-lockfile --production' : 'pnpm install --frozen-lockfile --prod'}

# Copy application code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE ${config.application.port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${config.application.port}${config.application.healthCheckPath} || exit 1

# Start application
CMD ["node", "src/server.js"]
`;
    } else if (config.application.type.includes('react') || config.application.type.includes('vue')) {
      dockerfile = `# Build stage
FROM node:${nodeVersion}-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
${packageManager === 'yarn' ? 'COPY yarn.lock ./' : ''}
${packageManager === 'pnpm' ? 'COPY pnpm-lock.yaml ./' : ''}

# Install dependencies
RUN ${packageManager === 'npm' ? 'npm ci' : packageManager === 'yarn' ? 'yarn install --frozen-lockfile' : 'pnpm install --frozen-lockfile'}

# Copy source code
COPY . .

# Build application
RUN ${packageManager} run build

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;

      // Generate nginx.conf for SPA
      const nginxConf = `events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    server {
        listen       80;
        server_name  localhost;
        root   /usr/share/nginx/html;
        index  index.html index.htm;

        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Health check endpoint
        location ${config.application.healthCheckPath} {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }
}
`;

      await fs.writeFile(path.join(projectPath, 'nginx.conf'), nginxConf);

    } else {
      // Generic Dockerfile
      dockerfile = `FROM node:${nodeVersion}-alpine

WORKDIR /app

# Copy application files
COPY . .

# Install dependencies if package.json exists
RUN if [ -f "package.json" ]; then ${packageManager === 'npm' ? 'npm ci --only=production' : packageManager === 'yarn' ? 'yarn install --frozen-lockfile --production' : 'pnpm install --frozen-lockfile --prod'}; fi

# Expose port
EXPOSE ${config.application.port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${config.application.port}${config.application.healthCheckPath} || exit 1

# Start application
CMD ["node", "src/server.js"]
`;
    }

    await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);

    // Generate .dockerignore
    const dockerignore = `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.vscode
.idea
*.log
.DS_Store
`;

    await fs.writeFile(path.join(projectPath, '.dockerignore'), dockerignore);
  }

  /**
   * Generate CI/CD files
   */
  async generateCIFiles(projectPath, config) {
    console.log(chalk.cyan('🔄 Generating CI/CD files...'));

    await fs.ensureDir(path.join(projectPath, '.github/workflows'));

    const workflow = `name: Deploy to AWS

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '${config.application.nodeVersion || '20'}'
        cache: '${config.application.packageManager || 'npm'}'
    
    - name: Install dependencies
      run: ${config.application.packageManager === 'npm' ? 'npm ci' : config.application.packageManager === 'yarn' ? 'yarn install --frozen-lockfile' : 'pnpm install --frozen-lockfile'}
    
    - name: Run tests
      run: ${config.application.packageManager || 'npm'} test
      
    - name: Build application
      run: ${config.application.packageManager || 'npm'} run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '${config.application.nodeVersion || '20'}'
        cache: '${config.application.packageManager || 'npm'}'
    
    - name: Install focal-deploy
      run: npm install -g focal-deploy
    
    - name: Deploy to AWS
      run: focal-deploy up
      env:
        AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
        AWS_REGION: \${{ secrets.AWS_REGION }}
`;

    await fs.writeFile(path.join(projectPath, '.github/workflows/deploy.yml'), workflow);
  }

  /**
   * Generate configuration files
   */
  async generateConfigFiles(projectPath, config) {
    console.log(chalk.cyan('⚙️  Generating configuration files...'));

    // Generate focal-deploy configuration
    const focalConfig = {
      project: {
        name: config.projectName,
        type: config.application.type,
        port: parseInt(config.application.port),
        healthCheck: config.application.healthCheckPath
      },
      aws: {
        region: 'us-east-1', // Will be updated during deployment
        instanceType: 't3.micro'
      },
      domains: config.domains.enabled ? {
        primary: config.domains.primaryDomain,
        subdomains: config.domains.subdomains,
        ssl: config.domains.ssl
      } : null,
      repository: config.repository.enabled ? {
        url: config.repository.url,
        branch: 'main'
      } : null,
      environment: config.environment.environment,
      monitoring: config.environment.enableMonitoring,
      backups: config.environment.enableBackups,
      docker: config.application.useDocker
    };

    await fs.writeFile(
      path.join(projectPath, '.focal-deploy/config.json'),
      JSON.stringify(focalConfig, null, 2)
    );

    // Generate environment file template
    let envContent = `# ${config.projectName} Environment Variables
NODE_ENV=${config.environment.environment}
PORT=${config.application.port}
LOG_LEVEL=${config.environment.logLevel}

# Add your environment variables here
`;

    // Add configured environment variables
    if (config.environment.variables) {
      envContent += '\n# Application Variables\n';
      Object.entries(config.environment.variables).forEach(([key, { value, secret }]) => {
        if (secret) {
          envContent += `${key}=your_${key.toLowerCase()}_here\n`;
        } else {
          envContent += `${key}=${value}\n`;
        }
      });
    }

    await fs.writeFile(path.join(projectPath, '.env.example'), envContent);
  }

  /**
   * Generate package.json
   */
  async generatePackageJson(projectPath, config) {
    const packageJson = {
      name: config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '1.0.0',
      description: config.repository.description || `${config.projectName} - Deployed with focal-deploy`,
      main: 'src/server.js',
      scripts: {},
      keywords: ['focal-deploy', config.application.type],
      author: '',
      license: 'MIT',
      dependencies: {},
      devDependencies: {}
    };

    // Add scripts based on application type
    if (config.application.type.includes('nodejs') || config.application.type.includes('express')) {
      packageJson.scripts = {
        start: 'node src/server.js',
        dev: 'nodemon src/server.js',
        test: 'jest',
        'test:watch': 'jest --watch',
        lint: 'eslint src/',
        'lint:fix': 'eslint src/ --fix'
      };

      packageJson.dependencies = {
        express: '^4.18.2',
        cors: '^2.8.5'
      };

      packageJson.devDependencies = {
        nodemon: '^3.0.1',
        jest: '^29.7.0',
        eslint: '^8.50.0'
      };

    } else if (config.application.type.includes('react')) {
      packageJson.scripts = {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        test: 'vitest',
        lint: 'eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0'
      };

      packageJson.dependencies = {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      };

      packageJson.devDependencies = {
        '@types/react': '^18.2.15',
        '@types/react-dom': '^18.2.7',
        '@vitejs/plugin-react': '^4.0.3',
        eslint: '^8.45.0',
        'eslint-plugin-react': '^7.32.2',
        'eslint-plugin-react-hooks': '^4.6.0',
        'eslint-plugin-react-refresh': '^0.4.3',
        vite: '^4.4.5',
        vitest: '^0.34.0'
      };

    } else if (config.application.type === 'static') {
      packageJson.scripts = {
        start: 'serve src',
        dev: 'serve src',
        build: 'echo "Static site - no build needed"',
        test: 'echo "No tests specified"'
      };

      packageJson.devDependencies = {
        serve: '^14.2.1'
      };
    }

    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  /**
   * Generate .gitignore
   */
  async generateGitignore(projectPath, config) {
    const gitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
.next/
out/

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# focal-deploy
.focal-deploy/state/
.focal-deploy/keys/private_*
.focal-deploy/logs/
`;

    await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);
  }

  /**
   * Generate documentation
   */
  async generateDocumentation(projectPath, config) {
    console.log(chalk.cyan('📚 Generating documentation...'));

    const readme = `# ${config.projectName}

${config.repository.description || `A ${config.application.type} application deployed with focal-deploy.`}

## 🚀 Quick Start

### Prerequisites

- Node.js ${config.application.nodeVersion || '20'}+ 
- ${config.application.packageManager || 'npm'}
${config.application.useDocker ? '- Docker (optional)' : ''}

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone ${config.repository.url || 'your-repo-url'}
   cd ${config.projectName}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   ${config.application.packageManager || 'npm'} install
   \`\`\`

3. Copy environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Start the development server:
   \`\`\`bash
   ${config.application.packageManager || 'npm'} run dev
   \`\`\`

The application will be available at \`http://localhost:${config.application.port}\`

## 📋 Available Scripts

${Object.entries(JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8')).scripts || {})
  .map(([script, command]) => `- \`${config.application.packageManager || 'npm'} run ${script}\` - ${command}`)
  .join('\n')}

## 🏗️ Project Structure

\`\`\`
${config.projectName}/
├── src/                 # Source code
${config.application.type.includes('nodejs') ? '├── src/routes/          # API routes' : ''}
${config.application.type.includes('react') || config.application.type.includes('vue') ? '├── src/components/      # React/Vue components' : ''}
├── config/              # Configuration files
├── scripts/             # Build and deployment scripts
├── .focal-deploy/       # focal-deploy configuration
${config.application.useDocker ? '├── Dockerfile          # Docker configuration' : ''}
${config.repository.enabled && config.repository.features.actions ? '├── .github/workflows/   # GitHub Actions' : ''}
└── docs/                # Documentation
\`\`\`

## 🔧 Configuration

### Environment Variables

Copy \`.env.example\` to \`.env\` and configure:

${Object.entries(config.environment.variables || {})
  .map(([key, { secret }]) => `- \`${key}\` - ${secret ? '(Secret)' : 'Configuration value'}`)
  .join('\n') || '- No environment variables configured'}

### focal-deploy Configuration

The project is configured for deployment with focal-deploy. See \`.focal-deploy/config.json\` for deployment settings.

## 🚀 Deployment

This project is configured for automatic deployment with focal-deploy:

1. **Manual Deployment:**
   \`\`\`bash
   focal-deploy up
   \`\`\`

2. **Automatic Deployment:**
   ${config.repository.enabled && config.repository.features.actions 
     ? 'Push to the main branch to trigger automatic deployment via GitHub Actions.'
     : 'Configure CI/CD pipeline for automatic deployment.'}

### Deployment Features

- ✅ AWS EC2 deployment
- ✅ Automatic SSL certificates${config.domains.enabled ? ` for ${config.domains.primaryDomain}` : ''}
- ✅ Health checks at \`${config.application.healthCheckPath}\`
- ✅ Emergency access mechanisms (SSM Session Manager)
${config.environment.enableMonitoring ? '- ✅ Application monitoring' : ''}
${config.environment.enableBackups ? '- ✅ Automatic backups' : ''}
${config.application.useDocker ? '- ✅ Docker containerization' : ''}

## 🔒 Security

This project includes several security features:

- Emergency SSH access via AWS SSM Session Manager
- Automatic security group management
- SSL/TLS encryption${config.domains.enabled ? ` for ${config.domains.primaryDomain}` : ''}
- Health check monitoring

## 📊 Monitoring

${config.environment.enableMonitoring 
  ? 'Application monitoring is enabled. Check your AWS CloudWatch dashboard for metrics and logs.'
  : 'Enable monitoring in `.focal-deploy/config.json` to track application performance.'}

## 🆘 Emergency Access

If you're locked out of your server, use these emergency access methods:

1. **AWS SSM Session Manager:**
   \`\`\`bash
   focal-deploy emergency-access
   \`\`\`

2. **Emergency Recovery:**
   \`\`\`bash
   focal-deploy emergency-recovery
   \`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: \`${config.application.packageManager || 'npm'} test\`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- [focal-deploy Documentation](https://github.com/your-org/focal-deploy)
- [Issue Tracker](${config.repository.url}/issues)

---

*Deployed with ❤️ using [focal-deploy](https://github.com/your-org/focal-deploy)*
`;

    await fs.writeFile(path.join(projectPath, 'README.md'), readme);

    // Generate deployment guide
    const deploymentGuide = `# Deployment Guide

## Overview

This guide covers deploying ${config.projectName} using focal-deploy.

## Prerequisites

- AWS Account with appropriate permissions
- focal-deploy CLI installed
- Domain name configured (if using custom domains)

## Deployment Steps

### 1. Initial Setup

\`\`\`bash
# Navigate to project directory
cd ${config.projectName}

# Verify configuration
focal-deploy validate

# Deploy infrastructure
focal-deploy up
\`\`\`

### 2. Domain Configuration

${config.domains.enabled ? `
Your domains are configured:
- Primary: ${config.domains.primaryDomain}
${config.domains.subdomains.length > 0 ? `- Subdomains: ${config.domains.subdomains.join(', ')}` : ''}

SSL certificates will be automatically provisioned.
` : 'No domains configured. The application will be accessible via the EC2 public IP.'}

### 3. Security Setup

\`\`\`bash
# Configure security groups and emergency access
focal-deploy security-setup
\`\`\`

### 4. Verification

\`\`\`bash
# Check deployment status
focal-deploy status

# View application logs
focal-deploy logs
\`\`\`

## Post-Deployment

### Health Checks

Your application health check is available at:
- \`${config.application.healthCheckPath}\`

### Monitoring

${config.environment.enableMonitoring 
  ? 'Monitoring is enabled. Check AWS CloudWatch for metrics.'
  : 'Enable monitoring in your configuration for detailed metrics.'}

### Backups

${config.environment.enableBackups
  ? 'Automatic backups are enabled.'
  : 'Enable backups in your configuration for data protection.'}

## Troubleshooting

### Common Issues

1. **Deployment Fails**
   - Check AWS credentials
   - Verify region settings
   - Review error logs

2. **Application Not Accessible**
   - Check security groups
   - Verify health check endpoint
   - Review application logs

3. **SSL Certificate Issues**
   - Verify domain DNS settings
   - Check certificate status
   - Review Let's Encrypt logs

### Emergency Access

If locked out of your server:

\`\`\`bash
# Use SSM Session Manager
focal-deploy emergency-access

# Or use emergency recovery
focal-deploy emergency-recovery
\`\`\`

## Updating Your Application

\`\`\`bash
# Pull latest changes
git pull origin main

# Redeploy
focal-deploy up
\`\`\`

## Scaling

To scale your application:

1. Update instance type in \`.focal-deploy/config.json\`
2. Run \`focal-deploy up\` to apply changes
3. Monitor performance and adjust as needed

## Cleanup

To remove all AWS resources:

\`\`\`bash
focal-deploy down
\`\`\`

**Warning:** This will permanently delete all resources and data.
`;

    await fs.writeFile(path.join(projectPath, 'docs/DEPLOYMENT.md'), deploymentGuide);
  }
}

module.exports = TemplateEngine;