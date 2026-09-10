// Instagram Comments Scraper
// Uses Playwright with auth cookies to load post page and capture comments
// Comments are always gated behind login wall

import { createAuthenticatedContext } from './auth.js';

export interface IGComment {
    id: string;
    text: string;
    authorUsername: string;
    authorProfilePic: string;
    authorIsVerified: boolean;
    timestamp: number | null;
    likeCount: number;
    replyCount: number;
    isPinned: boolean;
    replies: IGComment[];
}

export interface IGCommentResult {
    postUrl: string;
    postAuthor: string;
    postCaption: string;
    comments: IGComment[];
    totalComments: number;
    source: string;
}

/** Parse a comment node from Instagram's response */
function parseCommentNode(node: any): IGComment {
    const owner = node.owner || node.user || {};
    return {
        id: node.id || node.pk?.toString() || '',
        text: node.text || '',
        authorUsername: owner.username || '',
        authorProfilePic: owner.profile_pic_url || '',
        authorIsVerified: owner.is_verified ?? false,
        timestamp: node.created_at_utc ?? node.created_at ?? null,
        likeCount: node.edge_liked_by?.count ?? node.comment_like_count ?? 0,
        replyCount: node.edge_threaded_comments?.count ?? node.child_comment_count ?? 0,
        isPinned: node.is_pinned ?? node.did_report_as_spam === false,
        replies: [],
    };
}

/** Parse threaded replies from a comment */
function parseReplies(node: any): IGComment[] {
    const edges = node.edge_threaded_comments?.edges || node.preview_child_comments || [];
    return edges.map((e: any) => parseCommentNode(e.node || e));
}

/**
 * Scrape comments from an Instagram post.
 * @param postUrl - Full Instagram post URL (e.g., https://www.instagram.com/p/ABC123/)
 * @param limit - Max comments to return (default 50)
 */
export async function scrapeComments(postUrl: string, limit: number = 50): Promise<IGCommentResult> {
    // Normalize URL
    if (!postUrl.startsWith('http')) {
        postUrl = `https://www.instagram.com/p/${postUrl}/`;
    }

    console.log(`[ig-comments] Scraping comments for ${postUrl} (limit: ${limit})`);

    const { context, page } = await createAuthenticatedContext();
    const collectedComments: IGComment[] = [];
    const seenIds = new Set<string>();
    let postAuthor = '';
    let postCaption = '';

    try {
        // Intercept network responses for comment data
        page.on('response', async (response) => {
            const url = response.url();
            if (
                url.includes('/api/graphql') ||
                url.includes('graphql/query') ||
                url.includes('/comments/') ||
                url.includes('edge_media_to_parent_comment') ||
                url.includes('edge_media_to_comment')
            ) {
                try {
                    const data = await response.json();

                    // GraphQL comments response
                    const comments =
                        data?.data?.shortcode_media?.edge_media_to_parent_comment ||
                        data?.data?.shortcode_media?.edge_media_to_comment ||
                        data?.data?.xdt_shortcode_media?.edge_media_to_parent_comment;

                    if (comments?.edges) {
                        for (const edge of comments.edges) {
                            const node = edge.node;
                            if (!node) continue;

                            const comment = parseCommentNode(node);
                            if (comment.id && !seenIds.has(comment.id)) {
                                seenIds.add(comment.id);
                                comment.replies = parseReplies(node);
                                collectedComments.push(comment);
                            }
                        }
                    }

                    // API v1 comments response
                    const apiComments = data?.comments;
                    if (apiComments?.length) {
                        for (const node of apiComments) {
                            const comment = parseCommentNode(node);
                            if (comment.id && !seenIds.has(comment.id)) {
                                seenIds.add(comment.id);
                                if (node.child_comments || node.preview_child_comments) {
                                    comment.replies = (
                                        node.child_comments || node.preview_child_comments || []
                                    ).map((r: any) => parseCommentNode(r));
                                }
                                collectedComments.push(comment);
                            }
                        }
                    }

                    // Extract post metadata if available
                    const media = data?.data?.shortcode_media || data?.data?.xdt_shortcode_media;
                    if (media) {
                        postAuthor = postAuthor || media.owner?.username || '';
                        postCaption =
                            postCaption ||
                            media.edge_media_to_caption?.edges?.[0]?.node?.text ||
                            '';
                    }
                } catch {
                    // Not a comments response
                }
            }
        });

        // Navigate to the post
        await page.goto(postUrl, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // Wait for initial load
        await page.waitForTimeout(3000);

        // Try to extract post metadata from the page if not captured via network
        if (!postAuthor) {
            try {
                postAuthor = await page.locator('header a[role="link"]').first().textContent() || '';
            } catch {
                // Fallback
            }
        }

        // Click "View all N comments" button if present
        try {
            const viewAllBtn = page.locator('button:has-text("View all"), a:has-text("View all")');
            if (await viewAllBtn.count() > 0) {
                await viewAllBtn.first().click();
                await page.waitForTimeout(2000);
            }
        } catch {
            // No "View all" button
        }

        // Scroll the comments section to load more
        let staleScrolls = 0;
        const maxStaleScrolls = 5;
        let prevCount = 0;

        // Try to find the comments section/container for scrolling
        const commentSelectors = [
            'ul[class*="comment"]',
            'div[class*="comment"]',
            'section > div > div > ul',
            'article',
        ];

        let commentContainer = null;
        for (const selector of commentSelectors) {
            const el = page.locator(selector).first();
            if (await el.count() > 0) {
                commentContainer = el;
                break;
            }
        }

        while (collectedComments.length < limit && staleScrolls < maxStaleScrolls) {
            // Try clicking "Load more comments" or "+" buttons
            try {
                const loadMoreBtn = page.locator(
                    'button:has-text("Load more"), button[aria-label="Load more comments"], li button svg[aria-label="Load more comments"]',
                );
                if (await loadMoreBtn.count() > 0) {
                    await loadMoreBtn.first().click();
                    await page.waitForTimeout(1500);
                }
            } catch {
                // No load more button
            }

            // Scroll the comment section or page
            if (commentContainer) {
                await commentContainer.evaluate((el: Element) => el.scrollTo(0, el.scrollHeight));
            } else {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            }
            await page.waitForTimeout(2000 + Math.random() * 1000);

            if (collectedComments.length === prevCount) {
                staleScrolls++;
            } else {
                staleScrolls = 0;
                prevCount = collectedComments.length;
            }

            console.log(`[ig-comments] Scroll: ${collectedComments.length}/${limit} comments collected`);
        }

        return {
            postUrl,
            postAuthor,
            postCaption,
            comments: collectedComments.slice(0, limit),
            totalComments: collectedComments.length,
            source: 'playwright-authenticated',
        };
    } finally {
        await context.close();
    }
}
