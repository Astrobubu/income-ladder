// Tiny confetti burst on a canvas. The rAF loop stops itself when the last piece falls.
const COLORS = ["#ff8a3d", "#ff4f81", "#ffd23f", "#2ec4b6", "#8e5bff", "#ffffff"];

type Piece = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; life: number };

const canvas = document.getElementById("confetti") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let pieces: Piece[] = [];
let running = false;

function fit() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function burst(x: number, y: number, count = 70) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  fit();
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = 3 + Math.random() * 5;
    pieces.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 5 + Math.random() * 4,
      h: 3 + Math.random() * 3,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      life: 90 + Math.random() * 40,
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

function tick() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  pieces = pieces.filter((p) => p.life > 0);
  for (const p of pieces) {
    p.vy += 0.18;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.r += p.vr;
    p.life--;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.c;
    ctx.strokeStyle = "#120d2b";
    ctx.lineWidth = 1.6;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  if (pieces.length) requestAnimationFrame(tick);
  else running = false;
}
