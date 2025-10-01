# Offboarding - Runbook

Feilhåndtering og operasjonell guide for offboarding-funksjonen.

## 🔍 Quick Health Check

```bash
# 1. Check diagnostics
curl https://skx.no/api/diag/offboarding | jq .

# 2. Check recent runs (last 24h)
# Look for: stats.last_24h.failed > 0

# 3. Check for errors
# Look for: last_error field

# 4. Verify flags
# Ensure: api_enabled=true, ui_enabled=true
```

## 🚨 Common Issues

### 1. API returns 403 "offboarding_disabled"

**Symptom**: User clicks "Start Offboarding" → 403 error

**Cause**: `ENABLE_OFFBOARDING_API` is not set or is `0`

**Fix**:
```bash
# In Vercel → Settings → Environment Variables
ENABLE_OFFBOARDING_API=1

# Redeploy
```

**Rollback scenario**: This is intentional if you've disabled the feature.

---

### 2. API returns 401 "unauthorized"

**Symptom**: API calls fail with 401

**Possible causes**:
- User not logged in (Clerk session expired)
- QA bypass misconfigured (dev/test only)
- Middleware blocking request

**Fix**:
1. Check user is logged in to Clerk
2. Verify Clerk environment variables:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<set>
   CLERK_SECRET_KEY=<set>
   ```
3. In dev/test: ensure `ENABLE_QA_BYPASS=1` if using bypass headers

---

### 3. API returns 404 "user_not_found"

**Symptom**: Start offboarding fails with 404

**Cause**: User email doesn't exist in organization or has no active membership

**Fix**:
1. Verify user exists:
   ```sql
   select u.id, u.primary_email, m.status, m.role
   from users u
   join memberships m on m.user_id = u.id
   where lower(u.primary_email) = lower('user@example.com')
     and m.organization_id = '<org-id>'
     and m.status = 'approved';
   ```

2. If user doesn't exist or membership is not approved → inform user

---

### 4. Finalize fails with 500 error

**Symptom**: Run starts OK, but finalize returns 500

**Possible causes**:
- AI generation failure (OpenAI API)
- Database constraint violation
- S3 upload failure (if S3 mode)

**Debug**:
```bash
# Check logs in Vercel
# Look for: [offboarding.finalize] error

# Check diagnostics
curl https://skx.no/api/diag/offboarding | jq '.last_error'

# Check run status in database
select id, status, result
from offboarding_runs
where id = '<run-id>';
```

**Fix**:
1. **AI failure**: Check OpenAI API key and quota
   ```bash
   OPENAI_API_KEY=<valid-key>
   ```

2. **Database**: Check error in `result` field, fix constraint
   
3. **S3**: Verify AWS credentials and bucket permissions
   ```bash
   AWS_ACCESS_KEY_ID=<valid>
   AWS_SECRET_ACCESS_KEY=<valid>
   S3_BUCKET=<exists>
   ```

---

### 5. No artifacts generated

**Symptom**: Finalize completes, but `artifacts` array is empty

**Cause**: AI generation returned empty or invalid response

**Debug**:
```sql
select id, status, artifacts, result
from offboarding_runs
where status = 'completed'
  and jsonb_array_length(artifacts) = 0
order by created_at desc
limit 5;
```

**Fix**:
1. Check if user has any files in candidate_files
2. Verify AI prompt is working (check logs)
3. Manually retry finalize if needed

---

### 6. Search returns no results

**Symptom**: Transition space created, but search finds nothing

**Cause**: `file_index` not populated (embeddings missing)

**Debug**:
```sql
-- Check if artifacts exist
select f.id, f.name, f.storage_key
from files f
join spaces s on s.id = f.space_id
where s.type = 'transition'
  and s.id = '<space-id>';

-- Check if indexed
select count(*)
from file_index fi
join files f on f.id = fi.file_id
where f.space_id = '<space-id>';
```

**Fix**:
1. **DB-only mode**: Search uses metadata, not embeddings (limited results expected)
2. **S3 mode**: Ensure indexing job ran after artifact upload
3. Manually trigger reindex if needed (implement reindex endpoint)

---

### 7. Performance issues (slow finalize)

**Symptom**: Finalize takes > 30 seconds

**Causes**:
- Large number of candidate files
- AI generation slow (OpenAI API latency)
- Database queries slow

**Monitor**:
```bash
# Check average completion time
curl https://skx.no/api/diag/offboarding | jq '.stats.last_24h.avg_completion_ms'

# Should be < 10000 (10 seconds)
```

**Optimize**:
1. Limit candidate_files (currently hardcoded to 0 in test)
2. Use streaming for AI generation
3. Add database indexes if needed
4. Consider background job for large organizations

---

### 8. Storage quota exceeded (DB-only mode)

**Symptom**: Finalize fails with storage error

**Cause**: Artifacts stored in PostgreSQL `storage_key` field hitting size limits

**Fix**: Migrate to S3 immediately (see `OFFBOARDING_ENV.md`)

---

## 🔧 Manual Interventions

### Retry failed run

```sql
-- Reset run to allow retry
update offboarding_runs
set status = 'processing',
    result = null,
    updated_at = now()
where id = '<run-id>'
  and status = 'error';
```

### Delete stuck run

```sql
-- Clean up (cascades to artifacts)
delete from offboarding_runs
where id = '<run-id>';
```

### Force complete run

```sql
-- Mark as completed (not recommended)
update offboarding_runs
set status = 'completed',
    updated_at = now()
where id = '<run-id>';
```

---

## 📊 Monitoring & Alerts

### Recommended alerts

1. **High error rate**
   ```
   Alert: offboarding_runs.failed > 5 in last hour
   ```

2. **API latency**
   ```
   Alert: /api/offboarding/*/finalize p95 > 15s
   ```

3. **No completions**
   ```
   Alert: offboarding_runs.completed = 0 in last 24h (if traffic exists)
   ```

4. **Storage growth**
   ```
   Alert: files table size > 80% quota
   Action: Migrate to S3
   ```

### Logs to watch

```bash
# In Vercel logs, filter for:
[offboarding.start]
[offboarding.finalize]
[diag.offboarding]

# Look for ERROR severity
```

---

## 🚀 Go-Live Checklist

Before enabling offboarding in production:

- [ ] Environment variables set (see `OFFBOARDING_ENV.md`)
- [ ] QA bypass disabled in prod (`ENABLE_QA_BYPASS=0`)
- [ ] Playwright tests passing locally
- [ ] CI smoke tests passing on preview
- [ ] Diagnostics endpoint accessible
- [ ] Test user can complete full flow (start → finalize → search)
- [ ] Audit events logging correctly
- [ ] Alerts configured (5xx, latency)
- [ ] Runbook reviewed with team
- [ ] Rollback plan communicated

---

## 📞 Escalation

If issue persists:

1. Check Vercel logs for stack traces
2. Query database for run details
3. Verify environment variables
4. Check OpenAI API status (status.openai.com)
5. Check Neon database status (status.neon.tech)
6. Rollback if critical: `ENABLE_OFFBOARDING_API=0`

---

## 🔄 Rollback Procedure

Emergency rollback (< 2 minutes):

```bash
# 1. In Vercel → Settings → Environment Variables
ENABLE_OFFBOARDING_API=0

# 2. Trigger redeploy
# Vercel → Deployments → Latest → Redeploy

# 3. Verify
curl https://skx.no/api/diag/offboarding | jq '.flags.api_enabled'
# Should return: false

# 4. Communicate to users (UI will hide offboarding button)
```

Partial rollback (API works, hide UI):

```bash
NEXT_PUBLIC_OFFBOARDING_ENABLED=0
# Redeploy
```

---

## 📈 Post-Incident Review

After major incident:

1. Document what happened (incident log)
2. Root cause analysis
3. Update runbook with learnings
4. Add new alerts/monitoring if needed
5. Test rollback procedure

