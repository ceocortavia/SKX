# M3 Offboarding - Deployment Guide

## Feature Overview

M3 Offboarding implementerer kunnskapsoverføring ved avslutning av ansatte. Systemet:

- Finner kandidatfiler (personal spaces + opt-in delte filer)
- Oppretter Transition Space for overføring
- Genererer artefakter: Playbook.md, FAQ.md, Oppsummering.xlsx
- Logger alle steg for audit

## Environment Variables

### Required for Production
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

### Optional
```bash
# Disable in production if needed
NEXT_PUBLIC_OFFBOARDING_ENABLED=0  # Hides UI
ENABLE_OFFBOARDING_API=0           # Disables API endpoints
```

## API Endpoints

### POST /api/offboarding/start
Starter offboarding-prosess for en bruker.

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "run_id": "uuid",
  "status": "processing",
  "candidate_files": [...],
  "created_at": "2025-01-27T..."
}
```

### GET /api/offboarding/{run_id}
Henter status og detaljer for en offboarding-run.

**Response:**
```json
{
  "run_id": "uuid",
  "user_id": "uuid",
  "user_email": "user@example.com",
  "status": "processing",
  "candidate_files": [...],
  "transition_space": {...},
  "artifacts": {...}
}
```

### POST /api/offboarding/{run_id}/finalize
Fullfører offboarding og oppretter Transition Space med artefakter.

**Response:**
```json
{
  "run_id": "uuid",
  "status": "completed",
  "transition_space": {
    "id": "uuid",
    "name": "Transition-user@example.com-2025-01-27"
  },
  "artifacts": [
    {
      "id": "uuid",
      "name": "Playbook.md"
    },
    {
      "id": "uuid", 
      "name": "FAQ.md"
    },
    {
      "id": "uuid",
      "name": "Oppsummering.xlsx"
    }
  ]
}
```

## Database Schema

### offboarding_runs
```sql
CREATE TABLE public.offboarding_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  started_by uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### RLS Policies
- `offboarding_org_rls`: Users can only access runs from their organization

## Testing

### Manual Testing
1. Deploy to preview environment
2. Log in as admin user
3. Navigate to `/admin/offboarding`
4. Start offboarding for a test user
5. Verify Transition Space and artifacts are created

### Automated Testing

#### Playwright Tests (Lokalt)
```bash
# Run offboarding API tests
npx playwright test tests/api.offboarding.spec.ts
```

#### CI Smoke Test (Preview Deploys)

For automatisk testing mot preview-deploys, aktiver GitHub Actions workflow:

**Workflow:** `.github/workflows/offboarding-smoke.yml`

For å aktivere:
1. Rediger `.github/workflows/offboarding-smoke.yml`
2. Uncommenter `on:` seksjonen
3. Sett `PREVIEW_URL` (fra Vercel preview action)
4. Legg til `TEST_USER_ID` secret i GitHub repo settings

Workflowen kjører automatisk:
- Ved PR som endrer offboarding-kode
- Logger inn via test bypass/Playwright
- Kjører smoke-test scriptet
- Verifiserer database-tilstand
- Sjekker diagnostics endpoint

**Eksempel output i Actions:**
```
[1/6] Starting offboarding run... ✓
[2/6] Fetching run details... ✓
[3/6] Finalizing run... ✓
[4/6] Testing search... ✓
[5/6] Verifying database... ✓
[6/6] Test Summary ✓ All smoke tests passed!
```

### Smoke Test Script

Bruk det ferdiglagde smoke-test scriptet for end-to-end testing:

```bash
# Get session cookie from browser (DevTools → Application → Cookies)
# Get user_id from Neon or test fixtures

./scripts/smoke-test-offboarding.sh \
  https://your-preview.vercel.app \
  "__session=abc123..." \
  "550e8400-e29b-41d4-a716-446655440000"
```

Scriptet kjører automatisk gjennom hele flyten:
1. ✓ Start offboarding
2. ✓ Hent run details
3. ✓ Finalize (lager Transition Space + artefakter)
4. ✓ Test søk i Transition Space
5. ✓ Verifiser database (hvis `DATABASE_URL` er satt)
6. ✓ Generer SQL-queries for manuell verifisering

**Output eksempel:**
```
========================================
  Offboarding Smoke Test
========================================

[1/6] Starting offboarding run...
✓ Run started
  Run ID: abc-123-def
  Status: processing
  Candidate files: 5

[2/6] Fetching run details...
✓ Run details fetched
  User: test@example.com

[3/6] Finalizing run...
✓ Run finalized
  Status: completed
  Mode: db-only
  Space: Transition-test@example.com-2025-01-27
  Artifacts: 3

[4/6] Testing search in Transition Space...
✓ Search successful
  Hits: 3

[5/6] Verifying database state...
✓ Database verified
  Files with storage_key: 3
  Artifact chunks indexed: 3

✓ All smoke tests passed!
```

### cURL Testing (Manual)

For manuell testing med curl:

```bash
BASE="https://your-preview-url"
COOKIE="your-session-cookie"

# Start offboarding
RUN=$(curl -sS -X POST "$BASE/api/offboarding/start" \
  -H "content-type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"user_id":"test-user-uuid"}' | jq -r .run_id)

# Check status
curl -sS "$BASE/api/offboarding/$RUN" -H "Cookie: $COOKIE" | jq .

# Finalize
curl -sS -X POST "$BASE/api/offboarding/$RUN/finalize" -H "Cookie: $COOKIE" | jq .
```

## Security Considerations

### RLS (Row Level Security)
- All database operations use `withGUC` for proper RLS context
- Users can only access their organization's data
- Offboarding runs are scoped to organization

### API Security
- Endpoints require authentication (Clerk)
- Feature flags allow disabling without code changes
- Audit logging for all operations

### Data Privacy
- Personal files are only included if explicitly opted-in
- Transition Space is created per offboarding (isolated)
- No existing data is overwritten

## Rollback Strategy

### Immediate Rollback
```bash
# Hide UI
NEXT_PUBLIC_OFFBOARDING_ENABLED=0

# Disable API
ENABLE_OFFBOARDING_API=0
```

### Data Cleanup (if needed)
```sql
-- Remove test runs (be careful in production!)
DELETE FROM public.offboarding_runs WHERE status = 'collecting';

-- Remove test transition spaces
DELETE FROM public.spaces WHERE type = 'transition' AND name LIKE 'Transition-test%';
```

## Monitoring

### Diagnostics Endpoint

Bruk `/api/_diag/offboarding` for sanntids-metrikker:

```bash
curl https://your-app.vercel.app/api/_diag/offboarding | jq .
```

**Eksempel respons:**
```json
{
  "ok": true,
  "ts": "2025-01-27T12:00:00.000Z",
  "stats": {
    "last_24h": {
      "total": 12,
      "completed": 10,
      "processing": 1,
      "failed": 1,
      "avg_completion_ms": 1850
    },
    "all_time": {
      "transition_spaces": 45,
      "artifact_files": 135
    }
  },
  "recent_runs": [
    {
      "id": "abc-123",
      "status": "completed",
      "created_at": "2025-01-27T11:00:00Z",
      "duration_ms": 1823,
      "candidate_files": 8,
      "artifacts": 3
    }
  ],
  "mode": "db-only",
  "flags": {
    "api_enabled": true,
    "ui_enabled": true,
    "db_only": true
  }
}
```

**Nøkkelverdier å overvåke:**
- `avg_completion_ms` < 3000ms (ideelt < 2000ms)
- `failed` runs bør være 0
- `processing` runs som ikke fullfører kan indikere stuck jobs

### Key Metrics
- Offboarding runs started/completed
- Transition spaces created
- Artifacts generated
- API response times
- Error rates per endpoint

### Audit Trail
All operations are logged in `public.audit` table:
- `offboarding_started`
- `offboarding_completed`

Vis audit-logg for offboarding:
```sql
SELECT created_at, user_id, action, target_type, target_id
FROM public.audit
WHERE action LIKE 'offboarding%'
ORDER BY created_at DESC
LIMIT 50;
```

## Troubleshooting

### Common Issues

**404 on /admin/offboarding**
- Check `NEXT_PUBLIC_OFFBOARDING_ENABLED=1`
- Verify admin layout is deployed

**403 on API endpoints**
- Check `ENABLE_OFFBOARDING_API=1`
- Verify authentication headers

**Database errors**
- Check RLS policies
- Verify GUC context is set correctly

**Missing candidate files**
- Ensure user has personal space
- Check file labels for `offboarding_include`

## Storage Architecture

### DB-Only Mode (Current Implementation)

Systemet bruker for øyeblikket DB-only modus hvor artefakter lagres direkte i databasen uten S3/R2 avhengighet.

#### Storage Key Pattern
Alle artefakter får en unik `storage_key` selv om de ikke lagres i S3:
```
transition/{space_id}/{artifact_key}-{timestamp}
```

Eksempel:
```
transition/550e8400-e29b-41d4-a716-446655440000/playbook-1738012800000
```

**Hvorfor?** Dette gjør migrering til S3 enkel senere – filen har allerede en nøkkel som kan brukes direkte som S3 object key.

#### File Index Structure

Hver artefakt indekseres i `public.file_index` med følgende struktur:

```sql
INSERT INTO public.file_index (file_id, chunk_id, page, md)
VALUES (
  'uuid-of-file',
  'artifact-playbook',  -- Chunk ID følger pattern: artifact-{artifact_key}
  NULL,                 -- Page er NULL for artefakter
  '{
    "text": "...fullt innhold...",
    "type": "artifact",
    "artifact_type": "playbook"
  }'::jsonb
);
```

**Chunk ID Pattern:**
- `artifact-playbook` → Playbook.md
- `artifact-faq` → FAQ.md  
- `artifact-summary` → Oppsummering.csv

Dette gjør at artefakter er søkbare via `/api/files/search` umiddelbart etter finalize.

#### Verification Queries

Bekreft storage_key er satt korrekt:
```sql
SELECT id, name, storage_key, bytes
FROM public.files 
WHERE storage_key LIKE 'transition/%'
ORDER BY created_at DESC 
LIMIT 10;
```

Bekreft file_index inneholder artefakter:
```sql
SELECT f.name, fi.chunk_id, fi.md->>'type', fi.md->>'artifact_type'
FROM public.file_index fi
JOIN public.files f ON f.id = fi.file_id
WHERE fi.chunk_id LIKE 'artifact-%'
ORDER BY f.created_at DESC
LIMIT 10;
```

Verifiser Transition Space:
```sql
SELECT s.id, s.name, s.type, s.owner_user_id, COUNT(f.id) as file_count
FROM public.spaces s
LEFT JOIN public.files f ON f.space_id = s.id
WHERE s.type = 'transition'
GROUP BY s.id
ORDER BY s.created_at DESC
LIMIT 5;
```

### Migration Path to S3

Når S3 er klar:

1. **Sett miljøvariabel:**
   ```bash
   ENABLE_DB_ONLY_ARTIFACTS=0
   ```

2. **Implementer S3 upload** (allerede har `storage_key`):
   ```typescript
   await s3.putObject({
     Bucket: process.env.S3_BUCKET,
     Key: storageKey,  // Bruker eksisterende storage_key
     Body: artifact.content,
     ContentType: artifact.mime,
   });
   ```

3. **Valgfritt: Re-indeksér eksisterende artefakter** (hvis ønskelig):
   ```sql
   -- Finn alle DB-only artefakter
   SELECT f.id, f.storage_key, fi.md->>'text' as content
   FROM public.files f
   JOIN public.file_index fi ON fi.file_id = f.id
   WHERE f.storage_key LIKE 'transition/%'
     AND fi.chunk_id LIKE 'artifact-%';
   ```

## Future Enhancements

### Quick Wins
- [ ] **90-day auto-cleanup cron**: Arkiver/slett Transition Spaces eldre enn 90 dager (Vercel Cron)
- [ ] **Observability dashboard**: Visualiser metrikker fra `/api/_diag/offboarding`
- [ ] **RBAC for endpoints**: Begrens start/finalize til org-admin; GET til admin + HR

### Medium-term
- [ ] **S3 migration**: Migrer eksisterende DB-only artefakter til S3
- [ ] **CSV export**: Last ned artefakter som CSV
- [ ] **Email notifications**: Varsle HR når offboarding er fullført
- [ ] **BRREG cache**: Redis-cache for BRREG-oppslag

### Long-term
- [ ] **AI-genererte artefakter**: Bruk LLM til å generere personlig Playbook/FAQ
- [ ] **Retention policies**: Automatisk arkivering basert på org policy
- [ ] **Multi-space support**: Samle filer fra flere spaces automatisk






