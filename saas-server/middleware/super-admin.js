/**
 * Super Admin Middleware - For DFY (Done For You) accounts
 */

/**
 * Check if user is a super admin
 */
function isSuperAdmin(req, res, next) {
  if (req.user?.role === 'super_admin') {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'This action requires super admin privileges'
  });
}

/**
 * Check if user can manage a specific client (for DFY)
 */
function canManageClient(clientId) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const superAdminFor = req.user?.superAdminFor || [];

    // Super admins can manage anyone
    if (userRole === 'super_admin') {
      return next();
    }

    // Regular admins can manage their assigned clients
    if (userRole === 'admin' && superAdminFor.includes(clientId)) {
      return next();
    }

    // Users can only access their own account
    if (req.user?.userId === clientId) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to manage this account'
    });
  };
}

/**
 * Allow access for both user and their super admin
 */
function allowSuperAdminAccess(req, res, next) {
  // If user is accessing their own resources, allow
  if (req.user?.userId === req.params.userId || req.user?.userId === req.query.userId) {
    return next();
  }

  // If user is super admin for this client, allow
  const targetUserId = req.params.userId || req.query.userId;
  const superAdminFor = req.user?.superAdminFor || [];

  if (req.user?.role === 'super_admin' || superAdminFor.includes(targetUserId)) {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Access denied'
  });
}

module.exports = {
  isSuperAdmin,
  canManageClient,
  allowSuperAdminAccess
};
