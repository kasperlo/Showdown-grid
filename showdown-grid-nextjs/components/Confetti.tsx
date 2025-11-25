import React, { useEffect, useRef } from "react";

type ConfettiProps = {
  show: boolean;
  duration?: number;
  onComplete?: () => void;
};

export default function Confetti({
  show,
  duration = 1200,
  onComplete,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!show) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      const t = setTimeout(
        () => onCompleteRef.current?.(),
        Math.min(400, duration)
      );
      return () => clearTimeout(t);
    }

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      rot: number;
      vr: number;
      color: string;
      life: number;
      alpha: number;
    };

    const colors = [
      "hsl(217 91% 60%)",
      "hsl(48 96% 53%)",
      "hsl(142 76% 36%)",
      "hsl(262 83% 58%)",
      "hsl(25 95% 53%)",
    ];

    const particles: P[] = [];
    const count = Math.min(
      220,
      Math.floor((window.innerWidth + window.innerHeight) / 6)
    );

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = 4 + Math.random() * 6;
      particles.push({
        x: window.innerWidth / 2,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 4,
        size: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        color: colors[i % colors.length],
        life: 1,
        alpha: 1,
      });
    }

    const start = performance.now();

    const tick = (now: number) => {
      const t = now - start;
      const progress = Math.min(1, t / duration);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.vy += 0.12;
        p.vx *= 0.995;
        p.vy *= 0.995;

        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        p.life = 1 - progress;
        p.alpha = Math.max(0, p.life);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onCompleteRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      const c = canvasRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    };
  }, [show, duration]);

  if (!show) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}
