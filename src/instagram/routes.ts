// Instagram Express Router — wires up all scraper endpoints

import { Router } from 'express';
import { scrapeProfile } from './profile.js';
import { scrapePosts } from './posts.js';
import { scrapeReels } from './reels.js';
import { scrapeComments } from './comments.js';
import { scrapeFollowers } from './followers.js';
import { importCookies } from './auth.js';
import { getInstagramUI } from './ui.js';

export const instagramRouter = Router();

// Web UI
instagramRouter.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getInstagramUI());
});

// Profile endpoint
instagramRouter.get('/profile', async (req, res): Promise<void> => {
    const handle = (req.query.handle as string)?.trim();
    if (!handle) {
        res.status(400).json({ error: 'Missing required query param: handle' });
        return;
    }

    try {
        console.log(`[api] GET /instagram/profile?handle=${handle}`);
        const startTime = Date.now();
        const result = await scrapeProfile(handle);
        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            elapsed: `${elapsed}ms`,
            ...result,
        });
    } catch (err) {
        console.error(`[api] /instagram/profile error:`, err);
        res.status(500).json({
            success: false,
            error: (err as Error).message,
            handle,
        });
    }
});

// Posts endpoint
instagramRouter.get('/posts', async (req, res): Promise<void> => {
    const handle = (req.query.handle as string)?.trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 200);

    if (!handle) {
        res.status(400).json({ error: 'Missing required query param: handle' });
        return;
    }

    try {
        console.log(`[api] GET /instagram/posts?handle=${handle}&limit=${limit}`);
        const startTime = Date.now();
        const result = await scrapePosts(handle, limit);
        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            elapsed: `${elapsed}ms`,
            ...result,
            count: result.posts.length,
        });
    } catch (err) {
        console.error(`[api] /instagram/posts error:`, err);
        res.status(500).json({
            success: false,
            error: (err as Error).message,
            handle,
        });
    }
});

// Reels endpoint
instagramRouter.get('/reels', async (req, res): Promise<void> => {
    const handle = (req.query.handle as string)?.trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 100);

    if (!handle) {
        res.status(400).json({ error: 'Missing required query param: handle' });
        return;
    }

    try {
        console.log(`[api] GET /instagram/reels?handle=${handle}&limit=${limit}`);
        const startTime = Date.now();
        const result = await scrapeReels(handle, limit);
        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            elapsed: `${elapsed}ms`,
            ...result,
            count: result.reels.length,
        });
    } catch (err) {
        console.error(`[api] /instagram/reels error:`, err);
        res.status(500).json({
            success: false,
            error: (err as Error).message,
            handle,
        });
    }
});

// Comments endpoint
instagramRouter.get('/comments', async (req, res): Promise<void> => {
    const url = (req.query.url as string)?.trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    if (!url) {
        res.status(400).json({ error: 'Missing required query param: url' });
        return;
    }

    try {
        console.log(`[api] GET /instagram/comments?url=${url}&limit=${limit}`);
        const startTime = Date.now();
        const result = await scrapeComments(url, limit);
        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            elapsed: `${elapsed}ms`,
            ...result,
            count: result.comments.length,
        });
    } catch (err) {
        console.error(`[api] /instagram/comments error:`, err);
        res.status(500).json({
            success: false,
            error: (err as Error).message,
            url,
        });
    }
});

// Followers endpoint
instagramRouter.get('/followers', async (req, res): Promise<void> => {
    const handle = (req.query.handle as string)?.trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

    if (!handle) {
        res.status(400).json({ error: 'Missing required query param: handle' });
        return;
    }

    try {
        console.log(`[api] GET /instagram/followers?handle=${handle}&limit=${limit}`);
        const startTime = Date.now();
        const result = await scrapeFollowers(handle, limit);
        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            elapsed: `${elapsed}ms`,
            ...result,
            count: result.followers.length,
        });
    } catch (err) {
        console.error(`[api] /instagram/followers error:`, err);
        res.status(500).json({
            success: false,
            error: (err as Error).message,
            handle,
        });
    }
});

// Import cookies endpoint (POST)
instagramRouter.post('/import-cookies', (req, res): void => {
    try {
        const { cookies } = req.body;
        if (!cookies) {
            res.status(400).json({ error: 'Missing cookies in request body' });
            return;
        }

        const cookieStr = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
        importCookies(cookieStr);

        res.json({
            success: true,
            message: 'Cookies imported successfully',
        });
    } catch (err) {
        console.error(`[api] /instagram/import-cookies error:`, err);
        res.status(500).json({
            success: false,
            error: (err as Error).message,
        });
    }
});
