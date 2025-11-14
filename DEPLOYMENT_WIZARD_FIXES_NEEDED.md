# Deployment Wizard Fixes Needed

## Critical Issues to Fix

### 1. SSH Port Configuration (CRITICAL!)

**Problem:** The SaaS deployment wizard currently defaults to SSH port 22, but the CLI **ALWAYS closes port 22** during deployment for security.

**Fix Needed in `/dashboard/src/app/dashboard/deployments/new/page.tsx`:**

```typescript
// Line 67-69: Change defaults
// Step 2: Server
operatingSystem: 'ubuntu-22.04',
deploymentUsername: 'deploy', // NEW: Changed from serverUsername
sshPort: 2847, // CRITICAL: Changed from 22 - port 22 gets closed!
```

**Also update allowedPorts:**
```typescript
// Line 76: Update to use custom SSH port
allowedPorts: [2847, 80, 443], // Use custom SSH port, not 22!
```

**Add validation (around line 370):**
```typescript
<label className="block text-sm font-medium text-gray-700 mb-2">
  Custom SSH Port <span className="text-red-500">*</span>
</label>
<input
  type="number"
  value={formData.sshPort}
  onChange={(e) => {
    const port = parseInt(e.target.value);
    setFormData({
      ...formData,
      sshPort: port,
      allowedPorts: [port, 80, 443], // Update allowed ports array
    });
  }}
  placeholder="2847"
  min="1024"
  max="65535"
  required
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
<p className="mt-1 text-sm text-amber-600 font-medium">
  ⚠️ IMPORTANT: Port 22 is NEVER used for security. Port 22 will be automatically closed during deployment.
</p>
{formData.sshPort === 22 && (
  <p className="mt-1 text-sm text-red-600 font-medium">
    ❌ Port 22 is not allowed! Please use a custom port (e.g., 2847).
  </p>
)}
```

### 2. Deployment Username Validation

**Problem:** Current form allows using OS default usernames like 'ubuntu', 'ec2-user', which the CLI explicitly forbids.

**Fix Needed (around line 356):**

```typescript
<label className="block text-sm font-medium text-gray-700 mb-2">
  Deployment Username <span className="text-red-500">*</span>
</label>
<input
  type="text"
  value={formData.deploymentUsername}
  onChange={(e) => setFormData({
    ...formData,
    deploymentUsername: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  })}
  placeholder="deploy"
  pattern="[a-z][a-z0-9_-]*"
  required
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
<p className="mt-1 text-sm text-gray-500">
  Custom deployment user (lowercase letters, numbers, hyphens, underscores). Cannot use 'ubuntu', 'ec2-user', 'admin', or 'root'.
</p>
{['ubuntu', 'ec2-user', 'admin', 'root'].includes(formData.deploymentUsername) && (
  <p className="mt-1 text-sm text-red-600">
    ⚠️ Cannot use OS default usernames. Please choose a different deployment username.
  </p>
)}
```

### 3. Form Submission Payload

**Fix Needed (around line 108-138):**

```typescript
const payload = {
  projectName: formData.projectName,
  region: formData.region,
  instanceType: formData.instanceType,
  configuration: {
    server: {
      os: formData.operatingSystem,
      deploymentUsername: formData.deploymentUsername, // Changed from 'username'
      sshPort: formData.sshPort, // Make sure this is included
    },
    security: {
      sshHardening: formData.enableSshHardening,
      fail2ban: formData.enableFail2ban,
      autoUpdates: formData.enableAutoUpdates,
      firewall: formData.enableFirewall,
      allowedPorts: formData.allowedPorts, // This should include custom SSH port
      customSSHPort: formData.sshPort, // Explicitly add this
    },
    application: {
      type: formData.applicationType,
      githubRepo: formData.githubRepo,
      githubBranch: formData.githubBranch,
      port: formData.applicationPort,
      envVars: formData.envVars,
    },
    domain: formData.customDomain ? {
      name: formData.customDomain,
      ssl: formData.enableSsl,
      sslEmail: formData.sslEmail,
    } : null,
  },
};
```

### 4. Review Page (Step 6)

**Update to show deployment username and custom SSH port (around line 662-676):**

```typescript
<div className="border border-gray-200 rounded-lg p-4">
  <h3 className="font-medium text-gray-900 mb-2">Server</h3>
  <dl className="space-y-1 text-sm">
    <div className="flex justify-between">
      <dt className="text-gray-600">OS:</dt>
      <dd className="text-gray-900">{OS_OPTIONS.find(os => os.value === formData.operatingSystem)?.label}</dd>
    </div>
    <div className="flex justify-between">
      <dt className="text-gray-600">Deployment User:</dt>
      <dd className="text-gray-900 font-mono">{formData.deploymentUsername}</dd>
    </div>
    <div className="flex justify-between">
      <dt className="text-gray-600">Custom SSH Port:</dt>
      <dd className="text-gray-900 font-mono">{formData.sshPort}</dd>
    </div>
  </dl>
</div>
```

## How the Deployment Worker Should Function

### Current File: `/saas-server/services/deploymentWorker.js`

The deployment worker should:

1. **Accept the full configuration** from the API including:
   - `deploymentUsername`
   - `sshPort` (custom SSH port, e.g., 2847)
   - All security settings

2. **Create a project config file** similar to what the CLI uses in `.focal-deploy/config.json`

3. **Run `focal-deploy up`** with the proper parameters:
   ```javascript
   const { execSync } = require('child_process');

   // Create project directory
   const projectDir = `/tmp/deployments/${deploymentId}`;
   fs.mkdirSync(projectDir, { recursive: true });

   // Write config file
   const config = {
     projectName: deployment.project_name,
     region: deployment.region,
     instanceType: deployment.instance_type,
     operatingSystem: deployment.configuration.server.os,
     deploymentUsername: deployment.configuration.server.deploymentUsername,
     sshPort: deployment.configuration.server.sshPort,
     security: {
       sshHardening: deployment.configuration.security.sshHardening,
       fail2ban: deployment.configuration.security.fail2ban,
       firewall: deployment.configuration.security.firewall,
       customSSHPort: deployment.configuration.security.customSSHPort,
     },
     // ... rest of config
   };

   fs.writeFileSync(
     path.join(projectDir, '.focal-deploy', 'config.json'),
     JSON.stringify(config, null, 2)
   );

   // Run focal-deploy up
   const result = execSync('focal-deploy up', {
     cwd: projectDir,
     env: {
       ...process.env,
       AWS_ACCESS_KEY_ID: userCredentials.aws_access_key_id,
       AWS_SECRET_ACCESS_KEY: userCredentials.aws_secret_access_key,
     },
     encoding: 'utf8',
   });
   ```

4. **Stream deployment logs** back to the database:
   ```javascript
   // Save deployment logs
   await DeploymentLog.create({
     deployment_id: deploymentId,
     log_level: 'info',
     message: result,
     timestamp: new Date(),
   });
   ```

5. **Update deployment status** as it progresses:
   - `pending` → `provisioning` → `configuring` → `running` or `failed`

## Key Differences Between CLI and SaaS

### CLI Workflow:
1. Runs `focal-deploy new` → Creates project directory
2. Wizard collects all configuration
3. Saves to `.focal-deploy/config.json`
4. Runs `focal-deploy up` → Reads config and deploys
5. Closes port 22, opens custom SSH port

### SaaS Workflow (Should Be):
1. User fills out web form
2. API creates deployment record
3. deploymentWorker:
   - Creates temp project directory
   - Writes config file (same format as CLI)
   - Runs `focal-deploy up` with environment variables
   - Streams logs to database
   - Updates deployment status
4. User sees deployment progress in dashboard

## Testing Checklist

- [ ] SSH port defaults to 2847 (not 22)
- [ ] Port 22 is rejected with error message
- [ ] Deployment username cannot be 'ubuntu', 'ec2-user', 'admin', or 'root'
- [ ] Username validation works (lowercase, alphanumeric, hyphens, underscores)
- [ ] allowedPorts array includes custom SSH port
- [ ] Form submission includes all required fields
- [ ] deploymentWorker receives correct configuration
- [ ] deploymentWorker runs `focal-deploy up` successfully
- [ ] Deployment logs are captured and displayed
- [ ] SSH connection uses custom port after deployment

## References

- **CLI Security Configuration**: `lib/wizard/security-configurator.js` (lines 59-74 for SSH port validation)
- **CLI Deployment Executor**: `lib/wizard/deployment-executor.js` (shows how SSH port is used)
- **CLI Infrastructure Config**: `lib/wizard/infrastructure-configurator.js` (shows sshPort configuration)
