/**
 * Fallback covers for a room that has no photo of its own.
 *
 * The rabbit banners, approved 2026-07-31. They are wide by nature (2.0–2.5:1)
 * and the rabbit sits off-centre, so they are only ever used at the hero
 * aspect below — never square-cropped. The compact list row asks for
 * `roomCoverThumb` instead, which is why that export exists separately.
 */
const ROOM_COVERS = [
  require('./room-cover-rabbit-surf.png'),
  require('./room-cover-rabbit-city.png'),
  require('./room-cover-rabbit-desert.png'),
] as const;

/**
 * 16:9 re-crops of the same three banners, each framed on the rabbit.
 *
 * These stay *banners* — a square crop turns the artwork into a sticker and
 * loses the scene. They exist because the source files run 2.0–2.5:1 with the
 * rabbit at 28–48% of the width, so letting the row crop the full-width file
 * would cut the animal off centre. Same index as ROOM_COVERS: one room, one
 * animal, two framings.
 */
const ROOM_COVER_THUMBS = [
  require('./thumb-rabbit-surf.png'),
  require('./thumb-rabbit-city.png'),
  require('./thumb-rabbit-desert.png'),
] as const;

/** Stable FNV-1a hash, so a room keeps the same fallback across launches. */
function coverIndex(roomId: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < roomId.length; i += 1) {
    hash ^= roomId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % ROOM_COVERS.length;
}

/** Wide fallback, for the room hero. */
export function roomCoverForId(roomId: string) {
  return ROOM_COVERS[coverIndex(roomId)];
}

/** Narrow 16:9 fallback, for the compact list row. */
export function roomCoverThumbForId(roomId: string) {
  return ROOM_COVER_THUMBS[coverIndex(roomId)];
}

/** Row thumbnail geometry. 16:9, matching the hero — a banner stays a banner. */
export const ROOM_ROW_THUMB = { width: 72, height: 40 } as const;

/**
 * A proporção nativa da arte de capa (1983×793 = 2.5:1), não um 16:9 genérico.
 *
 * Declarar 16:9 aqui criava três proporções brigando: a arte em 2.5, o
 * container em 1.78 e o resultado real em 2.03 depois do `maxHeight`. Com o
 * `resizeMode="cover"` isso cortava ~19% das laterais da ilustração — a ilha e
 * as palmeiras da direita simplesmente sumiam. Casar este valor com a arte faz
 * a capa mostrar a composição inteira.
 */
export const ROOM_COVER_ASPECT_RATIO = 2.5;
