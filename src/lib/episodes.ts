import type { MediaRecord } from "./types";

/** The episode after (season, episode) based on the cached season index. */
export function nextAfter(
  media: Pick<MediaRecord, "seasons">,
  season: number,
  episode: number,
): { season: number; episode: number } | null {
  const seasons = [...(media.seasons ?? [])].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const current = seasons.find((item) => item.seasonNumber === season);
  if (current && episode < current.episodeCount) return { season, episode: episode + 1 };
  const following = seasons.find((item) => item.seasonNumber > season && item.episodeCount > 0);
  return following ? { season: following.seasonNumber, episode: 1 } : null;
}
