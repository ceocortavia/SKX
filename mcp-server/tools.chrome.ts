import { chromium } from 'playwright';

// (valgfritt) begrens hvilke domener som kan probes:
const ALLOWLIST = [
  'https://skx-livid.vercel.app',
  'https://skx-git-main-skillcortavia.vercel.app',
  'https://skx-',
  'https://skx-9ruqtutgb-skillcortavia.vercel.app',
  'https://skx-nuo7tuzeu-skillcortavia.vercel.app',
];

function isAllowed(url: string) {
  try {
    const u = new URL(url);
    const full = `${u.protocol}//${u.host}`;
    return ALLOWLIST.some(p => full.startsWith(p) || url.startsWith(p));
  } catch { return false; }
}

export const chrome_probe = {
  name: 'chrome_probe',
  description:
    'Åpner en URL i headless Chrome og returnerer tittel, liten HTML-snutt, konsoll- og nettverksfeil samt screenshot (base64).',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL (https://...)' },
      waitFor: { type: 'string', description: 'CSS-selector å vente på', nullable: true },
      timeout_ms: { type: 'number', description: 'Timeout i ms', nullable: true }
    },
    required: ['url']
  },
  handler: async (args: { url: string; waitFor?: string; timeout_ms?: number }) => {
    const { url, waitFor, timeout_ms } = args;
    if (!isAllowed(url)) {
      return {
        type: 'json',
        content: [{ type: 'json', json: { ok: false, error: 'url_not_allowed', url } }]
      };
    }

    const t = timeout_ms ?? 15000;
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(`${msg.type()}: ${msg.text()}`));

    const requestErrors: Array<{ url: string; failure?: string; status?: number }> = [];
    page.on('requestfailed', r => requestErrors.push({ url: r.url(), failure: r.failure()?.errorText }));
    page.on('response', async r => {
      if (r.status() >= 400) requestErrors.push({ url: r.url(), status: r.status() });
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: t });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: t });

    const title = await page.title();
    const html = await page.content();
    const png = await page.screenshot({ type: 'png' });

    await browser.close();

    return {
      type: 'json',
      content: [{
        type: 'json',
        json: {
          ok: true,
          title,
          url,
          waitedFor: waitFor ?? null,
          htmlSnippet: html.slice(0, 2000),
          consoleLogs: consoleLogs.slice(-50),
          requestErrors: requestErrors.slice(-50),
          screenshot_png_base64: png.toString('base64')
        }
      }]
    };
  }
};


