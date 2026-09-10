// Instagram Profile Scraper
// Tier 1: Direct HTTP to web_profile_info (no auth, first 12 posts included)
// Tier 2: Playwright fallback if HTTP is blocked

import { getIGHeaders, getSessionCookies, cookiesToHeader, createAuthenticatedContext } from './auth.js';

export interface IGProfile {
    username: string;
    fullName: string;
    biography: string;
    bioLinks: string[];
    externalUrl: string | null;
    profilePicUrl: string;
    profilePicUrlHD: string;
    followerCount: number;
    followingCount: number;
    mediaCount: number;
    isVerified: boolean;
    isPrivate: boolean;
    isBusinessAccount: boolean;
    categoryName: string | null;
    id: string;
}

/** Extract profile data from the Instagram user object */
function parseProfile(user: any): IGProfile {
    return {
        username: user.username || '',
        fullName: user.full_name || '',
        biography: user.biography || '',
        bioLinks: (user.bio_links || []).map((l: any) => l.url || l.link_url).filter(Boolean),
        externalUrl: user.external_url || null,
        profilePicUrl: user.profile_pic_url || '',
        profilePicUrlHD: user.profile_pic_url_hd || user.profile_pic_url || '',
        followerCount: user.edge_followed_by?.count ?? user.follower_count ?? 0,
        followingCount: user.edge_follow?.count ?? user.following_count ?? 0,
        mediaCount: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? 0,
        isVerified: user.is_verified ?? false,
        isPrivate: user.is_private ?? false,
        isBusinessAccount: user.is_business_account ?? user.is_professional_account ?? false,
        categoryName: user.category_name || user.category || null,
        id: user.id || user.pk?.toString() || '',
    };
}

/** Extract post data from timeline media edges */
export function parseTimelinePosts(edges: any[]): any[] {
    return edges.map((edge: any) => {
        const node = edge.node || edge;
        return {
            id: node.id || '',
            shortcode: node.shortcode || '',
            url: node.shortcode ? `https://www.instagram.com/p/${node.shortcode}/` : '',
            type: node.__typename || (node.is_video ? 'GraphVideo' : 'GraphImage'),
            caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || '',
            hashtags: extractHashtags(
                node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || '',
            ),
            displayUrl: node.display_url || node.image_versions2?.candidates?.[0]?.url || '',
            videoUrl: node.video_url || null,
            isVideo: node.is_video ?? node.__typename === 'GraphVideo',
            likeCount: node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? node.like_count ?? 0,
            commentCount: node.edge_media_to_comment?.count ?? node.comment_count ?? 0,
            viewCount: node.video_view_count ?? node.video_play_count ?? null,
            timestamp: node.taken_at_timestamp ?? node.taken_at ?? null,
            location: node.location
                ? {
                      name: node.location.name,
                      id: node.location.id,
                  }
                : null,
            taggedUsers: (node.edge_media_to_tagged_user?.edges || []).map(
                (e: any) => e.node?.user?.username || '',
            ),
            carouselMedia:
                node.__typename === 'GraphSidecar'
                    ? (node.edge_sidecar_to_children?.edges || []).map((e: any) => ({
                          displayUrl: e.node?.display_url || '',
                          videoUrl: e.node?.video_url || null,
                          isVideo: e.node?.is_video ?? false,
                      }))
                    : null,
            isPinned: node.pinned_for_users?.length > 0 || false,
        };
    });
}

/** Extract hashtags from caption text */
function extractHashtags(text: string): string[] {
    const matches = text.match(/#[\w\u00C0-\u024F]+/g);
    return matches ? matches.map((h) => h.slice(1)) : [];
}

/**
 * Scrape an Instagram profile.
 * Uses Playwright with auth cookies + network interception (most reliable).
 * Falls back to direct HTTP if Playwright fails.
 */
export async function scrapeProfile(
    handle: string,
): Promise<{ profile: IGProfile; recentPosts: any[]; source: string }> {
    // Clean handle — remove @ and URL prefix
    handle = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');

    // Primary: Playwright with network interception
    try {
        const result = await fetchProfilePlaywright(handle);
        if (result) return { ...result, source: 'playwright-authenticated' };
    } catch (err) {
        console.log(`[ig-profile] Playwright scrape failed: ${(err as Error).message}`);
    }

    // Fallback: Direct HTTP with auth cookies
    try {
        const cookies = await getSessionCookies();
        const cookieHeader = cookiesToHeader(cookies);
        const result = await fetchProfileHTTP(handle, cookieHeader);
        if (result) return { ...result, source: 'http-authenticated' };
    } catch (err) {
        console.log(`[ig-profile] Authenticated HTTP failed: ${(err as Error).message}`);
    }

    throw new Error(`Failed to scrape profile for @${handle} — Instagram may be blocking requests`);
}

/** Fetch profile via Playwright — navigates to profile page and intercepts JSON responses */
async function fetchProfilePlaywright(
    handle: string,
): Promise<{ profile: IGProfile; recentPosts: any[] } | null> {
    console.log(`[ig-profile] Fetching @${handle} via Playwright...`);

    const { context, page } = await createAuthenticatedContext();
    let userData: any = null;
    const capturedPosts: any[] = [];

    try {
        // Intercept network responses for profile data
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('web_profile_info') || url.includes('/api/graphql') || url.includes('graphql/query')) {
                try {
                    const data = await response.json();

                    // Extract user data
                    const user = data?.data?.user || data?.user;
                    if (user && user.username && !userData) {
                        userData = user;
                        console.log(`[ig-profile] Captured profile data for @${user.username}`);
                    }

                    // Extract posts from various response shapes
                    const timelineEdges = user?.edge_owner_to_timeline_media?.edges;
                    if (timelineEdges?.length) {
                        capturedPosts.push(...timelineEdges);
                    }

                    // New GraphQL format: xdt_api__v1__feed__user_timeline_graphql_connection
                    const timeline = data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
                    if (timeline?.edges?.length) {
                        capturedPosts.push(...timeline.edges);
                    }

                    // Also check for items array (v1 API format)
                    const items = data?.items || user?.items;
                    if (items?.length) {
                        capturedPosts.push(...items.map((item: any) => ({ node: item })));
                    }
                } catch {
                    // Not a relevant response
                }
            }
        });

        // Navigate to the profile page
        await page.goto(`https://www.instagram.com/${handle}/`, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // Wait a bit for any remaining network requests
        await page.waitForTimeout(3000);

        // If we didn't capture data via network, try extracting from page JS
        if (!userData) {
            userData = await page.evaluate(() => {
                const shared = (window as any)._sharedData;
                if (shared?.entry_data?.ProfilePage?.[0]?.graphql?.user) {
                    return shared.entry_data.ProfilePage[0].graphql.user;
                }
                const scripts = document.querySelectorAll('script[type="application/json"]');
                for (const script of scripts) {
                    try {
                        const data = JSON.parse(script.textContent || '');
                        const user = data?.require?.[0]?.[3]?.[0]?.__bbox?.require?.[0]?.[3]?.[1]?.__bbox?.result?.data?.user;
                        if (user?.username) return user;
                    } catch {}
                }
                return null;
            });
        }

        if (!userData) {
            throw new Error('Could not capture profile data from page');
        }

        const profile = parseProfile(userData);

        // Deduplicate posts by id
        const postSet = new Map<string, any>();
        const allEdges = [...(userData.edge_owner_to_timeline_media?.edges || []), ...capturedPosts];
        for (const edge of allEdges) {
            const node = edge.node || edge;
            const id = node.id || node.pk?.toString();
            if (id && !postSet.has(id)) postSet.set(id, edge);
        }
        const recentPosts = parseTimelinePosts([...postSet.values()]);
        console.log(`[ig-profile] Captured ${recentPosts.length} posts for @${handle}`);

        return { profile, recentPosts };
    } finally {
        await context.close();
    }
}

/** Fetch profile via Instagram's internal web API (direct HTTP — may be TLS fingerprinted) */
async function fetchProfileHTTP(
    handle: string,
    cookieHeader?: string,
): Promise<{ profile: IGProfile; recentPosts: any[] } | null> {
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
    const headers = getIGHeaders(cookieHeader);

    console.log(`[ig-profile] Fetching ${url} via HTTP (auth: ${!!cookieHeader})`);

    const response = await fetch(url, {
        headers,
        redirect: 'follow',
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error(`HTTP ${response.status} — login required`);
        }
        if (response.status === 404) {
            throw new Error(`User @${handle} not found`);
        }
        if (response.status === 429) {
            throw new Error('Rate limited by Instagram');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
        throw new Error('Got HTML instead of JSON — login wall detected');
    }

    const data = await response.json();
    const user = data?.data?.user || data?.user;

    if (!user) {
        throw new Error('No user data in response');
    }

    const profile = parseProfile(user);
    const postEdges = user.edge_owner_to_timeline_media?.edges || [];
    const recentPosts = parseTimelinePosts(postEdges);

    return { profile, recentPosts };
}
