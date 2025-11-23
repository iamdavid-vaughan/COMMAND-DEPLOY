# Dashboard Feature Parity Requirements

**Date**: 2025-11-20
**Status**: Planning Phase
**Priority**: High

## Overview

The Focal Deploy landing page makes specific promises about dashboard capabilities that need to be fully implemented to match CLI functionality. This document outlines the gaps between current dashboard features and promised/CLI-available features.

## Critical Issue

**Landing Page Promise**:
> "Monitor & Scale - Track deployments across all clouds, view real-time metrics, SSH into servers, and scale resources - all from one unified dashboard."

**Current Reality**: These features exist in the CLI (`focal-deploy ssl status`, `focal-deploy down`, etc.) but are not available in the web dashboard.

---

## Feature Gap Analysis

### 1. Monitoring & Health Checks

#### CLI Features Available:
- `focal-deploy status` - Check deployment health
- `focal-deploy down` - Check if services are down
- Server health monitoring
- AWS EC2 instance status monitoring
- Real-time deployment tracking

#### Dashboard Implementation Needed:
- [ ] **Deployment Health Dashboard**
  - Real-time status cards for each deployment
  - Visual indicators (green/yellow/red) for health status
  - Last health check timestamp
  - Quick action buttons (restart, view logs, SSH)

- [ ] **Server Health Monitoring**
  - CPU usage graphs
  - Memory usage graphs
  - Disk space monitoring
  - Network I/O metrics
  - Uptime tracking

- [ ] **AWS/GCP Resource Monitoring**
  - EC2 instance status (running, stopped, terminated)
  - GCP Compute Engine status
  - Instance metadata (type, region, cost)
  - Resource utilization

- [ ] **Live Metrics Dashboard**
  - Real-time application metrics
  - Request rate graphs
  - Response time charts
  - Error rate tracking
  - Historical data (7/30/90 days)

**Technical Implementation**:
```
/dashboard/monitoring/[deploymentId]/
├── health - Health status overview
├── metrics - Real-time metrics and graphs
├── resources - Cloud resource status
└── logs - Live log streaming
```

**API Endpoints Needed**:
- `GET /api/monitoring/deployments/:id/health`
- `GET /api/monitoring/deployments/:id/metrics`
- `GET /api/monitoring/deployments/:id/resources`
- `GET /api/monitoring/deployments/:id/logs/stream` (WebSocket)

---

### 2. SSL Certificate Management

#### CLI Features Available:
- `focal-deploy ssl status` - Check SSL certificate status
- Certificate expiration monitoring
- Auto-renewal status

#### Dashboard Implementation Needed:
- [ ] **SSL Certificate Dashboard**
  - List all SSL certificates across deployments
  - Certificate expiration dates with warnings
  - Auto-renewal status and configuration
  - Manual renewal button
  - Certificate chain verification

- [ ] **SSL Status Indicators**
  - Visual warnings for expiring certificates (< 30 days)
  - Critical alerts for expired certificates
  - Renewal history and logs

**Technical Implementation**:
```
/dashboard/ssl/
├── overview - All certificates across deployments
└── [deploymentId] - SSL details for specific deployment
```

**API Endpoints Needed**:
- `GET /api/ssl/certificates` - List all certificates
- `GET /api/ssl/certificates/:deploymentId` - Get specific cert status
- `POST /api/ssl/certificates/:deploymentId/renew` - Manual renewal
- `GET /api/ssl/certificates/:deploymentId/history` - Renewal history

---

### 3. Alerting & Notifications

#### Current Gap:
No alerting or notification system exists in dashboard or CLI.

#### Implementation Needed:
- [ ] **Alert Configuration Dashboard**
  - Define alert rules (CPU > 80%, disk > 90%, SSL expiring, etc.)
  - Set alert thresholds
  - Configure notification channels
  - Alert rule testing

- [ ] **Notification Channels**
  - **Email Notifications** (Priority 1)
    - Health check failures
    - Deployment status changes
    - SSL certificate expiring/expired
    - Resource usage warnings
    - Security alerts

  - **Slack Integration** (Priority 2)
    - Webhook configuration UI
    - Channel selection
    - Message format customization
    - Test notification button

  - **SMS Notifications** (Future - Not Immediate)
    - User noted: "not SMS as that is too challenging at this time"

- [ ] **Super Admin Notifications**
  - Critical system alerts
  - Service outages (auto-detect via status monitoring)
  - Database issues
  - High error rates across platform
  - Billing issues (failed payments, quota exceeded)

**Technical Implementation**:
```
/dashboard/alerts/
├── overview - Active alerts and recent history
├── rules - Configure alert rules
├── channels - Configure notification channels
└── history - Alert history and resolution

/dashboard/admin/alerts/ - Super admin system-wide alerts
```

**API Endpoints Needed**:
- `GET /api/alerts/rules` - List alert rules
- `POST /api/alerts/rules` - Create alert rule
- `PUT /api/alerts/rules/:id` - Update alert rule
- `DELETE /api/alerts/rules/:id` - Delete alert rule
- `GET /api/alerts/channels` - List notification channels
- `POST /api/alerts/channels` - Add notification channel
- `POST /api/alerts/channels/:id/test` - Send test notification
- `GET /api/alerts/history` - Alert history

**Database Schema Needed**:
```sql
-- Alert rules table
CREATE TABLE alert_rules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  deployment_id INTEGER REFERENCES deployments(id),
  name VARCHAR(255) NOT NULL,
  condition VARCHAR(50) NOT NULL, -- 'cpu_usage', 'memory_usage', 'ssl_expiring', etc.
  threshold NUMERIC,
  notification_channels JSONB, -- Array of channel IDs
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notification channels table
CREATE TABLE notification_channels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- 'email', 'slack', 'webhook'
  config JSONB NOT NULL, -- Email address, Slack webhook URL, etc.
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alert history table
CREATE TABLE alert_history (
  id SERIAL PRIMARY KEY,
  alert_rule_id INTEGER REFERENCES alert_rules(id),
  deployment_id INTEGER REFERENCES deployments(id),
  triggered_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  severity VARCHAR(20), -- 'info', 'warning', 'critical'
  message TEXT,
  notification_sent BOOLEAN DEFAULT false
);
```

---

### 4. SSH Access from Dashboard

#### Landing Page Promise:
> "SSH into servers"

#### Current Gap:
No web-based SSH access or SSH session management.

#### Implementation Needed:
- [ ] **Web-based SSH Terminal**
  - In-browser terminal using xterm.js + WebSocket
  - SSH connection to deployment servers
  - Multiple terminal tabs/windows
  - Terminal session persistence
  - Copy/paste support
  - Keyboard shortcuts

- [ ] **SSH Session Management**
  - View active SSH sessions
  - Terminate sessions
  - Session audit log
  - Connection history

**Technical Implementation**:
```
/dashboard/deployments/[id]/ssh - Web terminal interface
```

**Backend Requirements**:
- WebSocket server for terminal I/O
- SSH client library (node-ssh or similar)
- Session authentication and authorization
- Security: Only allow SSH to user's own deployments
- Rate limiting to prevent abuse

**Security Considerations**:
- Require 2FA for SSH access
- Log all SSH commands executed
- Timeout inactive sessions (10 min default)
- Audit trail for compliance

---

### 5. Resource Scaling

#### Landing Page Promise:
> "scale resources"

#### Current Gap:
No ability to scale resources from dashboard.

#### Implementation Needed:
- [ ] **Resource Scaling Dashboard**
  - View current instance type and size
  - Vertical scaling (change instance type)
  - Horizontal scaling (add/remove instances)
  - Auto-scaling rule configuration
  - Cost estimate for scaling changes

- [ ] **Quick Scale Actions**
  - One-click scale up/down presets
  - Emergency scale-up button
  - Schedule scaling (e.g., scale up during business hours)

**Technical Implementation**:
```
/dashboard/deployments/[id]/scale
```

**API Endpoints Needed**:
- `GET /api/deployments/:id/scale/current` - Current resource allocation
- `POST /api/deployments/:id/scale/vertical` - Change instance type
- `POST /api/deployments/:id/scale/horizontal` - Add/remove instances
- `GET /api/deployments/:id/scale/cost-estimate` - Estimate cost of changes
- `POST /api/deployments/:id/scale/auto` - Configure auto-scaling

---

### 6. Real-Time Deployment Tracking

#### CLI Features Available:
- Live deployment progress
- Step-by-step status updates
- Real-time log streaming

#### Dashboard Implementation Needed:
- [ ] **Live Deployment View**
  - Real-time progress bar
  - Step-by-step status (provisioning, configuring, deploying, testing, live)
  - Live log streaming with syntax highlighting
  - Error highlighting and quick navigation to errors
  - WebSocket for real-time updates

- [ ] **Deployment History**
  - Timeline view of all deployments
  - Success/failure indicators
  - Deployment duration tracking
  - Rollback capability

**Technical Implementation**:
- WebSocket connection for live updates
- Persistent log storage (S3 or database)
- Log streaming API

---

## Implementation Priority

### Phase 1 - Critical (Immediate)
1. **Monitoring Dashboard** - Server health, resource status, deployment health
2. **Email Notifications** - Alert system with email delivery
3. **SSL Certificate Status** - Dashboard view with expiration warnings
4. **Real-Time Deployment Tracking** - Live progress and log streaming

### Phase 2 - High Priority (1-2 weeks)
5. **Slack Integration** - Webhook-based notifications
6. **Alert Rule Configuration** - User-defined alert rules and thresholds
7. **Resource Scaling** - UI for vertical/horizontal scaling

### Phase 3 - Medium Priority (3-4 weeks)
8. **Web-based SSH Terminal** - In-browser SSH access
9. **Auto-scaling Configuration** - Rule-based auto-scaling
10. **Advanced Metrics** - Custom dashboards, metric exports

---

## Technical Architecture

### Frontend Components Needed
- Real-time chart library (Chart.js, Recharts, or similar)
- WebSocket client for live updates
- Terminal emulator (xterm.js) for SSH
- Notification toast system for alerts

### Backend Services Needed
- Monitoring agent to collect metrics from deployments
- Alert evaluation engine (runs every 1-5 minutes)
- Notification service (email, Slack, webhooks)
- WebSocket server for real-time updates
- SSH proxy service for web terminal

### Infrastructure Requirements
- Monitoring agents deployed with each deployment
- Message queue (Redis) for real-time events
- Time-series database for metrics (InfluxDB or TimescaleDB)
- Log aggregation (could use existing logging)

---

## Success Metrics

After implementation, the following should be true:
- [ ] All features promised on landing page are functional in dashboard
- [ ] Users can complete all CLI operations from web dashboard
- [ ] Super admin receives notifications for system outages
- [ ] Users can set up custom alerts and receive notifications
- [ ] Response time for monitoring dashboard < 2 seconds
- [ ] Real-time updates have < 5 second latency

---

## Action Items

1. **Immediate**:
   - Review and approve this feature plan
   - Prioritize features for Phase 1 implementation
   - Allocate development resources

2. **Short-term**:
   - Create detailed technical specifications for Phase 1 features
   - Design database schema for alerts and monitoring
   - Set up monitoring infrastructure

3. **Medium-term**:
   - Begin Phase 1 implementation
   - Set up staging environment for testing
   - Prepare documentation for new features

---

## Notes

- User specifically mentioned: "we promise that everything can be done from the dashboard but if we do not have these options available to people then we need to implement to get these available"
- SMS notifications explicitly deprioritized: "not SMS as that is too challenging at this time"
- Super admin notifications are critical: "As super admin, I CERTAINLY need notifications for issues and outages"
- Current status page created today needs integration with actual monitoring system
- Third-party status page monitoring may be considered once funding is available

---

## Related Files

- Frontend: `/dashboard/src/app/dashboard/monitoring/` (to be created)
- Backend: `/saas-server/routes/monitoring.js` (exists but needs expansion)
- Backend: `/saas-server/services/alerting.js` (to be created)
- Backend: `/saas-server/services/monitoring-agent.js` (to be created)

---

**Last Updated**: 2025-11-20
**Author**: Claude Code
**Reviewer**: [To be assigned]
