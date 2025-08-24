const $ = (sel) => document.querySelector(sel);
const api = {
  async createGame(grid) {
    const res = await fetch(`/api/games?grid=${grid}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create game');
    const j = await res.json();
    return j.id;
  },
  async addPlayer(id, name) {
    const res = await fetch(`/api/games/${id}/players`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to add player');
    return res.json();
  },
  async roll(id) {
    const res = await fetch(`/api/games/${id}/roll`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to roll');
    return res.json();
  },
  async state(id) {
    const res = await fetch(`/api/games/${id}/state`); return res.json();
  },
  stream(id, cb) {
    const es = new EventSource(`/api/games/${id}/stream`);
    es.onmessage = (ev) => { cb(JSON.parse(ev.data)); };
    return es;
  }
};

// Small dorsal scales along the back
function drawSnakeDorsalScales(centerPts, baseW, pal){
  const main = pal[0];
  const outline = 'rgba(15,23,42,0.45)';
  const light = 'rgba(255,255,255,0.55)';
  const count = Math.max(10, Math.floor(centerPts.length*2));
  for (let i=0;i<count;i++){
    const t = i/(count-1);
    const idx = Math.floor(t*(centerPts.length-1)); const p = centerPts[idx];
    const prev = centerPts[Math.max(0,idx-1)], next = centerPts[Math.min(centerPts.length-1,idx+1)];
    const dx = next.x - prev.x, dy = next.y - prev.y; const len = Math.hypot(dx,dy)||1; const nx = -dy/len, ny = dx/len;
    const r = baseW*(0.28*(1-t)+0.10);
    const cx = p.x + nx*baseW*0.15; const cy = p.y + ny*baseW*0.15; // back ridge
    // outline
    ctx.fillStyle = outline; ctx.beginPath(); ctx.ellipse(cx, cy, r, r*0.65, Math.atan2(dy,dx), 0, Math.PI*2); ctx.fill();
    // inner lighter scale
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(cx, cy, r*0.7, r*0.46, Math.atan2(dy,dx), 0, Math.PI*2); ctx.fill();
    // color core
    ctx.fillStyle = main; ctx.beginPath(); ctx.ellipse(cx, cy, r*0.5, r*0.33, Math.atan2(dy,dx), 0, Math.PI*2); ctx.fill();
  }
}

// Realistic spade head with nostrils, pupils, jaw and tongue
function drawSnakeHeadRealistic(x, y, bodyW, angle, pal, now){
  const headW = bodyW*1.2, headL = bodyW*1.9;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  // head shape (spade)
  ctx.fillStyle = pal[0];
  ctx.beginPath();
  ctx.moveTo(-headL*0.1, -headW*0.9);
  ctx.quadraticCurveTo(headL*0.6, -headW*0.9, headL*0.9, -headW*0.1);
  ctx.quadraticCurveTo(headL*1.0, 0, headL*0.9, headW*0.1);
  ctx.quadraticCurveTo(headL*0.6, headW*0.9, -headL*0.1, headW*0.9);
  ctx.quadraticCurveTo(-headL*0.6, headW*0.2, -headL*0.6, 0);
  ctx.quadraticCurveTo(-headL*0.6, -headW*0.2, -headL*0.1, -headW*0.9);
  ctx.closePath(); ctx.fill();
  // head highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, bodyW*0.12);
  ctx.beginPath(); ctx.moveTo(-headL*0.1, -headW*0.6); ctx.quadraticCurveTo(headL*0.5, -headW*0.5, headL*0.7, -headW*0.1); ctx.stroke();
  // eyes with blinking/rolling
  const blink = (Math.sin(now/400 + x*0.03 + y*0.02) + 1) * 0.5; // 0..1
  const eyelid = blink>0.85 ? (blink-0.85)/0.15 : 0; // close briefly
  // sclera
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -headW*0.35, headW*0.22, headW*0.16*(1-eyelid), 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(headL*0.35, -headW*0.28, headW*0.22, headW*0.16*(1-eyelid), 0, 0, Math.PI*2); ctx.fill();
  // pupil rolls in a circle
  const roll = now*0.002;
  const px1 = 0 + Math.cos(roll)*headW*0.06, py1 = -headW*0.35 + Math.sin(roll)*headW*0.04;
  const px2 = headL*0.35 + Math.cos(roll+1.2)*headW*0.06, py2 = -headW*0.28 + Math.sin(roll+1.2)*headW*0.04;
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(px1, py1, headW*0.09, headW*0.18*(1-eyelid), 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px2, py2, headW*0.09, headW*0.18*(1-eyelid), 0, 0, Math.PI*2); ctx.fill();
  // nostrils
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.ellipse(headL*0.75, -headW*0.08, headW*0.06, headW*0.03, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(headL*0.75, headW*0.08, headW*0.06, headW*0.03, 0, 0, Math.PI*2); ctx.fill();
  // jaw line
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(1, bodyW*0.08);
  ctx.beginPath(); ctx.moveTo(-headL*0.05, headW*0.5); ctx.quadraticCurveTo(headL*0.5, headW*0.55, headL*0.85, headW*0.15); ctx.stroke();
  // fangs
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, bodyW*0.08);
  ctx.beginPath(); ctx.moveTo(headL*0.55, headW*0.25); ctx.lineTo(headL*0.55, headW*0.55);
  ctx.moveTo(headL*0.55, -headW*0.25); ctx.lineTo(headL*0.55, -headW*0.55); ctx.stroke();
  // tongue
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(1, bodyW*0.09);
  ctx.beginPath(); ctx.moveTo(headL*0.1, headW*0.6); ctx.lineTo(headL*0.9, headW*0.9); ctx.moveTo(headL*0.9, headW*0.9); ctx.lineTo(headL*0.98, headW*1.05); ctx.moveTo(headL*0.9, headW*0.9); ctx.lineTo(headL*0.98, headW*0.75); ctx.stroke();
  ctx.restore();
}

function drawPawnLabel(cx, cy, cell, ch){
  ctx.save();
  const r = Math.max(6, cell*0.18);
  const y = cy - r*0.4; // place near the head/body area
  ctx.font = `${Math.max(10, cell*0.28)}px Poppins, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // outline for contrast
  ctx.lineWidth = Math.max(2, cell*0.03);
  ctx.strokeStyle = 'rgba(17,24,39,0.9)';
  ctx.strokeText(ch, cx, y);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(ch, cx, y);
  ctx.restore();
}

// helper: pick a point along a poly-curve using simple segment lerp
function pointOnPath(pts, t){
  if (t<=0) return pts[0]; if (t>=1) return pts[pts.length-1];
  const total = pts.length-1; const idx = Math.floor(t*total); const frac = t*total - idx;
  const a = pts[idx], b = pts[idx+1];
  return { x: a.x + (b.x-a.x)*frac, y: a.y + (b.y-a.y)*frac };
}

// --- Real SVG heads (preloaded from /assets) ---
const snakeHeadImgs = [];
function preloadSnakeAssets(){
  const headFiles = [
    '/assets/snake_head_1.svg',
    '/assets/snake_head_2.svg'
  ];
  snakeHeadImgs.length = 0;
  for (const p of headFiles){ const img = new Image(); img.src = p; snakeHeadImgs.push(img); }
}

let gameId = null;
let gameState = null;
let prevState = null;
let es = null;
let lastWinPlayed = null;
let diceAnimating = false;
let pendingState = null;
let renderOverrides = null; // used by global animation loop during tweens
let shakeFX = { type: null, start: 0, dur: 0, amp: 0 };

const canvas = $('#board');
const ctx = canvas.getContext('2d');

// Cartoon snake themes
const snakeThemes = [
  { palette: ['#ff4d8d','#ffd166'], pattern: 'stripes' },   // pink-yellow stripes
  { palette: ['#34d399','#60a5fa'], pattern: 'diamonds' },  // green-blue diamonds
  { palette: ['#f97316','#fde047'], pattern: 'spots' },     // orange-yellow spots
  { palette: ['#a78bfa','#fbcfe8'], pattern: 'stripes' },   // violet-pink stripes
  { palette: ['#22c55e','#86efac'], pattern: 'diamonds' },  // green tones
  { palette: ['#ef4444','#fecaca'], pattern: 'spots' },     // red spots
];

// coordinate helpers (bottom-left origin)
function gridToCanvas(x, y, cell){
  // server uses top-left origin with total = x*N + y (row-major, top to bottom)
  // map using total to bottom-left serpentine coordinates
  const N = gameState ? gameState.gridSize : 10;
  const total = x*N + y;
  const rb = Math.floor(total / N); // row from bottom
  const c = total % N;
  const col = (rb % 2 === 0) ? c : (N - 1 - c);
  const cx = col*cell + cell/2;
  const cy = (N - 1 - rb)*cell + cell/2; // canvas Y grows downward; rb is bottom-based
  return {cx, cy};
}

function drawBoard(state, overrides) {
  const N = state.gridSize;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cell = W / N;
  const now = performance.now();
  // apply board shake FX
  ctx.save();
  if (shakeFX.type){
    const t = Math.min(1, (now - shakeFX.start) / shakeFX.dur);
    const decay = 1 - t;
    const a = shakeFX.amp * decay;
    let dx = 0, dy = 0;
    if (shakeFX.type === 'snake'){
      dx = Math.sin(now*0.06) * a;
      dy = Math.cos(now*0.09) * a;
    } else if (shakeFX.type === 'ladder'){
      dy = Math.sin(now*0.18) * a*0.6; // stepping feel
      dx = Math.sin(now*0.12) * a*0.3;
    }
    ctx.translate(dx, dy);
    if (t >= 1){ shakeFX.type = null; }
  }
  // colorful checkerboard background
  const palette = ['#fef08a','#c7d2fe','#f5d0fe','#bbf7d0'];
  for (let r=0; r<N; r++){
    for (let c=0; c<N; c++){
      const idx = (r+c)%palette.length;
      fillCell3D(c*cell, r*cell, cell, palette[idx]);
    }
  }
  // embossed grid lines for 3D feel (light up/left, dark down/right)
  ctx.save();
  ctx.translate(-0.5, -0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= N; i++) {
    ctx.beginPath(); ctx.moveTo(i*cell, 0); ctx.lineTo(i*cell, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*cell); ctx.lineTo(W, i*cell); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.strokeStyle = 'rgba(15,23,42,0.18)'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= N; i++) {
    ctx.beginPath(); ctx.moveTo(i*cell, 0); ctx.lineTo(i*cell, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*cell); ctx.lineTo(W, i*cell); ctx.stroke();
  }
  ctx.restore();
  // labels with bottom-left origin, serpentine (alternating) numbering
  ctx.fillStyle = '#94a3b8'; ctx.font = `${Math.max(10, cell*0.25)}px Poppins, sans-serif`;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const rb = N-1 - r; // row index from bottom
      const col = (rb % 2 === 0) ? c : (N-1 - c);
      const idx = rb*N + col; // 0-based index
      const x = c*cell + 6, y = r*cell + cell - 8;
      ctx.fillText(String(idx+1), x, y);
    }
  }
  // snakes - varied shapes with patterns
  state.snakes.forEach((s, i) => { drawSnake(s.head, s.tail, cell, i, N, now); });
  // ladders - colorful wood
  state.ladders.forEach((l, i) => { drawLadderFixed(l.bottom, l.top, cell, N, i); });
  // players (chess-like pawns)
  const colors = ['#10b981','#3b82f6','#a855f7','#f59e0b','#ef4444','#14b8a6'];
  state.players.forEach((p, i) => {
    if (p.position.x < 0) return;
    const ov = overrides || renderOverrides;
    const pos = ov && ov[i] ? ov[i] : p.position;
    const {cx, cy} = gridToCanvas(pos.x, pos.y, cell);
    drawChessPawn(cx, cy, cell, colors[i % colors.length]);
    // overlay initial letter badge for readability
    const init = (p.name && p.name.length) ? p.name[0].toUpperCase() : String(i+1);
    drawPawnLabel(cx, cy, cell, init);
  });
  ctx.restore(); // for shake transform
}

function drawSnake(head, tail, cell, index, N, now){
  const a = gridToCanvas(head.x, head.y, cell); const b = gridToCanvas(tail.x, tail.y, cell);
  const ax = a.cx, ay = a.cy; const bx = b.cx, by = b.cy;
  // path segments
  const dx = bx-ax, dy = by-ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy/len, ny = dx/len; // normal
  const offset = ((index % 3) - 1) * Math.min(18, cell*0.25); // -1,0,1
  const wav = Math.min(40, Math.max(22, len*0.14));
  const steps = 8 + (index % 4);
  const pts = [];
  for (let i=0;i<=steps;i++){
    const t = i/steps;
    const phase = now*0.003 + index*0.7; // animate body undulation
    const sway = Math.sin(t*Math.PI*steps + phase) * (wav/4);
    const x = ax + dx*t + nx*sway + nx*offset;
    const y = ay + dy*t + ny*sway + ny*offset;
    pts.push({x,y});
  }
  // gradient body + cartoon patterns
  const theme = snakeThemes[index % snakeThemes.length];
  const pal = theme.palette;
  const grad = ctx.createLinearGradient(ax, ay, bx, by);
  grad.addColorStop(0, pal[0]); grad.addColorStop(1, pal[1]);
  // Render realistic body: tapered filled polygon with belly stripe and highlight
  const bodyW = Math.max(8, cell*0.18);
  drawSnakeBodyRealistic(pts, bodyW, grad);
  drawSnakeBelly(pts, bodyW, pal);
  drawSnakeDorsalScales(pts, bodyW, pal);
  drawSnakeHighlight(pts, bodyW);
  // head (realistic spade-shaped head with blink)
  const ang = Math.atan2(by - ay, bx - ax);
  drawSnakeHeadRealistic(ax+nx*offset, ay+ny*offset, bodyW, ang, pal, now);
}

// Build tapered body polygon and fill with gradient
function drawSnakeBodyRealistic(centerPts, baseW, fillStyle){
  const L=[], R=[]; // left/right edges
  const n = centerPts.length;
  for (let i=0;i<n;i++){
    const p = centerPts[i];
    const prev = centerPts[Math.max(0,i-1)], next = centerPts[Math.min(n-1,i+1)];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.hypot(dx,dy)||1; const nx = -dy/len, ny = dx/len;
    const t = i/(n-1);
    const r = baseW*(0.55*(1-t) + 0.18); // taper towards tail
    L.push({x:p.x + nx*r, y:p.y + ny*r});
    R.push({x:p.x - nx*r, y:p.y - ny*r});
  }
  // drop shadow
  ctx.save(); ctx.translate(2,3); ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y); for (let i=1;i<L.length;i++) ctx.lineTo(L[i].x, L[i].y);
  for (let i=R.length-1;i>=0;i--) ctx.lineTo(R[i].x, R[i].y); ctx.closePath(); ctx.fill(); ctx.restore();
  // main fill
  ctx.fillStyle = fillStyle;
  ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y); for (let i=1;i<L.length;i++) ctx.lineTo(L[i].x, L[i].y);
  for (let i=R.length-1;i>=0;i--) ctx.lineTo(R[i].x, R[i].y); ctx.closePath(); ctx.fill();
}

function drawSnakeBelly(centerPts, baseW, pal){
  // light belly stripe slightly offset inside the body
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = Math.max(2, baseW*0.28);
  ctx.beginPath();
  for (let i=0;i<centerPts.length;i++){
    const p = centerPts[i];
    const prev = centerPts[Math.max(0,i-1)], next = centerPts[Math.min(centerPts.length-1,i+1)];
    const dx = next.x - prev.x, dy = next.y - prev.y; const len = Math.hypot(dx,dy)||1; const nx = -dy/len, ny = dx/len;
    const bx = p.x - nx*baseW*0.25, by = p.y - ny*baseW*0.25;
    if (i===0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
  }
  ctx.stroke();
}

function drawSnakeHighlight(centerPts, baseW){
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, baseW*0.16);
  ctx.beginPath();
  for (let i=0;i<centerPts.length;i++){
    const p = centerPts[i];
    const prev = centerPts[Math.max(0,i-1)], next = centerPts[Math.min(centerPts.length-1,i+1)];
    const dx = next.x - prev.x, dy = next.y - prev.y; const len = Math.hypot(dx,dy)||1; const nx = -dy/len, ny = dx/len;
    const hx = p.x + nx*baseW*0.3, hy = p.y + ny*baseW*0.3;
    if (i===0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
  }
  ctx.stroke();
}

// Fallback/overlay details (kept for subtle hood + blink)
function drawSnakeHead(x, y, cell, color, nx, ny, bodyW){
  const r = Math.max(7, cell*0.14);
  // Cobra hood: two flared lobes behind head
  const hx = x - nx*bodyW*0.2, hy = y - ny*bodyW*0.2;
  const hoodW = bodyW*0.9, hoodH = bodyW*1.3;
  const tx = -ny, ty = nx; // tangent
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath(); ctx.ellipse(hx + tx*hoodW*0.25, hy + ty*hoodW*0.25, hoodW*0.65, hoodH*0.55, Math.atan2(ty, tx), 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - tx*hoodW*0.25, hy - ty*hoodW*0.25, hoodW*0.65, hoodH*0.55, Math.atan2(ty, tx), 0, Math.PI*2); ctx.fill();
  // forked tongue
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(1.5, cell*0.02);
  ctx.beginPath(); ctx.moveTo(x, y+r*0.2); ctx.lineTo(x, y+r*0.7); ctx.moveTo(x, y+r*0.7); ctx.lineTo(x-r*0.15, y+r*0.9); ctx.moveTo(x, y+r*0.7); ctx.lineTo(x+r*0.15, y+r*0.9); ctx.stroke();
}

function drawSnakeHeadSVG(x, y, bodyW, angle, index, now){
  const img = snakeHeadImgs.length ? snakeHeadImgs[index % snakeHeadImgs.length] : null;
  const size = bodyW*3.0; // scale relative to body
  if (img && img.complete){
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  }
  // blinking overlay (animated): draw eyelids as rectangles that slide down/up
  const blink = (Math.sin(now/350 + index) + 1) * 0.5; // 0..1
  const eyelid = Math.max(0, (blink>0.8? (blink-0.8)/0.2 : 0)); // blink only near peak
  if (eyelid>0){
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#f0f0f0';
    const w = size*0.22, h = size*0.15*eyelid; const off = size*0.1;
    ctx.fillRect(-w - off, -size*0.05 - h, w*2, h);
    ctx.fillRect( off - w, -size*0.05 - h, w*2, h);
    ctx.restore();
  }
}

function drawLadderFixed(bottom, top, cell, N, idx){
  const railGapPx = 28; // fixed visual width
  const bpt = gridToCanvas(bottom.x, bottom.y, cell); const tpt = gridToCanvas(top.x, top.y, cell);
  const bx = bpt.cx, by = bpt.cy; const tx = tpt.cx, ty = tpt.cy;
  const dx = tx-bx, dy = ty-by; const len = Math.hypot(dx,dy);
  const nx = -dy/len, ny = dx/len;
  const rx1 = bx + nx*railGapPx/2, ry1 = by + ny*railGapPx/2;
  const rx2 = bx - nx*railGapPx/2, ry2 = by - ny*railGapPx/2;
  const tx1 = tx + nx*railGapPx/2, ty1 = ty + ny*railGapPx/2;
  const tx2 = tx - nx*railGapPx/2, ty2 = ty - ny*railGapPx/2;
  // wooden rails with gradient for 3D
  const woodSets = [ ['#8b5a2b','#deb887'], ['#7c3f10','#dcae84'], ['#a16207','#facc15'] ];
  const ws = woodSets[idx % woodSets.length];
  const woodDark = ws[0], woodLight = ws[1];
  const railGrad1 = ctx.createLinearGradient(rx1, ry1, tx1, ty1); railGrad1.addColorStop(0, woodDark); railGrad1.addColorStop(1, woodLight);
  const railGrad2 = ctx.createLinearGradient(rx2, ry2, tx2, ty2); railGrad2.addColorStop(0, woodDark); railGrad2.addColorStop(1, woodLight);
  // side faces for 3D thickness
  const thick = 6;
  const srx1 = rx1 + nx*thick, sry1 = ry1 + ny*thick;
  const srx2 = rx2 + nx*thick, sry2 = ry2 + ny*thick;
  const stx1 = tx1 + nx*thick, sty1 = ty1 + ny*thick;
  const stx2 = tx2 + nx*thick, sty2 = ty2 + ny*thick;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.lineTo(tx1, ty1); ctx.lineTo(stx1, sty1); ctx.lineTo(srx1, sry1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(rx2, ry2); ctx.lineTo(tx2, ty2); ctx.lineTo(stx2, sty2); ctx.lineTo(srx2, sry2); ctx.closePath(); ctx.fill();
  // main rails
  ctx.strokeStyle = railGrad1; ctx.lineWidth = 7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.lineTo(tx1, ty1); ctx.stroke();
  ctx.strokeStyle = railGrad2; ctx.beginPath(); ctx.moveTo(rx2, ry2); ctx.lineTo(tx2, ty2); ctx.stroke();
  ctx.strokeStyle = woodLight; ctx.lineWidth = 4;
  const steps = Math.max(3, Math.floor(len/40));
  for (let i=1;i<steps;i++){
    const t = i/steps;
    const sx1 = rx1 + (tx1-rx1)*t; const sy1 = ry1 + (ty1-ry1)*t;
    const sx2 = rx2 + (tx2-rx2)*t; const sy2 = ry2 + (ty2-ry2)*t;
    // rung top face
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
    // rung side face
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx1+nx*thick*0.8, sy1+ny*thick*0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(sx2+nx*thick*0.8, sy2+ny*thick*0.8); ctx.stroke();
    ctx.strokeStyle = woodLight; ctx.lineWidth = 4;
  }
}

function updateUI(state){
  // animate the mover if position changed
  const prev = gameState;
  if (diceAnimating){ pendingState = state; return; }
  gameState = state;
  const N = state.gridSize;
  const cell = canvas.width / N;
  let animated = false;
  if (prev && prev.players.length === state.players.length){
    const mover = (state.turnIndex - 1 + state.players.length) % state.players.length;
    const pPrev = prev.players[mover];
    const pNow = state.players[mover];
    if (pPrev && pNow && (pPrev.Position ? pPrev.Position : pPrev.position) && (pNow.Position ? pNow.Position : pNow.position)){
      const prevPos = pPrev.Position || pPrev.position;
      const nowPos = pNow.Position || pNow.position;
      if (prevPos.x !== nowPos.x || prevPos.y !== nowPos.y){
        animated = true;
        const ease = t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
        const tween = (from, to, onDone, dur=600)=>{
          const start = performance.now();
          const step = (ts)=>{
            const t = Math.min(1, (ts-start)/dur); const et = ease(t);
            const ix = from.x + (to.x - from.x)*et; const iy = from.y + (to.y - from.y)*et;
            if (!renderOverrides) renderOverrides = {};
            renderOverrides[mover] = {x: ix, y: iy};
            if (t < 1) requestAnimationFrame(step); else { renderOverrides = null; onDone && onDone(); }
          };
          requestAnimationFrame(step);
        };

        // compute potential intermediate landing (snake/ladder square)
        const prevTotal = prevPos.x>=0? prevPos.x*N + prevPos.y : -1;
        const finalTotal = nowPos.x*N + nowPos.y;
        const landing = prevTotal >= 0 ? Math.min(N*N-1, prevTotal + (state.lastRoll||0)) : (state.lastRoll||0) - 1;
        const landingPos = { x: Math.floor(landing / N), y: landing % N };
        // map snakes/ladders to totals
        const headTotals = new Set(state.snakes.map(s=>s.head.x*N + s.head.y));
        const tailTotals = new Map(state.snakes.map(s=>[s.head.x*N+s.head.y, s.tail.x*N+s.tail.y]));
        const bottomTotals = new Set(state.ladders.map(l=>l.bottom.x*N + l.bottom.y));
        const topTotals = new Map(state.ladders.map(l=>[l.bottom.x*N+l.bottom.y, l.top.x*N+l.top.y]));

        // Build chained transitions (ladder->ladder or snake->snake sequences)
        const hops = [landing];
        let cur = landing;
        let guard = 0;
        while (guard++ < 10){
          if (headTotals.has(cur)) { cur = tailTotals.get(cur); hops.push(cur); continue; }
          if (bottomTotals.has(cur)) { cur = topTotals.get(cur); hops.push(cur); continue; }
          break;
        }
        const segments = [];
        if (prevTotal >= 0) segments.push({from: prevPos, to: landingPos});
        for (let i=0;i<hops.length-1;i++){
          const from = { x: Math.floor(hops[i]/N), y: hops[i]%N };
          const toT = hops[i+1];
          const to = { x: Math.floor(toT/N), y: toT%N };
          segments.push({from, to});
        }
        // Final move to nowPos if chain ends before finalTotal
        if (hops[hops.length-1] !== finalTotal){ segments.push({from: {x: Math.floor(hops[hops.length-1]/N), y: hops[hops.length-1]%N}, to: nowPos}); }
        // Play sounds on each board interaction during tweening
        const playFor = (fromTotal)=>{ if (headTotals.has(fromTotal)) playSnakeSound(); else if (bottomTotals.has(fromTotal)) playLadderSound(); };
        const runSegments = (k)=>{
          if (k>=segments.length){ return; }
          const seg = segments[k];
          // figure total index for sound
          const tFrom = seg.from.x*N + seg.from.y;
          if (k>0) playFor(tFrom);
          // slow, dramatic motion on interactions and trigger board shake
          let dur = 600;
          if (k>0){
            if (headTotals.has(tFrom)) { shakeFX = {type:'snake', start: performance.now(), dur: 900, amp: Math.max(6, cell*0.12)}; dur = 900; }
            if (bottomTotals.has(tFrom)) { shakeFX = {type:'ladder', start: performance.now(), dur: 900, amp: Math.max(5, cell*0.1)}; dur = 900; }
          }
          tween(seg.from, seg.to, ()=>runSegments(k+1), dur);
        };
        runSegments(0);
      }
    }
  }
  if (!animated) {
    // ensure a fresh frame (global loop also draws, this is for immediate user feedback)
    // no-op: rely on global animation loop
  }
  const playersDiv = $('#players');
  playersDiv.innerHTML = '';
  state.players.forEach((p,i)=>{
    const el = document.createElement('div');
    el.className = 'player';
    const total = (typeof p.position.total === 'number' && p.position.total >= 0) ? p.position.total : (p.position.x>=0? (p.position.x*state.gridSize + p.position.y): -1);
    const square = total >= 0 ? (total+1) : 'Start';
    el.textContent = `${i===state.turnIndex ? '👉 ' : ''}${p.name} — ${square}`;
    playersDiv.appendChild(el);
  });
  // Turn box is redundant; leave empty to hide via CSS
  $('#turn').textContent = '';
  $('#last').textContent = state.lastRoll ? `Last Roll: ${state.lastRoll}` : '';
  if (state.winner){
    $('#winner').textContent = `Winner: ${state.winner} 🎉`;
    $('#rollBtn').disabled = true;
    if (lastWinPlayed !== state.winner){
      playApplauseSound();
      lastWinPlayed = state.winner;
    }
    // show new game button
    const ng = $('#newGameBtn'); if (ng) ng.style.display = 'inline-block';
  } else {
    $('#winner').textContent = '';
    $('#rollBtn').disabled = state.players.length < 2;
    lastWinPlayed = null;
    const ng = $('#newGameBtn'); if (ng) ng.style.display = 'none';
  }
}

// Dice: CSS 3D cube
function buildDiceCube(){
  const dice = $('#dice');
  if (dice.dataset.enhanced) return;
  const face = (name, pips, pos)=>`<div class="face ${name} ${pos}">${'<div class="pip"></div>'.repeat(pips)}</div>`;
  // Orient faces in 3D space: front/back/right/left/top/bottom
  // Mapping numbers to positions for our rotation classes
  dice.innerHTML = `<div class="cube show-1">${
    face('one',1,'front')+
    face('six',6,'back')+
    face('three',3,'right')+
    face('four',4,'left')+
    face('two',2,'top')+
    face('five',5,'bottom')
  }</div>`;
  dice.dataset.enhanced = '1';
}
function showDiceFace(n){
  buildDiceCube();
  const cube = $('#dice').querySelector('.cube');
  cube.className = `cube show-${n}`;
}
function animateDice(value){
  buildDiceCube();
  const dice = $('#dice');
  const cube = dice.querySelector('.cube');
  dice.classList.add('rolling');
  diceAnimating = true;
  return new Promise(resolve=>{
    setTimeout(()=>{ cube.className = `cube show-${value}`; dice.classList.remove('rolling'); diceAnimating = false; const st = pendingState; pendingState = null; if (st) updateUI(st); resolve(); }, 900);
  });
}

// Sounds via WebAudio
let audioCtx = null;
function getCtx(){ if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
function playDiceSound(){
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 220; g.gain.value = 0.0001; o.connect(g); g.connect(ctx.destination);
  o.start();
  // rumble envelope
  const now = ctx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.1, now+0.05);
  g.gain.exponentialRampToValueAtTime(0.02, now+0.4);
  o.frequency.exponentialRampToValueAtTime(140, now+0.4);
  o.stop(now+0.45);
}
function playSnakeSound(){
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 600; g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination);
  const now = ctx.currentTime; o.start();
  o.frequency.exponentialRampToValueAtTime(220, now+0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, now+0.32); o.stop(now+0.33);
}
function playLadderSound(){
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'square'; g.gain.value = 0.04; o.connect(g); g.connect(ctx.destination);
  const now = ctx.currentTime; o.start();
  o.frequency.setValueAtTime(330, now);
  o.frequency.setValueAtTime(392, now+0.08);
  o.frequency.setValueAtTime(523.25, now+0.16);
  g.gain.exponentialRampToValueAtTime(0.0001, now+0.35); o.stop(now+0.36);
}

// Applause sound when someone wins (noise burst + claps-like envelope)
function playApplauseSound(){
  const ctx = getCtx();
  // white noise buffer
  const bufferSize = 2 * ctx.sampleRate;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2 - 1) * 0.6;
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer; noise.loop = false;
  // filter and gain envelope
  const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 0.8;
  const gain = ctx.createGain(); gain.gain.value = 0.0001;
  noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  const now = ctx.currentTime;
  noise.start(now);
  // multi-peak envelope to resemble applause swells
  gain.gain.exponentialRampToValueAtTime(0.2, now+0.05);
  gain.gain.exponentialRampToValueAtTime(0.05, now+0.35);
  gain.gain.exponentialRampToValueAtTime(0.15, now+0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, now+1.2);
  noise.stop(now+1.25);
}

function setupStartModal(){
  const modal = $('#startModal');
  const addBtn = $('#addPlayerField');
  const inputsWrap = $('#playerInputs');
  let starting = false;
  addBtn.onclick = () => {
    const inp = document.createElement('input'); inp.placeholder = `Player ${inputsWrap.children.length+1}`; inputsWrap.appendChild(inp);
  };
  const startBtn = $('#startBtn');
  startBtn.onclick = async () => {
    if (starting) return; // guard against double-clicks
    starting = true;
    startBtn.disabled = true;
    try {
      const grid = Number($('#gridInput').value) || 10;
      let names = Array.from(inputsWrap.querySelectorAll('input')).map(i=>i.value.trim());
      names = names.filter(Boolean);
      if (names.length === 0) { names = ['Player 1','Player 2']; }
      if (names.length === 1) { names.push('Player 2'); }
      console.log('[Start] creating game with grid', grid, 'players', names);
      const id = await api.createGame(grid); gameId = id; $('#gameId').textContent = `Game ID: ${id}`;
      console.log('[Start] game created id=', id);
      // add players sequentially with logs to diagnose any hang
      for (const n of names){
        console.log('[Start] adding player', n);
        await withTimeout(api.addPlayer(id, n), 10000);
        console.log('[Start] added player', n);
      }
      console.log('[Start] players added');
      if (es) es.close(); es = api.stream(id, updateUI); console.log('[Start] sse subscribed');
      const st = await api.state(id); console.log('[Start] initial state', st); updateUI(st);
      modal.classList.remove('visible');
      // enable rolling if we have players
      $('#rollBtn').disabled = st.players.length < 2;
    } catch (e){
      console.error('Failed to start game', e);
      // inline error feedback
      let err = modal.querySelector('.error');
      if (!err){ err = document.createElement('div'); err.className = 'error'; modal.querySelector('.modal-content').appendChild(err); }
      err.textContent = e.message || 'Something went wrong starting the game.';
    } finally {
      // allow retry regardless of outcome to prevent deadlock on network hang
      startBtn.disabled = false;
      starting = false;
    }
  };
}

// simple timeout wrapper for promises
function withTimeout(promise, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`request timed out after ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function main(){
  setupStartModal();
  preloadSnakeAssets();
  // new game button opens the modal
  const ng = $('#newGameBtn');
  if (ng){ ng.onclick = () => { const m = $('#startModal'); if (m) m.classList.add('visible'); }; }
  $('#rollBtn').onclick = async () => {
    if (!gameId) return;
    try {
      diceAnimating = true; // gate UI updates before server state arrives
      const res = await api.roll(gameId);
      playDiceSound();
      await animateDice(res.roll);
    } catch (e){
      diceAnimating = false;
      alert(e.message);
    }
  };
  function resize(){
    const sz = Math.min(window.innerWidth-320, window.innerHeight-180, 820);
    canvas.width = canvas.height = Math.max(420, sz);
    if (gameState) drawBoard(gameState);
  }
  // build dice immediately to keep consistent look before/after game
  buildDiceCube(); showDiceFace(1);
  window.addEventListener('resize', resize); resize();
  // global animation loop: animate snakes/eyes even when idle
  const tick = ()=>{
    if (gameState) drawBoard(gameState, renderOverrides);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// --- Visual helpers ---
function shade(col, amt){
  // col: #rrggbb, amt: -255..255
  const n = col.replace('#','');
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0,2),16)+amt));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2,4),16)+amt));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4,6),16)+amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function fillCell3D(x, y, size, base){
  const lg = ctx.createLinearGradient(x, y, x+size, y+size);
  lg.addColorStop(0, shade(base, 28));
  lg.addColorStop(0.5, base);
  lg.addColorStop(1, shade(base, -28));
  ctx.fillStyle = lg; ctx.fillRect(x, y, size, size);
  // inner bevel
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x+0.5, y+0.5, size-1, size-1);
}

function drawChessPawn(cx, cy, cell, color){
  const scale = Math.max(0.6, cell/40);
  const h = 18*scale, w = 12*scale;
  ctx.save();
  ctx.translate(cx, cy);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, h*0.9, w*1.2, h*0.25, 0, 0, Math.PI*2); ctx.fill();
  // base
  const dark = shade(color.replace('#','').length? color : '#888888', -30) || color;
  const g = ctx.createLinearGradient(-w, -h, w, h);
  g.addColorStop(0, shade(color, -20)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, 30));
  ctx.fillStyle = g; ctx.strokeStyle = shade(color, -40); ctx.lineWidth = 1.2;
  // pedestal
  ctx.beginPath(); ctx.ellipse(0, h*0.65, w*1.1, h*0.18, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  // body
  ctx.beginPath();
  ctx.moveTo(-w*0.6, h*0.6);
  ctx.quadraticCurveTo(-w*0.9, h*0.1, -w*0.2, -h*0.2);
  ctx.quadraticCurveTo(0, -h*0.35, w*0.2, -h*0.2);
  ctx.quadraticCurveTo(w*0.9, h*0.1, w*0.6, h*0.6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // head ball
  ctx.beginPath(); ctx.arc(0, -h*0.35, w*0.45, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  // highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-w*0.15, -h*0.45); ctx.quadraticCurveTo(0, -h*0.5, w*0.15, -h*0.35); ctx.stroke();
  ctx.restore();
}

document.addEventListener('DOMContentLoaded', main);
