import React, { useEffect, useRef } from "react";

type EmojiBurstProps = {
  show: boolean;
  emojis: string[];           // kilde-sett – vi velger ÉN tilfeldig per burst
  duration?: number;          // ms
  intensity?: number;         // 0.6 .. 2.0 – påvirker antall og fart
  onComplete?: () => void;
};

/**
 * Emoji-regn: ÉN tilfeldig emoji per burst, mange av samme,
 * som regner ned fra toppen med lett vind og rotasjon.
 * Respekterer prefers-reduced-motion.
 */
export default function EmojiBurst({
  show,
  emojis,
  duration = 3600,
  intensity = 1.2,
  onComplete,
}: EmojiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!show) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      const t = setTimeout(() => onComplete?.(), Math.min(300, duration));
      return () => clearTimeout(t);
    }

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // DPR + resize
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Velg ÉN emoji for hele burst’en
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const emoji = emojis.length > 0 ? pick(emojis) : "🎉";

    // Partikler
    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      rot: number;
      vr: number;
      size: number;
      alpha: number;
      seed: number;
    };

    // Antall: færre enn før, skaler lett med bredde og intensitet
    const baseCount = Math.round((window.innerWidth / 20) * intensity);
    const count = Math.min(160, Math.max(40, baseCount)); // 40–160
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const particles: P[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: rand(0, window.innerWidth),
        y: rand(-120, -20),              // start over toppen
        vx: rand(-0.6, 0.6),             // svak horisontal start
        vy: rand(2.2, 5.2) * intensity,  // fallhastighet
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.15, 0.15),           // roter sakte
        size: rand(28, 48),              // store nok for storskjerm
        alpha: 1,
        seed: Math.random() * 1000,      // unik vindfase
      });
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        // Vind som varierer over tid og per partikkel
        const wind = Math.sin((now + p.seed) * 0.0016) * 0.35;
        p.vx += wind * 0.04;
        p.vy += 0.12;            // lett gravitasjon
        p.vx *= 0.996;           // litt drag
        p.vy *= 0.998;

        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        // Fade sakte mot slutt av animasjonen
        p.alpha = Math.max(0, 1 - Math.pow(progress, 1.1));

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `${p.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
        ctx.fillText(emoji, 0, 0);
        ctx.restore();
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      const c = canvasRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    };
  }, [show, emojis, duration, intensity, onComplete]);

  if (!show) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}