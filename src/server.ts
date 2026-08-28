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
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Papa Crawlee — apify.beenex.org</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 40px 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                h1 { color: #fff; border-bottom: 1px solid #2a2a2a; padding-bottom: 12px; }
                a { color: #3b82f6; text-decoration: none; }
                a:hover { text-decoration: underline; }
                .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 18px; margin: 16px 0; }
                .badge { background: #22c55e; color: #000; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-left: 8px; }
                ul { padding-left: 20px; }
                li { margin: 8px 0; }
                code { background: #222; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
            </style>
        </head>
        <body>
            <h1>Papa Crawlee <span class="badge">LIVE</span></h1>
            <p>Deployed on Coolify (Lenovo • <a href="http://apify.beenex.org">apify.beenex.org</a>)</p>

            <div class="card">
                <h3>TikTok Scrapers</h3>
                <ul>
                    <li><a href="/tiktok"><strong>/tiktok</strong></a> — Interactive Web UI for TikTok Scrapers (Creator Posts & Community Reposts)</li>
                    <li><a href="/tiktok/posts?handle=openai&limit=30">/tiktok/posts?handle=openai&limit=30</a> — Scrape categorized creator posts & community reposts</li>
                    <li><a href="/tiktok/comments?url=https://www.tiktok.com/@arc_journal/video/7402747839643667743">/tiktok/comments?url=...</a> — Scrape video comments</li>
                </ul>
            </div>

            <div class="card">
                <h3>General & Smoke Endpoints</h3>
                <ul>
                    <li><a href="/crawl?url=https://crawlee.dev">/crawl?url=https://crawlee.dev</a> — CheerioCrawler smoke test</li>
                    <li><a href="/crawl?case=books">/crawl?case=books</a> — books.toscrape pagination</li>
                    <li><a href="/crawl?case=quotes">/crawl?case=quotes</a> — quotes.toscrape router</li>
                    <li><a href="/crawl?case=httpbin">/crawl?case=httpbin</a> — httpbin json</li>
                    <li><a href="/zapier?limit=100&pages=1">/zapier?limit=100&pages=1</a> — Zapier integration list (10,014 apps)</li>
                    <li><a href="/health">/health</a> — Health check</li>
                </ul>
            </div>
            <p style="color: #666; font-size: 13px;">Powered by Crawlee + Playwright Stealth + xvfb</p>
        </body>
        </html>
    `);
});

// ── TikTok Scraper UI ─────────────────────────────────────────────────────────
app.get('/tiktok', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TikTok Scraper Suite — Papa Crawlee</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e0e0e0; min-height: 100vh; padding: 0; }
  .header { background: #1a1a1a; border-bottom: 1px solid #2a2a2a; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 18px; font-weight: 600; color: #fff; }
  .header .badge { background: #22c55e; color: #000; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .container { max-width: 960px; margin: 28px auto; padding: 0 20px; }
  
  .tabs { display: flex; gap: 8px; border-bottom: 1px solid #2a2a2a; margin-bottom: 20px; }
  .tab-btn { background: transparent; border: none; color: #888; font-size: 14px; font-weight: 600; padding: 10px 18px; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
  .tab-btn:hover { color: #fff; }
  .tab-btn.active { color: #3b82f6; border-bottom-color: #3b82f6; }

  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .card h2 { font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }
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
  .config-item .suffix { color: #666; font-size: 12px; margin-top: 4px; }
  .actions { display: flex; gap: 12px; margin-top: 8px; }
  .btn-run { background: #22c55e; color: #000; border: none; border-radius: 8px; padding: 12px 28px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
  .btn-run:hover { background: #16a34a; }
  .btn-run:disabled { background: #333; color: #666; cursor: not-allowed; }
  .status { margin-top: 20px; padding: 16px; background: #111; border: 1px solid #2a2a2a; border-radius: 8px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; color: #888; min-height: 40px; display: none; }
  .status.active { display: block; }
  .status .spinner { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .results { margin-top: 20px; display: none; }
  .results.active { display: block; }

  /* User Profile Header */
  .profile-banner { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; gap: 20px; align-items: center; }
  .profile-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; background: #333; border: 2px solid #3b82f6; }
  .profile-info { flex: 1; }
  .profile-name { font-size: 18px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px; }
  .profile-handle { color: #3b82f6; font-size: 14px; margin-top: 2px; }
  .profile-bio { color: #aaa; font-size: 13px; margin-top: 8px; line-height: 1.4; }
  .profile-stats { display: flex; gap: 20px; margin-top: 12px; }
  .p-stat { font-size: 13px; color: #888; }
  .p-stat span { color: #fff; font-weight: 700; }
  .verified-badge { background: #3b82f6; color: #fff; border-radius: 50%; font-size: 11px; width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; }

  /* Filter Toolbar */
  .filter-toolbar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .filter-btn { background: #161616; border: 1px solid #333; color: #aaa; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 20px; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
  .filter-btn:hover { color: #fff; border-color: #555; background: #222; }
  .filter-btn.active { background: #2563eb; color: #fff; border-color: #3b82f6; }
  .filter-btn .badge-num { background: rgba(0,0,0,0.35); font-size: 11px; padding: 2px 6px; border-radius: 10px; }

  /* Posts Grid */
  .posts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px; }
  .post-card { background: #161616; border: 1px solid #262626; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.15s, border-color 0.15s; }
  .post-card:hover { transform: translateY(-2px); border-color: #3b82f6; }
  .post-cover-wrapper { position: relative; width: 100%; aspect-ratio: 9/16; background: #222; max-height: 280px; overflow: hidden; }
  .post-cover { width: 100%; height: 100%; object-fit: cover; }
  .post-duration { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.75); color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
  
  .badge-container { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .badge-tag { font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
  .badge-pinned { background: #ef4444; color: #fff; }
  .badge-creator { background: #059669; color: #fff; }
  .badge-repost { background: #8b5cf6; color: #fff; }

  .post-body { padding: 12px 14px; display: flex; flex-direction: column; flex: 1; justify-content: space-between; }
  .post-author-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 12px; }
  .post-author-avatar { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
  .post-author-name { color: #3b82f6; font-weight: 600; }
  .post-type-label { font-size: 11px; color: #888; margin-left: auto; }
  .post-caption { font-size: 13px; color: #ddd; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 10px; }
  .post-date { font-size: 11px; color: #666; margin-bottom: 8px; }
  .post-stats { display: flex; justify-content: space-between; font-size: 12px; color: #888; border-top: 1px solid #222; padding-top: 8px; }
  .post-stat { display: flex; align-items: center; gap: 4px; }
  .post-link { display: block; text-align: center; background: #1e293b; color: #3b82f6; padding: 6px; border-radius: 6px; font-size: 12px; text-decoration: none; margin-top: 10px; font-weight: 500; }
  .post-link:hover { background: #1e3a5f; }

  /* Comments UI items */
  .video-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .video-meta { display: flex; gap: 16px; align-items: flex-start; }
  .video-meta .author { font-weight: 600; color: #fff; font-size: 15px; }
  .video-meta .handle { color: #3b82f6; font-size: 13px; }
  .video-meta .caption { color: #aaa; font-size: 13px; margin-top: 6px; line-height: 1.5; }
  .stats { display: flex; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
  .stat { font-size: 13px; color: #888; }
  .stat span { color: #fff; font-weight: 600; }
  .comments-list { display: flex; flex-direction: column; gap: 8px; }
  .comment-item { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px 18px; }
  .comment-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .comment-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: #333; }
  .comment-author { font-weight: 600; color: #fff; font-size: 13px; }
  .comment-time { color: #555; font-size: 11px; margin-left: auto; }
  .comment-text { color: #ccc; font-size: 14px; line-height: 1.5; }
  .comment-footer { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: #666; }
  
  .summary-bar { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 12px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #888; flex-wrap: wrap; gap: 10px; }
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
  <h1>TikTok Scraper Suite</h1>
  <span class="badge">LIVE</span>
</div>

<div class="container">
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('postsTab', this)">📹 Creator & Community Posts Scraper</button>
    <button class="tab-btn" onclick="switchTab('commentsTab', this)">💬 Video Comments Scraper</button>
  </div>

  <!-- TAB 1: USER & REPOST SCRAPER -->
  <div id="postsTab" class="tab-content active">
    <div class="card">
      <h2>Target TikTok Creator Handle</h2>
      <label>Username or Profile URL</label>
      <input type="text" id="postHandle" placeholder="@openai or charlidamelio or https://www.tiktok.com/@openai" value="@openai" />
    </div>

    <div class="card">
      <h2>Options</h2>
      <div class="config-grid">
        <div class="config-item">
          <label>Max Videos to Scrape</label>
          <input type="number" id="postLimit" value="50" min="5" max="200" />
          <div class="suffix">videos (max 200)</div>
        </div>
        <div class="config-item">
          <label>Timeout</label>
          <input type="number" id="postTimeout" value="60" min="15" max="180" />
          <div class="suffix">seconds</div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-run" id="runPostsBtn" onclick="runPostsScrape()">
        <span class="icon">▶</span> Scrape Posts & Reposts
      </button>
    </div>

    <div class="status" id="postsStatus"></div>
    <div class="results" id="postsResults"></div>
  </div>

  <!-- TAB 2: COMMENTS SCRAPER -->
  <div id="commentsTab" class="tab-content">
    <div class="card">
      <h2>Input</h2>
      <label>TikTok video URLs</label>
      <div class="url-list" id="urlList">
        <div class="url-row">
          <span class="num">1</span>
          <input type="text" placeholder="https://www.tiktok.com/@user/video/1234567890" value="https://www.tiktok.com/@arc_journal/video/7402747839643667743" />
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
          <input type="number" id="commentTimeout" value="45" min="10" max="120" />
          <div class="suffix">seconds</div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-run" id="runCommentsBtn" onclick="runCommentsScrape()">
        <span class="icon">▶</span> Scrape Comments
      </button>
    </div>

    <div class="status" id="commentsStatus"></div>
    <div class="results" id="commentsResults"></div>
  </div>
</div>

<script>
var currentPostsData = null;
var currentCommentsData = null;
var currentPostFilter = 'all';

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmt(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

// ── Tab 1: User Posts & Reposts Logic ────────────────────────────────────────
async function runPostsScrape() {
  var handleInput = document.getElementById('postHandle').value.trim();
  if (!handleInput) { alert('Please enter a TikTok handle or profile URL'); return; }

  var limit = parseInt(document.getElementById('postLimit').value, 10) || 50;
  var timeout = (parseInt(document.getElementById('postTimeout').value, 10) || 60) * 1000;

  var btn = document.getElementById('runPostsBtn');
  var statusEl = document.getElementById('postsStatus');
  var resultsEl = document.getElementById('postsResults');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner">⏳</span> Scraping profile & reposts...';
  statusEl.className = 'status active';
  statusEl.innerHTML = '<span class="spinner">⏳</span> Loading profile, creator videos, and community reposts for <strong>' + esc(handleInput) + '</strong>...';
  resultsEl.className = 'results';
  resultsEl.innerHTML = '';

  try {
    var url = '/tiktok/posts?handle=' + encodeURIComponent(handleInput) + '&limit=' + limit + '&timeout=' + timeout;
    var resp = await fetch(url);
    var data = await resp.json();

    if (data.error) {
      statusEl.className = 'status active';
      statusEl.innerHTML = '❌ Error: ' + esc(data.error);
      btn.disabled = false;
      btn.innerHTML = '<span class="icon">▶</span> Scrape Posts & Reposts';
      return;
    }

    currentPostsData = data;
    currentPostFilter = 'all';
    renderPostsUI();

  } catch (e) {
    statusEl.className = 'status active';
    statusEl.innerHTML = '❌ Request failed: ' + esc(e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="icon">▶</span> Scrape Posts & Reposts';
  }
}

function setPostFilter(filterType) {
  currentPostFilter = filterType;
  renderPostsUI();
}

function renderPostsUI() {
  var data = currentPostsData;
  if (!data) return;
  var u = data.user || {};
  var summary = data.summary || {};
  var allPosts = data.posts || [];
  var creatorPosts = data.creatorPosts || [];
  var commReposts = data.communityReposts || [];
  
  var statusEl = document.getElementById('postsStatus');
  var resultsEl = document.getElementById('postsResults');

  var filteredPosts = allPosts;
  if (currentPostFilter === 'creator') filteredPosts = creatorPosts;
  if (currentPostFilter === 'repost') filteredPosts = commReposts;

  var html = '';
  
  // Profile Banner
  html += '<div class="profile-banner">';
  if (u.avatar) {
    html += '<img class="profile-avatar" src="' + esc(u.avatar) + '" onerror="this.style.display=\\'none\\'" />';
  }
  html += '<div class="profile-info">';
  html += '<div class="profile-name">' + esc(u.nickname || u.handle || 'Creator') + (u.verified ? ' <span class="verified-badge">✓</span>' : '') + '</div>';
  html += '<div class="profile-handle">@' + esc(u.handle || '') + '</div>';
  if (u.bio) html += '<div class="profile-bio">' + esc(u.bio) + '</div>';
  html += '<div class="profile-stats">';
  html += '<div class="p-stat">Followers: <span>' + fmt(u.followerCount) + '</span></div>';
  html += '<div class="p-stat">Following: <span>' + fmt(u.followingCount) + '</span></div>';
  html += '<div class="p-stat">Likes: <span>' + fmt(u.heartCount) + '</span></div>';
  html += '<div class="p-stat">Total Videos: <span>' + fmt(u.videoCount) + '</span></div>';
  html += '</div></div></div>';

  // Summary bar & export
  html += '<div class="summary-bar">';
  html += '<div>Scraped <span class="count">' + allPosts.length + '</span> total videos (<span style="color:#059669;font-weight:700">' + creatorPosts.length + ' creator</span> + <span style="color:#8b5cf6;font-weight:700">' + commReposts.length + ' reposts</span>) in ' + (data.durationMs / 1000).toFixed(1) + 's</div>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<button class="export-btn" onclick="exportPostsJson()">Export JSON</button>';
  html += '<button class="export-btn" onclick="exportPostsCsv()">Export CSV</button>';
  html += '</div></div>';

  // Filter Toolbar Tabs
  html += '<div class="filter-toolbar">';
  html += '<button class="filter-btn ' + (currentPostFilter === 'all' ? 'active' : '') + '" onclick="setPostFilter(\\'all\\')">🔘 All Posts <span class="badge-num">' + allPosts.length + '</span></button>';
  html += '<button class="filter-btn ' + (currentPostFilter === 'creator' ? 'active' : '') + '" onclick="setPostFilter(\\'creator\\')">📹 Creator Uploads <span class="badge-num">' + creatorPosts.length + '</span></button>';
  html += '<button class="filter-btn ' + (currentPostFilter === 'repost' ? 'active' : '') + '" onclick="setPostFilter(\\'repost\\')">🔁 Community Reposts & Mentions <span class="badge-num">' + commReposts.length + '</span></button>';
  html += '</div>';

  // Posts Grid
  html += '<div class="posts-grid">';
  for (var i = 0; i < filteredPosts.length; i++) {
    var p = filteredPosts[i];
    var isCreator = p.postType === 'creator_post';
    var date = p.createTime ? new Date(p.createTime).toLocaleDateString() : '';
    var stats = p.stats || {};
    var auth = p.author || {};

    html += '<div class="post-card">';
    
    html += '<div class="post-cover-wrapper">';
    if (p.coverUrl) {
      html += '<img class="post-cover" src="' + esc(p.coverUrl) + '" loading="lazy" />';
    }
    
    html += '<div class="badge-container">';
    if (p.isPinned) html += '<span class="badge-tag badge-pinned">📌 PINNED</span>';
    if (isCreator) {
      html += '<span class="badge-tag badge-creator">📹 CREATOR POST</span>';
    } else {
      html += '<span class="badge-tag badge-repost">🔁 COMMUNITY REPOST</span>';
    }
    html += '</div>';

    if (p.duration) html += '<span class="post-duration">' + p.duration + 's</span>';
    html += '</div>';

    html += '<div class="post-body">';
    html += '<div>';
    
    html += '<div class="post-author-row">';
    if (auth.avatar) html += '<img class="post-author-avatar" src="' + esc(auth.avatar) + '" onerror="this.style.display=\\'none\\'" />';
    html += '<span class="post-author-name">@' + esc(auth.handle || '') + '</span>';
    html += '<span class="post-type-label">' + (isCreator ? 'Creator Video' : 'Repost / Tagged') + '</span>';
    html += '</div>';

    html += '<div class="post-caption">' + esc(p.caption || '(No caption)') + '</div>';
    html += '<div class="post-date">📅 ' + date + '</div>';
    html += '</div>';

    html += '<div>';
    html += '<div class="post-stats">';
    html += '<div class="post-stat" title="Views">▶️ ' + fmt(stats.plays) + '</div>';
    html += '<div class="post-stat" title="Likes">❤️ ' + fmt(stats.likes) + '</div>';
    html += '<div class="post-stat" title="Comments">💬 ' + fmt(stats.comments) + '</div>';
    html += '<div class="post-stat" title="Shares">↗️ ' + fmt(stats.shares) + '</div>';
    html += '</div>';
    html += '<a class="post-link" href="' + esc(p.url) + '" target="_blank" rel="noopener">Open on TikTok ↗</a>';
    html += '</div>';

    html += '</div></div>';
  }
  html += '</div>';

  statusEl.className = 'status';
  resultsEl.className = 'results active';
  resultsEl.innerHTML = html;
}

function exportPostsJson() {
  if (!currentPostsData) return;
  var jsonStr = JSON.stringify(currentPostsData, null, 2);
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  var handle = currentPostsData.user ? currentPostsData.user.handle : 'user';
  a.download = 'tiktok-posts-' + handle + '-' + Date.now() + '.json';
  a.click();
}

function exportPostsCsv() {
  if (!currentPostsData || !currentPostsData.posts) return;
  var posts = currentPostsData.posts;
  var headers = ['id', 'category', 'authorHandle', 'url', 'caption', 'createTime', 'duration', 'likes', 'comments', 'shares', 'plays', 'bookmarks', 'isPinned', 'coverUrl'];
  var rows = [headers.join(',')];
  
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var stats = p.stats || {};
    var auth = p.author || {};
    var row = [
      '"' + (p.id || '').replace(/"/g, '""') + '"',
      '"' + (p.postType === 'creator_post' ? 'Creator Upload' : 'Community Repost') + '"',
      '"' + (auth.handle || '').replace(/"/g, '""') + '"',
      '"' + (p.url || '').replace(/"/g, '""') + '"',
      '"' + (p.caption || '').replace(/"/g, '""') + '"',
      '"' + (p.createTime || '') + '"',
      p.duration || 0,
      stats.likes || 0,
      stats.comments || 0,
      stats.shares || 0,
      stats.plays || 0,
      stats.bookmarks || 0,
      p.isPinned ? 'true' : 'false',
      '"' + (p.coverUrl || '').replace(/"/g, '""') + '"'
    ];
    rows.push(row.join(','));
  }
  
  var csvText = rows.join(String.fromCharCode(10));
  var blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  var handle = currentPostsData.user ? currentPostsData.user.handle : 'user';
  a.download = 'tiktok-posts-' + handle + '-' + Date.now() + '.csv';
  a.click();
}

// ── Tab 2: Comments Logic ────────────────────────────────────────────────────
var urlCounter = 1;
function addUrl() {
  urlCounter++;
  var row = document.createElement('div');
  row.className = 'url-row';
  row.innerHTML = '<span class="num">' + urlCounter + '</span><input type="text" placeholder="https://www.tiktok.com/@user/video/1234567890" /><button class="remove" onclick="removeUrl(this)" title="Remove">✕</button>';
  document.getElementById('urlList').appendChild(row);
  row.querySelector('input').focus();
}

function removeUrl(btn) {
  var list = document.getElementById('urlList');
  if (list.children.length > 1) {
    btn.closest('.url-row').remove();
    list.querySelectorAll('.num').forEach(function(n, i) { n.textContent = i + 1; });
    urlCounter = list.children.length;
  }
}

async function runCommentsScrape() {
  var inputs = document.querySelectorAll('#urlList input[type="text"]');
  var urls = Array.from(inputs).map(function(i) { return i.value.trim(); }).filter(function(u) { return u.includes('tiktok.com'); });
  if (urls.length === 0) { alert('Enter at least one TikTok URL'); return; }

  var timeout = parseInt(document.getElementById('commentTimeout').value) * 1000;
  var btn = document.getElementById('runCommentsBtn');
  var statusEl = document.getElementById('commentsStatus');
  var resultsDiv = document.getElementById('commentsResults');
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner">⏳</span> Scraping...';
  statusEl.className = 'status active';
  resultsDiv.className = 'results';
  resultsDiv.innerHTML = '';

  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];
    statusEl.innerHTML = '<span class="spinner">⏳</span> Scraping video ' + (i + 1) + ' of ' + urls.length + '... <br><code>' + esc(url) + '</code>';

    try {
      var resp = await fetch('/tiktok/comments?url=' + encodeURIComponent(url) + '&timeout=' + timeout);
      var data = await resp.json();

      if (data.error) {
        resultsDiv.innerHTML += '<div class="card" style="border-color:#ef4444"><p style="color:#ef4444">Error: ' + esc(data.error) + '</p><p style="color:#666;font-size:12px">' + esc(url) + '</p></div>';
        continue;
      }

      currentCommentsData = data;
      resultsDiv.className = 'results active';
      var v = data.video || {};
      var comments = data.comments || [];
      var date = v.createTime ? new Date(v.createTime).toLocaleDateString() : '';

      var html = '<div class="video-card"><div class="video-meta"><div>';
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
      html += '<button class="export-btn" onclick="exportCommentsJson()">Export JSON</button></div>';

      html += '<div class="comments-list">';
      for (var j = 0; j < comments.length; j++) {
        var c = comments[j];
        if (!c.text && c.id === 'dom-raw') continue;
        var cDate = c.createTime ? new Date(c.createTime).toLocaleDateString() : '';
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
      resultsDiv.innerHTML += '<div class="card" style="border-color:#ef4444"><p style="color:#ef4444">Request failed: ' + esc(e.message) + '</p></div>';
    }
  }

  statusEl.className = 'status';
  btn.disabled = false;
  btn.innerHTML = '<span class="icon">▶</span> Scrape Comments';
}

function exportCommentsJson() {
  if (!currentCommentsData) return;
  var jsonStr = JSON.stringify(currentCommentsData, null, 2);
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tiktok-comments-' + Date.now() + '.json';
  a.click();
}
</script>
</body>
</html>`);
});

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ── Zapier Endpoints ──────────────────────────────────────────────────────────

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

// ── TikTok Interfaces ─────────────────────────────────────────────────────────

export type TikTokPostType = 'creator_post' | 'community_repost';

interface TikTokUser {
    id: string;
    handle: string;
    nickname: string;
    avatar: string;
    bio: string;
    bioLink?: string;
    verified: boolean;
    followerCount: number;
    followingCount: number;
    heartCount: number;
    videoCount: number;
}

interface TikTokPost {
    id: string;
    url: string;
    caption: string;
    createTime: string;
    duration: number;
    coverUrl: string;
    postType: TikTokPostType;
    stats: {
        likes: number;
        comments: number;
        shares: number;
        plays: number;
        bookmarks: number;
    };
    author: {
        handle: string;
        nickname: string;
        avatar: string;
        verified: boolean;
    };
    music?: {
        id: string;
        title: string;
        author: string;
        isOriginal: boolean;
    };
    isPinned: boolean;
    hashtags?: string[];
}

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

function parsePostItem(
    item: any,
    defaultType: TikTokPostType = 'creator_post',
    targetHandle?: string,
): TikTokPost | null {
    if (!item || !item.id) return null;
    const authorUniqueId = item.author?.uniqueId || item.author?.unique_id || item.authorName || '';
    const desc = item.desc || item.title || '';
    
    // Automatically determine postType
    let postType: TikTokPostType = defaultType;
    if (targetHandle && authorUniqueId) {
        if (authorUniqueId.toLowerCase() === targetHandle.toLowerCase()) {
            postType = 'creator_post';
        } else {
            postType = 'community_repost';
        }
    }

    // Extract hashtags from challenges or textExtra or desc regex
    const hashtags: string[] = [];
    if (Array.isArray(item.challenges)) {
        item.challenges.forEach((ch: any) => { if (ch.title) hashtags.push(ch.title); });
    } else if (Array.isArray(item.textExtra)) {
        item.textExtra.forEach((te: any) => { if (te.hashtagName) hashtags.push(te.hashtagName); });
    }
    if (hashtags.length === 0 && desc) {
        const matches = desc.match(/#(\w+)/g);
        if (matches) matches.forEach((m: string) => hashtags.push(m.replace('#', '')));
    }

    return {
        id: String(item.id),
        url: `https://www.tiktok.com/@${authorUniqueId || targetHandle || ''}/video/${item.id}`,
        caption: desc,
        createTime: item.createTime ? new Date(Number(item.createTime) * 1000).toISOString() : new Date().toISOString(),
        duration: Number(item.video?.duration || 0),
        coverUrl: item.video?.cover || item.video?.originCover || item.video?.dynamicCover || '',
        postType,
        stats: {
            likes: Number(item.stats?.diggCount ?? item.stats?.digg_count ?? 0),
            comments: Number(item.stats?.commentCount ?? item.stats?.comment_count ?? 0),
            shares: Number(item.stats?.shareCount ?? item.stats?.share_count ?? 0),
            plays: Number(item.stats?.playCount ?? item.stats?.play_count ?? 0),
            bookmarks: Number(item.stats?.collectCount ?? item.stats?.collect_count ?? 0),
        },
        author: {
            handle: authorUniqueId || targetHandle || '',
            nickname: item.author?.nickname || '',
            avatar: item.author?.avatarThumb || item.author?.avatar_thumb?.url_list?.[0] || '',
            verified: !!(item.author?.verified || item.author?.customVerify),
        },
        music: item.music ? {
            id: String(item.music.id || ''),
            title: item.music.title || '',
            author: item.music.authorName || item.music.author || '',
            isOriginal: !!item.music.original,
        } : undefined,
        isPinned: !!(item.isPinnedItem || item.isTop || item.item_control?.show_pin_tag),
        hashtags: Array.from(new Set(hashtags)),
    };
}

function normalizeTikTokHandle(raw: string): string {
    let clean = raw.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
        try {
            const parsedUrl = new URL(clean);
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            const userPart = pathParts.find(p => p.startsWith('@'));
            if (userPart) {
                clean = userPart.replace('@', '');
            } else if (pathParts.length > 0) {
                clean = pathParts[0].replace('@', '');
            }
        } catch {
            clean = clean.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '').split('/')[0].split('?')[0];
        }
    }
    return clean.replace(/^@/, '').trim();
}

// ── Scraper: TikTok User Profile, Creator Posts & Community Reposts ──────────

async function scrapeTikTokUserPosts(
    rawHandle: string,
    maxPosts = 50,
    timeoutMs = 60000,
): Promise<{
    user: TikTokUser | null;
    summary: {
        total: number;
        creatorPostsCount: number;
        communityRepostsCount: number;
    };
    posts: TikTokPost[];
    creatorPosts: TikTokPost[];
    communityReposts: TikTokPost[];
    durationMs: number;
    error?: string;
}> {
    const start = Date.now();
    const handle = normalizeTikTokHandle(rawHandle);
    if (!handle) {
        return {
            user: null,
            summary: { total: 0, creatorPostsCount: 0, communityRepostsCount: 0 },
            posts: [],
            creatorPosts: [],
            communityReposts: [],
            durationMs: 0,
            error: 'Invalid or empty TikTok handle',
        };
    }

    const targetUrl = `https://www.tiktok.com/@${handle}`;
    const creatorPostsMap = new Map<string, TikTokPost>();
    const communityRepostsMap = new Map<string, TikTokPost>();
    let user: TikTokUser | null = null;
    let browser;

    try {
        browser = await chromium.launch({
            headless: false, // Headed Chrome inside xvfb
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

        // Listen for both /api/post/item_list (creator videos) and /api/repost/item_list (reposts/mentions)
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('tiktok.com') && (url.includes('/api/post/item_list') || url.includes('/api/repost/item_list'))) {
                try {
                    const json = await response.json();
                    const list = json.itemList || json.items || json.data?.itemList || [];
                    if (Array.isArray(list)) {
                        for (const item of list) {
                            const itemAuthor = (item.author?.uniqueId || item.author?.unique_id || '').toLowerCase();
                            const isCreator = itemAuthor === handle.toLowerCase();
                            const parsed = parsePostItem(item, isCreator ? 'creator_post' : 'community_repost', handle);
                            if (parsed && parsed.id) {
                                if (isCreator) {
                                    creatorPostsMap.set(parsed.id, parsed);
                                } else {
                                    communityRepostsMap.set(parsed.id, parsed);
                                }
                            }
                        }
                        console.log(`[tiktok-posts] captured: ${creatorPostsMap.size} creator posts, ${communityRepostsMap.size} community reposts`);
                    }
                } catch (e: any) {
                    // Ignore non-JSON streams
                }
            }
        });

        console.log(`[tiktok-posts] navigating to ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

        // 1. Parse rehydration data from SSR HTML
        try {
            const rehydrationData = await page.evaluate(() => {
                const script = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (script?.textContent) {
                    try { return JSON.parse(script.textContent); } catch { return null; }
                }
                const sigi = (window as any)['SIGI_STATE'];
                if (sigi) return { SIGI_STATE: sigi };
                return null;
            });

            if (rehydrationData) {
                const scope = rehydrationData['__DEFAULT_SCOPE__'] || {};
                const userDetail = scope['webapp.user-detail'] || scope['webapp.user_detail'] || {};
                const userInfo = userDetail.userInfo || {};
                const rawUser = userInfo.user || {};
                const rawStats = userInfo.stats || {};

                if (rawUser.id || rawUser.uniqueId) {
                    user = {
                        id: String(rawUser.id || ''),
                        handle: rawUser.uniqueId || handle,
                        nickname: rawUser.nickname || '',
                        avatar: rawUser.avatarLarger || rawUser.avatarMedium || rawUser.avatarThumb || '',
                        bio: rawUser.signature || '',
                        bioLink: rawUser.bioLink?.link || '',
                        verified: !!rawUser.verified,
                        followerCount: Number(rawStats.followerCount || 0),
                        followingCount: Number(rawStats.followingCount || 0),
                        heartCount: Number(rawStats.heartCount || rawStats.heart || 0),
                        videoCount: Number(rawStats.videoCount || 0),
                    };
                    console.log(`[tiktok-posts] extracted user @${user.handle} (${user.followerCount} followers)`);
                }

                // Initial batch of items from SSR
                const rawItems = userDetail.itemList || userDetail.items || [];
                if (Array.isArray(rawItems)) {
                    for (const item of rawItems) {
                        const itemAuthor = (item.author?.uniqueId || item.author?.unique_id || '').toLowerCase();
                        const isCreator = !itemAuthor || itemAuthor === handle.toLowerCase();
                        const parsed = parsePostItem(item, isCreator ? 'creator_post' : 'community_repost', handle);
                        if (parsed && parsed.id) {
                            if (isCreator) creatorPostsMap.set(parsed.id, parsed);
                            else communityRepostsMap.set(parsed.id, parsed);
                        }
                    }
                }

                // Also check SIGI_STATE ItemModule with categorization
                if (rehydrationData.SIGI_STATE?.ItemModule) {
                    const itemModule = rehydrationData.SIGI_STATE.ItemModule;
                    for (const item of Object.values(itemModule) as any[]) {
                        const itemAuthor = (item.author?.uniqueId || item.author?.unique_id || '').toLowerCase();
                        const isCreator = itemAuthor === handle.toLowerCase();
                        const parsed = parsePostItem(item, isCreator ? 'creator_post' : 'community_repost', handle);
                        if (parsed && parsed.id) {
                            if (isCreator) creatorPostsMap.set(parsed.id, parsed);
                            else communityRepostsMap.set(parsed.id, parsed);
                        }
                    }
                }
            }
        } catch (e: any) {
            console.log(`[tiktok-posts] rehydration parse failed: ${e.message}`);
        }

        // 2. Auto-scroll to load more posts up to maxPosts
        const deadline = Date.now() + timeoutMs;
        let staleCycles = 0;
        const MAX_STALE_CYCLES = 5;

        while (Date.now() < deadline && (creatorPostsMap.size + communityRepostsMap.size) < maxPosts && staleCycles < MAX_STALE_CYCLES) {
            const prevTotal = creatorPostsMap.size + communityRepostsMap.size;

            // Scroll down smoothly
            await page.evaluate(() => {
                window.scrollBy({ top: 1800, behavior: 'smooth' });
            });

            await page.waitForTimeout(2000);

            // Supplementary DOM extraction for rendered video tiles
            try {
                const domPosts = await page.evaluate((currentHandle) => {
                    const items: any[] = [];
                    const postElements = document.querySelectorAll('[data-e2e="user-post-item"]');
                    const targetPath = '/@' + currentHandle.toLowerCase() + '/video/';
                    postElements.forEach((el) => {
                        const linkEl = el.querySelector('a[href*="/video/"]');
                        const imgEl = el.querySelector('img');
                        const viewsEl = el.querySelector('[data-e2e="video-views"]');
                        const href = linkEl?.getAttribute('href') || '';
                        const idMatch = href.match(/\/video\/(\d+)/);
                        if (idMatch && idMatch[1]) {
                            const id = idMatch[1];
                            const viewsText = viewsEl?.textContent?.trim() || '0';
                            const isCreator = href.toLowerCase().includes(targetPath) || href.startsWith('/video/');
                            let authorHandle = currentHandle;
                            const matchAuthor = href.match(/@([\w.-]+)/);
                            if (matchAuthor && matchAuthor[1]) authorHandle = matchAuthor[1];

                            items.push({
                                id,
                                url: href.startsWith('http') ? href : `https://www.tiktok.com/@${authorHandle}/video/${id}`,
                                cover: imgEl?.src || '',
                                title: imgEl?.alt || linkEl?.getAttribute('title') || '',
                                viewsText,
                                isCreator,
                                authorHandle,
                            });
                        }
                    });
                    return items;
                }, handle);

                for (const dp of domPosts) {
                    if (!creatorPostsMap.has(dp.id) && !communityRepostsMap.has(dp.id)) {
                        const newPost: TikTokPost = {
                            id: dp.id,
                            url: dp.url,
                            caption: dp.title || '',
                            createTime: '',
                            duration: 0,
                            coverUrl: dp.cover || '',
                            postType: dp.isCreator ? 'creator_post' : 'community_repost',
                            stats: {
                                likes: 0,
                                comments: 0,
                                shares: 0,
                                plays: 0,
                                bookmarks: 0,
                            },
                            author: {
                                handle: dp.authorHandle || handle,
                                nickname: dp.isCreator ? (user?.nickname || '') : '',
                                avatar: dp.isCreator ? (user?.avatar || '') : '',
                                verified: dp.isCreator ? (user?.verified || false) : false,
                            },
                            isPinned: false,
                        };
                        if (dp.isCreator) creatorPostsMap.set(dp.id, newPost);
                        else communityRepostsMap.set(dp.id, newPost);
                    }
                }
            } catch {
                // Ignore DOM parse errors
            }

            if (creatorPostsMap.size + communityRepostsMap.size === prevTotal) {
                staleCycles++;
                // Nudge scroll to bottom
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(2500);
            } else {
                staleCycles = 0;
            }
        }

        await context.close();
    } catch (e: any) {
        console.error(`[tiktok-posts] error: ${e.message}`);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }

    // Sort creator posts: pinned first, then chronological
    const sortedCreatorPosts = Array.from(creatorPostsMap.values())
        .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

    const sortedCommunityReposts = Array.from(communityRepostsMap.values());

    // Combined list with creator uploads first, then community reposts
    const combinedPosts = [...sortedCreatorPosts, ...sortedCommunityReposts].slice(0, maxPosts);

    return {
        user,
        summary: {
            total: sortedCreatorPosts.length + sortedCommunityReposts.length,
            creatorPostsCount: sortedCreatorPosts.length,
            communityRepostsCount: sortedCommunityReposts.length,
        },
        posts: combinedPosts,
        creatorPosts: sortedCreatorPosts,
        communityReposts: sortedCommunityReposts,
        durationMs: Date.now() - start,
    };
}

// ── API: TikTok User Posts ───────────────────────────────────────────────────

app.get('/tiktok/posts', async (req, res) => {
    const handle = (req.query.handle as string) || (req.query.user as string) || (req.query.url as string);
    if (!handle) {
        return res.status(400).json({
            error: 'Missing ?handle= parameter. Provide a TikTok handle e.g. /tiktok/posts?handle=openai',
        });
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const timeout = Math.min(parseInt((req.query.timeout as string) || '60000', 10), 180000);

    try {
        console.log(`[tiktok-posts] request for @${handle} (limit: ${limit})`);
        const result = await scrapeTikTokUserPosts(handle, limit, timeout);
        res.json({
            user: result.user,
            summary: result.summary,
            posts: result.posts,
            creatorPosts: result.creatorPosts,
            communityReposts: result.communityReposts,
            durationMs: result.durationMs,
            ...(result.error ? { error: result.error } : {}),
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// ── Scraper: TikTok Video Comments ───────────────────────────────────────────

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
            headless: false,
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

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('comment') && (url.includes('list') || url.includes('reply'))) {
                try {
                    const json = await response.json();
                    const commentList = json.comments || json.data?.comments || json.comment_list ||
                        json.reply_comments || json.data?.reply_comments || [];
                    for (const c of commentList) {
                        const parsed = parseComment(c);
                        if (parsed.id && parsed.text) {
                            comments.set(parsed.id, parsed);
                        }
                    }
                } catch {}
            }
        });

        console.log(`[tiktok] navigating to ${videoUrl}`);
        await page.goto(videoUrl, { waitUntil: 'networkidle', timeout: 30000 });

        // Extract video metadata AND comments from SSR rehydration data
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
                const detail = scope['webapp.video-detail'] || scope['webapp.video_detail'] || {};
                const itemStruct = detail.itemInfo?.itemStruct || detail.itemStruct;
                if (itemStruct) {
                    video = parseVideoMeta(itemStruct);
                }

                const commentScope = scope['webapp.comment-detail'] || scope['webapp.comment_detail'] || {};
                const possibleCommentSources = [
                    detail.commentInfo?.comments,
                    detail.comments,
                    commentScope.comments,
                    commentScope.commentList,
                ];

                for (const source of possibleCommentSources) {
                    if (Array.isArray(source) && source.length > 0) {
                        for (const c of source) {
                            const parsed = parseComment(c);
                            if (parsed.id && parsed.text) {
                                comments.set(parsed.id, parsed);
                            }
                        }
                        break;
                    }
                }
            }
        } catch (e) {
            console.log(`[tiktok] rehydration parse failed: ${e}`);
        }

        await page.waitForTimeout(3000);

        try {
            const commentButton = page.locator('[data-e2e="comment-icon"]').first();
            if (await commentButton.isVisible({ timeout: 3000 })) {
                await commentButton.click();
                await page.waitForTimeout(2000);
            }
        } catch {}

        // Locate comment list container and hover to focus
        try {
            const commentBox = page.locator('[class*="CommentListContainer"], [class*="DivCommentListContainer"], [data-e2e="comment-list"], [data-e2e="search-comment-container"]').first();
            if (await commentBox.isVisible({ timeout: 2000 })) {
                await commentBox.hover().catch(() => {});
            }
        } catch {}

        const deadline = Date.now() + timeoutMs;
        let staleCycles = 0;
        const MAX_STALE_CYCLES = 12;

        while (Date.now() < deadline && staleCycles < MAX_STALE_CYCLES) {
            const prevSize = comments.size;

            // 1. Dispatch wheel events & DOM scrolls
            await page.mouse.wheel(0, 1000).catch(() => {});
            await page.keyboard.press('PageDown').catch(() => {});

            await page.evaluate(() => {
                const candidates = [
                    ...document.querySelectorAll('[class*="DivCommentListContainer"]'),
                    ...document.querySelectorAll('[class*="CommentListContainer"]'),
                    ...document.querySelectorAll('[data-e2e="comment-list"]'),
                    ...document.querySelectorAll('[class*="comment-list"]'),
                ];
                for (const el of candidates) {
                    if (el.scrollHeight > el.clientHeight && el.clientHeight > 0) {
                        el.scrollTop += 1200;
                    }
                }
                window.scrollBy(0, 800);
            });

            // 2. Expand replies if visible
            try {
                const replyButtons = await page.$$('[data-e2e="view-more-replies"], [data-e2e="comment-reply-1st"], [class*="ReplyActionText"]');
                for (const btn of replyButtons.slice(0, 3)) {
                    await btn.click().catch(() => {});
                    await page.waitForTimeout(300);
                }
            } catch {}

            await page.waitForTimeout(1800);

            if (comments.size === prevSize) {
                staleCycles++;
                await page.mouse.wheel(0, 1500).catch(() => {});
                await page.keyboard.press('PageDown').catch(() => {});
                await page.waitForTimeout(2000);
            } else {
                staleCycles = 0;
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

    const timeout = Math.min(parseInt((req.query.timeout as string) || '60000', 10), 300000);

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

// ── Cheerio crawl ─────────────────────────────────────────────────────────────

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
