const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { Logger } = require('./logger');

class TemplateEngine {
  constructor() {
    this.logger = Logger;
  }

  async generateAllTemplates(targetPath, context) {
    try {
      this.logger.info(`📝 Generating template files for ${chalk.cyan(context.projectName)}...`);

      // Generate all template files
      await this.generatePackageJson(targetPath, context);
      await this.generateDockerfile(targetPath, context);
      await this.generateReadme(targetPath, context);
      await this.generateDeployConfig(targetPath, context);
      await this.generateGitignore(targetPath, context);
      await this.generateEnvExample(targetPath, context);
      await this.generateAppJs(targetPath, context);
      await this.generateRoutes(targetPath, context);
      await this.generatePublicFiles(targetPath, context);
      await this.generateTestFiles(targetPath, context);
      await this.generateDeployScripts(targetPath, context);
      await this.generateGithubWorkflow(targetPath, context);

      this.logger.success(`✅ All template files generated successfully`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to generate templates: ${error.message}`);
      throw error;
    }
  }

  async generatePackageJson(targetPath, context) {
    const packageJson = {
      name: context.projectName,
      version: "1.0.0",
      description: `${context.projectName} - Node.js application with focal-deploy`,
      main: "src/app.js",
      scripts: {
        start: "node src/app.js",
        dev: "node src/app.js",
        test: "jest",
        "test:watch": "jest --watch"
      },
      keywords: [
        "nodejs",
        "express",
        "focal-deploy",
        "aws"
      ],
      author: "",
      license: "MIT",
      dependencies: {
        express: "^4.18.0",
        cors: "^2.8.5",
        helmet: "^7.0.0",
        morgan: "^1.10.0",
        dotenv: "^16.0.0"
      },
      devDependencies: {
        jest: "^29.0.0",
        supertest: "^6.3.0",
        nodemon: "^3.0.0"
      },
      engines: {
        node: ">=18.0.0"
      }
    };

    if (context.gitRepository) {
      packageJson.repository = {
        type: "git",
        url: `git+${context.githubUrl}.git`
      };
      packageJson.bugs = {
        url: `${context.githubUrl}/issues`
      };
      packageJson.homepage = `${context.githubUrl}#readme`;
    }

    await fs.writeJson(path.join(targetPath, 'package.json'), packageJson, { spaces: 2 });
  }

  async generateDockerfile(targetPath, context) {
    const dockerfile = `# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]`;

    await fs.writeFile(path.join(targetPath, 'Dockerfile'), dockerfile);
  }

  async generateReadme(targetPath, context) {
    const readme = `# ${context.projectName}

${context.projectName} - Node.js application deployed with focal-deploy

## Quick Start

### Development
\`\`\`bash
npm install
npm run dev
\`\`\`

### Deployment with focal-deploy

1. **Deploy to AWS:**
   \`\`\`bash
   focal-deploy up
   \`\`\`

2. **Check status:**
   \`\`\`bash
   focal-deploy status
   \`\`\`

3. **Deploy updates:**
   \`\`\`bash
   focal-deploy deploy
   \`\`\`

${context.githubUrl ? `### Git Workflow

This project is configured with Git integration:

1. **Make changes to your code**
2. **Commit and push:**
   \`\`\`bash
   git add .
   git commit -m "Your changes"
   git push
   \`\`\`

3. **Deploy to EC2:**
   \`\`\`bash
   focal-deploy deploy
   \`\`\`

**Repository:** [${context.githubUrl}](${context.githubUrl})

` : ''}## Project Structure

\`\`\`
${context.projectName}/
├── src/
│   ├── app.js              # Main application
│   ├── routes/             # API routes
│   └── public/             # Static files
├── tests/                  # Test files
├── deploy/                 # Deployment scripts
├── ${context.projectName}-deploy.yml  # focal-deploy configuration
├── Dockerfile              # Container configuration
└── package.json            # Dependencies
\`\`\`

## Configuration

### Environment Variables

Copy \`.env.example\` to \`.env\` and configure:

\`\`\`bash
cp .env.example .env
\`\`\`

### focal-deploy Configuration

The deployment configuration is in \`${context.projectName}-deploy.yml\`. Customize as needed:

- AWS region and instance type
- Domain configuration
- SSL settings
- Environment variables

## Available Scripts

- \`npm start\` - Start production server
- \`npm run dev\` - Start development server
- \`npm test\` - Run tests
- \`npm run test:watch\` - Run tests in watch mode

## Deployment Commands

- \`focal-deploy validate\` - Validate configuration
- \`focal-deploy up\` - Deploy infrastructure
- \`focal-deploy status\` - Check deployment status
- \`focal-deploy deploy\` - Deploy application updates
- \`focal-deploy down\` - Destroy infrastructure

## Support

For issues and questions:
- focal-deploy documentation
- GitHub Issues${context.githubUrl ? `: ${context.githubUrl}/issues` : ''}

---

Generated by focal-deploy on ${new Date(context.timestamp).toLocaleDateString()}`;

    await fs.writeFile(path.join(targetPath, 'README.md'), readme);
  }

  async generateDeployConfig(targetPath, context) {
    const config = `# focal-deploy configuration for ${context.projectName}
project:
  name: ${context.projectName}
  description: "${context.projectName} - Node.js application"

aws:
  region: us-east-1
  instance_type: t3.micro
  key_pair_name: ${context.projectName}-key

application:
  port: 3000
  health_check_path: /health
  environment:
    NODE_ENV: production
    PORT: 3000

${context.gitRepository ? `git:
  repository: ${context.githubUrl}
  branch: main
  deploy_key: ~/.ssh/${context.projectName}_deploy_key

` : ''}domain:
  # Uncomment and configure your domain
  # name: example.com
  # ssl: true

monitoring:
  enabled: true
  health_checks: true
  log_retention_days: 7

security:
  allowed_ips:
    - 0.0.0.0/0  # Allow all IPs (configure as needed)
  
backup:
  enabled: false
  # Configure backup settings as needed`;

    await fs.writeFile(path.join(targetPath, `${context.projectName}-deploy.yml`), config);
  }

  async generateGitignore(targetPath, context) {
    const gitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

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

# Grunt intermediate storage
.grunt

# Bower dependency directory
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test
.env.production
.env.local

# parcel-bundler cache
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
public

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# focal-deploy specific
.focal-deploy-state.json
*.pem
*.key

# AWS credentials (never commit these)
.aws/
aws-credentials.json

# SSH keys
*.pub
*_rsa
*_ed25519
*_deploy_key*

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db`;

    await fs.writeFile(path.join(targetPath, '.gitignore'), gitignore);
  }

  async generateEnvExample(targetPath, context) {
    const envExample = `# Environment Configuration for ${context.projectName}

# Application
NODE_ENV=production
PORT=3000

# Database (if needed)
# DATABASE_URL=postgresql://user:password@localhost:5432/database

# API Keys (if needed)
# API_KEY=your-api-key-here

# External Services (if needed)
# REDIS_URL=redis://localhost:6379
# MONGODB_URI=mongodb://localhost:27017/database

# Logging
LOG_LEVEL=info

# Security
# JWT_SECRET=your-jwt-secret-here
# SESSION_SECRET=your-session-secret-here

# AWS (if using AWS services directly)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key

# focal-deploy will automatically set these:
# - PORT (application port)
# - NODE_ENV (environment)
# - Any variables defined in ${context.projectName}-deploy.yml`;

    await fs.writeFile(path.join(targetPath, '.env.example'), envExample);
  }

  async generateAppJs(targetPath, context) {
    const appJs = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', require('./routes'));

// Health check endpoint (required for focal-deploy)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ${context.projectName}!',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 ${context.projectName} server running on port \${PORT}\`);
  console.log(\`📍 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🏥 Health check: http://localhost:\${PORT}/health\`);
});

module.exports = app;`;

    await fs.writeFile(path.join(targetPath, 'src', 'app.js'), appJs);
  }

  async generateRoutes(targetPath, context) {
    const routesIndex = `const express = require('express');
const router = express.Router();

// Example API route
router.get('/', (req, res) => {
  res.json({
    message: '${context.projectName} API',
    version: '1.0.0',
    endpoints: [
      'GET /api - This endpoint',
      'GET /api/status - API status',
      'GET /health - Health check'
    ]
  });
});

// Status endpoint
router.get('/status', (req, res) => {
  res.json({
    api: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Example data endpoint
router.get('/data', (req, res) => {
  res.json({
    message: 'Sample data from ${context.projectName}',
    data: [
      { id: 1, name: 'Item 1', created: new Date().toISOString() },
      { id: 2, name: 'Item 2', created: new Date().toISOString() }
    ]
  });
});

module.exports = router;`;

    await fs.writeFile(path.join(targetPath, 'src', 'routes', 'index.js'), routesIndex);
  }

  async generatePublicFiles(targetPath, context) {
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${context.projectName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 ${context.projectName}</h1>
            <p>Node.js application deployed with focal-deploy</p>
        </header>
        
        <main>
            <section class="status">
                <h2>Application Status</h2>
                <div id="status-info">
                    <p>Loading...</p>
                </div>
            </section>
            
            <section class="api">
                <h2>API Endpoints</h2>
                <ul>
                    <li><a href="/api" target="_blank">GET /api</a> - API information</li>
                    <li><a href="/api/status" target="_blank">GET /api/status</a> - API status</li>
                    <li><a href="/api/data" target="_blank">GET /api/data</a> - Sample data</li>
                    <li><a href="/health" target="_blank">GET /health</a> - Health check</li>
                </ul>
            </section>
            
            ${context.githubUrl ? `<section class="git">
                <h2>Git Repository</h2>
                <p>
                    <a href="${context.githubUrl}" target="_blank" rel="noopener">
                        View on GitHub →
                    </a>
                </p>
            </section>` : ''}
        </main>
        
        <footer>
            <p>Generated by focal-deploy • <span id="timestamp"></span></p>
        </footer>
    </div>
    
    <script>
        // Update timestamp
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
        
        // Fetch and display status
        fetch('/api/status')
            .then(response => response.json())
            .then(data => {
                document.getElementById('status-info').innerHTML = \`
                    <p><strong>API:</strong> \${data.api}</p>
                    <p><strong>Uptime:</strong> \${Math.floor(data.uptime)} seconds</p>
                    <p><strong>Version:</strong> \${data.version}</p>
                    <p><strong>Last Updated:</strong> \${new Date(data.timestamp).toLocaleString()}</p>
                \`;
            })
            .catch(error => {
                document.getElementById('status-info').innerHTML = '<p>Error loading status</p>';
                console.error('Status fetch error:', error);
            });
    </script>
</body>
</html>`;

    const css = `/* ${context.projectName} Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    background: white;
    margin-top: 2rem;
    margin-bottom: 2rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

header {
    text-align: center;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 2px solid #f0f0f0;
}

header h1 {
    font-size: 2.5rem;
    color: #2c3e50;
    margin-bottom: 0.5rem;
}

header p {
    color: #7f8c8d;
    font-size: 1.1rem;
}

section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

section h2 {
    color: #2c3e50;
    margin-bottom: 1rem;
    font-size: 1.3rem;
}

.status p {
    margin: 0.5rem 0;
}

.status strong {
    color: #2c3e50;
}

.api ul {
    list-style: none;
}

.api li {
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
    border: 1px solid #e9ecef;
}

.api a {
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
}

.api a:hover {
    color: #764ba2;
    text-decoration: underline;
}

.git a {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: #2c3e50;
    color: white;
    text-decoration: none;
    border-radius: 5px;
    font-weight: 500;
    transition: background 0.3s ease;
}

.git a:hover {
    background: #34495e;
}

footer {
    text-align: center;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 2px solid #f0f0f0;
    color: #7f8c8d;
    font-size: 0.9rem;
}

@media (max-width: 768px) {
    .container {
        margin: 1rem;
        padding: 1rem;
    }
    
    header h1 {
        font-size: 2rem;
    }
    
    section {
        padding: 1rem;
    }
}`;

    await fs.writeFile(path.join(targetPath, 'src', 'public', 'index.html'), indexHtml);
    await fs.writeFile(path.join(targetPath, 'src', 'public', 'style.css'), css);
  }

  async generateTestFiles(targetPath, context) {
    const testFile = `const request = require('supertest');
const app = require('../src/app');

describe('${context.projectName} API', () => {
  describe('GET /', () => {
    it('should return welcome message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body.message).toContain('${context.projectName}');
      expect(response.body.status).toBe('running');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);
      
      expect(response.body.message).toContain('${context.projectName} API');
      expect(response.body.endpoints).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/status', () => {
    it('should return API status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      expect(response.body.api).toBe('online');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/data', () => {
    it('should return sample data', async () => {
      const response = await request(app)
        .get('/api/data')
        .expect(200);
      
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);
      
      expect(response.body.error).toBe('Not Found');
    });
  });
});`;

    await fs.writeFile(path.join(targetPath, 'tests', 'app.test.js'), testFile);
  }

  async generateDeployScripts(targetPath, context) {
    const setupScript = `#!/bin/bash
# EC2 Setup Script for ${context.projectName}

set -e

echo "🚀 Setting up ${context.projectName} on EC2..."

# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git if not present
sudo yum install -y git

${context.gitRepository ? `# Setup SSH key for Git repository access
if [ ! -f ~/.ssh/${context.projectName}_deploy_key ]; then
    echo "⚠️  Deploy key not found. Please ensure it's properly configured."
fi

# Clone repository
if [ ! -d "/opt/${context.projectName}" ]; then
    sudo mkdir -p /opt/${context.projectName}
    sudo chown ec2-user:ec2-user /opt/${context.projectName}
    git clone ${context.githubUrl} /opt/${context.projectName}
fi

cd /opt/${context.projectName}
` : `# Create application directory
sudo mkdir -p /opt/${context.projectName}
sudo chown ec2-user:ec2-user /opt/${context.projectName}
cd /opt/${context.projectName}
`}

# Install dependencies
npm install --production

# Setup PM2 ecosystem
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '${context.projectName}',
    script: 'src/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "✅ ${context.projectName} setup completed!"
echo "🌐 Application should be running on port 3000"`;

    const updateScript = `#!/bin/bash
# Deployment Update Script for ${context.projectName}

set -e

echo "🔄 Updating ${context.projectName}..."

cd /opt/${context.projectName}

${context.gitRepository ? `# Pull latest changes
git pull origin main

# Install/update dependencies
npm install --production
` : `# Note: Manual deployment - copy files as needed
echo "Manual deployment mode - update files manually"
`}

# Restart application
pm2 restart ${context.projectName}

# Show status
pm2 status

echo "✅ ${context.projectName} updated successfully!"`;

    await fs.writeFile(path.join(targetPath, 'deploy', 'setup.sh'), setupScript);
    await fs.writeFile(path.join(targetPath, 'deploy', 'update.sh'), updateScript);

    // Make scripts executable
    await fs.chmod(path.join(targetPath, 'deploy', 'setup.sh'), '755');
    await fs.chmod(path.join(targetPath, 'deploy', 'update.sh'), '755');
  }

  async generateGithubWorkflow(targetPath, context) {
    if (!context.gitRepository) return;

    const workflow = `name: Deploy to AWS with focal-deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run linting (if configured)
      run: npm run lint || echo "No linting configured"
      continue-on-error: true

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to AWS
      run: |
        echo "🚀 Deployment triggered for ${context.projectName}"
        echo "Use focal-deploy commands to deploy to AWS"
        # Add your deployment commands here
        # Example: focal-deploy deploy
      env:
        AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}`;

    await fs.writeFile(path.join(targetPath, '.github', 'workflows', 'deploy.yml'), workflow);
  }
}

module.exports = { TemplateEngine };