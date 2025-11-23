/**
 * Team Management Routes
 * Manage team members, invitations, and seat allocations
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { initializeDatabase } = require('../services/database');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const crypto = require('crypto');

const router = express.Router();

/**
 * GET /api/teams/members
 * Get all team members for the user's account
 */
router.get('/members', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const sequelize = await initializeDatabase();

    // Check if user is team account owner
    const [user] = await sequelize.query(`
      SELECT is_team_account, seats_purchased, license_tier
      FROM users
      WHERE id = :userId
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!user || !user.is_team_account) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only team account owners can view members'
      });
    }

    // Get team members
    const members = await sequelize.query(`
      SELECT
        tm.id,
        tm.member_id,
        u.email,
        u.first_name,
        u.last_name,
        tm.role,
        tm.status,
        tm.joined_at,
        tm.last_active_at
      FROM team_members tm
      JOIN users u ON tm.member_id = u.id
      WHERE tm.owner_id = :userId
      ORDER BY tm.joined_at DESC
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      members,
      meta: {
        total: members.length,
        seatsAvailable: user.seats_purchased,
        seatsUsed: members.length,
        seatsRemaining: user.seats_purchased - members.length
      }
    });

  } catch (error) {
    logger.error('Error fetching team members', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/teams/invitations
 * Get all pending invitations
 */
router.get('/invitations', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const sequelize = await initializeDatabase();

    const invitations = await sequelize.query(`
      SELECT
        id,
        email,
        role,
        status,
        expires_at,
        created_at,
        invited_by_email
      FROM team_invitations
      WHERE invited_by = :userId
      ORDER BY created_at DESC
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      invitations,
      meta: {
        total: invitations.length,
        pending: invitations.filter(i => i.status === 'pending').length,
        accepted: invitations.filter(i => i.status === 'accepted').length,
        expired: invitations.filter(i => i.status === 'expired').length
      }
    });

  } catch (error) {
    logger.error('Error fetching invitations', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/teams/invite
 * Invite a new team member
 */
router.post('/invite',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const userEmail = req.user.email;
      const { email, role = 'member' } = req.body;
      const sequelize = await initializeDatabase();

      // Check if user is team account owner
      const [user] = await sequelize.query(`
        SELECT is_team_account, seats_purchased, license_tier, first_name, last_name, company_name
        FROM users
        WHERE id = :userId
      `, {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      });

      if (!user || !user.is_team_account) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only team account owners can invite members'
        });
      }

      // Check if seats are available
      const [memberCount] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM team_members
        WHERE owner_id = :userId AND status = 'active'
      `, {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      });

      if (memberCount.count >= user.seats_purchased) {
        return res.status(400).json({
          error: 'No seats available',
          message: `You have ${user.seats_purchased} seats and ${memberCount.count} are in use. Please purchase more seats.`,
          upgradeUrl: '/api/billing/upgrade'
        });
      }

      // Check if user already invited
      const [existingInvite] = await sequelize.query(`
        SELECT id, status
        FROM team_invitations
        WHERE invited_by = :userId AND email = :email
        AND status = 'pending'
      `, {
        replacements: { userId, email },
        type: sequelize.QueryTypes.SELECT
      });

      if (existingInvite) {
        return res.status(409).json({
          error: 'Already invited',
          message: 'This email has already been invited'
        });
      }

      // Check if user is already a member
      const [existingMember] = await sequelize.query(`
        SELECT tm.id
        FROM team_members tm
        JOIN users u ON tm.member_id = u.id
        WHERE tm.owner_id = :userId AND u.email = :email
      `, {
        replacements: { userId, email },
        type: sequelize.QueryTypes.SELECT
      });

      if (existingMember) {
        return res.status(409).json({
          error: 'Already a member',
          message: 'This user is already a team member'
        });
      }

      // Generate invitation token
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      // Create invitation
      await sequelize.query(`
        INSERT INTO team_invitations (
          invited_by, invited_by_email, email, role, invite_token, expires_at, status
        ) VALUES (
          :userId, :userEmail, :email, :role, :inviteToken, :expiresAt, 'pending'
        )
      `, {
        replacements: {
          userId,
          userEmail,
          email,
          role,
          inviteToken,
          expiresAt
        }
      });

      // Send invitation email
      const inviteUrl = `${process.env.FRONTEND_URL}/team/accept-invite?token=${inviteToken}`;
      const companyName = user.company_name || `${user.first_name} ${user.last_name}`.trim();

      try {
        await sendEmail({
          to: email,
          subject: `You've been invited to join ${companyName} on Focal Deploy`,
          html: `
            <h2>Team Invitation</h2>
            <p>You've been invited by ${userEmail} to join their team on Focal Deploy.</p>
            <p><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p>This invitation expires in 7 days.</p>
            <p><a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Accept Invitation</a></p>
            <p>Or copy this link: ${inviteUrl}</p>
          `
        });

        logger.info('Team invitation sent', { userId, invitedEmail: email, role });
      } catch (emailError) {
        logger.error('Failed to send invitation email', {
          error: emailError.message,
          email
        });
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Invitation sent successfully',
        invitation: {
          email,
          role,
          expiresAt,
          inviteUrl: process.env.NODE_ENV === 'development' ? inviteUrl : undefined
        }
      });

    } catch (error) {
      logger.error('Error creating invitation', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /api/teams/accept-invite
 * Accept a team invitation
 */
router.post('/accept-invite',
  [
    body('token').notEmpty().withMessage('Invitation token required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;
      const userId = req.user.userId;
      const userEmail = req.user.email;
      const sequelize = await initializeDatabase();

      // Find invitation
      const [invitation] = await sequelize.query(`
        SELECT id, invited_by, email, role, status, expires_at
        FROM team_invitations
        WHERE invite_token = :token
      `, {
        replacements: { token },
        type: sequelize.QueryTypes.SELECT
      });

      if (!invitation) {
        return res.status(404).json({
          error: 'Invalid invitation',
          message: 'Invitation not found or has been revoked'
        });
      }

      // Check if invitation is for this user's email
      if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
        return res.status(403).json({
          error: 'Email mismatch',
          message: 'This invitation is for a different email address'
        });
      }

      // Check if already accepted
      if (invitation.status === 'accepted') {
        return res.status(409).json({
          error: 'Already accepted',
          message: 'This invitation has already been accepted'
        });
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        await sequelize.query(`
          UPDATE team_invitations
          SET status = 'expired'
          WHERE id = :invitationId
        `, {
          replacements: { invitationId: invitation.id }
        });

        return res.status(410).json({
          error: 'Invitation expired',
          message: 'This invitation has expired'
        });
      }

      // Check if user is already a member
      const [existingMember] = await sequelize.query(`
        SELECT id
        FROM team_members
        WHERE owner_id = :ownerId AND member_id = :userId
      `, {
        replacements: { ownerId: invitation.invited_by, userId },
        type: sequelize.QueryTypes.SELECT
      });

      if (existingMember) {
        return res.status(409).json({
          error: 'Already a member',
          message: 'You are already a member of this team'
        });
      }

      // Add user to team
      await sequelize.query(`
        INSERT INTO team_members (
          owner_id, member_id, role, status, joined_at
        ) VALUES (
          :ownerId, :memberId, :role, 'active', NOW()
        )
      `, {
        replacements: {
          ownerId: invitation.invited_by,
          memberId: userId,
          role: invitation.role
        }
      });

      // Update invitation status
      await sequelize.query(`
        UPDATE team_invitations
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = :invitationId
      `, {
        replacements: { invitationId: invitation.id }
      });

      logger.info('Team invitation accepted', {
        invitationId: invitation.id,
        userId,
        ownerId: invitation.invited_by
      });

      res.json({
        success: true,
        message: 'Successfully joined the team!'
      });

    } catch (error) {
      logger.error('Error accepting invitation', { error: error.message });
      next(error);
    }
  }
);

/**
 * DELETE /api/teams/members/:memberId
 * Remove a team member
 */
router.delete('/members/:memberId',
  [
    param('memberId').isUUID().withMessage('Invalid member ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { memberId } = req.params;
      const sequelize = await initializeDatabase();

      // Verify ownership
      const [member] = await sequelize.query(`
        SELECT tm.id, u.email, u.first_name, u.last_name
        FROM team_members tm
        JOIN users u ON tm.member_id = u.id
        WHERE tm.owner_id = :userId AND tm.member_id = :memberId
      `, {
        replacements: { userId, memberId },
        type: sequelize.QueryTypes.SELECT
      });

      if (!member) {
        return res.status(404).json({
          error: 'Member not found',
          message: 'Team member not found or you do not have permission to remove them'
        });
      }

      // Remove member
      await sequelize.query(`
        DELETE FROM team_members
        WHERE id = :id
      `, {
        replacements: { id: member.id }
      });

      // Terminate all sessions for removed member
      const sessionTrackingService = require('../services/sessionTracking');
      await sessionTrackingService.initialize();
      await sessionTrackingService.terminateAllUserSessions(memberId);

      logger.info('Team member removed', {
        ownerId: userId,
        memberId,
        memberEmail: member.email
      });

      res.json({
        success: true,
        message: `${member.email} has been removed from the team`
      });

    } catch (error) {
      logger.error('Error removing team member', { error: error.message });
      next(error);
    }
  }
);

/**
 * PATCH /api/teams/members/:memberId/role
 * Update team member role
 */
router.patch('/members/:memberId/role',
  [
    param('memberId').isUUID().withMessage('Invalid member ID'),
    body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { memberId } = req.params;
      const { role } = req.body;
      const sequelize = await initializeDatabase();

      // Verify ownership
      const [member] = await sequelize.query(`
        SELECT tm.id
        FROM team_members tm
        WHERE tm.owner_id = :userId AND tm.member_id = :memberId
      `, {
        replacements: { userId, memberId },
        type: sequelize.QueryTypes.SELECT
      });

      if (!member) {
        return res.status(404).json({
          error: 'Member not found',
          message: 'Team member not found or you do not have permission to update them'
        });
      }

      // Update role
      await sequelize.query(`
        UPDATE team_members
        SET role = :role
        WHERE id = :id
      `, {
        replacements: { id: member.id, role }
      });

      logger.info('Team member role updated', {
        ownerId: userId,
        memberId,
        newRole: role
      });

      res.json({
        success: true,
        message: 'Member role updated successfully'
      });

    } catch (error) {
      logger.error('Error updating member role', { error: error.message });
      next(error);
    }
  }
);

/**
 * DELETE /api/teams/invitations/:invitationId
 * Revoke a pending invitation
 */
router.delete('/invitations/:invitationId', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { invitationId } = req.params;
    const sequelize = await initializeDatabase();

    // Verify ownership
    const [invitation] = await sequelize.query(`
      SELECT id, email
      FROM team_invitations
      WHERE id = :invitationId AND invited_by = :userId
    `, {
      replacements: { invitationId, userId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found',
        message: 'Invitation not found or you do not have permission to revoke it'
      });
    }

    // Delete invitation
    await sequelize.query(`
      DELETE FROM team_invitations
      WHERE id = :invitationId
    `, {
      replacements: { invitationId }
    });

    logger.info('Team invitation revoked', {
      userId,
      invitationId,
      email: invitation.email
    });

    res.json({
      success: true,
      message: 'Invitation revoked successfully'
    });

  } catch (error) {
    logger.error('Error revoking invitation', { error: error.message });
    next(error);
  }
});

module.exports = router;
