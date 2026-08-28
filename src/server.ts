import express from 'express';
import { CheerioCrawler, Dataset } from 'crawlee';
import { chromium } from 'playwright';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.get('/', (_req, res) => {
    res.send(`
        <h1>Papa Crawlee — apify.beenex.org</h1>
        <p>Deployed on Coolify (lenovo • http://apify.beenex.org)</p>
        <ul>
            <li><a href="/crawl?url=https://crawlee.dev">/crawl?url=https://crawlee.dev</a> — smoke test (CheerioCrawler title)</li>
            <li><a href="/crawl?case=books">/crawl?case=books</a> — books.toscrape (Cheerio, pagination sample)</li>
            <li><a href="/crawl?case=quotes">/crawl?case=quotes</a> — quotes.toscrape</li>
            <li><a href="/crawl?case=httpbin">/crawl?case=httpbin</a> — httpbin json</li>
            <li><a href="/zapier?limit=100&pages=1">/zapier?limit=100&pages=1</a> — Zapier integration list (10014 apps)</li>
            <li><a href="/zapier?limit=100&pages=101">/zapier?limit=100&pages=101</a> — full Zapier dump (10k)</li>
            <li><a href="/tiktok/comments?url=https://www.tiktok.com/@arc_journal/video/7402747839643667743">/tiktok/comments</a> — TikTok comment scraper</li>
            <li><a href="/health">/health</a></li>
        </ul>
        <p>See <a href="https://github.com/apify/crawlee">crawlee.dev</a> • test cases in test.md</p>
    `);
});

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ── Zapier (unchanged) ────────────────────────────────────────────────────────

let zapierCache: { key: string; data: any[]; ts: number } | null = null;
const ZAPIER_CACHE_MS = 60 * 60 * 1000;
async function fetchZapierApps(limit = 100, maxPages = 5): Promise<any[]> {
    const key = `${limit}:${maxPages}`;
    if (zapierCache && zapierCache.key === key && Date.now() - zapierCache.ts < ZAPIER_CACHE_MS) {
        return zapierCache.data;
    }
    const firstResp = await fetch(`https://zapier.com/api/v4/apps?limit=${limit}&offset=0`, {
        headers: { 'User-Agent': 'papa-crawlee/1.0', Accept: 'application/json' },
    });
    if (!firstResp.ok) throw new Error(`Zapier API ${firstResp.status}`);
    const firstData: any = await firstResp.json();
    const total = firstData.count;
    const pages = Math.min(maxPages, Math.ceil(total / limit));
    const all: any[] = [];
    const push = (results: any[]) => {
        for (const r of results) all.push({ id: r.id, name: r.name, slug: r.slug, description: r.description, url: `https://zapier.com${r.app_profile_url}`, categories: (r.categories || []).map((c: any) => c.title), popularity: r.popularity });
    };
    push(firstData.results || []);
    if (pages > 1) {
        const offsets = Array.from({ length: pages - 1 }, (_, i) => (i + 1) * limit);
        const concurrency = 10;
        for (let i = 0; i < offsets.length; i += concurrency) {
            const batch = offsets.slice(i, i + concurrency);
            const results = await Promise.all(
                batch.map(async (off) => {
                    const resp = await fetch(`https://zapier.com/api/v4/apps?limit=${limit}&offset=${off}`, { headers: { 'User-Agent': 'papa-crawlee/1.0', Accept: 'application/json' } });
                    if (!resp.ok) throw new Error(`Zapier API ${resp.status} at offset ${off}`);
                    const data: any = await resp.json();
                    return data.results || [];
                }),
            );
            for (const r of results) push(r);
        }
    }
    all.sort((a, b) => a.popularity - b.popularity);
    if (maxPages === 101) zapierCache = { key, data: all, ts: Date.now() };
    return all;
}

app.get('/zapier', async (req, res) => {
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 100);
    const pages = Math.min(parseInt((req.query.pages as string) || '2', 10), 101);
    const simple = req.query.simple === '1' || req.query.simple === 'true';
    if (pages === 101) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', 'application/json');
    }
    try {
        const start = Date.now();
        const apps = await fetchZapierApps(limit, pages);
        const out = simple ? apps.map((a: any) => ({ name: a.name, functionality: a.description, scope: a.categories, url: a.url })) : apps;
        res.json({ count: out.length, total: 10014, limit, pages, durationMs: Date.now() - start, cached: !!zapierCache && zapierCache.key === `${limit}:${pages}`, simple, apps: out });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/zapier-simple', async (_req, res) => {
    try {
        const apps = await fetchZapierApps(100, 101);
        const simple = apps.map((a: any) => ({ name: a.name, functionality: a.description, scope: a.categories, url: a.url }));
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json({ count: simple.length, apps: simple });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/zapier-names', async (_req, res) => {
    try {
        const apps = await fetchZapierApps(100, 101);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(apps.map((a: any) => a.name).join('\n'));
    } catch (e: any) {
        res.status(500).send(String(e.message));
    }
});

// ── TikTok comment scraper ─────────────────────────────────────────────────────

interface TikTokComment {
    id: string;
    text: string;
    author: string;
    authorNickname: string;
    authorAvatar: string;
    likes: number;
    replyCount: number;
    createTime: string;
    isAuthorLiked: boolean;
}

interface TikTokVideo {
    id: string;
    url: string;
    author: string;
    authorNickname: string;
    caption: string;
    likes: number;
    comments: number;
    shares: number;
    plays: number;
    createTime: string;
}

function parseComment(c: any): TikTokComment {
    return {
        id: String(c.cid || c.id || ''),
        text: c.text || c.comment || '',
        author: c.user?.unique_id || c.user?.uniqueId || '',
        authorNickname: c.user?.nickname || '',
        authorAvatar: c.user?.avatar_thumb?.url_list?.[0] || c.user?.avatarThumb || '',
        likes: c.digg_count ?? c.diggCount ?? 0,
        replyCount: c.reply_comment_total ?? c.replyCommentTotal ?? 0,
        createTime: new Date((c.create_time ?? c.createTime ?? 0) * 1000).toISOString(),
        isAuthorLiked: !!(c.is_author_digged ?? c.isAuthorDigged),
    };
}

function parseVideoMeta(itemStruct: any): TikTokVideo {
    return {
        id: itemStruct.id || '',
        url: `https://www.tiktok.com/@${itemStruct.author?.uniqueId || ''}/video/${itemStruct.id}`,
        author: itemStruct.author?.uniqueId || '',
        authorNickname: itemStruct.author?.nickname || '',
        caption: itemStruct.desc || '',
        likes: itemStruct.stats?.diggCount ?? 0,
        comments: itemStruct.stats?.commentCount ?? 0,
        shares: itemStruct.stats?.shareCount ?? 0,
        plays: itemStruct.stats?.playCount ?? 0,
        createTime: new Date((itemStruct.createTime ?? 0) * 1000).toISOString(),
    };
}

async function scrapeTikTokComments(videoUrl: string, timeoutMs = 60000): Promise<{
    video: TikTokVideo | null;
    comments: TikTokComment[];
    durationMs: number;
    error?: string;
}> {
    const start = Date.now();
    const comments = new Map<string, TikTokComment>();
    let video: TikTokVideo | null = null;
    let browser;

    try {
        browser = await chromium.launch({
            headless: false, // Use headed mode with xvfb virtual display — much harder for TikTok to detect
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
            ],
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 },
            locale: 'en-US',
            timezoneId: 'America/New_York',
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        // Hide webdriver flag
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        const page = await context.newPage();

        // Track all API URLs for debugging
        const apiUrls: string[] = [];

        // Use CDP (Chrome DevTools Protocol) to capture response bodies
        // This captures the ACTUAL browser response including all cookies/tokens,
        // unlike route.fetch() which makes a separate request
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');

        cdp.on('Network.responseReceived', async (event: any) => {
            const url = event.response.url;
            try {
                if (url.includes('tiktok.com') && (url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/'))) {
                    apiUrls.push(url.split('?')[0]);
                }

                if (url.includes('comment') && (url.includes('list') || url.includes('reply'))) {
                    console.log(`[tiktok] comment API hit: ${event.response.status} ${url.split('?')[0]}`);
                    try {
                        const { body, base64Encoded } = await cdp.send('Network.getResponseBody', {
                            requestId: event.requestId,
                        });
                        const bodyText = base64Encoded ? Buffer.from(body, 'base64').toString('utf-8') : body;
                        console.log(`[tiktok] comment body (${bodyText.length} chars): ${bodyText.slice(0, 500)}`);

                        if (bodyText.length > 0) {
                            const json = JSON.parse(bodyText);
                            const commentList = json.comments || json.data?.comments || json.comment_list || [];
                            for (const c of commentList) {
                                const parsed = parseComment(c);
                                if (parsed.id && parsed.text) {
                                    comments.set(parsed.id, parsed);
                                }
                            }
                            console.log(`[tiktok] parsed ${commentList.length} comments (total: ${comments.size})`);
                        }
                    } catch (e: any) {
                        console.log(`[tiktok] CDP body read: ${e.message?.slice(0, 100)}`);
                    }
                }
            } catch {
                // skip
            }
        });

        console.log(`[tiktok] navigating to ${videoUrl}`);
        await page.goto(videoUrl, { waitUntil: 'networkidle', timeout: 30000 });

        // Extract video metadata AND comments from rehydration data (SSR data)
        try {
            const rehydrationData = await page.evaluate(() => {
                const script = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (script?.textContent) {
                    return JSON.parse(script.textContent);
                }
                return null;
            });

            if (rehydrationData) {
                const scope = rehydrationData['__DEFAULT_SCOPE__'] || {};
                
                // Log available keys for debugging
                console.log(`[tiktok] rehydration keys: ${Object.keys(scope).join(', ')}`);
                
                // Extract video metadata
                const detail = scope['webapp.video-detail'] || scope['webapp.video_detail'] || {};
                const itemStruct = detail.itemInfo?.itemStruct || detail.itemStruct;
                if (itemStruct) {
                    video = parseVideoMeta(itemStruct);
                    console.log(`[tiktok] video: ${video.caption.slice(0, 60)}... (${video.comments} comments)`);
                }

                // Extract comments from rehydration data
                // TikTok includes initial comments in several possible locations
                const commentScope = scope['webapp.comment-detail'] || scope['webapp.comment_detail'] || {};
                const possibleCommentSources = [
                    detail.commentInfo?.comments,
                    detail.comments,
                    commentScope.comments,
                    commentScope.commentList,
                ];

                for (const source of possibleCommentSources) {
                    if (Array.isArray(source) && source.length > 0) {
                        console.log(`[tiktok] found ${source.length} comments in rehydration data`);
                        for (const c of source) {
                            const parsed = parseComment(c);
                            if (parsed.id && parsed.text) {
                                comments.set(parsed.id, parsed);
                            }
                        }
                        break;
                    }
                }

                // Also look in any key that contains "comment"
                for (const [key, value] of Object.entries(scope)) {
                    if (key.toLowerCase().includes('comment') && typeof value === 'object' && value !== null) {
                        const val = value as Record<string, any>;
                        console.log(`[tiktok] comment scope key "${key}" has keys: ${Object.keys(val).join(', ')}`);
                        // Check if it has a comments array
                        for (const subKey of Object.keys(val)) {
                            const subVal = val[subKey];
                            if (Array.isArray(subVal) && subVal.length > 0 && subVal[0]?.text) {
                                console.log(`[tiktok] found ${subVal.length} comments in ${key}.${subKey}`);
                                for (const c of subVal) {
                                    const parsed = parseComment(c);
                                    if (parsed.id && parsed.text) {
                                        comments.set(parsed.id, parsed);
                                    }
                                }
                            }
                        }
                    }
                }

                console.log(`[tiktok] comments from rehydration: ${comments.size}`);
            }
        } catch (e) {
            console.log(`[tiktok] rehydration parse failed: ${e}`);
        }

        // Wait for comment section to load
        await page.waitForTimeout(3000);

        // Try to click the comments section to ensure it's open
        try {
            // Look for the comment count button/icon and click it
            const commentButton = page.locator('[data-e2e="comment-icon"]').first();
            if (await commentButton.isVisible({ timeout: 3000 })) {
                await commentButton.click();
                await page.waitForTimeout(2000);
            }
        } catch {
            // Comment section might already be visible
        }

        // Scroll the comment section to trigger pagination
        const deadline = Date.now() + timeoutMs;
        let previousCount = 0;
        let staleCycles = 0;
        const MAX_STALE_CYCLES = 5;

        while (Date.now() < deadline && staleCycles < MAX_STALE_CYCLES) {
            // Try scrolling different potential comment containers
            await page.evaluate(() => {
                // Scroll the comment container if found
                const containers = [
                    document.querySelector('[class*="CommentListContainer"]'),
                    document.querySelector('[class*="comment-list"]'),
                    document.querySelector('[data-e2e="comment-list"]'),
                    document.querySelector('[class*="DivCommentListContainer"]'),
                ];
                for (const container of containers) {
                    if (container) {
                        container.scrollTop = container.scrollHeight;
                        return;
                    }
                }
                // Fallback: scroll the whole page
                window.scrollBy(0, 1000);
            });

            await page.waitForTimeout(1500);

            if (comments.size === previousCount) {
                staleCycles++;
            } else {
                staleCycles = 0;
                previousCount = comments.size;
            }

            console.log(`[tiktok] scroll cycle — ${comments.size} comments (stale: ${staleCycles}/${MAX_STALE_CYCLES})`);
        }

        // Log all API URLs seen for debugging
        const uniqueApiUrls = [...new Set(apiUrls)];
        console.log(`[tiktok] API URLs seen: ${uniqueApiUrls.join(', ')}`);

        // DOM fallback: extract comments from rendered page if API interception got nothing
        if (comments.size === 0) {
            console.log('[tiktok] API interception found no comments, trying DOM extraction...');
            try {
                const domComments = await page.evaluate(() => {
                    const results: any[] = [];

                    // Try multiple selectors for comment containers
                    const selectors = [
                        '[data-e2e="comment-level-1"]',
                        '[class*="DivCommentItemContainer"]',
                        '[class*="CommentItemContainer"]',
                        '[class*="comment-item"]',
                        '[class*="CommentListContainer"] > div',
                    ];

                    for (const selector of selectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            elements.forEach((el, i) => {
                                // Try to get comment text from various possible child selectors
                                const textEl = el.querySelector('[data-e2e="comment-level-1"] span') ||
                                    el.querySelector('[class*="CommentText"]') ||
                                    el.querySelector('[class*="comment-text"]') ||
                                    el.querySelector('p') ||
                                    el.querySelector('span:not([class*="name"]):not([class*="time"])');

                                const authorEl = el.querySelector('[data-e2e="comment-username-1"]') ||
                                    el.querySelector('[class*="UserName"]') ||
                                    el.querySelector('[class*="user-name"]') ||
                                    el.querySelector('a[href*="/@"]');

                                const text = textEl?.textContent?.trim() || '';
                                const author = authorEl?.textContent?.trim() || '';

                                if (text) {
                                    results.push({
                                        id: `dom-${i}`,
                                        text,
                                        author,
                                        source: 'dom',
                                        selector,
                                    });
                                }
                            });
                            if (results.length > 0) break; // stop if we found comments
                        }
                    }

                    // If no structured comments found, try getting all text from the comment section
                    if (results.length === 0) {
                        const commentSection = document.querySelector('[class*="DivCommentListContainer"]') ||
                            document.querySelector('[data-e2e="comment-list"]') ||
                            document.querySelector('[class*="CommentList"]');
                        if (commentSection) {
                            results.push({
                                id: 'dom-raw',
                                text: commentSection.textContent?.slice(0, 5000) || '',
                                author: '',
                                source: 'dom-raw-section',
                                selector: 'comment-section',
                            });
                        }
                    }

                    return results;
                });

                for (const dc of domComments) {
                    comments.set(dc.id, {
                        id: dc.id,
                        text: dc.text,
                        author: dc.author,
                        authorNickname: '',
                        authorAvatar: '',
                        likes: 0,
                        replyCount: 0,
                        createTime: '',
                        isAuthorLiked: false,
                    });
                }

                console.log(`[tiktok] DOM extraction found ${domComments.length} comments`);
            } catch (e: any) {
                console.log(`[tiktok] DOM extraction failed: ${e.message}`);
            }
        }

        await context.close();
    } catch (e: any) {
        console.error(`[tiktok] error: ${e.message}`);
        return {
            video,
            comments: Array.from(comments.values()),
            durationMs: Date.now() - start,
            error: e.message,
        };
    } finally {
        if (browser) await browser.close().catch(() => {});
    }

    return {
        video,
        comments: Array.from(comments.values()),
        durationMs: Date.now() - start,
    };
}

app.get('/tiktok/comments', async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.includes('tiktok.com')) {
        return res.status(400).json({ error: 'Missing or invalid ?url= parameter. Provide a TikTok video URL.' });
    }

    const timeout = Math.min(parseInt((req.query.timeout as string) || '60000', 10), 120000);

    try {
        console.log(`[tiktok] request: ${url}`);
        const result = await scrapeTikTokComments(url, timeout);
        res.json({
            video: result.video,
            comments: result.comments,
            totalComments: result.video?.comments ?? null,
            scrapedComments: result.comments.length,
            durationMs: result.durationMs,
            ...(result.error ? { error: result.error } : {}),
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// ── Cheerio crawl (unchanged) ──────────────────────────────────────────────────

async function runCrawl(targetUrl: string, label = 'smoke'): Promise<any[]> {
    const results: any[] = [];
    const crawler = new CheerioCrawler({
        maxRequestsPerCrawl: 5,
        async requestHandler({ $, request, enqueueLinks, log }) {
            const title = $('title').text().trim();
            log.info(`[${label}] ${title} @ ${request.loadedUrl}`);
            results.push({ url: request.loadedUrl, title });
            if (results.length < 3) {
                await enqueueLinks({ globs: [`${new URL(targetUrl).origin}/**`], label: 'detail' }).catch(() => {});
            }
        },
    });
    await crawler.run([targetUrl]);
    return results;
}

app.get('/crawl', async (req, res) => {
    const url = (req.query.url as string) || '';
    const c = (req.query.case as string) || '';
    if (c === 'zapier') {
        const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 100);
        const pages = Math.min(parseInt((req.query.pages as string) || '2', 10), 101);
        try {
            const start = Date.now();
            const apps = await fetchZapierApps(limit, pages);
            return res.json({ target: 'https://zapier.com/api/v4/apps', count: apps.length, durationMs: Date.now() - start, apps });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
    let target = url;
    if (!target) {
        if (c === 'books') target = 'https://books.toscrape.com';
        else if (c === 'quotes') target = 'https://quotes.toscrape.com';
        else if (c === 'httpbin') target = 'https://httpbin.org/json';
        else target = 'https://crawlee.dev';
    }
    try {
        const start = Date.now();
        const data = await runCrawl(target, c || 'smoke');
        res.json({ target, count: data.length, durationMs: Date.now() - start, data });
    } catch (e: any) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[papa] listening on 0.0.0.0:${PORT} -> http://apify.beenex.org`);
});
