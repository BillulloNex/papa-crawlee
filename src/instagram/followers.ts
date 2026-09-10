// Instagram Followers Scraper
// Uses Playwright to make authenticated API requests to Instagram's friendships endpoint
// Bypasses TLS fingerprinting by routing the API calls through a real browser context

import { createAuthenticatedContext } from './auth.js';
import { scrapeProfile } from './profile.js';

export interface IGFollower {
    id: string;
    username: string;
    fullName: string;
    profilePicUrl: string;
    isVerified: boolean;
    isPrivate: boolean;
}

/**
 * Scrape followers of an Instagram user.
 * Requires authenticated session (cookies).
 * Uses the v1 friendships API via Playwright page.evaluate (bypasses TLS fingerprinting).
 * Instagram rate-limits: typically ~200 per batch, few hundred per session.
 */
export async function scrapeFollowers(
    handle: string,
    limit: number = 100,
): Promise<{ handle: string; followers: IGFollower[]; total: number | null }> {
    handle = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');

    console.log(`[ig-followers] Scraping followers for @${handle} (limit: ${limit})`);

    // Get user ID from profile — needed for the API endpoint
    let userId: string | null = null;
    let totalFollowers: number | null = null;
    try {
        const profileData = await scrapeProfile(handle);
        userId = profileData.profile.id;
        totalFollowers = profileData.profile.followerCount;
        console.log(`[ig-followers] User ID: ${userId}, total followers: ${totalFollowers}`);
    } catch (err) {
        throw new Error(`Could not get user ID for @${handle}: ${(err as Error).message}`);
    }

    if (!userId) {
        throw new Error(`Could not determine user ID for @${handle}`);
    }

    const { context, page } = await createAuthenticatedContext();
    const followers: Map<string, IGFollower> = new Map();

    try {
        // Navigate to Instagram first (needed for cookies/CSRF to be active)
        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Use page.evaluate to make fetch requests from within the browser context
        // This uses the browser's TLS stack, bypassing Node.js fingerprinting
        let maxId: string | null = null;
        const batchSize = 50;
        const maxPages = Math.ceil(limit / batchSize);

        for (let pageNum = 0; pageNum < maxPages; pageNum++) {
            if (followers.size >= limit) break;

            console.log(`[ig-followers] Fetching page ${pageNum + 1}/${maxPages} (${followers.size} so far)...`);

            const apiUrl = maxId
                ? `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=${batchSize}&max_id=${maxId}`
                : `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=${batchSize}`;

            const result = await page.evaluate(async (url: string) => {
                try {
                    const csrfToken = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='))?.split('=')[1] || '';
                    const resp = await fetch(url, {
                        headers: {
                            'X-CSRFToken': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-IG-App-ID': '936619743392459',
                            'X-ASBD-ID': '129477',
                        },
                        credentials: 'include',
                    });
                    if (!resp.ok) {
                        return { error: `HTTP ${resp.status}`, users: [], next_max_id: null };
                    }
                    const data = await resp.json();
                    return {
                        users: data.users || [],
                        next_max_id: data.next_max_id || null,
                        big_list: data.big_list ?? false,
                        page_size: data.page_size ?? 0,
                        status: data.status,
                    };
                } catch (err: any) {
                    return { error: err.message, users: [], next_max_id: null };
                }
            }, apiUrl);

            if (result.error) {
                console.log(`[ig-followers] API error: ${result.error}`);
                break;
            }

            if (result.users.length === 0) {
                console.log(`[ig-followers] No more followers returned`);
                break;
            }

            for (const user of result.users) {
                if (followers.size >= limit) break;
                if (!user.username || followers.has(user.username)) continue;

                followers.set(user.username, {
                    id: user.pk?.toString() || user.id?.toString() || '',
                    username: user.username,
                    fullName: user.full_name || '',
                    profilePicUrl: user.profile_pic_url || '',
                    isVerified: user.is_verified ?? false,
                    isPrivate: user.is_private ?? false,
                });
            }

            console.log(`[ig-followers] Page ${pageNum + 1}: got ${result.users.length} users (total: ${followers.size})`);

            // Check for pagination
            maxId = result.next_max_id;
            if (!maxId) {
                console.log(`[ig-followers] No more pages`);
                break;
            }

            // Rate limit delay between pages
            await page.waitForTimeout(2000 + Math.random() * 2000);
        }

        console.log(`[ig-followers] Captured ${followers.size} followers for @${handle}`);

        return {
            handle,
            followers: [...followers.values()],
            total: totalFollowers,
        };
    } finally {
        await context.close();
    }
}
