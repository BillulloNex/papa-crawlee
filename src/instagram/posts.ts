// Instagram Posts Scraper
// - First 12 posts come free with profile request (no auth)
// - Deep pagination (limit > 12) requires auth cookies + GraphQL

import { getIGHeaders, getSessionCookies, cookiesToHeader, createAuthenticatedContext } from './auth.js';
import { scrapeProfile, parseTimelinePosts } from './profile.js';

const GRAPHQL_URL = 'https://www.instagram.com/graphql/query/';

// Known doc_ids for user media query — these rotate every 2-4 weeks
// If they break, we fall back to Playwright interception
const USER_MEDIA_DOC_IDS = [
    '17991233890457762', // edge_owner_to_timeline_media (legacy, often still works)
    '8845758582119845',  // PolarisProfilePostsQuery (newer)
];

/**
 * Scrape posts from an Instagram profile.
 * @param handle - Instagram username
 * @param limit - Max posts to return (default 12, first 12 are free)
 */
export async function scrapePosts(
    handle: string,
    limit: number = 12,
): Promise<{ profile: any; posts: any[]; total: number; source: string }> {
    // Clean handle
    handle = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');

    // Get initial profile data (includes first 12 posts)
    const profileData = await scrapeProfile(handle);
    const { profile, recentPosts } = profileData;

    // If we only need ≤12 posts, return what we have
    if (limit <= recentPosts.length || limit <= 12) {
        return {
            profile,
            posts: recentPosts.slice(0, limit),
            total: profile.mediaCount,
            source: profileData.source,
        };
    }

    // Need more than 12 — try GraphQL pagination with auth
    console.log(`[ig-posts] Need ${limit} posts, have ${recentPosts.length}. Attempting pagination...`);

    try {
        const allPosts = await paginatePostsGraphQL(handle, profile.id, limit, recentPosts);
        return {
            profile,
            posts: allPosts.slice(0, limit),
            total: profile.mediaCount,
            source: 'graphql-authenticated',
        };
    } catch (err) {
        console.log(`[ig-posts] GraphQL pagination failed: ${(err as Error).message}`);
    }

    // Fallback: try Playwright scrolling
    try {
        const allPosts = await paginatePostsPlaywright(handle, limit);
        return {
            profile,
            posts: allPosts.slice(0, limit),
            total: profile.mediaCount,
            source: 'playwright-authenticated',
        };
    } catch (err) {
        console.log(`[ig-posts] Playwright pagination failed: ${(err as Error).message}`);
    }

    // Return what we have
    return {
        profile,
        posts: recentPosts.slice(0, limit),
        total: profile.mediaCount,
        source: `${profileData.source} (pagination failed, first ${recentPosts.length} only)`,
    };
}

/** Paginate posts using Instagram's GraphQL API */
async function paginatePostsGraphQL(
    _handle: string,
    userId: string,
    limit: number,
    initialPosts: any[],
): Promise<any[]> {
    const cookies = await getSessionCookies();
    const cookieHeader = cookiesToHeader(cookies);
    const headers = getIGHeaders(cookieHeader);

    // Get CSRF token from cookies
    const csrfCookie = cookies.find((c: any) => c.name === 'csrftoken');
    if (csrfCookie) {
        headers['X-CSRFToken'] = csrfCookie.value;
    }

    const allPosts = [...initialPosts];
    let endCursor: string | null = null;
    let hasNextPage = true;

    // We need the end_cursor from the initial profile data
    // Since we don't have it from the profile response directly,
    // we'll start pagination from scratch using GraphQL
    let attempts = 0;
    const maxAttempts = Math.ceil(limit / 12) + 2;

    while (hasNextPage && allPosts.length < limit && attempts < maxAttempts) {
        attempts++;

        const variables = JSON.stringify({
            id: userId,
            first: 12,
            after: endCursor || '',
        });

        let success = false;
        for (const docId of USER_MEDIA_DOC_IDS) {
            try {
                const queryUrl = `${GRAPHQL_URL}?doc_id=${docId}&variables=${encodeURIComponent(variables)}`;
                const response = await fetch(queryUrl, { headers });

                if (!response.ok) continue;

                const data = await response.json();
                const media =
                    data?.data?.user?.edge_owner_to_timeline_media ||
                    data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;

                if (!media) continue;

                const newPosts = parseTimelinePosts(media.edges || []);
                // Deduplicate by id
                for (const post of newPosts) {
                    if (!allPosts.find((p) => p.id === post.id)) {
                        allPosts.push(post);
                    }
                }

                hasNextPage = media.page_info?.has_next_page ?? false;
                endCursor = media.page_info?.end_cursor ?? null;
                success = true;
                break;
            } catch {
                continue;
            }
        }

        if (!success) {
            throw new Error('All GraphQL doc_ids failed');
        }

        // Rate limit: small delay between pages
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
    }

    return allPosts;
}

/** Paginate posts using Playwright scroll + network interception */
async function paginatePostsPlaywright(handle: string, limit: number): Promise<any[]> {
    const { context, page } = await createAuthenticatedContext();
    const allPosts: any[] = [];

    try {
        // Intercept GraphQL responses for post data
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/graphql') || url.includes('graphql/query') || url.includes('user_timeline_graphql')) {
                try {
                    const data = await response.json();
                    const media =
                        data?.data?.user?.edge_owner_to_timeline_media ||
                        data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
                    if (media?.edges) {
                        const posts = parseTimelinePosts(media.edges);
                        for (const post of posts) {
                            if (!allPosts.find((p) => p.id === post.id)) {
                                allPosts.push(post);
                            }
                        }
                    }
                } catch {
                    // Not a timeline response
                }
            }
        });

        // Navigate to profile
        await page.goto(`https://www.instagram.com/${handle}/`, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // Scroll to load more posts
        let prevCount = 0;
        let staleScrolls = 0;
        const maxStaleScrolls = 5;

        while (allPosts.length < limit && staleScrolls < maxStaleScrolls) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000 + Math.random() * 1000);

            if (allPosts.length === prevCount) {
                staleScrolls++;
            } else {
                staleScrolls = 0;
                prevCount = allPosts.length;
            }

            console.log(`[ig-posts] Playwright scroll: ${allPosts.length}/${limit} posts collected`);
        }

        return allPosts;
    } finally {
        await context.close();
    }
}
