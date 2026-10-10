export type SurfaceId = 'cork' | 'glass' | 'brick' | 'wood' | 'archive';
export type MoodId = 'noir-office' | 'precinct' | 'basement' | 'motel' | 'archive';
export type FastenerId = 'pin' | 'tack' | 'tape' | 'magnet' | 'clip' | 'nail';
export type StringMaterial = 'yarn' | 'twine' | 'marker';
export type EffectId = 'blinds' | 'rain' | 'grain' | 'neon' | 'dust' | 'flicker';
export type AmbienceId = 'rain' | 'jazz' | 'sirens' | 'hum' | 'buzz' | 'tick';
export type LightId = 'lamp' | 'fluorescent' | 'bulb' | 'neon' | 'sepia';
export type ItemType = 'photo' | 'polaroid' | 'sticky' | 'index'
  | 'mugshot' | 'newspaper' | 'receipt' | 'casefile' | 'sketch' | 'stamp' | 'object';
export type StampId = 'classified' | 'evidence' | 'case-closed' | 'question' | 'red-x' | 'coffee-ring';
export type ObjectId = 'keys' | 'matchbook' | 'cassette' | 'casing' | 'evidence-bag' | 'ticket' | 'burner-phone';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Atmosphere = 'full' | 'gentle' | 'off';
export type LinkArrow = 'end' | 'both';

/** Price in pence, integer 0..999_999. */
export interface ReceiptLine { name: string; price: number }
/** `d` is path data in SKETCH_VIEW coordinates. */
export interface SketchStroke { d: string; color: string; width: number }
export const SKETCH_VIEW = { w: 400, h: 300 } as const;

export interface ItemData {
  imageId?: string; text?: string; caption?: string; unknown?: boolean; textScale?: number; // phase 1
  aged?: boolean; crossed?: boolean; seed?: number;
  name?: string; bookingNo?: string;
  masthead?: string; date?: string; headline?: string;
  store?: string; lines?: ReceiptLine[]; time?: string;
  subject?: string; officer?: string; status?: string;
  strokes?: SketchStroke[];
  stamp?: StampId; object?: ObjectId;
}

/** Per-item text size multiplier (absent = 1), on top of the card-size scaling. */
export const TEXT_SCALE_MIN = 0.5;
export const TEXT_SCALE_MAX = 3;
export const TEXT_STEP = 1.15;

/** Step a text scale by `factor`, clamped, rounded to 2 dp. */
export function stepTextScale(cur: number | undefined, factor: number): number {
  return Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, (cur ?? 1) * factor)) * 100) / 100;
}

export interface Item {
  id: string; type: ItemType;
  x: number; y: number; w: number; h: number; // top-left + size in world px, before rotation
  rot: number; // degrees, rotation about centre
  z: number;
  attach: FastenerId; attachColor: string;
  data: ItemData;
}

/** Spot on an item, in its own unrotated frame: fractions of w/h from the centre (each -0.5..0.5). */
export interface Anchor { u: number; v: number }

export interface Link {
  id: string; from: string; to: string;
  color: string; tension: number; // 0 taut … 1 droopy
  style?: LineStyle; label?: string;
  fromAt?: Anchor; toAt?: Anchor; // absent = the item's main fastener
  material?: StringMaterial; thickness?: number; arrow?: LinkArrow; // absent = yarn / 1 / none
}

export interface Board {
  id: string; name: string; caseNo: number;
  surface: SurfaceId; mood: MoodId; closed?: boolean;
  items: Item[]; links: Link[];
  version: 1; updatedAt: number;
}

export const BOARD_W = 4000;
export const BOARD_H = 3000;

export const ITEM_SIZES: Record<ItemType, { w: number; h: number }> = {
  photo: { w: 260, h: 200 },
  polaroid: { w: 240, h: 290 },
  sticky: { w: 220, h: 220 },
  index: { w: 320, h: 200 },
  mugshot: { w: 260, h: 330 }, newspaper: { w: 300, h: 380 }, receipt: { w: 200, h: 340 }, casefile: { w: 340, h: 260 },
  sketch: { w: 300, h: 225 }, stamp: { w: 260, h: 100 }, object: { w: 150, h: 150 },
};

export const FASTENERS: { id: FastenerId; name: string }[] = [
  { id: 'pin', name: 'Push pin' }, { id: 'tack', name: 'Thumbtack' }, { id: 'tape', name: 'Tape' },
  { id: 'magnet', name: 'Magnet' }, { id: 'clip', name: 'Binder clip' }, { id: 'nail', name: 'Nail' },
];
export const MATERIALS: { id: StringMaterial; name: string }[] = [
  { id: 'yarn', name: 'Yarn' }, { id: 'twine', name: 'Twine' }, { id: 'marker', name: 'Marker line' },
];
export const SURFACES: Record<SurfaceId, { name: string; fasteners: FastenerId[]; material: StringMaterial }> = {
  cork:    { name: 'Cork board',      fasteners: ['pin', 'tack'],    material: 'yarn' },
  glass:   { name: 'Precinct glass',  fasteners: ['magnet', 'tape'], material: 'marker' },
  brick:   { name: 'Brick wall',      fasteners: ['tape', 'nail'],   material: 'yarn' },
  wood:    { name: 'Wood panelling',  fasteners: ['tack', 'nail'],   material: 'twine' },
  archive: { name: 'Archive cork',    fasteners: ['pin', 'tack'],    material: 'twine' },
};
export const MOODS: Record<MoodId, { name: string; blurb: string; surface: SurfaceId; light: LightId; effects: EffectId[]; ambience: AmbienceId[] }> = {
  'noir-office': { name: 'Noir Office', blurb: 'Desk lamp, venetian blinds, rain on the glass, a little jazz.', surface: 'cork', light: 'lamp', effects: ['blinds', 'rain', 'flicker'], ambience: ['rain', 'jazz'] },
  precinct: { name: 'Precinct Night Shift', blurb: 'Cold fluorescent tubes, a glass board, sirens far off.', surface: 'glass', light: 'fluorescent', effects: ['flicker'], ambience: ['hum', 'sirens'] },
  basement: { name: 'Basement Obsession', blurb: 'One bare bulb, brick, and a lot of grain.', surface: 'brick', light: 'bulb', effects: ['grain', 'flicker'], ambience: ['hum'] },
  motel: { name: 'Motel Stakeout', blurb: 'Wood panelling lit by a buzzing neon sign.', surface: 'wood', light: 'neon', effects: ['neon', 'grain'], ambience: ['buzz', 'rain'] },
  archive: { name: 'Cold Case Archive', blurb: 'Sepia files, dust in the air, a clock ticking.', surface: 'archive', light: 'sepia', effects: ['dust', 'grain'], ambience: ['tick'] },
};
export const STAMPS: { id: StampId; label: string; w: number; h: number }[] = [
  { id: 'classified', label: 'CLASSIFIED', w: 300, h: 100 }, { id: 'evidence', label: 'EVIDENCE', w: 260, h: 100 },
  { id: 'case-closed', label: 'CASE CLOSED', w: 340, h: 110 }, { id: 'question', label: '?', w: 120, h: 160 },
  { id: 'red-x', label: 'Red X', w: 200, h: 200 }, { id: 'coffee-ring', label: 'Coffee ring', w: 180, h: 180 },
];
export const OBJECTS: { id: ObjectId; name: string; w: number; h: number }[] = [
  { id: 'keys', name: 'Keys', w: 150, h: 120 }, { id: 'matchbook', name: 'Matchbook', w: 110, h: 150 },
  { id: 'cassette', name: 'Cassette tape', w: 200, h: 130 }, { id: 'casing', name: 'Bullet casing', w: 90, h: 140 },
  { id: 'evidence-bag', name: 'Evidence bag', w: 200, h: 240 }, { id: 'ticket', name: 'Ticket stub', w: 200, h: 90 },
  { id: 'burner-phone', name: 'Burner phone', w: 110, h: 200 },
];
export const THICKNESSES: { value: number; name: string }[] = [
  { value: 0.6, name: 'Thread' }, { value: 1, name: 'Yarn' }, { value: 1.6, name: 'Cord' }, { value: 2.4, name: 'Rope' },
];

export const PIN_COLORS = ['#c0392b', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#6a3d9a'] as const;
export const YARN_COLORS = ['#b3261e', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#1d1d1d', '#6a3d9a', '#d9661f'] as const;

export type Mode = 'move' | 'string' | 'erase';
