# GitHub Actions CI/CD Setup Guide

This document provides instructions for setting up the CI/CD pipeline for the AI Roadcall Assistant platform.

## Prerequisites

1. AWS Account with appropriate permissions
2. GitHub repository with admin access
3. Slack workspace (optional, for notifications)
4. SMTP server credentials (optional, for email notifications)

## Required GitHub Secrets

Configure the following secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### AWS Configuration

- `AWS_ROLE_ARN`: ARN of the IAM role for OIDC authentication
  - Example: `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`
  - This role should have permissions to deploy CDK stacks

### Notification Configuration (Optional)

- `SLACK_WEBHOOK_URL`: Slack webhook URL for deployment notifications
  - Create at: https://api.slack.com/messaging/webhooks
  
- `NOTIFICATION_EMAIL`: Email address for failure notifications
- `SMTP_SERVER`: SMTP server address (e.g., `smtp.gmail.com`)
- `SMTP_PORT`: SMTP server port (e.g., `587`)
- `SMTP_USERNAME`: SMTP authentication username
- `SMTP_PASSWORD`: SMTP authentication password

## AWS OIDC Setup

To enable GitHub Actions to authenticate with AWS without storing credentials:

### 1. Create OIDC Identity Provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create IAM Role

Create a file `github-actions-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
        }
      }
    }
  ]
}
```

Create the role:

```bash
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://github-actions-trust-policy.json
```

### 3. Attach Policies

Attach necessary policies for CDK deployment:

```bash
# Administrator access (for initial setup - restrict in production)
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Or create a custom policy with minimal permissions
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/CDKDeploymentPolicy
```

### 4. Get Role ARN

```bash
aws iam get-role --role-name GitHubActionsDeployRole --query 'Role.Arn' --output text
```

Add this ARN to GitHub Secrets as `AWS_ROLE_ARN`.

## GitHub Environments

Configure the following environments in your repository (Settings → Environments):

### 1. Development (dev)
- No protection rules
- Automatically deploys on push to `develop` branch

### 2. Staging
- Require reviewers: 1 reviewer
- Automatically deploys on push to `release/*` branches

### 3. Production
- Require reviewers: 2 reviewers
- Deployment branch: `main` only
- Automatically deploys on push to `main` branch

## Workflow Files

The CI/CD pipeline consists of three workflows:

### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every pull request and push to main/develop:
- Linting
- Type checking
- Unit tests
- Build verification

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

Handles deployments to different environments:
- Determines target environment based on branch
- Deploys infrastructure using CDK
- Runs smoke tests
- Handles rollback on failure

### 3. Notifications Workflow (`.github/workflows/notify.yml`)

Sends notifications on workflow completion:
- Slack notifications for all workflows
- Email notifications for failures

## Branch Strategy

- `main`: Production environment
- `develop`: Development environment
- `release/*`: Staging environment
- Feature branches: Run CI only (no deployment)

## Testing Strategy

### Unit Tests
- Run on every PR and push
- Must pass before merge
- Coverage reports uploaded to Codecov

### Integration Tests
- Run on staging deployments
- Test service-to-service interactions

### E2E Tests
- Run on staging deployments
- Test complete user flows
- Use Playwright for browser automation

### Smoke Tests
- Run after every deployment
- Verify basic functionality
- Fast execution (<2 minutes)

## Deployment Process

### Development Deployment
1. Push to `develop` branch
2. CI workflow runs
3. If CI passes, deploy workflow triggers
4. Infrastructure deployed to dev environment
5. Smoke tests run
6. Slack notification sent

### Staging Deployment
1. Create release branch: `release/v1.0.0`
2. Push to release branch
3. CI workflow runs
4. If CI passes, deploy workflow triggers
5. Infrastructure deployed to staging
6. Integration and E2E tests run
7. Manual approval required (1 reviewer)
8. Slack notification sent

### Production Deployment
1. Merge to `main` branch
2. CI workflow runs
3. If CI passes, deploy workflow triggers
4. Manual approval required (2 reviewers)
5. Infrastructure deployed to production
6. Smoke tests run
7. Health check verification
8. Slack notification sent

## Rollback Process

If deployment fails:
1. Automatic rollback triggered
2. Previous version checked out
3. Infrastructure redeployed
4. Team notified via Slack and email

Manual rollback:
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or use GitHub Actions workflow_dispatch
# Go to Actions → Deploy → Run workflow
# Select previous commit SHA
```

## Monitoring Deployments

### GitHub Actions UI
- View workflow runs: Repository → Actions
- Check logs for each job
- Download artifacts (test reports, coverage)

### AWS Console
- CloudFormation: View stack status
- CloudWatch: View logs and metrics
- X-Ray: View traces

### Slack Notifications
- Real-time deployment status
- Links to workflow runs
- Failure alerts with details

## Troubleshooting

### Authentication Failures

If you see "Error: Could not assume role":
1. Verify `AWS_ROLE_ARN` secret is correct
2. Check OIDC provider is configured
3. Verify trust policy allows your repository
4. Check role has necessary permissions

### Deployment Failures

If CDK deployment fails:
1. Check CloudFormation events in AWS Console
2. Review workflow logs for error messages
3. Verify AWS service quotas
4. Check for resource conflicts

### Test Failures

If tests fail:
1. Review test logs in workflow output
2. Check if environment variables are set
3. Verify API endpoints are accessible
4. Run tests locally to reproduce

### Notification Issues

If notifications aren't working:
1. Verify webhook URLs are correct
2. Check secret names match workflow files
3. Test webhooks manually
4. Review workflow logs for errors

## Best Practices

1. **Always run CI locally before pushing**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

2. **Use feature branches for development**
   - Create branch: `feature/my-feature`
   - Open PR to `develop`
   - Merge after CI passes and review

3. **Tag releases**
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

4. **Monitor deployments**
   - Watch Slack notifications
   - Check CloudWatch dashboards
   - Review X-Ray traces

5. **Keep secrets secure**
   - Never commit secrets to repository
   - Rotate secrets regularly
   - Use AWS Secrets Manager for application secrets

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [OIDC with GitHub Actions](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [Playwright Documentation](https://playwright.dev/)
