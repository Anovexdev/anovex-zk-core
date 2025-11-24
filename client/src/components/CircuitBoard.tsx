import { useEffect, useRef, useState } from "react";
import anovexCenterLogo from "@assets/anovex-logo-center.png";

interface Stage {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  color: string;
  secondaryColor: string;
}

interface Pulse {
  pathIndex: number;
  progress: number;
  speed: number;
}

const STAGE_DATA = [
  {
    id: "user",
    label: "User",
    description: "Initial transaction submission with encrypted payload wrapping",
    color: "#A855F7",
    secondaryColor: "#9333EA",
  },
  {
    id: "relay",
    label: "Relay",
    description: "Multi-hop routing through decentralized relay network",
    color: "#9333EA",
    secondaryColor: "#7E22CE",
  },
  {
    id: "zkbatch",
    label: "ZK Batch",
    description: "Zero-knowledge proof generation and transaction batching",
    color: "#7E22CE",
    secondaryColor: "#6B21A8",
  },
  {
    id: "pool",
    label: "Pool",
    description: "Anonymous liquidity aggregation from multiple sources",
    color: "#6B21A8",
    secondaryColor: "#581C87",
  },
  {
    id: "execution",
    label: "Execute",
    description: "Final settlement with stealth addressing",
    color: "#8B5CF6",
    secondaryColor: "#7C3AED",
  },
];

export function CircuitBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredStage, setHoveredStage] = useState<Stage | null>(null);
  const [focusedStageIndex, setFocusedStageIndex] = useState<number>(-1);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();
  const stagesRef = useRef<Stage[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const isPausedRef = useRef(false);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const logoImg = new Image();
    logoImg.src = anovexCenterLogo;
    logoImageRef.current = logoImg;

    let dpr = window.devicePixelRatio || 1;
    const isMobile = window.innerWidth < 768;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      layoutStages();
    };

    const layoutStages = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const isMobileLayout = width < 768;

      const padding = isMobileLayout ? 40 : 60;
      const boxWidth = width - padding * 2;
      const boxHeight = height - padding * 2;

      const positions = [
        { x: padding + boxWidth * 0.5, y: padding + boxHeight * 0.05 },
        { x: padding + boxWidth * 0.85, y: padding + boxHeight * 0.2 },
        { x: padding + boxWidth * 0.85, y: padding + boxHeight * 0.8 },
        { x: padding + boxWidth * 0.15, y: padding + boxHeight * 0.8 },
        { x: padding + boxWidth * 0.15, y: padding + boxHeight * 0.2 },
      ];

      stagesRef.current = STAGE_DATA.map((data, i) => ({
        ...data,
        x: positions[i].x,
        y: positions[i].y,
      }));
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const pulseCount = isMobile ? 8 : 15;
    pulsesRef.current = Array.from({ length: pulseCount }, () => ({
      pathIndex: Math.floor(Math.random() * STAGE_DATA.length),
      progress: Math.random(),
      speed: 0.002 + Math.random() * 0.003,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x, y });

      let hovered: Stage | null = null;
      for (const stage of stagesRef.current) {
        const dx = x - stage.x;
        const dy = y - stage.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 40) {
          hovered = stage;
          break;
        }
      }

      setHoveredStage(hovered);
    };

    canvas.addEventListener("mousemove", handleMouseMove);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedStageIndex((prev) => (prev + 1) % STAGE_DATA.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedStageIndex((prev) => (prev - 1 + STAGE_DATA.length) % STAGE_DATA.length);
      } else if (e.key === "Escape") {
        setFocusedStageIndex(-1);
      }
    };

    canvas.addEventListener("keydown", handleKeyDown);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let isAnimating = true;

    const handleVisibilityChange = () => {
      const wasHidden = isPausedRef.current;
      isPausedRef.current = document.hidden;
      
      if (wasHidden && !document.hidden && !prefersReducedMotion && isAnimating) {
        animate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const drawTrace = (x1: number, y1: number, x2: number, y2: number, color: string, glowIntensity: number = 0.3) => {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const midX = (x1 + x2) / 2;
      const offsetY = Math.abs(x2 - x1) * 0.15;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(
        midX, y1 - offsetY,
        midX, y2 + offsetY,
        x2, y2
      );

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.shadowBlur = 10 * glowIntensity;
      ctx.shadowColor = color;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 * glowIntensity})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    };

    const drawChip = (stage: Stage, isActive: boolean) => {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const chipWidth = isMobile ? 70 : 90;
      const chipHeight = isMobile ? 50 : 60;
      const x = stage.x - chipWidth / 2;
      const y = stage.y - chipHeight / 2;

      ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
      ctx.strokeStyle = stage.color;
      ctx.lineWidth = isActive ? 2.5 : 2;
      
      ctx.shadowBlur = isActive ? 20 : 12;
      ctx.shadowColor = stage.color;

      ctx.beginPath();
      ctx.roundRect(x, y, chipWidth, chipHeight, 4);
      ctx.fill();
      ctx.stroke();

      const pinLength = isMobile ? 6 : 8;
      const pinSpacing = isMobile ? 12 : 15;
      const pinCount = 3;

      for (let i = 0; i < pinCount; i++) {
        const pinY = y + chipHeight / 2 - (pinCount - 1) * pinSpacing / 2 + i * pinSpacing;
        
        ctx.fillStyle = stage.secondaryColor;
        ctx.fillRect(x - pinLength, pinY - 2, pinLength, 4);
        ctx.fillRect(x + chipWidth, pinY - 2, pinLength, 4);
      }

      ctx.shadowBlur = 0;

      const gradient = ctx.createLinearGradient(x, y, x, y + chipHeight);
      gradient.addColorStop(0, `${stage.color}40`);
      gradient.addColorStop(1, `${stage.secondaryColor}20`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 5, y + 5, chipWidth - 10, chipHeight - 10);

      const fontSize = isMobile ? 9 : 11;
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowBlur = 10;
      ctx.shadowColor = stage.color;
      
      ctx.fillText(stage.label.toUpperCase(), stage.x, stage.y);
      
      ctx.shadowBlur = 0;
      ctx.restore();
    };

    const animate = () => {
      if (!canvas || !ctx || !isAnimating) {
        return;
      }

      if (isPausedRef.current || prefersReducedMotion) {
        return;
      }

      const rect = canvas.getBoundingClientRect();

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      ctx.fillStyle = 'rgba(15, 15, 20, 0.1)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const gradient = ctx.createRadialGradient(rect.width / 2, rect.height / 2, 0, rect.width / 2, rect.height / 2, rect.width / 2);
      gradient.addColorStop(0, 'rgba(31, 31, 46, 0)');
      gradient.addColorStop(1, 'rgba(10, 10, 15, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.restore();

      for (let i = 0; i < stagesRef.current.length; i++) {
        const from = stagesRef.current[i];
        const to = stagesRef.current[(i + 1) % stagesRef.current.length];
        drawTrace(from.x, from.y, to.x, to.y, from.color, 1);
      }

      for (const pulse of pulsesRef.current) {
        pulse.progress += pulse.speed;
        if (pulse.progress > 1) {
          pulse.progress = 0;
          pulse.pathIndex = Math.floor(Math.random() * STAGE_DATA.length);
        }

        const from = stagesRef.current[pulse.pathIndex];
        const to = stagesRef.current[(pulse.pathIndex + 1) % stagesRef.current.length];

        const midX = (from.x + to.x) / 2;
        const offsetY = Math.abs(to.x - from.x) * 0.15;

        const t = pulse.progress;
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        const px = mt3 * from.x +
                  3 * mt2 * t * midX +
                  3 * mt * t2 * midX +
                  t3 * to.x;

        const py = mt3 * from.y +
                  3 * mt2 * t * (from.y - offsetY) +
                  3 * mt * t2 * (to.y + offsetY) +
                  t3 * to.y;

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.beginPath();
        ctx.arc(px, py, isMobile ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = from.color;
        ctx.shadowBlur = isMobile ? 10 : 15;
        ctx.shadowColor = from.color;
        ctx.fill();

        const trailCount = isMobile ? 3 : 5;
        for (let i = 1; i <= trailCount; i++) {
          const trailT = pulse.progress - i * 0.04;
          if (trailT < 0) continue;

          const tt = trailT;
          const tt2 = tt * tt;
          const tt3 = tt2 * tt;
          const mtt = 1 - tt;
          const mtt2 = mtt * mtt;
          const mtt3 = mtt2 * mtt;

          const tpx = mtt3 * from.x +
                     3 * mtt2 * tt * midX +
                     3 * mtt * tt2 * midX +
                     tt3 * to.x;

          const tpy = mtt3 * from.y +
                     3 * mtt2 * tt * (from.y - offsetY) +
                     3 * mtt * tt2 * (to.y + offsetY) +
                     tt3 * to.y;

          ctx.beginPath();
          const trailSize = (isMobile ? 2 : 3) * (1 - i / trailCount);
          ctx.arc(tpx, tpy, trailSize, 0, Math.PI * 2);
          
          const r = parseInt(from.color.slice(1, 3), 16);
          const g = parseInt(from.color.slice(3, 5), 16);
          const b = parseInt(from.color.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.4 * (1 - i / trailCount)})`;
          ctx.fill();
        }

        ctx.restore();
      }

      if (logoImageRef.current && logoImageRef.current.complete) {
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const logoSize = isMobile ? rect.width * 0.28 : rect.width * 0.20;

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.globalAlpha = 0.08;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#8B5CF6';
        ctx.drawImage(
          logoImageRef.current,
          centerX - logoSize / 2,
          centerY - logoSize / 2,
          logoSize,
          logoSize
        );

        ctx.restore();

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const fontSize = isMobile ? 14 : 18;
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textY = centerY + logoSize / 2 + (isMobile ? 20 : 30);

        ctx.shadowBlur = 20;
        ctx.shadowColor = '#A855F7';
        ctx.fillStyle = '#A855F7';
        ctx.globalAlpha = 0.9;
        ctx.fillText('ANOVEX CORE', centerX, textY);

        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.6;
        ctx.fillText('ANOVEX CORE', centerX, textY);

        ctx.restore();
      }

      for (let i = 0; i < stagesRef.current.length; i++) {
        const stage = stagesRef.current[i];
        const isHovered = hoveredStage?.id === stage.id;
        const isFocused = focusedStageIndex === i;
        const isActive = isHovered || isFocused;

        drawChip(stage, isActive);
      }

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (!prefersReducedMotion) {
      animate();
    }

    return () => {
      isAnimating = false;
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [hoveredStage, focusedStageIndex]);

  const displayedStage = hoveredStage || (focusedStageIndex >= 0 ? stagesRef.current[focusedStageIndex] : null);

  return (
    <div className="relative w-full h-full" data-testid="canvas-container">
      <canvas
        ref={canvasRef}
        className="w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-1 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-2 rounded-xl"
        aria-label="Circuit board workflow visualization showing Anovex's transaction flow through User, Relay, ZK Batch, Pool, and Execute stages. Use arrow keys to navigate."
        aria-describedby="canvas-description"
        role="img"
        tabIndex={0}
      />
      <div id="canvas-description" className="sr-only">
        Interactive circuit board visualization of the Anovex transaction workflow. 
        Shows five processing stages: User for initial transaction submission, 
        Relay for private transaction routing, ZK Batch for zero-knowledge proof generation, 
        Pool for anonymous liquidity aggregation, and Execute for final settlement. 
        Animated pulses show data flowing through the system in a continuous loop.
        Use arrow keys to navigate between stages and hear their descriptions.
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {displayedStage ? `${displayedStage.label}: ${displayedStage.description}` : ''}
      </div>
      {displayedStage && (
        <div
          className="absolute pointer-events-none glassmorphism px-4 py-3 rounded-md max-w-xs z-10"
          style={{
            left: hoveredStage ? `${mousePos.x + 20}px` : '50%',
            top: hoveredStage ? `${mousePos.y + 20}px` : '10%',
            transform: hoveredStage ? 'none' : 'translateX(-50%)',
          }}
          aria-hidden="true"
          data-testid={`tooltip-${displayedStage.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="text-sm font-semibold text-white mb-1">{displayedStage.label}</div>
          <div className="text-xs text-muted-foreground">{displayedStage.description}</div>
        </div>
      )}
    </div>
  );
}
