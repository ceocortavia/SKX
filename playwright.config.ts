import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
  webServer: {
    command: 'NEXT_TELEMETRY_DISABLED=1 TEST_AUTH_BYPASS=1 next dev -p 3000',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});


