import { useEffect, useRef, useState } from "react";

interface Phase {
  title: string;
  subtitle: string;
  chains: string;
  features: string[];
}

const PHASES: Phase[] = [
  {
    title: "Phase 1",
    subtitle: "Foundation",
    chains: "Solana",
    features: [
      "Core ZK privacy engine with stealth routing",
      "Private swaps & liquidity pools",
      "Multi-hop relay network",
      "Telegram bot & web interface",
      "Advanced anonymity features",
    ],
  },
  {
    title: "Phase 2",
    subtitle: "Multi-Chain Expansion",
    chains: "Solana, Ethereum",
    features: [
      "Cross-chain private swaps",
      "Unified privacy pools",
      "Multi-chain routing integration",
      "Enhanced privacy analytics",
    ],
  },
  {
    title: "Phase 3",
    subtitle: "Network Growth",
    chains: "Solana, Ethereum, Polygon, Arbitrum",
    features: [
      "Native mobile apps",
      "DAO governance",
      "Developer API & SDK",
      "Institutional features",
    ],
  },
];

export function Roadmap() {
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const currentSection = sectionRef.current;
    if (currentSection) {
      observer.observe(currentSection);
    }

    return () => {
      if (currentSection) {
        observer.unobserve(currentSection);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-12 px-6 lg:px-8 overflow-hidden"
      data-testid="section-roadmap"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-1/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-0 animate-slide-up">
          <div className="inline-block mb-2">
            <span className="text-xs uppercase tracking-widest text-purple-1 font-bold px-4 py-2 rounded-full bg-purple-1/10 border border-purple-1/20">
              Development Journey
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-2 glow-text leading-tight">
            Roadmap
          </h2>
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Progressive expansion of privacy-first decentralized trading
          </p>
        </div>

        {/* Desktop: Horizontal curved path */}
        <div className="hidden lg:block relative -mt-8" style={{ height: "480px" }}>
          {/* SVG Path */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1200 600"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Gradient for the path */}
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#A855F7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7E22CE" stopOpacity="0.8" />
              </linearGradient>

              {/* Glow filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Animated gradient for shimmer effect */}
              <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3">
                  <animate
                    attributeName="stop-opacity"
                    values="0.3;0.8;0.3"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </stop>
                <stop offset="50%" stopColor="#A855F7" stopOpacity="0.6">
                  <animate
                    attributeName="stop-opacity"
                    values="0.6;1;0.6"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </stop>
                <stop offset="100%" stopColor="#7E22CE" stopOpacity="0.3">
                  <animate
                    attributeName="stop-opacity"
                    values="0.3;0.8;0.3"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </stop>
              </linearGradient>
            </defs>

            {/* Main curved path - S-curve for map-like feel */}
            <path
              d="M 100 300 Q 300 150, 600 300 T 1100 300"
              stroke="url(#pathGradient)"
              strokeWidth="3"
              fill="none"
              filter="url(#glow)"
              className={isVisible ? "animate-draw-path" : "opacity-0"}
            />

            {/* Shimmer overlay path */}
            <path
              d="M 100 300 Q 300 150, 600 300 T 1100 300"
              stroke="url(#shimmerGradient)"
              strokeWidth="5"
              fill="none"
              className={isVisible ? "opacity-100" : "opacity-0"}
            />

            {/* Phase 1 Node */}
            <g 
              className={isVisible ? "animate-fade-in" : "opacity-0"} 
              style={{ animationDelay: "0.5s" }}
              data-testid="roadmap-node-phase-1"
            >
              <circle
                cx="100"
                cy="300"
                r={activePhase === 0 ? "24" : "20"}
                fill="#8B5CF6"
                filter="url(#glow)"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setActivePhase(0)}
                onMouseLeave={() => setActivePhase(null)}
              />
              <circle
                cx="100"
                cy="300"
                r="12"
                fill="white"
                className="transition-all duration-300"
              />
            </g>

            {/* Phase 2 Node */}
            <g 
              className={isVisible ? "animate-fade-in" : "opacity-0"} 
              style={{ animationDelay: "0.7s" }}
              data-testid="roadmap-node-phase-2"
            >
              <circle
                cx="600"
                cy="300"
                r={activePhase === 1 ? "24" : "20"}
                fill="#A855F7"
                filter="url(#glow)"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setActivePhase(1)}
                onMouseLeave={() => setActivePhase(null)}
              />
              <circle
                cx="600"
                cy="300"
                r="12"
                fill="white"
                className="transition-all duration-300"
              />
            </g>

            {/* Phase 3 Node */}
            <g 
              className={isVisible ? "animate-fade-in" : "opacity-0"} 
              style={{ animationDelay: "0.9s" }}
              data-testid="roadmap-node-phase-3"
            >
              <circle
                cx="1100"
                cy="300"
                r={activePhase === 2 ? "24" : "20"}
                fill="#7E22CE"
                filter="url(#glow)"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setActivePhase(2)}
                onMouseLeave={() => setActivePhase(null)}
              />
              <circle
                cx="1100"
                cy="300"
                r="12"
                fill="white"
                className="transition-all duration-300"
              />
            </g>
          </svg>

          {/* Phase Content - Positioned absolutely */}
          {PHASES.map((phase, index) => {
            const positions = [
              { left: "0%", top: "55%" },
              { left: "42%", top: "55%" },
              { left: "84%", top: "55%" },
            ];

            return (
              <div
                key={index}
                className={`absolute w-80 transition-all duration-300 ${
                  isVisible ? "animate-slide-up" : "opacity-0"
                }`}
                style={{
                  ...positions[index],
                  animationDelay: `${0.6 + index * 0.2}s`,
                  transform: activePhase === index ? "translateY(-8px)" : "translateY(0)",
                }}
                onMouseEnter={() => setActivePhase(index)}
                onMouseLeave={() => setActivePhase(null)}
                data-testid={`roadmap-phase-${index + 1}`}
              >
                <div className="space-y-3">
                  {/* Phase header */}
                  <div>
                    <div className="text-sm font-bold text-purple-1 mb-1">{phase.title}</div>
                    <h3 className="text-2xl font-bold text-white glow-text mb-2">
                      {phase.subtitle}
                    </h3>
                    <div className="inline-block px-3 py-1 rounded-full bg-purple-1/20 border border-purple-1/30">
                      <span className="text-xs font-medium text-purple-1">{phase.chains}</span>
                    </div>
                  </div>

                  {/* Features list */}
                  <ul className="space-y-2">
                    {phase.features.map((feature, fIndex) => (
                      <li
                        key={fIndex}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-purple-1 mt-1 flex-shrink-0">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: Vertical zig-zag layout */}
        <div className="lg:hidden space-y-16">
          <svg
            className="absolute left-1/2 -translate-x-1/2 top-32 h-full w-1"
            style={{ zIndex: 0 }}
          >
            <defs>
              <linearGradient id="verticalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#A855F7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7E22CE" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <line
              x1="50%"
              y1="0"
              x2="50%"
              y2="100%"
              stroke="url(#verticalGradient)"
              strokeWidth="2"
              className={isVisible ? "opacity-100" : "opacity-0"}
            />
          </svg>

          {PHASES.map((phase, index) => (
            <div
              key={index}
              className={`relative ${
                isVisible ? "animate-slide-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${0.3 + index * 0.2}s`, zIndex: 1 }}
              data-testid={`roadmap-phase-mobile-${index + 1}`}
            >
              {/* Node indicator */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-purple-1 border-4 border-background glow-primary"
                data-testid={`roadmap-node-mobile-phase-${index + 1}`}
              />

              {/* Content card - alternating sides */}
              <div
                className={`glassmorphism p-6 rounded-2xl border border-purple-1/20 ${
                  index % 2 === 0 ? "mr-auto ml-0" : "ml-auto mr-0"
                } w-[85%]`}
              >
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-bold text-purple-1 mb-1">{phase.title}</div>
                    <h3 className="text-xl font-bold text-white glow-text mb-2">
                      {phase.subtitle}
                    </h3>
                    <div className="inline-block px-3 py-1 rounded-full bg-purple-1/20 border border-purple-1/30">
                      <span className="text-xs font-medium text-purple-1">{phase.chains}</span>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {phase.features.map((feature, fIndex) => (
                      <li
                        key={fIndex}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-purple-1 mt-1 flex-shrink-0">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
