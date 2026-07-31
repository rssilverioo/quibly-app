const ROOM_COVERS = [
  require('./room-cover-castle-01.png'),
  require('./room-cover-castle-02.png'),
  require('./room-cover-castle-03.png'),
  require('./room-cover-castle-04.png'),
] as const;

/** Stable FNV-1a mapping: a room keeps the same fallback cover across launches. */
export function roomCoverForId(roomId: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < roomId.length; i += 1) {
    hash ^= roomId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ROOM_COVERS[(hash >>> 0) % ROOM_COVERS.length];
}

export const ROOM_COVER_ASPECT_RATIO = 16 / 9;
