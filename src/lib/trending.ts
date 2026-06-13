/**
 * Trending score algorithm — Hacker News-style gravity decay
 *
 * score = (likes×1 + comments×2 + reposts×3) / (age_hours + 2)^GRAVITY
 *
 * - Likes     → 1 pt  (passive engagement)
 * - Comments  → 2 pts (active engagement)
 * - Reposts   → 3 pts (viral signal, strongest)
 * - gravity = 1.8  → score drops steeply after a few hours
 * - +2 offset prevents division-by-zero and gives brand-new posts a fair start
 *
 * Result: fresh posts with engagement rank highest;
 * old posts with no engagement sink to the bottom over time.
 */

const GRAVITY = 1.8;
const LIKE_WEIGHT = 1;
const COMMENT_WEIGHT = 2;
const REPOST_WEIGHT = 3;
const FRESHNESS_BONUS = 5; // Bonus points for posts less than 1 hour old

export function trendingScore(post: {
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  created_at: string;
}): number {
  const likes = post.likes_count ?? 0;
  const comments = post.comments_count ?? 0;
  const reposts = post.reposts_count ?? 0;

  const engagementPoints =
    likes * LIKE_WEIGHT + comments * COMMENT_WEIGHT + reposts * REPOST_WEIGHT;

  const ageMs = Date.now() - new Date(post.created_at).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  // Base score from engagement
  let score = engagementPoints / Math.pow(ageHours + 2, GRAVITY);

  // Add freshness bonus for brand-new posts (less than 1 hour old)
  // This ensures new posts with zero engagement still appear in explore feed
  if (ageHours < 1) {
    score += FRESHNESS_BONUS;
  }

  return score;
}

/** Sort an array of posts in-place by trending score (highest first). */
export function sortByTrending<T extends {
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  created_at: string;
}>(posts: T[]): T[] {
  return posts.sort((a, b) => trendingScore(b) - trendingScore(a));
}
