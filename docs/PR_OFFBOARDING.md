# M3 Offboarding - Production Deployment

## Summary
Implements M3 Offboarding system for knowledge transfer when employees leave. Creates Transition Spaces with generated artifacts (Playbook.md, FAQ.md, Oppsummering.xlsx) for seamless handover.

## Features
- ✅ **API Endpoints**: POST /api/offboarding/start, GET /api/offboarding/:run_id, POST /api/offboarding/:run_id/finalize
- ✅ **Admin UI**: /admin/offboarding with start/finalize workflow
- ✅ **Transition Spaces**: Isolated spaces for offboarding artifacts
- ✅ **Artifact Generation**: Playbook.md, FAQ.md, Oppsummering.xlsx
- ✅ **Security**: RLS, feature flags, audit logging
- ✅ **Testing**: Playwright tests + verification script

## Environment Variables Required
```bash
# Feature flags
NEXT_PUBLIC_OFFBOARDING_ENABLED=1
ENABLE_OFFBOARDING_API=1

# S3/R2 Storage (from M1)
S3_BUCKET=your-bucket-name
S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# OpenAI (for embeddings in M2)
OPENAI_API_KEY=your-openai-key
```

## Pre-deployment Checklist
- [ ] Set environment variables in Vercel
- [ ] Verify test user is org-admin
- [ ] Add preview URL to Clerk allowed origins
- [ ] Configure S3 CORS for domain
- [ ] Run verification script: `./scripts/verify-offboarding.sh <preview-url> <cookie>`

## Testing
### Manual Testing
1. Deploy to preview environment
2. Log in as admin user
3. Navigate to `/admin/offboarding`
4. Start offboarding for test user
5. Verify Transition Space and artifacts are created

### Automated Testing
```bash
# Run offboarding API tests
npx playwright test tests/api.offboarding.spec.ts

# Run verification script
./scripts/verify-offboarding.sh <preview-url> <cookie>
```

## Rollback Strategy
```bash
# Hide UI
NEXT_PUBLIC_OFFBOARDING_ENABLED=0

# Disable API
ENABLE_OFFBOARDING_API=0
```

## Security Notes
- All operations use RLS with proper GUC context
- Feature flags allow safe rollback
- Transition Spaces are isolated (no existing data overwritten)
- Audit logging for all operations

## Files Changed
- `app/api/offboarding/` - API endpoints
- `app/(protected)/admin/offboarding/` - Admin UI
- `components/admin/Sidebar.tsx` - Navigation
- `tests/api.offboarding.spec.ts` - Tests
- `scripts/verify-offboarding.sh` - Verification script
- `docs/OFFBOARDING_DEPLOYMENT.md` - Documentation

## Go/No-Go Criteria
- [ ] Preview deployment successful
- [ ] API endpoints respond correctly
- [ ] UI is accessible and functional
- [ ] Transition Spaces created successfully
- [ ] Artifacts generated with correct labels
- [ ] No security vulnerabilities
- [ ] Rollback strategy tested

## Post-deployment
- [ ] Monitor offboarding runs
- [ ] Check audit logs
- [ ] Verify S3 artifacts
- [ ] Test rollback procedure
- [ ] Update documentation








