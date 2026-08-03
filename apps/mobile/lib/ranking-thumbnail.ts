export function rankingThumbnailUrl(entry: {
  latest_photo_url: string | null;
  avatar_url: string | null;
}) {
  return entry.latest_photo_url || entry.avatar_url || null;
}
