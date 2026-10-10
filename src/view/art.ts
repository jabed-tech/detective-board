import type { ObjectId } from '../model/types';

// Static markup only: no parameters ever reach these strings.
const OBJECT_ART: Record<ObjectId, string> = {
  keys: `<circle cx="30" cy="30" r="15" fill="none" stroke="#9aa0a6" stroke-width="5"/>
<g transform="rotate(35 30 30)"><rect x="26" y="40" width="9" height="48" rx="3" fill="#c9a227"/><circle cx="30.5" cy="48" r="5" fill="#8a6d12"/><rect x="35" y="72" width="8" height="5" fill="#c9a227"/><rect x="35" y="81" width="6" height="5" fill="#c9a227"/><rect x="27" y="42" width="2.5" height="40" fill="#f3dc7a"/></g>
<g transform="rotate(-20 30 30)"><rect x="26" y="40" width="9" height="46" rx="3" fill="#b8bcc2"/><circle cx="30.5" cy="48" r="5" fill="#7d838a"/><rect x="35" y="70" width="8" height="5" fill="#b8bcc2"/><rect x="27" y="42" width="2.5" height="38" fill="#eef0f2"/></g>`,
  matchbook: `<rect x="22" y="40" width="56" height="50" rx="3" fill="#8e1f17"/><rect x="22" y="40" width="56" height="12" fill="#6e170f"/>
<rect x="30" y="14" width="6" height="30" rx="2" fill="#e6d3a3"/><rect x="47" y="10" width="6" height="34" rx="2" fill="#e6d3a3"/><rect x="64" y="14" width="6" height="30" rx="2" fill="#e6d3a3"/>
<circle cx="33" cy="13" r="5" fill="#c0392b"/><circle cx="50" cy="9" r="5" fill="#c0392b"/><circle cx="67" cy="13" r="5" fill="#c0392b"/>
<rect x="30" y="64" width="40" height="3" fill="#f0e2b6" opacity=".8"/><rect x="25" y="43" width="3" height="44" fill="#fff" opacity=".18"/>`,
  cassette: `<rect x="8" y="20" width="84" height="58" rx="5" fill="#2b2b2e"/><rect x="14" y="26" width="72" height="26" rx="2" fill="#e8dfc4"/>
<rect x="14" y="26" width="72" height="7" fill="#c0392b"/><circle cx="34" cy="62" r="8" fill="#d8d8d8"/><circle cx="66" cy="62" r="8" fill="#d8d8d8"/>
<circle cx="34" cy="62" r="3.5" fill="#2b2b2e"/><circle cx="66" cy="62" r="3.5" fill="#2b2b2e"/><rect x="40" y="58" width="20" height="8" fill="#444"/>
<rect x="12" y="23" width="76" height="2" fill="#fff" opacity=".18"/>`,
  casing: `<rect x="35" y="22" width="30" height="62" rx="3" fill="#c9a227"/><rect x="35" y="14" width="30" height="12" rx="6" fill="#b08a1c"/>
<rect x="30" y="80" width="40" height="9" rx="2" fill="#a07c18"/><ellipse cx="50" cy="14" rx="11" ry="3.5" fill="#6e5410"/>
<rect x="39" y="28" width="5" height="50" fill="#f3dc7a" opacity=".8"/>`,
  'evidence-bag': `<path d="M18 14 H82 L86 90 H14 Z" fill="#dce9ee" fill-opacity=".55" stroke="#9db3bb" stroke-width="2"/>
<rect x="18" y="14" width="64" height="8" fill="#b9ccd3" opacity=".8"/><rect x="14" y="40" width="72" height="16" fill="#c0392b"/>
<text x="50" y="52" text-anchor="middle" font-family="Courier Prime, monospace" font-weight="700" font-size="11" fill="#fff">EVIDENCE</text>
<path d="M24 28 L28 84" stroke="#fff" stroke-width="3" opacity=".5"/><rect x="38" y="64" width="24" height="18" rx="2" fill="#7a6a4a" opacity=".6"/>`,
  ticket: `<path d="M8 28 H92 V43 a7 7 0 0 0 0 14 V72 H8 V57 a7 7 0 0 0 0 -14 Z" fill="#e8c14e"/>
<line x1="68" y1="30" x2="68" y2="70" stroke="#8a6d12" stroke-width="2" stroke-dasharray="3 3"/>
<text x="38" y="53" text-anchor="middle" font-family="Courier Prime, monospace" font-weight="700" font-size="11" fill="#5a1d14">ADMIT ONE</text>
<text x="80" y="55" text-anchor="middle" font-family="Courier Prime, monospace" font-weight="700" font-size="9" fill="#5a1d14">No.7</text>
<rect x="12" y="31" width="52" height="2" fill="#fff" opacity=".4"/>`,
  'burner-phone': `<rect x="28" y="8" width="44" height="42" rx="6" fill="#2d3136"/><rect x="33" y="14" width="34" height="22" rx="2" fill="#9fc79a"/>
<rect x="36" y="18" width="18" height="3" fill="#41603d"/><rect x="36" y="24" width="12" height="3" fill="#41603d"/>
<rect x="26" y="50" width="48" height="42" rx="6" fill="#3a3f45"/><rect x="26" y="48" width="48" height="4" fill="#1e2124"/>
<g fill="#c4c9ce"><circle cx="38" cy="64" r="4"/><circle cx="50" cy="64" r="4"/><circle cx="62" cy="64" r="4"/><circle cx="38" cy="77" r="4"/><circle cx="50" cy="77" r="4"/><circle cx="62" cy="77" r="4"/></g>
<rect x="31" y="10" width="2.5" height="36" fill="#fff" opacity=".15"/>`,
};

export function objectSvg(id: ObjectId): string {
  const art = OBJECT_ART[id] ?? '';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${art}</svg>`;
}

export function stampSvg(id: 'red-x' | 'coffee-ring'): string {
  if (id === 'red-x') {
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<path d="M6 10 C25 18 40 40 55 52 C70 66 84 82 94 92 L89 96 C74 84 58 70 45 58 C30 44 14 26 3 16 Z" fill="#c0392b" opacity=".85"/>
<path d="M92 7 C76 22 62 38 50 50 C38 62 20 80 7 93 L12 97 C27 84 44 68 56 56 C68 44 84 28 96 12 Z" fill="#c0392b" opacity=".85"/></svg>`;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<path d="M50 8 C74 6 94 26 92 52 C90 78 70 94 46 92 C22 90 8 70 10 48 C12 26 28 10 50 8 Z M50 17 C32 18 20 32 19 49 C18 66 30 82 47 83 C65 84 82 72 83 53 C84 36 70 16 50 17 Z" fill="#6b4423" fill-rule="evenodd" opacity=".35"/>
<path d="M30 14 C40 8 56 8 64 12" fill="none" stroke="#6b4423" stroke-width="3" opacity=".3"/></svg>`;
}
