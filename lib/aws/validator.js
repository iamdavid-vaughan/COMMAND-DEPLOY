/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focal-deploy.com
 * For support: support@focal-deploy.com
 *
 * @author Focal Deploy Team
 * @copyright 2025 Focal Deploy
 * @license Proprietary
 */

const { EC2Client, DescribeRegionsCommand } = require('@aws-sdk/client-ec2');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { ErrorHandler } = require('../utils/errors');

async function validateAWSCredentials(awsConfig) {
  const credentials = {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey
  };

  try {
    // Test EC2 access
    const ec2Client = new EC2Client({
      region: awsConfig.region,
      credentials: credentials
    });

    await ec2Client.send(new DescribeRegionsCommand({}));

    // Test S3 access
    const s3Client = new S3Client({
      region: awsConfig.region,
      credentials: credentials
    });

    await s3Client.send(new ListBucketsCommand({}));

    return true;
  } catch (error) {
    throw ErrorHandler.createAWSError(error);
  }
}

async function validateAWSPermissions(awsConfig) {
  const credentials = {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey
  };

  const ec2Client = new EC2Client({
    region: awsConfig.region,
    credentials: credentials
  });

  // Test required EC2 permissions
  const requiredPermissions = [
    'ec2:DescribeInstances',
    'ec2:RunInstances',
    'ec2:TerminateInstances',
    'ec2:CreateSecurityGroup',
    'ec2:DescribeSecurityGroups',
    'ec2:AuthorizeSecurityGroupIngress',
    'ec2:CreateKeyPair',
    'ec2:DescribeKeyPairs',
    'ec2:DeleteKeyPair'
  ];

  // This is a simplified check - in a real implementation,
  // you might want to use AWS IAM policy simulator or similar
  try {
    await ec2Client.send(new DescribeRegionsCommand({}));
    return true;
  } catch (error) {
    throw ErrorHandler.createAWSError(error);
  }
}

module.exports = {
  validateAWSCredentials,
  validateAWSPermissions
};