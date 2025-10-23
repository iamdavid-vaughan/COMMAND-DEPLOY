const chalk = require('chalk');

class FocalDeployError extends Error {
  constructor(message, suggestion = '', code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'FocalDeployError';
    this.code = code;
    this.suggestion = suggestion;
  }
}

class ErrorHandler {
  static handle(error) {
    if (error instanceof FocalDeployError) {
      console.error(chalk.red('\n❌ Error: ') + error.message);
      
      if (error.suggestion) {
        console.log(chalk.yellow('\n💡 Suggestion: ') + error.suggestion);
      }
      
      if (error.suggestions && error.suggestions.length > 0) {
        console.log(chalk.yellow('\n💡 Suggestions:'));
        error.suggestions.forEach((suggestion, index) => {
          console.log(chalk.yellow(`   ${index + 1}. ${suggestion}`));
        });
      }
      
      console.log(chalk.gray('\nError Code:'), error.code);
    } else {
      console.error(chalk.red('\n❌ Unexpected Error: ') + (error?.message || error));
      console.log(chalk.gray('Stack trace:'), error?.stack || 'No stack trace available');
    }
    
    console.log(chalk.cyan('\n📖 For help, visit: https://github.com/focal-deploy/focal-deploy/wiki'));
  }

  static createAWSError(originalError) {
    const awsErrorMessages = {
      'InvalidUserID.NotFound': {
        message: 'Your AWS credentials are invalid or expired.',
        suggestions: [
          'Check that your Access Key ID and Secret Access Key are correct',
          'Verify your AWS account is active and not suspended',
          'Try creating new credentials in the AWS IAM console'
        ]
      },
      'UnauthorizedOperation': {
        message: 'Your AWS account doesn\'t have permission to perform this action.',
        suggestions: [
          'Make sure your AWS user has EC2 and S3 permissions',
          'Check if your account has the required IAM policies attached',
          'Contact your AWS administrator for proper permissions'
        ]
      },
      'InvalidKeyPair.NotFound': {
        message: 'The SSH key pair was not found in your AWS account.',
        suggestions: [
          'Run "focal-deploy init" to regenerate SSH keys',
          'Check if you\'re using the correct AWS region',
          'Verify the key pair exists in the AWS EC2 console'
        ]
      },
      'InvalidGroup.NotFound': {
        message: 'The security group was not found.',
        suggestions: [
          'Run "focal-deploy init" to recreate security groups',
          'Check if you\'re deploying to the correct AWS region',
          'Verify security groups exist in the AWS EC2 console'
        ]
      },
      'BucketAlreadyExists': {
        message: 'An S3 bucket with this name already exists.',
        suggestions: [
          'S3 bucket names must be globally unique',
          'Try using a different project name',
          'Add a random suffix to make the bucket name unique'
        ]
      }
    };

    const errorCode = originalError.Code || originalError.name || 'AWS_ERROR';
    const errorInfo = awsErrorMessages[errorCode];

    if (errorInfo) {
      return new FocalDeployError(
        errorInfo.message,
        errorCode,
        errorInfo.suggestions
      );
    }

    // Generic AWS error
    return new FocalDeployError(
      `AWS service error: ${originalError.message}`,
      errorCode,
      [
        'Check your internet connection',
        'Verify your AWS credentials are valid',
        'Try again in a few minutes'
      ]
    );
  }

  static createValidationError(field, value, requirements) {
    return new FocalDeployError(
      `Invalid ${field}: ${value}`,
      'VALIDATION_ERROR',
      requirements
    );
  }

  static createConfigError(message, suggestions = []) {
    return new FocalDeployError(
      message,
      'CONFIG_ERROR',
      suggestions
    );
  }
}

module.exports = { FocalDeployError, ErrorHandler };