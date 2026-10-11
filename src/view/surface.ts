import { SURFACES, type SurfaceId } from '../model/types';
import { BRICK_TILE, brickTileSvg } from './brickTile';
import { svgDataUrl } from '../export/svg-image';

let brickUrl: string | null = null;
export function applySurface(el: HTMLElement, id: SurfaceId): void {
  el.className = `surface surface-${id}`;
  el.setAttribute('aria-label', SURFACES[id].name);
  if (id === 'brick') {
    el.style.setProperty('--brick-tile', `url("${(brickUrl ??= svgDataUrl(brickTileSvg()))}")`);
    el.style.setProperty('--brick-tile-size', `${BRICK_TILE.w}px ${BRICK_TILE.h}px`);
  } else {
    el.style.removeProperty('--brick-tile');
    el.style.removeProperty('--brick-tile-size');
  }
  if (el.parentElement) el.parentElement.dataset.surface = id;
}
