import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  velocity: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let animationFrameId: number;
    let scrollY = 0;

    let dpr = window.devicePixelRatio || 1;

    const resizeCanvas = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      stars = [];
      const starCount = Math.min(150, Math.floor((window.innerWidth * window.innerHeight) / 8000));
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          velocity: Math.random() * 0.3 + 0.1,
        });
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleScroll = () => {
      scrollY = window.scrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let isAnimating = true;

    const animate = () => {
      if (!canvas || !ctx || !isAnimating) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const parallaxOffset = prefersReducedMotion ? 0 : scrollY * 0.5;

      for (const star of stars) {
        const adjustedY = (star.y + parallaxOffset * star.velocity) % window.innerHeight;

        ctx.beginPath();
        ctx.arc(star.x, adjustedY, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(animate);
    };

    if (!prefersReducedMotion) {
      animate();
    }

    return () => {
      isAnimating = false;
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
