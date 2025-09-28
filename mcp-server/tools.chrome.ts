import { chromium, type BrowserContext } from 'playwright';
import fs from 'node:fs';

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
    'Åpner en URL i headless Chrome og (valgfritt) simulerer enkle steg. Returnerer tittel, HTML-snutt, konsoll/nettverksfeil og screenshot (base64). Støtter auth via storageState eller cookies.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL (https://...)' },
      waitFor: { type: 'string', description: 'CSS-selector å vente på', nullable: true },
      timeout_ms: { type: 'number', description: 'Timeout i ms', nullable: true },
      storage_state_path: { type: 'string', description: 'Filsti til Playwright storageState JSON', nullable: true },
      cookies: {
        type: 'array',
        description: 'Valgfritt: cookies å injisere (f.eks. Clerk __session). Bruk i stedet for storage_state_path.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            domain: { type: 'string' },
            path: { type: 'string', nullable: true },
            secure: { type: 'boolean', nullable: true },
            httpOnly: { type: 'boolean', nullable: true },
            sameSite: { type: 'string', enum: ['Lax', 'None', 'Strict'], nullable: true }
          },
          required: ['name', 'value', 'domain']
        },
        nullable: true
      },
      actions: {
        type: 'array',
        description: 'Sekvens av trinn (click/type/waitFor/sleep/press) som kjøres etter første side-last.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            selector: { type: 'string', nullable: true },
            text: { type: 'string', nullable: true },
            delayMs: { type: 'number', nullable: true },
            timeoutMs: { type: 'number', nullable: true },
            ms: { type: 'number', nullable: true },
            key: { type: 'string', nullable: true }
          }
        },
        nullable: true
      },
      expectText: { type: 'string', description: 'Feil hvis teksten ikke finnes i DOM til slutt', nullable: true }
    },
    required: ['url']
  },
  handler: async (args: { url: string; waitFor?: string; timeout_ms?: number; storage_state_path?: string; cookies?: Array<{ name: string; value: string; domain: string; path?: string; secure?: boolean; httpOnly?: boolean; sameSite?: 'Lax'|'None'|'Strict' }>; actions?: Array<any>; expectText?: string; }) => {
    const { url, waitFor, timeout_ms, storage_state_path, cookies, actions, expectText } = args;
    if (!isAllowed(url)) {
      return {
        type: 'json',
        content: [{ type: 'json', json: { ok: false, error: 'url_not_allowed', url } }]
      };
    }

    const t = timeout_ms ?? 15000;
    const browser = await chromium.launch({ headless: true });
    let context: BrowserContext;
    if (storage_state_path && fs.existsSync(storage_state_path)) {
      context = await browser.newContext({ storageState: storage_state_path, ignoreHTTPSErrors: true });
    } else {
      context = await browser.newContext({ ignoreHTTPSErrors: true });
      if (cookies?.length) {
        await context.addCookies(cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path ?? '/',
          secure: c.secure ?? true,
          httpOnly: c.httpOnly ?? true,
          sameSite: (c.sameSite as any) ?? 'Lax'
        })));
      }
    }
    const page = await context.newPage();

    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(`${msg.type()}: ${msg.text()}`));

    const requestErrors: Array<{ url: string; failure?: string; status?: number }> = [];
    page.on('requestfailed', r => requestErrors.push({ url: r.url(), failure: r.failure()?.errorText }));
    page.on('response', async r => {
      if (r.status() >= 400) requestErrors.push({ url: r.url(), status: r.status() });
    });

    let pass = true;
    let failure: string | null = null;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: t });
      if (waitFor) await page.waitForSelector(waitFor, { timeout: t });

      if (Array.isArray(actions)) {
        for (const step of actions) {
          switch (step?.type) {
            case 'click':
              await page.click(step.selector, { timeout: step.timeoutMs ?? t });
              break;
            case 'type':
              await page.type(step.selector, step.text ?? '', { delay: step.delayMs ?? 20 });
              break;
            case 'waitFor':
              await page.waitForSelector(step.selector, { timeout: step.timeoutMs ?? t });
              break;
            case 'press':
              await page.locator(step.selector).press(step.key, { timeout: step.timeoutMs ?? t });
              break;
            case 'sleep':
              await page.waitForTimeout(step.ms ?? 300);
              break;
          }
        }
      }

      if (expectText) {
        const found = await page.getByText(expectText, { exact: false }).first().isVisible().catch(() => false);
        if (!found) {
          pass = false;
          failure = `expect_text_not_found:${expectText}`;
        }
      }
    } catch (e: any) {
      pass = false;
      failure = `exception:${String(e?.message || e)}`;
    }

    const title = await page.title();
    const html = await page.content();
    const png = await page.screenshot({ type: 'png' });

    await browser.close();

    return {
      type: 'json',
      content: [{ type: 'json', json: {
        ok: pass,
        failure,
        title,
        url,
        waitedFor: waitFor ?? null,
        htmlSnippet: html.slice(0, 2000),
        consoleLogs: consoleLogs.slice(-100),
        requestErrors: requestErrors.slice(-100),
        screenshot_png_base64: png.toString('base64')
      } }]
    };
  }
};


