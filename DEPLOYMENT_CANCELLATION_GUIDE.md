# Deployment Cancellation and Deletion Guide

## Features Added

### 1. Cancel Running Deployments
Cancel a deployment that is currently running or pending.

**Endpoint**: `PATCH /api/deployments/:id/cancel`

**Example**:
```bash
curl -X PATCH http://localhost:5001/api/deployments/abc-123/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "Deployment cancellation requested. The deployment will stop shortly.",
  "deployment": {
    "id": "abc-123",
    "status": "running",
    "cancelledByUser": true
  }
}
```

**Behavior**:
- Sets `cancelled_by_user` flag to true
- Worker checks this flag every 10 log messages
- Deployment stops and status changes to 'cancelled'
- Temporary project directory cleaned up
- Can only cancel pending/running deployments

### 2. Delete Deployments
Delete a deployment record from the database. For completed deployments, also terminates AWS resources.

**Endpoint**: `DELETE /api/deployments/:id`

**Example**:
```bash
curl -X DELETE http://localhost:5001/api/deployments/abc-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (Completed deployment with AWS resources)**:
```json
{
  "success": true,
  "message": "Deployment deletion initiated. AWS resources are being terminated in the background."
}
```

**Response (Failed/cancelled/terminated deployment)**:
```json
{
  "success": true,
  "message": "Deployment deleted successfully"
}
```

**Behavior**:
- **Running/Pending deployments**: Returns 400 error - must cancel first
- **Completed deployments**: Triggers AWS resource termination (EC2, S3, security groups), then deletes DB record
- **Failed/Cancelled/Terminated deployments**: Immediately deletes DB record
- Also deletes associated deployment logs
- Tracks deletion in usage tracking

### 3. Database Migration
Run the migration to add the `cancelled_by_user` field:

```bash
cd saas-server
npm run migrate
```

Or manually using sequelize-cli:
```bash
npx sequelize-cli db:migrate
```

## User Workflow

### Cancel a Stuck Deployment

1. User notices deployment is stuck or taking too long
2. Click "Cancel" button in UI (calls PATCH endpoint)
3. Worker detects cancellation flag within ~10 log messages
4. Deployment stops, status changes to 'cancelled'
5. User can now delete the cancelled deployment

### Delete a Failed Deployment

1. Deployment fails or is cancelled
2. Click "Delete" button in UI (calls DELETE endpoint)
3. Deployment record and logs removed from database immediately

### Delete a Completed Deployment (with AWS cleanup)

1. Deployment completed successfully
2. Click "Delete" button in UI
3. Backend triggers AWS resource termination in background
4. Database record deleted immediately
5. AWS resources (EC2, S3, security groups, key pairs) terminated asynchronously

### Cannot Delete Running Deployment

1. User tries to delete running deployment
2. Receives error: "Cannot delete a running deployment. Please cancel it first"
3. User must cancel first, then delete

## Frontend Integration

### Cancel Button
Add to deployment detail page when status is 'running' or 'pending':

```typescript
const handleCancel = async () => {
  const confirm = window.confirm('Are you sure you want to cancel this deployment?');
  if (!confirm) return;

  try {
    const response = await fetch(`/api/deployments/${deploymentId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.success) {
      alert('Deployment cancellation requested');
      // Refresh deployment status
    }
  } catch (error) {
    alert('Failed to cancel deployment');
  }
};
```

### Delete Button
Add to deployment list/detail when status is NOT 'running' or 'pending':

```typescript
const handleDelete = async () => {
  const confirm = window.confirm('Are you sure you want to delete this deployment? This cannot be undone.');
  if (!confirm) return;

  try {
    const response = await fetch(`/api/deployments/${deploymentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.success) {
      alert(data.message);
      // Remove from list or redirect
    }
  } catch (error) {
    alert('Failed to delete deployment');
  }
};
```

## Implementation Details

### Cancellation Detection

The worker checks for cancellation in two places:

1. **Before starting**: Checks `deployment.cancelled_by_user` flag
2. **During execution**: Checks every 10 log messages in the log callback

This ensures quick detection without excessive database queries.

### Error Handling

Cancellation is treated as a special error:
- Error message contains "cancelled by user"
- Worker detects this and sets status to 'cancelled' instead of 'failed'
- Deployment marked as completed with cancellation message

### AWS Resource Cleanup

When deleting a completed deployment:
- Calls `processTermination()` from deployment worker
- Terminates EC2 instance
- Deletes S3 bucket
- Removes security group
- Deletes SSH key pair
- Runs asynchronously (doesn't block API response)

## Database Schema

### New Field Added to `deployments` Table

```sql
ALTER TABLE deployments
ADD COLUMN cancelled_by_user BOOLEAN NOT NULL DEFAULT FALSE;
```

### Deployment Status Values

- `pending` - Waiting to start
- `running` - Currently deploying
- `completed` - Successfully finished
- `failed` - Error occurred
- `cancelled` - User cancelled
- `terminated` - AWS resources deleted

## Testing

### Test Cancellation

1. Start a deployment
2. While it's running, call cancel endpoint
3. Watch logs for "Deployment cancelled by user"
4. Verify status changes to 'cancelled'

### Test Deletion

1. Delete a failed deployment - should delete immediately
2. Delete a completed deployment - should trigger AWS cleanup
3. Try to delete running deployment - should return 400 error

### Test Full Workflow

1. Start deployment
2. Cancel it mid-execution
3. Verify it stops and shows 'cancelled' status
4. Delete the cancelled deployment
5. Verify it's removed from database
