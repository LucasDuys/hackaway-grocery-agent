// Picnic product images are stored as 64-char SHA-256 hash strings.
// The CDN serves images directly when the full hash is provided.
// Common sizes: small (100px), medium (200px), large (400px)

const PICNIC_IMAGE_CDN = "https://storefront-prod.nl.picnicinternational.com/static/images";

export type PicnicImageSize = "small" | "medium" | "large";

export function getPicnicImageUrl(
  imageHash: string | undefined,
  size: PicnicImageSize = "small"
): string | undefined {
  if (!imageHash) return undefined;

  // If it's already a full URL, return as-is
  if (imageHash.startsWith("http")) return imageHash;

  // Only use hashes that are the full 64-char SHA-256
  // Truncated hashes return 403 from the CDN
  if (imageHash.length < 60) return undefined;

  return `${PICNIC_IMAGE_CDN}/${imageHash}/${size}.png`;
}
