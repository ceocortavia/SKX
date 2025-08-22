# SKX

RLS satt opp med Clerk + Supabase/Neon og verifisert via `db/tests/199_final_verification.sql`.

Lokalt:

- Migrasjoner:
  make migrate
- Verifisering:
  make verify

CI:
- GitHub Actions workflow `RLS Verification` kjører migrasjoner, 199-testen og policy-snapshot diff.
