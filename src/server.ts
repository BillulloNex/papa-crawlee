import express from 'express';
import { CheerioCrawler, Dataset } from 'crawlee';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Register stealth plugin — patches navigator.webdriver, chrome.runtime,
// plugin enumeration, languages, WebGL vendor, and 10+ other automation signals
chromium.use(StealthPlugin());

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

// ── TikTok Scraper UI ─────────────────────────────────────────────────────────
app.get('/tiktok', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TikTok Comment Scraper — Papa Crawlee</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e0e0e0; min-height: 100vh; padding: 0; }
  .header { background: #1a1a1a; border-bottom: 1px solid #2a2a2a; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 18px; font-weight: 600; color: #fff; }
  .header .badge { background: #22c55e; color: #000; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .container { max-width: 720px; margin: 32px auto; padding: 0 24px; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .card h2 { font-size: 14px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
  label { display: block; font-size: 13px; font-weight: 500; color: #aaa; margin-bottom: 6px; }
  .url-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
  .url-row { display: flex; gap: 8px; align-items: center; }
  .url-row span.num { color: #555; font-size: 13px; min-width: 20px; text-align: right; }
  input[type="text"], input[type="number"] { background: #111; border: 1px solid #333; border-radius: 8px; color: #fff; padding: 10px 14px; font-size: 14px; width: 100%; outline: none; transition: border-color 0.2s; }
  input:focus { border-color: #3b82f6; }
  .url-row input { flex: 1; }
  .url-row button.remove { background: none; border: none; color: #ef4444; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
  .url-row button.remove:hover { background: #2a1515; }
  .add-btn { background: #1e293b; color: #3b82f6; border: 1px dashed #334155; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .add-btn:hover { background: #1e3a5f; border-color: #3b82f6; }
  .config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .config-item { }
  .config-item .suffix { color: #666; font-size: 12px; margin-top: 4px; }
  .actions { display: flex; gap: 12px; margin-top: 8px; }
  .btn-run { background: #22c55e; color: #000; border: none; border-radius: 8px; padding: 12px 28px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
  .btn-run:hover { background: #16a34a; }
  .btn-run:disabled { background: #333; color: #666; cursor: not-allowed; }
  .btn-run .icon { font-size: 14px; }
  .status { margin-top: 20px; padding: 16px; background: #111; border: 1px solid #2a2a2a; border-radius: 8px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; color: #888; min-height: 40px; display: none; }
  .status.active { display: block; }
  .status .spinner { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .results { margin-top: 20px; display: none; }
  .results.active { display: block; }
  .video-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .video-meta { display: flex; gap: 16px; align-items: flex-start; }
  .video-meta .author { font-weight: 600; color: #fff; font-size: 15px; }
  .video-meta .handle { color: #3b82f6; font-size: 13px; }
  .video-meta .caption { color: #aaa; font-size: 13px; margin-top: 6px; line-height: 1.5; }
  .stats { display: flex; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
  .stat { font-size: 13px; color: #888; }
  .stat span { color: #fff; font-weight: 600; }
  .comments-list { display: flex; flex-direction: column; gap: 1px; }
  .comment-item { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; }
  .comment-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .comment-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: #333; }
  .comment-author { font-weight: 600; color: #fff; font-size: 13px; }
  .comment-time { color: #555; font-size: 11px; margin-left: auto; }
  .comment-text { color: #ccc; font-size: 14px; line-height: 1.5; }
  .comment-footer { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: #666; }
  .summary-bar { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 12px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #888; }
  .summary-bar .count { color: #22c55e; font-weight: 700; }
  .export-btn { background: #1e293b; color: #3b82f6; border: 1px solid #334155; border-radius: 6px; padding: 6px 14px; font-size: 12px; cursor: pointer; }
  .export-btn:hover { background: #1e3a5f; }
  a.back { color: #555; text-decoration: none; font-size: 13px; }
  a.back:hover { color: #888; }
</style>
</head>
<body>
<div class="header">
  <a class="back" href="/">← Back</a>
  <h1>TikTok Comment Scraper</h1>
  <span class="badge">LIVE</span>
</div>

<div class="container">
  <div class="card">
    <h2>Input</h2>
    <label>TikTok video URLs</label>
    <div class="url-list" id="urlList">
      <div class="url-row">
        <span class="num">1</span>
        <input type="text" placeholder="https://www.tiktok.com/@user/video/1234567890" />
        <button class="remove" onclick="removeUrl(this)" title="Remove">✕</button>
      </div>
    </div>
    <button class="add-btn" onclick="addUrl()">+ Add URL</button>
  </div>

  <div class="card">
    <h2>Options</h2>
    <div class="config-grid">
      <div class="config-item">
        <label>Timeout per video</label>
        <input type="number" id="timeout" value="45" min="10" max="120" />
        <div class="suffix">seconds</div>
      </div>
    </div>
  </div>

  <div class="actions">
    <button class="btn-run" id="runBtn" onclick="runScrape()">
      <span class="icon">▶</span> Scrape Comments
    </button>
  </div>

  <div class="status" id="status"></div>
  <div class="results" id="results"></div>
</div>

<script>
let urlCounter = 1;

function addUrl() {
  urlCounter++;
  const row = document.createElement('div');
  row.className = 'url-row';
  row.innerHTML = '<span class="num">' + urlCounter + '</span><input type="text" placeholder="https://www.tiktok.com/@user/video/1234567890" /><button class="remove" onclick="removeUrl(this)" title="Remove">✕</button>';
  document.getElementById('urlList').appendChild(row);
  row.querySelector('input').focus();
}

function removeUrl(btn) {
  const list = document.getElementById('urlList');
  if (list.children.length > 1) {
    btn.closest('.url-row').remove();
    list.querySelectorAll('.num').forEach((n, i) => n.textContent = i + 1);
    urlCounter = list.children.length;
  }
}

function setStatus(msg, loading) {
  const el = document.getElementById('status');
  el.className = 'status active';
  el.innerHTML = (loading ? '<span class="spinner">⏳</span> ' : '') + msg;
}

function clearStatus() {
  document.getElementById('status').className = 'status';
}

async function runScrape() {
  const inputs = document.querySelectorAll('#urlList input[type="text"]');
  const urls = Array.from(inputs).map(i => i.value.trim()).filter(u => u.includes('tiktok.com'));
  if (urls.length === 0) { alert('Enter at least one TikTok URL'); return; }

  const timeout = parseInt(document.getElementById('timeout').value) * 1000;
  const btn = document.getElementById('runBtn');
  const resultsDiv = document.getElementById('results');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner">⏳</span> Scraping...';
  resultsDiv.className = 'results';
  resultsDiv.innerHTML = '';

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    setStatus('Scraping video ' + (i + 1) + ' of ' + urls.length + '... <br><code>' + url + '</code>', true);

    try {
      const resp = await fetch('/tiktok/comments?url=' + encodeURIComponent(url) + '&timeout=' + timeout);
      const data = await resp.json();

      if (data.error) {
        resultsDiv.innerHTML += '<div class="card" style="border-color:#ef4444"><p style="color:#ef4444">Error: ' + data.error + '</p><p style="color:#666;font-size:12px">' + url + '</p></div>';
        continue;
      }

      resultsDiv.className = 'results active';
      const v = data.video || {};
      const comments = data.comments || [];
      const date = v.createTime ? new Date(v.createTime).toLocaleDateString() : '';

      let html = '<div class="video-card"><div class="video-meta"><div>';
      html += '<div class="author">' + esc(v.authorNickname || v.author || 'Unknown') + '</div>';
      html += '<div class="handle">@' + esc(v.author || '') + ' · ' + date + '</div>';
      html += '<div class="caption">' + esc(v.caption || '') + '</div>';
      html += '</div></div>';
      html += '<div class="stats">';
      html += '<div class="stat">❤️ <span>' + fmt(v.likes) + '</span></div>';
      html += '<div class="stat">💬 <span>' + fmt(v.comments) + '</span></div>';
      html += '<div class="stat">↗️ <span>' + fmt(v.shares) + '</span></div>';
      html += '<div class="stat">▶️ <span>' + fmt(v.plays) + '</span></div>';
      html += '</div></div>';

      html += '<div class="summary-bar"><div>Scraped <span class="count">' + comments.length + '</span> of ' + (data.totalComments || '?') + ' comments (' + (data.durationMs / 1000).toFixed(1) + 's)</div>';
      html += '<button class="export-btn" onclick=\\'exportJson(' + JSON.stringify(JSON.stringify(data)) + ')\\'>Export JSON</button></div>';

      html += '<div class="comments-list">';
      for (const c of comments) {
        if (!c.text && c.id === 'dom-raw') continue;
        const cDate = c.createTime ? new Date(c.createTime).toLocaleDateString() : '';
        html += '<div class="comment-item">';
        html += '<div class="comment-header">';
        if (c.authorAvatar) html += '<img class="comment-avatar" src="' + esc(c.authorAvatar) + '" onerror="this.style.display=\\'none\\'" />';
        html += '<span class="comment-author">@' + esc(c.author || 'anon') + '</span>';
        html += '<span class="comment-time">' + cDate + '</span>';
        html += '</div>';
        html += '<div class="comment-text">' + esc(c.text || '') + '</div>';
        html += '<div class="comment-footer">';
        html += '<span>❤️ ' + (c.likes || 0) + '</span>';
        if (c.replyCount > 0) html += '<span>💬 ' + c.replyCount + ' replies</span>';
        html += '</div></div>';
      }
      html += '</div>';
      resultsDiv.innerHTML += html;

    } catch (e) {
      resultsDiv.className = 'results active';
      resultsDiv.innerHTML += '<div class="card" style="border-color:#ef4444"><p style="color:#ef4444">Request failed: ' + e.message + '</p></div>';
    }
  }

  clearStatus();
  btn.disabled = false;
  btn.innerHTML = '<span class="icon">▶</span> Scrape Comments';
}

function exportJson(jsonStr) {
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tiktok-comments-' + Date.now() + '.json';
  a.click();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmt(n) { if (!n) return '0'; if (n >= 1000000) return (n/1000000).toFixed(1) + 'M'; if (n >= 1000) return (n/1000).toFixed(1) + 'K'; return n.toString(); }
</script>
</body>
</html>`);
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
                    try {
                        const { body, base64Encoded } = await cdp.send('Network.getResponseBody', {
                            requestId: event.requestId,
                        });
                        const bodyText = base64Encoded ? Buffer.from(body, 'base64').toString('utf-8') : body;

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

        // Wait for comment section to load and comments to appear
        await page.waitForTimeout(3000);

        // Try to click the comments section to ensure it's open
        try {
            const commentButton = page.locator('[data-e2e="comment-icon"]').first();
            if (await commentButton.isVisible({ timeout: 3000 })) {
                await commentButton.click();
                await page.waitForTimeout(2000);
            }
        } catch {
            // Comment section might already be visible
        }

        // Find the scrollable comment container and paginate
        const deadline = Date.now() + timeoutMs;
        let previousCount = 0;
        let staleCycles = 0;
        const MAX_STALE_CYCLES = 3;

        while (Date.now() < deadline && staleCycles < MAX_STALE_CYCLES) {
            const prevSize = comments.size;

            // Scroll inside the actual comment container
            await page.evaluate(() => {
                // Strategy 1: Find the scrollable container by testing scroll properties
                // TikTok's comment section is a div with overflow-y: auto/scroll
                const candidates = [
                    // Known TikTok comment container selectors
                    ...document.querySelectorAll('[class*="DivCommentListContainer"]'),
                    ...document.querySelectorAll('[class*="CommentListContainer"]'),
                    ...document.querySelectorAll('[data-e2e="comment-list"]'),
                    ...document.querySelectorAll('[class*="comment-list"]'),
                ];

                // If known selectors found, scroll the first scrollable one
                for (const el of candidates) {
                    if (el.scrollHeight > el.clientHeight) {
                        el.scrollTop = el.scrollHeight;
                        return;
                    }
                }

                // Strategy 2: Walk up from a comment element to find its scrollable parent
                const anyComment = document.querySelector('[data-e2e="comment-level-1"]') ||
                    document.querySelector('[class*="DivCommentItemContainer"]') ||
                    document.querySelector('[class*="CommentItem"]');
                if (anyComment) {
                    let parent = anyComment.parentElement;
                    while (parent && parent !== document.body) {
                        const style = window.getComputedStyle(parent);
                        const overflowY = style.overflowY;
                        if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight + 50) {
                            parent.scrollTop = parent.scrollHeight;
                            return;
                        }
                        parent = parent.parentElement;
                    }
                }

                // Strategy 3: Find any deeply scrollable div that's likely the comment panel
                const allDivs = document.querySelectorAll('div');
                let bestDiv: Element | null = null;
                let bestOverflow = 0;
                for (const div of allDivs) {
                    const overflow = div.scrollHeight - div.clientHeight;
                    if (overflow > 200 && overflow > bestOverflow) {
                        const style = window.getComputedStyle(div);
                        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                            // Check it's not the main page scroller or video container
                            const rect = div.getBoundingClientRect();
                            if (rect.width < window.innerWidth * 0.8) { // Side panel, not full width
                                bestDiv = div;
                                bestOverflow = overflow;
                            }
                        }
                    }
                }
                if (bestDiv) {
                    bestDiv.scrollTop = bestDiv.scrollHeight;
                    return;
                }

                // Last resort: scroll the page itself
                window.scrollBy(0, 1500);
            });

            // Wait for potential API response — use a short wait then check
            await page.waitForTimeout(2000);

            // Check if new comments arrived
            if (comments.size > prevSize) {
                staleCycles = 0;
                console.log(`[tiktok] scroll → ${comments.size} comments (+${comments.size - prevSize})`);
            } else {
                staleCycles++;
                // On stale, wait a bit longer before next attempt
                await page.waitForTimeout(1000);
            }

            previousCount = comments.size;
        }

        console.log(`[tiktok] scroll done — ${comments.size} comments, ${staleCycles} stale cycles`);

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
