// Small hand-drawn SVG icons for goods and stats. Stroke matches the 3D outline colour.
const S = '#3b3346';
const wrap = (body: string) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" stroke="${S}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

export const ICONS: Record<string, string> = {
  gold: wrap(`<circle cx="12" cy="12" r="8.5" fill="#f7c948"/><circle cx="12" cy="12" r="5" fill="none"/>`),
  peasant: wrap(`<circle cx="12" cy="8" r="3.6" fill="#ffd9b0"/><path d="M5 20c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5z" fill="#8fcf6f"/><path d="M7.5 6.5h9l-1.5-3h-6z" fill="#f2cf5b"/>`),
  worker: wrap(`<circle cx="12" cy="8.5" r="3.6" fill="#ffd9b0"/><path d="M5 20c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5z" fill="#6fa8dc"/><path d="M8 6.2a4 4 0 0 1 8 0z" fill="#f2766b"/>`),
  wood: wrap(`<rect x="3" y="8" width="15" height="8" rx="4" fill="#c98b5a"/><ellipse cx="18" cy="12" rx="3" ry="4" fill="#f0c88f"/>`),
  planks: wrap(`<rect x="3" y="5" width="18" height="4" rx="1" fill="#f0c88f"/><rect x="3" y="10" width="18" height="4" rx="1" fill="#e2b077"/><rect x="3" y="15" width="18" height="4" rx="1" fill="#f0c88f"/>`),
  fish: wrap(`<path d="M3 12c3-5 9-6 13-2l4-3v10l-4-3c-4 4-10 3-13-2z" fill="#7fc3e8"/><circle cx="7.5" cy="11" r="0.8" fill="${S}"/>`),
  grain: wrap(`<path d="M12 21V8" fill="none"/><ellipse cx="9" cy="10" rx="2" ry="3.4" fill="#f2cf5b" transform="rotate(-25 9 10)"/><ellipse cx="15" cy="10" rx="2" ry="3.4" fill="#f2cf5b" transform="rotate(25 15 10)"/><ellipse cx="12" cy="5.5" rx="2" ry="3.2" fill="#f2cf5b"/>`),
  flour: wrap(`<path d="M7 6h10l2 14H5z" fill="#fff6e3"/><path d="M8 6l1.5-2.5h5L16 6" fill="#fff6e3"/><path d="M9.5 13h5" fill="none"/>`),
  bread: wrap(`<path d="M4 15c0-5 4-8 8-8s8 3 8 8v3H4z" fill="#e5a057"/><path d="M9 10l1 3M13 9.5l1 3" fill="none"/>`),
  house: wrap(`<path d="M4 11l8-7 8 7v9H4z" fill="#fff1d6"/><path d="M2.5 11.5L12 3l9.5 8.5" fill="none"/><rect x="10" y="14" width="4" height="6" fill="#c98b5a"/>`),
  clock: wrap(`<circle cx="12" cy="12" r="8.5" fill="#fff8ea"/><path d="M12 7v5l3 2" fill="none"/>`),
};
export const icon = (k: string) => ICONS[k] ?? '';
