import { useEffect, useRef, useState } from "react";
import { TrendingUp, Users, Zap, DollarSign } from "lucide-react";

interface Stat {
  icon: typeof TrendingUp;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const STATS: Stat[] = [
  {
    icon: DollarSign,
    label: "Total Value Locked",
    value: 2.4,
    prefix: "$",
    suffix: "B",
    decimals: 1,
  },
  {
    icon: TrendingUp,
    label: "24h Trading Volume",
    value: 450,
    prefix: "$",
    suffix: "M",
    decimals: 0,
  },
  {
    icon: Users,
    label: "Active Users",
    value: 125,
    suffix: "K",
    decimals: 0,
  },
  {
    icon: Zap,
    label: "Transactions",
    value: 8.5,
    suffix: "M",
    decimals: 1,
  },
];

function useCountUp(end: number, duration: number = 2000, decimals: number = 0) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const startTime = Date.now();
    const endTime = startTime + duration;

    const updateCount = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = easeOutQuart * end;
      
      setCount(currentCount);

      if (now < endTime) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(updateCount);
  }, [isVisible, end, duration]);

  return { count, elementRef };
}

function formatNumber(num: number, decimals: number): string {
  if (decimals === 0) {
    return Math.floor(num).toString();
  }
  return num.toFixed(decimals);
}

function StatCard({ stat }: { stat: Stat }) {
  const { count, elementRef } = useCountUp(stat.value, 2500, stat.decimals || 0);
  const Icon = stat.icon;

  return (
    <div
      ref={elementRef}
      className="glassmorphism p-8 md:p-10 rounded-2xl border border-purple-1/20 hover-elevate group"
      data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex flex-col gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-1 to-purple-2 flex items-center justify-center glow-primary transition-transform group-hover:scale-110">
          <Icon className="w-7 h-7 text-white" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground font-medium uppercase tracking-wide mb-2">{stat.label}</div>
          <div className="text-4xl md:text-5xl font-bold text-white glow-text">
            {stat.prefix}
            {formatNumber(count, stat.decimals || 0)}
            {stat.suffix}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Statistics() {
  return (
    <section className="relative py-24 md:py-32 lg:py-40 px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-1/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16 md:mb-20 animate-slide-up">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest text-purple-1 font-bold px-4 py-2 rounded-full bg-purple-1/10 border border-purple-1/20">
              Platform Metrics
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 glow-text leading-tight">
            Powering Private DeFi
          </h2>
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Real-time metrics from the world's most secure decentralized exchange
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className="animate-slide-up"
              style={{ animationDelay: `${0.1 * (index + 1)}s` }}
            >
              <StatCard stat={stat} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
