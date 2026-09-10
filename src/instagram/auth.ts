// Instagram Auth — session cookie management + Playwright login
// Credentials via env: IG_USERNAME, IG_PASSWORD
// Session persisted to ./storage/ig-session.json

import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const SESSION_PATH = path.resolve('./storage/ig-session.json');
const STORAGE_DIR = path.resolve('./storage');

// Shared browser instance (reused across requests)
let _browser: Browser | null = null;

/** Stealth launch args to avoid detection */
const STEALTH_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
];

const VIEWPORT = { width: 1366, height: 768 };

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Get or create a shared browser instance */
export async function getBrowser(): Promise<Browser> {
    if (!_browser || !_browser.isConnected()) {
        _browser = await chromium.launch({
            headless: true,
            args: STEALTH_ARGS,
        });
    }
    return _browser;
}

/** Apply stealth patches to a page (hide webdriver, etc.) */
async function applyStealthToPage(page: Page): Promise<void> {
    await page.addInitScript(() => {
        // Hide webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Override plugins to look like a real browser
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Chrome runtime
        (window as any).chrome = { runtime: {} };
    });
}

/** Load saved session cookies from disk */
export function loadSavedCookies(): any[] | null {
    try {
        if (!fs.existsSync(SESSION_PATH)) return null;
        const data = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
        if (!data.cookies || !Array.isArray(data.cookies)) return null;

        // Check if sessionid cookie exists and is not expired
        const sessionCookie = data.cookies.find((c: any) => c.name === 'sessionid');
        if (!sessionCookie) return null;

        // Check expiry (sessionid usually lasts ~1 year)
        if (sessionCookie.expires && sessionCookie.expires > 0 && sessionCookie.expires < Date.now() / 1000) {
            console.log('[ig-auth] Session cookie expired, need re-login');
            return null;
        }

        // Normalize cookies for Playwright compatibility
        const cookies = data.cookies.map((c: any) => ({
            ...c,
            expires: typeof c.expires === 'number' ? c.expires : -1,
            sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'None',
        }));

        console.log('[ig-auth] Loaded saved session cookies');
        return cookies;
    } catch (err) {
        console.error('[ig-auth] Failed to load saved cookies:', err);
        return null;
    }
}

/** Save cookies to disk */
export function saveCookies(cookies: any[]): void {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
    console.log(`[ig-auth] Saved ${cookies.length} cookies to ${SESSION_PATH}`);
}

/** Import cookies from a user-provided export (e.g., EditThisCookie JSON) */
export function importCookies(cookieJson: string): void {
    try {
        const cookies = JSON.parse(cookieJson);
        const normalized = Array.isArray(cookies)
            ? cookies.map((c: any) => ({
                  name: c.name,
                  value: c.value,
                  domain: c.domain || '.instagram.com',
                  path: c.path || '/',
                  expires: c.expirationDate || c.expires || -1,
                  httpOnly: c.httpOnly ?? false,
                  secure: c.secure ?? true,
                  sameSite: c.sameSite || 'None',
              }))
            : [];
        saveCookies(normalized);
        console.log(`[ig-auth] Imported ${normalized.length} cookies from user export`);
    } catch (err) {
        console.error('[ig-auth] Failed to import cookies:', err);
        throw err;
    }
}

/** Login to Instagram via Playwright and save cookies */
export async function loginWithPlaywright(): Promise<any[]> {
    const username = process.env.IG_USERNAME;
    const password = process.env.IG_PASSWORD;

    if (!username || !password) {
        throw new Error('[ig-auth] IG_USERNAME and IG_PASSWORD env vars are required for login');
    }

    console.log(`[ig-auth] Logging in as ${username} via Playwright...`);

    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: VIEWPORT,
        locale: 'en-US',
    });

    const page = await context.newPage();
    await applyStealthToPage(page);

    try {
        // Navigate to login page
        await page.goto('https://www.instagram.com/accounts/login/', {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // Dismiss cookie consent if present
        try {
            const cookieBtn = page.locator('button:has-text("Allow all cookies"), button:has-text("Accept")');
            await cookieBtn.click({ timeout: 3000 });
        } catch {
            // No cookie dialog
        }

        // Wait for login form — Instagram now uses name="email" and name="pass"
        await page.waitForSelector('input[name="email"]', { timeout: 15000 });

        // Fill credentials with human-like delays
        await page.locator('input[name="email"]').fill('');
        await page.locator('input[name="email"]').type(username, { delay: 50 + Math.random() * 50 });

        await page.locator('input[name="pass"]').fill('');
        await page.locator('input[name="pass"]').type(password, { delay: 50 + Math.random() * 50 });

        // Small delay before clicking login
        await page.waitForTimeout(500 + Math.random() * 500);

        // Click login — the blue "Log in" button is a div, not a standard submit
        // Try multiple strategies
        const loginBtn = page.locator('div[role="button"]:has-text("Log in"), button:has-text("Log in")').first();
        if (await loginBtn.isVisible()) {
            await loginBtn.click();
        } else {
            // Fallback: submit the form directly
            await page.locator('form').first().evaluate((form: HTMLFormElement) => form.submit());
        }

        // Wait for navigation — could be:
        // 1. Successful login → redirects to feed
        // 2. Challenge required → SMS/email verification page
        // 3. Error → stays on login page with error message
        await page.waitForTimeout(5000);

        // Check for challenge/verification page
        const currentUrl = page.url();
        if (currentUrl.includes('challenge') || currentUrl.includes('two_factor')) {
            console.log('[ig-auth] ⚠️  Instagram requires verification!');
            console.log('[ig-auth] Current URL:', currentUrl);
            console.log('[ig-auth] Please complete verification manually or provide exported cookies.');
            throw new Error(
                'Instagram requires verification (2FA/challenge). Please log in manually in a browser, export cookies, and use the /instagram/import-cookies endpoint.',
            );
        }

        // Check for login error
        const errorEl = page.locator('#slfErrorAlert, [data-testid="login-error-message"]');
        if ((await errorEl.count()) > 0) {
            const errorText = await errorEl.first().textContent();
            throw new Error(`Instagram login failed: ${errorText}`);
        }

        // Wait for successful navigation to feed
        try {
            await page.waitForURL('**/instagram.com/**', { timeout: 10000 });
        } catch {
            // May already be on the right page
        }

        // Dismiss "Save login info?" or "Turn on notifications?" dialogs
        try {
            const notNowBtn = page.locator('button:has-text("Not Now"), button:has-text("Not now")');
            await notNowBtn.first().click({ timeout: 3000 });
            await page.waitForTimeout(1000);
            // Second "Not Now" for notifications
            await notNowBtn.first().click({ timeout: 3000 });
        } catch {
            // No dialogs
        }

        // Extract cookies
        const cookies = await context.cookies();
        const sessionCookie = cookies.find((c) => c.name === 'sessionid');

        if (!sessionCookie) {
            throw new Error('[ig-auth] Login appeared to succeed but no sessionid cookie found');
        }

        saveCookies(cookies);
        console.log(`[ig-auth] ✅ Login successful! Session ID: ${sessionCookie.value.slice(0, 10)}...`);

        return cookies;
    } finally {
        await context.close();
    }
}

/** Get valid session cookies — loads from disk or logs in fresh */
export async function getSessionCookies(): Promise<any[]> {
    // Try saved cookies first
    const saved = loadSavedCookies();
    if (saved) return saved;

    // Need to login
    return await loginWithPlaywright();
}

/** Create an authenticated browser context with Instagram cookies */
export async function createAuthenticatedContext(): Promise<{ context: BrowserContext; page: Page }> {
    const cookies = await getSessionCookies();
    const browser = await getBrowser();

    const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: VIEWPORT,
        locale: 'en-US',
    });

    // Set cookies
    await context.addCookies(cookies);

    const page = await context.newPage();
    await applyStealthToPage(page);

    return { context, page };
}

/** HTTP headers for unauthenticated Instagram API requests */
export function getIGHeaders(extraCookies?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-IG-App-ID': '936619743392459',
        'X-ASBD-ID': '129477',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: 'https://www.instagram.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Sec-CH-UA': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
    };

    if (extraCookies) {
        headers['Cookie'] = extraCookies;
    }

    return headers;
}

/** Build cookie header string from cookie array */
export function cookiesToHeader(cookies: any[]): string {
    return cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
}

/** Cleanup — close browser */
export async function closeBrowser(): Promise<void> {
    if (_browser) {
        await _browser.close();
        _browser = null;
    }
}
