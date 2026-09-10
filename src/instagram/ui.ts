// Instagram Web UI — interactive HTML page with forms for each scraper endpoint

export function getInstagramUI(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instagram Scraper — Papa Crawlee</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #833AB4, #FD1D1D, #F77737);
            min-height: 100vh; padding: 20px;
            color: #262626;
        }
        .container { max-width: 800px; margin: 0 auto; }
        h1 {
            color: white; text-align: center; font-size: 2em;
            margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            color: rgba(255,255,255,0.9); text-align: center;
            margin-bottom: 30px; font-size: 1.1em;
        }
        .card {
            background: white; border-radius: 16px; padding: 24px;
            margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .card h2 {
            font-size: 1.2em; margin-bottom: 4px;
            display: flex; align-items: center; gap: 8px;
        }
        .card .desc {
            color: #8e8e8e; font-size: 0.9em; margin-bottom: 16px;
        }
        .card .badge {
            font-size: 0.7em; padding: 2px 8px; border-radius: 10px;
            font-weight: 600; text-transform: uppercase;
        }
        .badge.free { background: #e8f5e9; color: #2e7d32; }
        .badge.auth { background: #fff3e0; color: #e65100; }
        .form-row {
            display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
        }
        input[type="text"], input[type="number"] {
            flex: 1; min-width: 200px; padding: 10px 14px;
            border: 1px solid #dbdbdb; border-radius: 8px;
            font-size: 14px; outline: none;
            transition: border-color 0.2s;
        }
        input:focus { border-color: #833AB4; }
        button {
            padding: 10px 24px; border: none; border-radius: 8px;
            background: linear-gradient(45deg, #833AB4, #FD1D1D);
            color: white; font-weight: 600; font-size: 14px;
            cursor: pointer; transition: opacity 0.2s;
        }
        button:hover { opacity: 0.9; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .result {
            margin-top: 16px; padding: 16px; border-radius: 8px;
            background: #fafafa; border: 1px solid #efefef;
            max-height: 500px; overflow-y: auto;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 12px; white-space: pre-wrap;
            word-break: break-word; display: none;
        }
        .result.show { display: block; }
        .result.error { border-color: #ffcdd2; background: #ffebee; color: #c62828; }
        .result.loading { color: #833AB4; font-style: italic; }
        .status {
            text-align: center; padding: 8px; margin-bottom: 20px;
            border-radius: 8px; font-size: 0.9em;
        }
        .status.ok { background: #e8f5e9; color: #2e7d32; }
        .status.err { background: #ffebee; color: #c62828; }
        textarea {
            width: 100%; min-height: 100px; padding: 10px 14px;
            border: 1px solid #dbdbdb; border-radius: 8px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 12px; resize: vertical;
        }
        .links {
            text-align: center; margin-top: 20px;
        }
        .links a {
            color: rgba(255,255,255,0.8); margin: 0 12px;
            text-decoration: none; font-size: 0.9em;
        }
        .links a:hover { color: white; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📸 Instagram Scraper</h1>
        <p class="subtitle">Papa Crawlee — Instagram Data Extraction</p>

        <div id="status" class="status" style="display:none;"></div>

        <!-- Profile -->
        <div class="card">
            <h2>👤 Profile <span class="badge free">No Auth</span></h2>
            <p class="desc">Scrape profile metadata (bio, followers, avatar, etc.)</p>
            <div class="form-row">
                <input type="text" id="profile-handle" placeholder="Username (e.g., instagram)" />
                <button onclick="scrapeProfile()">Scrape</button>
            </div>
            <div id="profile-result" class="result"></div>
        </div>

        <!-- Posts -->
        <div class="card">
            <h2>📸 Posts <span class="badge free">First 12 Free</span> <span class="badge auth">Auth for 12+</span></h2>
            <p class="desc">Scrape feed posts with captions, likes, media URLs</p>
            <div class="form-row">
                <input type="text" id="posts-handle" placeholder="Username" />
                <input type="number" id="posts-limit" placeholder="Limit" value="12" min="1" max="200" style="max-width:100px" />
                <button onclick="scrapePosts()">Scrape</button>
            </div>
            <div id="posts-result" class="result"></div>
        </div>

        <!-- Reels -->
        <div class="card">
            <h2>🎬 Reels <span class="badge auth">Auth Required</span></h2>
            <p class="desc">Scrape reels with video URLs, play counts, music info</p>
            <div class="form-row">
                <input type="text" id="reels-handle" placeholder="Username" />
                <input type="number" id="reels-limit" placeholder="Limit" value="12" min="1" max="100" style="max-width:100px" />
                <button onclick="scrapeReels()">Scrape</button>
            </div>
            <div id="reels-result" class="result"></div>
        </div>

        <!-- Comments -->
        <div class="card">
            <h2>💬 Comments <span class="badge auth">Auth Required</span></h2>
            <p class="desc">Scrape comments from a specific post</p>
            <div class="form-row">
                <input type="text" id="comments-url" placeholder="Post URL (e.g., https://www.instagram.com/p/ABC123/)" />
                <input type="number" id="comments-limit" placeholder="Limit" value="50" min="1" max="500" style="max-width:100px" />
                <button onclick="scrapeComments()">Scrape</button>
            </div>
            <div id="comments-result" class="result"></div>
        </div>

        <!-- Import Cookies -->
        <div class="card">
            <h2>🍪 Import Cookies</h2>
            <p class="desc">Paste exported cookies (JSON from EditThisCookie or similar)</p>
            <textarea id="cookie-json" placeholder='[{"name":"sessionid","value":"...","domain":".instagram.com",...}]'></textarea>
            <div class="form-row" style="margin-top:12px">
                <button onclick="importCookies()">Import Cookies</button>
            </div>
            <div id="cookies-result" class="result"></div>
        </div>

        <div class="links">
            <a href="/">← Home</a>
            <a href="/health">Health</a>
            <a href="/instagram/profile?handle=instagram">API: Profile</a>
            <a href="/instagram/posts?handle=instagram&limit=5">API: Posts</a>
        </div>
    </div>

    <script>
        function showResult(id, data, isError = false) {
            const el = document.getElementById(id);
            el.className = 'result show' + (isError ? ' error' : '');
            el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        }

        function showLoading(id) {
            const el = document.getElementById(id);
            el.className = 'result show loading';
            el.textContent = '⏳ Scraping... this may take a moment...';
        }

        async function fetchEndpoint(url, resultId) {
            showLoading(resultId);
            try {
                const res = await fetch(url);
                const data = await res.json();
                showResult(resultId, data, !res.ok);
            } catch (err) {
                showResult(resultId, 'Error: ' + err.message, true);
            }
        }

        function scrapeProfile() {
            const handle = document.getElementById('profile-handle').value.trim();
            if (!handle) return alert('Enter a username');
            fetchEndpoint('/instagram/profile?handle=' + encodeURIComponent(handle), 'profile-result');
        }

        function scrapePosts() {
            const handle = document.getElementById('posts-handle').value.trim();
            const limit = document.getElementById('posts-limit').value || '12';
            if (!handle) return alert('Enter a username');
            fetchEndpoint('/instagram/posts?handle=' + encodeURIComponent(handle) + '&limit=' + limit, 'posts-result');
        }

        function scrapeReels() {
            const handle = document.getElementById('reels-handle').value.trim();
            const limit = document.getElementById('reels-limit').value || '12';
            if (!handle) return alert('Enter a username');
            fetchEndpoint('/instagram/reels?handle=' + encodeURIComponent(handle) + '&limit=' + limit, 'reels-result');
        }

        function scrapeComments() {
            const url = document.getElementById('comments-url').value.trim();
            const limit = document.getElementById('comments-limit').value || '50';
            if (!url) return alert('Enter a post URL');
            fetchEndpoint('/instagram/comments?url=' + encodeURIComponent(url) + '&limit=' + limit, 'comments-result');
        }

        async function importCookies() {
            const json = document.getElementById('cookie-json').value.trim();
            if (!json) return alert('Paste cookie JSON');
            showLoading('cookies-result');
            try {
                const res = await fetch('/instagram/import-cookies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cookies: json }),
                });
                const data = await res.json();
                showResult('cookies-result', data, !res.ok);
            } catch (err) {
                showResult('cookies-result', 'Error: ' + err.message, true);
            }
        }

        // Health check on load
        fetch('/health').then(r => r.json()).then(d => {
            const el = document.getElementById('status');
            el.style.display = 'block';
            el.className = 'status ok';
            el.textContent = '✅ Server online — uptime: ' + Math.round(d.uptime) + 's';
        }).catch(() => {
            const el = document.getElementById('status');
            el.style.display = 'block';
            el.className = 'status err';
            el.textContent = '❌ Server health check failed';
        });
    </script>
</body>
</html>`;
}
