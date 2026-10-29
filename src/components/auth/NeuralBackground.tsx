import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  glow: number; // 0..1, decai após receber um impulso
}

interface Pulse {
  from: number;
  to: number;
  t: number; // 0..1 ao longo da aresta
  speed: number;
  hops: number; // quantos saltos ainda pode propagar
}

const LINK_DISTANCE = 150;
const MOUSE_RADIUS = 180;

/**
 * Rede neural em canvas: neurônios derivam lentamente, conexões surgem por proximidade
 * e impulsos ("sinapses") percorrem as arestas, propagando-se de neurônio em neurônio.
 * O cursor atrai conexões; um clique dispara uma rajada a partir do neurônio mais próximo.
 */
export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let raf = 0;
    let lastSpawn = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    const neighbors = (i: number) => {
      const a = nodes[i];
      const out: number[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy < LINK_DISTANCE * LINK_DISTANCE) out.push(j);
      }
      return out;
    };

    const fire = (from: number, hops: number) => {
      const ns = neighbors(from);
      if (ns.length === 0) return;
      nodes[from].glow = 1;
      const count = Math.min(ns.length, hops > 2 ? 3 : 1);
      for (let k = 0; k < count; k++) {
        const to = ns[Math.floor(Math.random() * ns.length)];
        pulses.push({ from, to, t: 0, speed: 0.012 + Math.random() * 0.014, hops });
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.round(Math.min(130, Math.max(40, (width * height) / 14000)));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.4,
        glow: 0,
      }));
      pulses = [];
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Movimento
      if (!reduceMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) n.x = width + 20;
          if (n.x > width + 20) n.x = -20;
          if (n.y < -20) n.y = height + 20;
          if (n.y > height + 20) n.y = -20;
          if (mouse.active) {
            const dx = mouse.x - n.x;
            const dy = mouse.y - n.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < MOUSE_RADIUS * MOUSE_RADIUS && d2 > 1) {
              const f = 0.0009 * (1 - Math.sqrt(d2) / MOUSE_RADIUS);
              n.x += dx * f;
              n.y += dy * f;
            }
          }
          n.glow *= 0.955;
        }
      }

      // Arestas
      ctx.lineWidth = 0.6;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DISTANCE * LINK_DISTANCE) continue;
          const alpha = (1 - Math.sqrt(d2) / LINK_DISTANCE) * 0.16 + Math.max(a.glow, b.glow) * 0.18;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Conexões com o cursor
      if (mouse.active) {
        for (const n of nodes) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > MOUSE_RADIUS) continue;
          ctx.strokeStyle = `rgba(255,255,255,${(1 - d / MOUSE_RADIUS) * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      // Impulsos
      if (!reduceMotion) {
        if (time - lastSpawn > 650 && nodes.length) {
          lastSpawn = time;
          fire(Math.floor(Math.random() * nodes.length), 3);
        }
        const next: Pulse[] = [];
        for (const p of pulses) {
          p.t += p.speed;
          const a = nodes[p.from];
          const b = nodes[p.to];
          if (!a || !b) continue;
          if (p.t >= 1) {
            b.glow = 1;
            if (p.hops > 1 && pulses.length < 90) {
              const ns = neighbors(p.to).filter((n) => n !== p.from);
              if (ns.length) {
                next.push({ from: p.to, to: ns[Math.floor(Math.random() * ns.length)], t: 0, speed: p.speed, hops: p.hops - 1 });
              }
            }
            continue;
          }
          const x = a.x + (b.x - a.x) * p.t;
          const y = a.y + (b.y - a.y) * p.t;
          // rastro
          const tx = a.x + (b.x - a.x) * Math.max(0, p.t - 0.18);
          const ty = a.y + (b.y - a.y) * Math.max(0, p.t - 0.18);
          const grad = ctx.createLinearGradient(tx, ty, x, y);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(1, 'rgba(255,255,255,0.75)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
          next.push(p);
        }
        pulses = next;
      }

      // Neurônios
      for (const n of nodes) {
        if (n.glow > 0.05) {
          ctx.fillStyle = `rgba(255,255,255,${n.glow * 0.12})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 7 * n.glow, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(255,255,255,${0.35 + n.glow * 0.6})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.glow * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
    };
    const onClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let best = -1;
      let bestD = Infinity;
      nodes.forEach((n, i) => {
        const d = (n.x - x) ** 2 + (n.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        for (let k = 0; k < 3; k++) fire(best, 5);
      }
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onClick);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

