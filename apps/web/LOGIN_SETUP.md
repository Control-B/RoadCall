# Login Setup Guide

## Current Status

✅ **Working Now**: Email/Password login with demo accounts  
🚧 **Coming Soon**: Social login (Microsoft, Google, Apple, Amazon)

## Demo Accounts

You can now sign in with these test accounts:

| Email | Password | Role | Dashboard |
|-------|----------|------|-----------|
| `driver@roadcall.com` | `demo123` | Driver | `/driver` |
| `vendor@roadcall.com` | `demo123` | Vendor | `/vendor` |
| `dispatcher@roadcall.com` | `demo123` | Dispatcher | `/dispatcher` |
| `admin@roadcall.com` | `demo123` | Admin | `/admin` |

## How to Use

1. Navigate to `/auth/login`
2. Enter one of the demo emails and password `demo123`
3. Click "Sign In"
4. You'll be redirected to the appropriate dashboard based on your role

## Social Login Setup (For Production)

### 1. Configure AWS Cognito

```bash
# Set environment variables in .env.local
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxx
NEXT_PUBLIC_AWS_REGION=us-east-1
```

### 2. Add Identity Providers to Cognito

#### Microsoft (Azure AD)
1. Go to Azure Portal → App Registrations
2. Create new app registration
3. Add redirect URI: `https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
4. Copy Client ID and Client Secret
5. In Cognito → Identity Providers → Add Microsoft
6. Enter Client ID and Secret

#### Google
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
4. Copy Client ID and Client Secret
5. In Cognito → Identity Providers → Add Google
6. Enter Client ID and Secret

#### Apple
1. Go to Apple Developer → Certificates, IDs & Profiles
2. Create new Services ID
3. Configure Sign in with Apple
4. Add return URL: `https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
5. In Cognito → Identity Providers → Add Apple
6. Enter Services ID, Team ID, Key ID, and Private Key

#### Amazon
1. Go to Amazon Developer Console → Login with Amazon
2. Create new Security Profile
3. Add Allowed Return URL: `https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
4. Copy Client ID and Client Secret
5. In Cognito → Identity Providers → Add Amazon
6. Enter Client ID and Secret

### 3. Update Cognito App Client

```bash
# In AWS Console → Cognito → App Integration → App Client
# Enable these OAuth flows:
- Authorization code grant
- Implicit grant

# Enable these OAuth scopes:
- openid
- email
- phone
- profile

# Add callback URLs:
- http://localhost:3000/auth/callback (development)
- https://your-domain.com/auth/callback (production)

# Add sign-out URLs:
- http://localhost:3000 (development)
- https://your-domain.com (production)
```

### 4. Deploy Infrastructure

The Cognito User Pool is defined in your CDK infrastructure:

```bash
cd infrastructure
pnpm run deploy
```

This will create:
- Cognito User Pool
- App Client with OAuth configuration
- Identity Providers (if configured)
- Custom domain for hosted UI

## Current Implementation

### Login Flow (Email/Password)

```
User enters credentials
    ↓
POST /api/auth/login
    ↓
Validate against mock database
    ↓
Generate JWT token
    ↓
Store in localStorage
    ↓
Redirect to role-based dashboard
```

### Social Login Flow (When Cognito is configured)

```
User clicks social provider button
    ↓
Redirect to Cognito Hosted UI
    ↓
User authenticates with provider
    ↓
Provider redirects to Cognito
    ↓
Cognito redirects to /auth/callback
    ↓
Exchange code for tokens
    ↓
Store tokens securely
    ↓
Redirect to dashboard
```

## Security Notes

⚠️ **Current Implementation is for Development Only**

The current mock authentication:
- Stores tokens in localStorage (not secure for production)
- Uses simple base64 encoding (not real JWT)
- Has hardcoded demo accounts

**For Production:**
- Use AWS Cognito with proper JWT tokens
- Store tokens in httpOnly cookies
- Implement proper session management
- Add CSRF protection
- Enable MFA for sensitive accounts
- Use secure password hashing (bcrypt/argon2)

## Next Steps

1. ✅ Test login with demo accounts
2. ⬜ Deploy Cognito infrastructure (Task 4)
3. ⬜ Configure social identity providers (Task 29.1)
4. ⬜ Implement proper JWT validation
5. ⬜ Add refresh token flow
6. ⬜ Implement logout functionality
7. ⬜ Add password reset flow
8. ⬜ Enable MFA

## Troubleshooting

### "Nothing happens when I click Sign In"

**Solution**: The API route is now created. Make sure:
1. The Next.js dev server is running: `pnpm dev`
2. Check browser console for errors
3. Try with demo account: `driver@roadcall.com` / `demo123`

### "Invalid credentials" error

**Solution**: Use one of the demo accounts listed above

### Social login buttons don't work

**Expected**: Social login requires Cognito configuration. For now, use email/password.

## Files Modified

- ✅ `apps/web/app/auth/login/page.tsx` - Enhanced login UI
- ✅ `apps/web/app/api/auth/login/route.ts` - Mock auth API
- ✅ `apps/web/components/ui/separator.tsx` - UI component

## Testing

```bash
# Start the dev server
cd apps/web
pnpm dev

# Navigate to http://localhost:3000/auth/login
# Try logging in with: driver@roadcall.com / demo123
```

---

**Ready to test!** The login page now works with email/password. Social login will be enabled once Cognito is configured.
