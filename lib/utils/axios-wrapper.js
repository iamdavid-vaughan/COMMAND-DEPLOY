/**
 * Axios Wrapper - Handles axios loading for pkg compatibility
 *
 * This wrapper handles the conditional exports issue in axios 1.x
 * when bundling with pkg by trying multiple resolution paths.
 */

let axios = null;

// Try multiple ways to load axios
try {
  // Try standard require first
  axios = require('axios');
} catch (error) {
  // If that fails, try the direct CommonJS path
  try {
    axios = require('axios/dist/node/axios.cjs');
  } catch (error2) {
    // If that fails too, try the index
    try {
      axios = require('axios/index.js');
    } catch (error3) {
      // Last resort: try requiring from the dist directory
      try {
        const axiosPath = require.resolve('axios');
        const path = require('path');
        const axiosDir = path.dirname(axiosPath);
        axios = require(path.join(axiosDir, 'dist', 'node', 'axios.cjs'));
      } catch (error4) {
        throw new Error(
          'Could not load axios module. This is likely a pkg bundling issue.\n' +
          'Original errors:\n' +
          `1. ${error.message}\n` +
          `2. ${error2.message}\n` +
          `3. ${error3.message}\n` +
          `4. ${error4.message}`
        );
      }
    }
  }
}

// Export all axios functionality
module.exports = axios;
module.exports.default = axios;

// Also export common axios properties for compatibility
if (axios) {
  module.exports.create = axios.create;
  module.exports.Cancel = axios.Cancel;
  module.exports.CancelToken = axios.CancelToken;
  module.exports.isCancel = axios.isCancel;
  module.exports.all = axios.all;
  module.exports.spread = axios.spread;
  module.exports.isAxiosError = axios.isAxiosError;
}
