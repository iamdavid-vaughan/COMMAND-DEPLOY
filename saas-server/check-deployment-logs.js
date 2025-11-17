/**
 * Quick script to check deployment logs from database
 */

try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, continue without it
}
const { initializeDatabase } = require('./services/database');
const { initializeModels, getModels } = require('./models');

(async () => {
  try {
    await initializeDatabase();
    initializeModels();
    const { Deployment, DeploymentLog } = getModels();

    // Get recent deployments
    const deployments = await Deployment.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'project_name', 'status', 'error_message', 'created_at', 'started_at', 'completed_at']
    });

    console.log('\n=== Recent Deployments ===');
    deployments.forEach(d => {
      console.log(`\nID: ${d.id}`);
      console.log(`Project: ${d.project_name}`);
      console.log(`Status: ${d.status}`);
      console.log(`Created: ${d.created_at}`);
      if (d.error_message) {
        console.log(`Error: ${d.error_message}`);
      }
    });

    if (deployments.length > 0) {
      const latest = deployments[0];
      console.log(`\n=== Logs for Deployment ${latest.id} (${latest.project_name}) ===`);

      const logs = await DeploymentLog.findAll({
        where: { deployment_id: latest.id },
        order: [['created_at', 'ASC']],
        attributes: ['level', 'message', 'created_at']
      });

      logs.forEach(log => {
        const time = new Date(log.created_at).toLocaleTimeString();
        console.log(`[${time}] ${log.level.toUpperCase()}: ${log.message}`);
      });

      if (logs.length === 0) {
        console.log('No logs found for this deployment');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
