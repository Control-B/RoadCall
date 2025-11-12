# CI/CD Quick Reference Guide

## Common Commands

### Local Development
```bash
# Run all checks before pushing
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# Run E2E tests locally
cd tests/e2e && pnpm test

# Run smoke tests
export API_URL=https://api.dev.roadcall.example.com
bash tests/smoke/smoke-tests.sh
```

### Deployment

#### Deploy to Development
```bash
git checkout develop
git pull origin develop
git merge feature/my-feature
git push origin develop
# Automatic deployment triggered
```

#### Deploy to Staging
```bash
git checkout -b release/v1.0.0
git push origin release/v1.0.0
# Wait for CI to pass
# Approve deployment in GitHub
```

#### Deploy to Production
```bash
git checkout main
git merge release/v1.0.0
git push origin main
# Wait for CI to pass
# Get 2 approvals in GitHub
```

### Rollback

#### Automatic Rollback
- Happens automatically if smoke tests fail
- No action needed

#### Manual Rollback
```bash
# Option 1: Revert commit
git revert HEAD
git push origin main

# Option 2: GitHub Actions
# Go to Actions → Deploy → Run workflow
# Select previous commit SHA
```

## Branch Strategy

| Branch | Environment | Approval | Tests |
|--------|-------------|----------|-------|
| `feature/*` | None | N/A | CI only |
| `develop` | Dev | None | Smoke |
| `release/*` | Staging | 1 reviewer | Integration + E2E + Smoke |
| `main` | Production | 2 reviewers | Smoke + Health |

## Workflow Status

### Check Workflow Status
1. Go to repository → Actions
2. Select workflow (CI or Deploy)
3. View recent runs

### View Logs
1. Click on workflow run
2. Click on job name
3. Expand steps to see logs

### Download Artifacts
1. Go to workflow run
2. Scroll to "Artifacts" section
3. Download test reports or coverage

## Notifications

### Slack
- Channel: `#deployments`
- Notifications for all workflows
- Success/failure status
- Links to workflow runs

### Email
- Sent on failures only
- Includes error details
- Links to logs

## Troubleshooting

### CI Failing

**Lint errors:**
```bash
pnpm lint --fix
```

**Type errors:**
```bash
pnpm typecheck
# Fix errors in reported files
```

**Test failures:**
```bash
pnpm test
# Fix failing tests
```

### Deployment Failing

**Check CloudFormation:**
1. Go to AWS Console → CloudFormation
2. Find stack: `RoadcallAssistant-{env}`
3. Check Events tab for errors

**Check Logs:**
1. Go to workflow run in GitHub
2. Click on failed job
3. Review error messages

**Manual Deploy:**
```bash
cd infrastructure
pnpm cdk deploy --all
```

### Tests Failing

**E2E tests:**
```bash
cd tests/e2e
pnpm test --debug
# Review test output
```

**Smoke tests:**
```bash
export API_URL=https://api.staging.roadcall.example.com
bash tests/smoke/smoke-tests.sh
```

## Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ROLE_ARN` | IAM role for deployment | `arn:aws:iam::123456789012:role/GitHubActionsDeployRole` |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | `https://hooks.slack.com/services/...` |
| `NOTIFICATION_EMAIL` | Email for failure alerts | `team@example.com` |
| `SMTP_SERVER` | SMTP server address | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP username | `notifications@example.com` |
| `SMTP_PASSWORD` | SMTP password | `***` |

## Approval Process

### Staging Approval
1. Reviewer checks:
   - CI passed
   - Integration tests passed
   - E2E tests passed
2. Review deployment plan
3. Approve in GitHub Environments

### Production Approval
1. Two reviewers check:
   - Staging deployment successful
   - All tests passed
   - No critical issues
2. Review deployment plan
3. Both approve in GitHub Environments

## Monitoring

### GitHub Actions
- **URL**: `https://github.com/{org}/{repo}/actions`
- **View**: Workflow runs, logs, artifacts

### AWS CloudWatch
- **URL**: AWS Console → CloudWatch
- **View**: Logs, metrics, dashboards

### Slack
- **Channel**: `#deployments`
- **View**: Real-time notifications

## Best Practices

### Before Pushing
- [ ] Run lint: `pnpm lint`
- [ ] Run type check: `pnpm typecheck`
- [ ] Run tests: `pnpm test`
- [ ] Run build: `pnpm build`

### Before Merging PR
- [ ] CI passed
- [ ] Code reviewed
- [ ] Tests added for new features
- [ ] Documentation updated

### Before Production Deploy
- [ ] Staging deployment successful
- [ ] All tests passed
- [ ] No critical bugs
- [ ] Team notified
- [ ] Monitoring ready

## Emergency Procedures

### Critical Bug in Production
1. Create hotfix branch from `main`
2. Fix bug and test locally
3. Push to hotfix branch
4. Create PR to `main`
5. Get emergency approval (1 reviewer)
6. Merge and deploy

### Service Outage
1. Check AWS Console for issues
2. Review CloudWatch logs
3. Check recent deployments
4. Rollback if needed
5. Notify team in Slack

### Rollback Production
```bash
# Immediate rollback
git revert HEAD
git push origin main

# Or use GitHub Actions
# Actions → Deploy → Run workflow
# Select previous working commit
```

## Support

### Documentation
- Setup Guide: `.github/SETUP.md`
- E2E Tests: `tests/e2e/README.md`
- Full Pipeline Docs: `docs/CI-CD-PIPELINE.md`

### Contacts
- DevOps Team: `#devops` on Slack
- On-Call: Check PagerDuty
- Emergency: Call on-call engineer

### Resources
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [AWS CDK Docs](https://docs.aws.amazon.com/cdk/)
- [Playwright Docs](https://playwright.dev/)
