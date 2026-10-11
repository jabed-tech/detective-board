import { SURFACES, type SurfaceId } from '../model/types';
import { brickTileSvg } from './brickTile';
import { svgDataUrl } from '../export/svg-image';

let brickUrl: string | null = null;
export function applySurface(el: HTMLElement, id: SurfaceId): void {
  el.className = `surface surface-${id}`;
  el.setAttribute('aria-label', SURFACES[id].name);
  if (id === 'brick') el.style.setProperty('--brick-tile', `url("${(brickUrl ??= svgDataUrl(brickTileSvg()))}")`);
  else el.style.removeProperty('--brick-tile');
  if (el.parentElement) el.parentElement.dataset.surface = id;
}
