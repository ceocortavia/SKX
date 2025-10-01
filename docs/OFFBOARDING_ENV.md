# Offboarding - Miljøvariabler

Guide for miljøkonfigurasjon av offboarding-funksjonen.

## 📋 Produksjon (Vercel)

### Required

```bash
# Feature toggles
ENABLE_OFFBOARDING_API=1
NEXT_PUBLIC_OFFBOARDING_ENABLED=1

# Storage mode (set to 0 when S3 is configured)
ENABLE_DB_ONLY_ARTIFACTS=1

# Brreg mode
BRREG_MODE=open
```

### Security

```bash
# QA bypass (MUST be 0 in production)
ENABLE_QA_BYPASS=0

# Clerk authentication (already configured)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-key>
CLERK_SECRET_KEY=<your-secret>
```

### Database

```bash
# Neon database (already configured)
DATABASE_URL=<pooled-connection>
DATABASE_URL_UNPOOLED=<direct-connection>
```

### Optional: S3 for artifacts (when ready)

```bash
# AWS S3 configuration
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
S3_BUCKET=<bucket-name>
S3_REGION=<region>

# Switch to S3 mode
ENABLE_DB_ONLY_ARTIFACTS=0
```

## 🧪 Preview/Testing (Vercel Preview)

Same as production, but add:

```bash
# Enable QA bypass for automated tests
ENABLE_QA_BYPASS=1
TEST_BYPASS_SECRET=<secure-random-string>
```

## 💻 Local Development

```bash
# Copy .env.example to .env.local
cp .env.example .env.local

# Add offboarding flags
ENABLE_OFFBOARDING_API=1
NEXT_PUBLIC_OFFBOARDING_ENABLED=1
ENABLE_DB_ONLY_ARTIFACTS=1

# Test bypass for Playwright
TEST_AUTH_BYPASS=1
ENABLE_QA_BYPASS=1
TEST_BYPASS_SECRET=test-secret-123
```

## 🔄 Rollback

Om du trenger å skru av offboarding raskt:

```bash
# Option 1: Disable API (keeps UI visible but non-functional)
ENABLE_OFFBOARDING_API=0

# Option 2: Disable everything
ENABLE_OFFBOARDING_API=0
NEXT_PUBLIC_OFFBOARDING_ENABLED=0
```

Redeploy etter endring.

## 🚀 Overgangen til S3

Når du er klar for S3:

1. **Opprett S3 bucket**
   ```bash
   aws s3 mb s3://skx-offboarding-artifacts --region eu-north-1
   ```

2. **Sett CORS policy** (kun dine domener)
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedOrigins": ["https://skx.no", "https://*.vercel.app"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

3. **Oppdater env i Vercel**
   ```bash
   AWS_ACCESS_KEY_ID=<key>
   AWS_SECRET_ACCESS_KEY=<secret>
   S3_BUCKET=skx-offboarding-artifacts
   S3_REGION=eu-north-1
   ENABLE_DB_ONLY_ARTIFACTS=0
   ```

4. **Backfill eksisterende artifacts** (optional)
   ```bash
   # Run migration script to move DB-only artifacts to S3
   node scripts/backfill-s3-artifacts.mjs
   ```

## 📊 Verifisering

Sjekk at alt fungerer:

```bash
# Diagnostics endpoint
curl https://skx.no/api/diag/offboarding | jq .

# Expected output:
# {
#   "ok": true,
#   "mode": "db-only",  # or "s3"
#   "flags": {
#     "api_enabled": true,
#     "ui_enabled": true,
#     "db_only": true  # or false when S3 is enabled
#   }
# }
```

## ⚠️ Viktige notater

- **QA bypass**: ALLTID av (`0`) i produksjon
- **DB-only mode**: OK for MVP, men planlegg S3-overgang
- **Feature toggle**: Kan skrus av/på uten kodendringer
- **Rollback**: Sett `ENABLE_OFFBOARDING_API=0` og redeploy

