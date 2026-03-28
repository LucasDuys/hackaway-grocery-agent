// Picnic product images are stored as hash strings.
// The CDN URL pattern constructs the full image URL from the hash.
// Common sizes: small (100px), medium (200px), large (400px)

export type PicnicImageSize = "small" | "medium" | "large";

export function getPicnicImageUrl(
  imageHash: string | undefined,
  size: PicnicImageSize = "small"
): string | undefined {
  if (!imageHash) return undefined;

  // If it's already a full URL, return as-is
  if (imageHash.startsWith("http")) return imageHash;

  // Route through our image proxy to avoid 403 from Picnic CDN
  return `/api/image?hash=${imageHash}&size=${size}`;
}
