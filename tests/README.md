# Test Konvensjoner for SKX

## **🧪 Test Setup**

### **Playwright Konfigurasjon**
- **Config:** `playwright.config.ts` - API testing med baseURL
- **Scripts:** `npm run test:e2e` eller `npx playwright test`
- **Reports:** HTML reports genereres automatisk

## **🔐 Autentisering i Tester**

### **1. Test Bypass (Positive Tests)**
**Bruk når:** Du vil teste API-endepunkter som krever autentisering

**Setup:**
```bash
export TEST_AUTH_BYPASS=1
npm run dev
```

**Headers i test:**
```typescript
headers: {
  'x-test-clerk-user-id': 'user_a',
  'x-test-clerk-email': 'a@example.com',
  'x-org-id': 'ORG_ID_FRA_DATABASE'
}
```

**Eksempel:**
```typescript
test("memberships with auth returns data", async ({ request }) => {
  const res = await request.get("/api/memberships", {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
      'x-org-id': '9f217b9c-40ce-4814-a77b-5ef3cd5e9697'
    }
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.memberships).toBeDefined();
});
```

### **2. Negative Tests (Uten Auth)**
**Bruk når:** Du vil verifisere at endepunkter er beskyttet

**Ingen headers** - simulerer uautoriserte requests

**Eksempel:**
```typescript
test("memberships without auth returns redirect/401", async ({ request }) => {
  const res = await request.get("/api/memberships");
  await expectProtected(res); // Håndterer 401, 3xx, eller /sign-in
});
```

## **🛠️ Test Helpers**

### **`expectProtected(res)`**
Håndterer alle måter Clerk kan beskytte endepunkter:
- ✅ **401 Unauthorized** - API-stil
- ✅ **3xx Redirect** - Browser-stil  
- ✅ **200 på /sign-in** - Playwright følger redirect
- ✅ **HTML med "Sign in"** - Fallback

```typescript
import { expectProtected } from "./utils";

// Test at endepunkt er beskyttet
const res = await request.get("/api/protected");
await expectProtected(res);
```

## **📁 Test Filer Struktur**

```
tests/
├── utils.ts                    # Test helpers
├── api.health.spec.ts         # Health endpoint tests
├── api.memberships.spec.ts    # Memberships API tests  
├── api.orgDomains.spec.ts     # Org domains API tests
├── api.negative.spec.ts       # Negative auth tests
└── README.md                  # Denne filen
```

## **🎯 Test Mønstre**

### **Positive API Test (med auth)**
```typescript
test("endpoint works with auth", async ({ request }) => {
  const res = await request.post("/api/endpoint", {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
      'x-org-id': 'ORG_ID'
    },
    data: { /* test data */ }
  });
  
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Assert på response data
});
```

### **Negative Auth Test (uten auth)**
```typescript
test("endpoint protected without auth", async ({ request }) => {
  const res = await request.get("/api/endpoint");
  await expectProtected(res);
});
```

## **🚀 Kjøre Tester**

### **Alle Tester**
```bash
npm run test:e2e
```

### **Spesifikk Test Fil**
```bash
npx playwright test tests/api.memberships.spec.ts
```

### **Med UI (Debug)**
```bash
npm run test:e2e:ui
```

## **🔧 Troubleshooting**

### **Test Bypass Fungerer Ikke**
- Sjekk at `TEST_AUTH_BYPASS=1` er satt
- Sjekk at `NODE_ENV !== 'production'`
- Verifiser at test-headere er riktige

### **Negative Tests Feiler**
- Bruk `expectProtected()` helper
- Sjekk at du ikke sender auth-headers
- Verifiser at middleware ikke har bugs

### **Database Feil i Tester**
- Kjør `npm run db:seed` før testing
- Sjekk at `DATABASE_URL` er riktig
- Verifiser at migrasjoner er kjørt

## **📝 Best Practices**

1. **Separer positive og negative tester** i forskjellige filer
2. **Bruk `expectProtected()`** for alle auth-beskyttelse tester
3. **Test både happy path og edge cases**
4. **Hold test-data konsistent** mellom test-filer
5. **Dokumenter komplekse test-scenarios** med kommentarer

## **🔄 CI/CD Integration**

Tester kjøres automatisk i GitHub Actions:
- **Workflow:** `.github/workflows/rls-verify.yml`
- **Trigger:** På push til feature branches
- **Artifacts:** Test reports lastes opp ved feil

