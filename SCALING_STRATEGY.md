# TikTok Scraper Scaling & Proxy Strategy

This document outlines the strategy for scaling TikTok data extraction (posts and comments) via Playwright & Crawlee while maintaining stealth against bot detection, alongside a breakdown of residential proxy costs.

## Current Baseline Performance
Currently, the pipeline runs sequentially via `scrape_all.sh` using a single home residential IP (Coolify server) and a headed Chromium browser.
- **Posts:** ~35 posts per minute (30-45 seconds per account).
- **Comments:** ~15 comments per minute (60-90 seconds per video).
- **Limitation:** The single IP prevents concurrent execution without triggering rate limits.

## The 4-Step Scaling Strategy

### Step 1: Migrate to Crawlee Native Queue
Move the orchestration out of the synchronous `bash` script into a Crawlee `PlaywrightCrawler` queue to allow for asynchronous, concurrent execution.

### Step 2: Implement Rotating Residential Proxies
Pass a proxy pool into Crawlee using `ProxyConfiguration`. This allows 10-20 concurrent headless browsers to appear as different users across the country.

### Step 3: Block Media (Optimization)
Headed browsers consume massive bandwidth loading TikTok's videos. Intercept and abort network requests for media (images, fonts, stylesheets, video files) while letting the JSON API and JavaScript execute.

### Step 4: Distributed Workers (Optional)
Use a centralized queue (e.g., Redis) to run multiple instances of the scraper across different servers.

## Proxy Cost Breakdown
Residential proxies (e.g., IPRoyal, Smartproxy, Webshare) charge by **Bandwidth (Pay-per-GB)**. The cost per comment relies heavily on **Step 3 (Media Blocking)**.

### Scenario A: Without Media Blocking
- **Bandwidth:** ~5 MB per video page load.
- **Yield:** 1 GB = ~200 video loads = ~4,000 comments (at 20 comments/video).
- **Cost:** At $2.00/GB, cost is **$0.0005 per comment** ($0.50 per 1,000 comments).

### Scenario B: With Media Blocking (Optimized)
- **Bandwidth:** ~500 KB per video page load (HTML + JS + JSON only).
- **Yield:** 1 GB = ~2,000 video loads = ~40,000 comments.
- **Cost:** At $2.00/GB, cost is **$0.00005 per comment** ($0.05 per 1,000 comments).

## Stealth Requirements
Do we *need* proxies? **Yes, if scaling concurrently.** 
If we run 15 concurrent browsers on a single residential IP, TikTok's behavioral velocity checks will flag the IP, resulting in empty JSON responses or CAPTCHAs. Concurrency inherently requires IP diversification (proxies) to maintain stealth.
