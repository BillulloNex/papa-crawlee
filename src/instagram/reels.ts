// Instagram Reels Scraper
// Uses Playwright with auth cookies + network response interception
// Navigates to /@handle/reels/ and captures reel data from GraphQL responses

import { createAuthenticatedContext } from './auth.js';

export interface IGReel {
    id: string;
    shortcode: string;
    url: string;
    caption: string;
    hashtags: string[];
    videoUrl: string;
    coverUrl: string;
    duration: number | null;
    viewCount: number;
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number | null;
    timestamp: number | null;
    music: {
        title: string;
        artist: string;
        isOriginal: boolean;
    } | null;
}

/** Extract hashtags from text */
function extractHashtags(text: string): string[] {
    const matches = text.match(/#[\w\u00C0-\u024F]+/g);
    return matches ? matches.map((h) => h.slice(1)) : [];
}

/** Parse a reel node from Instagram's response */
function parseReelNode(node: any): IGReel {
    const caption =
        node.edge_media_to_caption?.edges?.[0]?.node?.text ||
        node.caption?.text ||
        '';

    // Music info comes in different formats
    let music: IGReel['music'] = null;
    const musicInfo = node.clips_music_attribution_info || node.music_info?.music_asset_info;
    if (musicInfo) {
        music = {
            title: musicInfo.song_name || musicInfo.title || '',
            artist: musicInfo.artist_name || musicInfo.display_artist || '',
            isOriginal: musicInfo.is_original_audio_on_music_library ?? musicInfo.is_original ?? false,
        };
    }

    return {
        id: node.id || node.pk?.toString() || '',
        shortcode: node.shortcode || node.code || '',
        url: node.shortcode
            ? `https://www.instagram.com/reel/${node.shortcode}/`
            : node.code
              ? `https://www.instagram.com/reel/${node.code}/`
              : '',
        caption,
        hashtags: extractHashtags(caption),
        videoUrl: node.video_url || node.video_versions?.[0]?.url || '',
        coverUrl: node.display_url || node.image_versions2?.candidates?.[0]?.url || node.thumbnail_url || '',
        duration: node.video_duration ?? null,
        viewCount: node.video_view_count ?? node.video_play_count ?? node.play_count ?? 0,
        playCount: node.video_play_count ?? node.play_count ?? node.video_view_count ?? 0,
        likeCount: node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? node.like_count ?? 0,
        commentCount: node.edge_media_to_comment?.count ?? node.comment_count ?? 0,
        shareCount: node.share_count ?? node.reshare_count ?? null,
        timestamp: node.taken_at_timestamp ?? node.taken_at ?? null,
        music,
    };
}

/**
 * Scrape reels from an Instagram profile.
 * Uses Playwright with auth to navigate the reels tab and intercept data.
 */
export async function scrapeReels(handle: string, limit: number = 12): Promise<{
    handle: string;
    reels: IGReel[];
    total: number;
    source: string;
}> {
    // Clean handle
    handle = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');

    console.log(`[ig-reels] Scraping reels for @${handle} (limit: ${limit})`);

    const { context, page } = await createAuthenticatedContext();
    const collectedReels: IGReel[] = [];
    const seenIds = new Set<string>();

    try {
        // Intercept network responses for reel data
        page.on('response', async (response) => {
            const url = response.url();
            if (
                url.includes('/api/graphql') ||
                url.includes('graphql/query') ||
                url.includes('clips/user/') ||
                url.includes('feed/reels_media')
            ) {
                try {
                    const data = await response.json();

                    // Try multiple response shapes
                    let reelNodes: any[] = [];

                    // GraphQL response shape
                    const clips = data?.data?.user?.edge_felix_video_timeline;
                    if (clips?.edges) {
                        reelNodes = clips.edges.map((e: any) => e.node);
                    }

                    // API v1 response shape
                    const items = data?.items || data?.data?.items;
                    if (items?.length) {
                        reelNodes = [...reelNodes, ...items];
                    }

                    // xdt response shape
                    const xdt = data?.data?.xdt_api__v1__clips__user__connection_v2;
                    if (xdt?.edges) {
                        reelNodes = [...reelNodes, ...xdt.edges.map((e: any) => e.node?.media)];
                    }

                    for (const node of reelNodes) {
                        if (!node) continue;
                        const reel = parseReelNode(node);
                        if (reel.id && !seenIds.has(reel.id)) {
                            seenIds.add(reel.id);
                            collectedReels.push(reel);
                        }
                    }
                } catch {
                    // Not a reels response
                }
            }
        });

        // Navigate to the reels tab
        await page.goto(`https://www.instagram.com/${handle}/reels/`, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // Wait for initial content
        await page.waitForTimeout(3000);

        // Scroll to load more reels
        let staleScrolls = 0;
        const maxStaleScrolls = 5;
        let prevCount = 0;

        while (collectedReels.length < limit && staleScrolls < maxStaleScrolls) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000 + Math.random() * 1000);

            if (collectedReels.length === prevCount) {
                staleScrolls++;
            } else {
                staleScrolls = 0;
                prevCount = collectedReels.length;
            }

            console.log(`[ig-reels] Scroll: ${collectedReels.length}/${limit} reels collected`);
        }

        return {
            handle,
            reels: collectedReels.slice(0, limit),
            total: collectedReels.length,
            source: 'playwright-authenticated',
        };
    } finally {
        await context.close();
    }
}
