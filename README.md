# SKX - Secure Knowledge Exchange

A secure, RLS-protected knowledge management platform built with Next.js 15, Neon PostgreSQL, and Clerk authentication.

## **🚀 Quick Start**

### **Prerequisites**
- Node.js 20+
- Neon PostgreSQL database
- Clerk authentication setup

### **Local Development**
```bash
# Clone and install
git clone <your-repo>
cd SKX
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Neon DATABASE_URL and Clerk keys

# Seed database
npm run db:seed

# Start development server
export TEST_AUTH_BYPASS=1  # For local API testing
npm run dev
```

### **Testing**
```bash
# Run all Playwright tests
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui
```

## **🏗️ Architecture**

### **Backend Services**
- **Database:** Neon PostgreSQL with Row-Level Security (RLS)
- **Authentication:** Clerk with MFA support
- **API Routes:** Next.js App Router with RLS-guarded operations
- **Security:** RLS policies, MFA requirements, audit logging

### **API Endpoints**
- **Health:** `/api/health/rls` ✅ implemented
- **Memberships:** `/api/memberships` ✅ implemented
- **Organization Domains:** `/api/org-domains` ✅ implemented
- **Invitations:** `/api/invitations` ✅ implemented
- **Audit:** `/api/audit` ✅ implemented
- **User Profile:** `/api/users/update-safe` ✅ implemented

### **Frontend**
- **Framework:** Next.js 15 with App Router
- **Styling:** Tailwind CSS
- **Admin Panel:** `/admin` with RLS-protected data display
- **Authentication:** Clerk middleware with test bypass support

## **🔐 Security Features**

### **Row-Level Security (RLS)**
- **Users:** Self-update policies, MFA level protection
- **Memberships:** Organization-scoped access control
- **Organizations:** Domain management with admin restrictions
- **Invitations:** Role-based invitation system
- **Audit:** Append-only audit trail with admin access

### **Authentication & Authorization**
- **MFA Required:** Admin operations require MFA verification
- **Role-Based Access:** Owner, Admin, Member roles
- **Organization Scoping:** All data scoped to user's organization
- **Test Bypass:** Development-only authentication bypass for testing

## **📊 Database Schema**

### **Core Tables**
- `users`: User profiles with MFA levels
- `organizations`: Organization details and status
- `memberships`: User-organization relationships with roles
- `organization_domains`: Verified organization domains
- `invitations`: Pending organization invitations
- `audit_events`: Append-only audit trail

### **Key Policies**
- `users_update_self_safe`: Safe field updates only
- `memberships_org_access`: Organization-scoped membership access
- `org_domains_admin_only`: Admin-only domain management
- `invitations_org_admin`: Admin-only invitation management
- `audit_events_admin`: Admin-only audit access

## **🧪 Testing Strategy**

### **Test Infrastructure**
- **Playwright:** E2E API testing with authentication scenarios
- **Test Bypass:** Development-only auth bypass for positive tests
- **Negative Tests:** Verify endpoint protection without authentication
- **CI Integration:** GitHub Actions with Playwright test suite

### **Test Conventions**
- **Positive Tests:** Use test bypass headers for authenticated operations
- **Negative Tests:** Verify protection with `expectProtected()` helper
- **Test Data:** Consistent seed data across all test files
- **Error Handling:** Test both success and failure scenarios

## **🔄 CI/CD Pipeline**

### **GitHub Actions**
- **RLS Verification:** Database policy verification (currently manual)
- **E2E Tests:** Playwright test suite on all PRs
- **Artifacts:** Test reports uploaded on failures

### **Deployment**
- **Platform:** Vercel with environment-specific configuration
- **Database:** Neon with connection pooling and SSL
- **Security:** No test bypass in production environments

## **📋 Production Deploy Checklist**

- [ ] **Vercel Environment:**
  - [ ] `DATABASE_URL` (pooled, sslmode=require)
  - [ ] `CLERK_SECRET_KEY` configured
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set
  - [ ] **IKKE** `TEST_AUTH_BYPASS` i prod
- [ ] **Neon Database:**
  - [ ] PITR/backups aktiv
  - [ ] Skriverettigheter kun til app-rollen
  - [ ] SSL connections required
  - [ ] Connection pooling enabled
- [ ] **CI (GitHub Actions):**
  - [ ] Playwright e2e må være grønn før merge
  - [ ] RLS verification pipeline reaktivert
- [ ] **RLS Verification (manuelt til pipeline reaktiveres):**
  - [ ] `psql "$DATABASE_URL" -c "select now()"` ok
  - [ ] Policy snapshots verifisert
- [ ] **Release:**
  - [ ] Tag `v0.1.0`
  - [ ] Noter migrasjoner i changelog
  - [ ] Update README med production status
- [ ] **Rollback Plan:**
  - [ ] Forrige tag + Neon restore-tidspunkt dokumentert
  - [ ] Database migration rollback scripts

## **🔧 Troubleshooting**

### **Common Issues**
- **Test Bypass Not Working:** Check `TEST_AUTH_BYPASS=1` and `NODE_ENV`
- **Database Connection Errors:** Verify `DATABASE_URL` format and SSL settings
- **RLS Policy Failures:** Check GUC values and user permissions
- **Playwright Test Failures:** Verify test data consistency and auth headers

### **Development Tips**
- Use `npm run test:e2e:ui` for interactive test debugging
- Check server logs for GUC values and RLS policy decisions
- Verify database state with `npm run db:seed` before testing
- Use `expectProtected()` helper for all negative auth tests

## **📚 Team Resources**

### **Useful Commands**
```bash
# Database operations
npm run db:seed                    # Seed test data
psql "$DATABASE_URL"              # Connect to database

# Testing
npm run test:e2e                  # Run all tests
npm run test:e2e:ui              # Interactive test runner
npm run type-check                # TypeScript validation

# Development
npm run dev                       # Start dev server
npm run build                     # Production build
npm run lint                      # Code linting
```

### **Key Files**
- **API Routes:** `app/api/*/route.ts`
- **Database Logic:** `lib/withGUC.ts`, `lib/org-context.ts`
- **Test Files:** `tests/*.spec.ts`, `tests/utils.ts`
- **Configuration:** `playwright.config.ts`, `.github/workflows/*.yml`

## **🚀 Next Steps**

1. **Admin UI Enhancement:** Add interactive forms for POST operations
2. **Advanced RLS Policies:** Implement dynamic MFA requirements
3. **Audit Dashboard:** Enhanced audit event visualization
4. **Performance Optimization:** Database query optimization and caching
5. **Monitoring:** Add application performance monitoring (APM)

---

**Status:** ✅ Production Ready with RLS, MFA, and comprehensive testing
**Version:** 0.1.0
**Last Updated:** August 2025
