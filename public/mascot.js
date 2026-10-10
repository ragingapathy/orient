/* Gidgit's face. One place decides what the mascot looks like, so every screen that shows it agrees.
   It is a 16 x 16 pixel sprite drawn here, in five expressions: idle, blinking, thinking, happy and confused.
   A mood (data-state) picks the face and a small movement; moods follow what Gidgit is actually doing (see ui.js). */
'use strict';
window.OrientMascot = (() => {
  // Letters are colours: g green, G dark green, c cream, d ink, o orange, w white. Every face row is 10 wide so the
  // picture is symmetric; only the eyes and mouth change between expressions.
  const face = inner => '..g' + inner + 'g..';
  const FACES = {
    idle:     { eyes: ['cdwccccwdc', 'cddccccddc'], nose: 'cccooooccc', mouth: 'ccccddcccc' },
    blink:    { eyes: ['cccccccccc', 'cddccccddc'], nose: 'cccooooccc', mouth: 'ccccddcccc' },
    thinking: { eyes: ['cddccccddc', 'cccccccccc'], nose: 'cccooooccc', mouth: 'cccddddccc' },
    happy:    { eyes: ['cddccccddc', 'cccccccccc'], cheeks: 'o' + 'c'.repeat(8) + 'o', nose: 'cccooooccc', mouth: 'ccddddddcc' },
    confused: { eyes: ['cdcdccdcdc', 'cccdccdccc'], nose: 'cccooooccc', mouth: 'ccdcddcdcc' },
  };
  const art = f => [
    '.......oo.......', '.......oo.......', '.......gg.......', '....gggggggg....', '...gggggggggg...', '..ggccccccccgg..',
    face('cccccccccc'), face(f.eyes[0]), face(f.eyes[1]), face(f.cheeks || 'cccccccccc'), face(f.nose), face(f.mouth),
    '...gggggggggg...', '....GGGGGGGG....', '...GG.GGGG.GG...', '..GG..G..G..GG..',
  ];
  const COLOURS = { g: '#2d7a62', G: '#17453a', c: '#f3ead2', d: '#173f3b', o: '#ca5b30', w: '#ffffff' };
  function sprite(rows) {
    let r = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (COLOURS[ch]) r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + COLOURS[ch] + '"/>'; }));
    return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">' + r + '</svg>') + '")';
  }
  const root = document.documentElement;
  for (const [name, f] of Object.entries(FACES)) root.style.setProperty('--gm-' + name, sprite(art(f)));

  const html = (state = 'idle', label = '', mini = false) => '<span class="gidgit-mascot' + (mini ? ' mini' : '') + '" data-state="' + state + '"' + (label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true"') + '><span class="gm-sprite"></span></span>';
  const set = (el, state) => { const m = el && el.querySelector ? el.querySelector('.gidgit-mascot:not(.mini)') : null; if (m && m.dataset.state !== state) m.dataset.state = state; };
  return { html, set, faces: Object.keys(FACES) };
})();
