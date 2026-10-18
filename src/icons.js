const paths = {
  hand: '<path d="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v10c0 4-3 6-7 6-3 0-5-1-7-4l-3-5a2 2 0 0 1 3-2l2 2Z"/>',
  squeeze: '<path d="M4 3h16M4 21h16M8 6l4 3 4-3M8 18l4-3 4 3"/><ellipse cx="12" cy="12" rx="8" ry="3"/>',
  blast: '<path d="m13 2-3 7H3l6 5-2 8 6-6 7 4-3-8 5-5-8 1Z"/>',
  erase: '<path d="m15 3 6 6a2 2 0 0 1 0 3l-9 9H7l-5-5a2 2 0 0 1 0-3L12 3a2 2 0 0 1 3 0ZM7 9l9 9M12 21h10"/>',
  pause: '<path d="M9 5H6v14h3ZM18 5h-3v14h3Z"/>',
  play: '<path d="m7 4 14 8-14 8Z"/>',
  step: '<path d="m5 5 10 7L5 19ZM19 5v14"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  undo: '<path d="m9 4-6 6 6 6M3 10h10a7 7 0 0 1 0 14" transform="translate(0 -2)"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6M22 9l-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 3M12 18h.01"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  save: '<path d="M5 3h12l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8"/>',
  load: '<path d="M3 7h6l2 3h10l-2 11H3ZM3 7V4h7l2 3h7v3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  rain: '<path d="M5 12a4 4 0 1 1 1-8 6 6 0 0 1 11 0 4 4 0 1 1 1 8M7 16v4M12 15v7M17 16v4"/>',
  full: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 4v-3a3 3 0 0 0-1-2c3 0 6-1 6-6a5 5 0 0 0-1-3 5 5 0 0 0 0-4s-2 0-4 2a14 14 0 0 0-7 0C6 3 4 3 4 3a5 5 0 0 0 0 4 5 5 0 0 0-1 3c0 5 3 6 6 6a3 3 0 0 0-1 2v3"/>',
};
export const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plus}</svg>`;

export function toyIcon(kind) {
  const common = 'stroke-linecap="round" stroke-linejoin="round"';
  const content = {
    jelly: '<path d="M11 40C2 20 16 9 31 14c17-8 28 9 20 24-5 13-31 16-40 2Z" fill="#98c6ef" stroke="#6b9cc3"/><path d="M16 25q0-7 8-8" stroke="#d9edff" stroke-width="3" fill="none"/><circle cx="25" cy="29" r="1.5"/><circle cx="38" cy="29" r="1.5"/><path d="M28 36q4 3 7-1" fill="none" stroke="#4f7797"/>',
    rubber: '<circle cx="31" cy="32" r="21" fill="#f2aa9a" stroke="#cc8374"/><path d="M17 25q2-8 11-9" stroke="#ffded4" stroke-width="3" fill="none"/><circle cx="26" cy="30" r="1.5"/><circle cx="38" cy="30" r="1.5"/><path d="M29 36q3 4 7-1" fill="none" stroke="#a96153"/>',
    water: '<path d="M8 38C8 24 20 18 24 12c4-6 8 4 14 5 25 3 23 24 10 31-17 9-40 4-40-10Z" fill="#b9addb" stroke="#9487b9"/><path d="M16 29q2-7 10-9" stroke="#e7defb" stroke-width="3" fill="none"/><circle cx="27" cy="34" r="1.5"/><circle cx="40" cy="34" r="1.5"/>',
    bouncy: '<circle cx="32" cy="32" r="19" fill="#e9cd67" stroke="#bca34b"/><path d="M17 23q15 13 29 17M17 42q11-14 26-23" stroke="#fff3b5" fill="none" stroke-width="3"/>',
    steel: '<defs><linearGradient id="metal" x2="1" y2="1"><stop stop-color="#e4e9e9"/><stop offset=".5" stop-color="#aab5ba"/><stop offset="1" stop-color="#78888e"/></linearGradient></defs><circle cx="32" cy="32" r="20" fill="url(#metal)" stroke="#8c9a9e"/><path d="M19 26q3-9 13-10" fill="none" stroke="#f5f7f7" stroke-width="3"/>',
    crate: '<rect x="12" y="13" width="40" height="40" rx="4" fill="#d8b183" stroke="#a58156"/><path d="m16 17 32 32m0-32L16 49M12 24h40M12 41h40" stroke="#b18b5c" fill="none"/>',
    plank: '<g transform="rotate(-20 32 32)"><rect x="5" y="24" width="54" height="15" rx="3" fill="#ccb28c" stroke="#a18a68"/><path d="M11 29h35M21 34h31" stroke="#b19873"/></g>',
    ramp: '<path d="m9 46 46-28v28Z" fill="#d8dbd2" stroke="#98a28d"/><path d="m9 42 46-28" stroke="#a5af98" stroke-width="5"/>',
    trampoline: '<path d="M12 47v-9M51 47v-9" stroke="#6f947a" stroke-width="4"/><rect x="7" y="26" width="50" height="13" rx="6" fill="#9ac0a7" stroke="#6f997f"/><path d="M14 32h36" stroke="#dbebdc" stroke-dasharray="3 3" stroke-width="2"/>',
    bumper: '<circle cx="32" cy="32" r="22" fill="#f6d784" stroke="#caa24f"/><circle cx="32" cy="32" r="16" fill="#f4c462" stroke="#fff2c6" stroke-dasharray="2 5"/><path d="m34 20-9 14h7l-2 10 10-16h-8Z" fill="#fff5d7"/>',
    fan: '<rect x="12" y="16" width="40" height="37" rx="7" fill="#a7c7c7" stroke="#6f9c9b"/><circle cx="32" cy="34" r="14" fill="#d6e7e4"/><path d="M32 34q-14-17-14-4t14 4q17-14 4-14t-4 14q14 17 14 4t-14-4q-17 14-4 14t4-14" fill="#81aaa8"/><path d="m22 10 2-5m8 4V3m10 7-2-5" stroke="#8cafab" stroke-width="2"/>',
    magnet: '<path d="M13 15v19a19 19 0 0 0 38 0V15H39v19a7 7 0 0 1-14 0V15Z" fill="#d99094" stroke="#ad6b75"/><path d="M13 15h12v10H13ZM39 15h12v10H39Z" fill="#d6e1e9" stroke="#8e9fae"/>',
  };
  return `<svg viewBox="0 0 64 64" fill="#42515b" stroke-width="1.1" ${common} aria-hidden="true">${content[kind] || content.crate}</svg>`;
}
