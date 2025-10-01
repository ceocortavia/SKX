import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    env: {
      TEST_AUTH_BYPASS: '1',
      ENABLE_QA_BYPASS: '1',
      TEST_BYPASS_SECRET: 'test-secret-123',
      NODE_ENV: process.env.NODE_ENV || 'development',
      ADMIN_BULK_MEMBERS_ENABLED: '1',
      ADMIN_BULK_ROLE_ENABLED: '1',
      ADMIN_BULK_REVOCATION_ENABLED: '1',
      ENABLE_OFFBOARDING_API: '1',
      NEXT_PUBLIC_OFFBOARDING_ENABLED: '1',
      ENABLE_DB_ONLY_ARTIFACTS: '1',
      NEXT_PUBLIC_DEV_BYPASS_USER_ID: process.env.NEXT_PUBLIC_DEV_BYPASS_USER_ID || 'user_a',
      NEXT_PUBLIC_DEV_BYPASS_EMAIL: process.env.NEXT_PUBLIC_DEV_BYPASS_EMAIL || 'a@example.com',
    }
  },
});
