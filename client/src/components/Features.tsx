import { Shield, Zap, Lock, Network, Layers, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Shield,
    title: "Zero-Knowledge Batching",
    description: "Aggregate multiple transactions into single zero-knowledge proofs for maximum efficiency and anonymity.",
  },
  {
    icon: Network,
    title: "Encrypted Relay Network",
    description: "Multi-hop routing through decentralized relay nodes to obfuscate transaction origins completely.",
  },
  {
    icon: Layers,
    title: "Shadow Pool Liquidity",
    description: "Anonymous liquidity aggregation from multiple sources without exposing individual positions or strategies.",
  },
  {
    icon: Lock,
    title: "Stealth Execution",
    description: "Private transaction settlement with stealth addressing and MEV-resistant routing for maximum security.",
  },
  {
    icon: Globe,
    title: "Cross-Chain Privacy",
    description: "Execute private trades across multiple blockchain networks while maintaining complete transaction anonymity.",
  },
  {
    icon: Zap,
    title: "Instant Settlement",
    description: "Lightning-fast trade execution with instant finality while preserving complete transaction privacy.",
  },
];

export function Features() {
  return (
    <section className="relative min-h-screen flex items-center py-20 px-6 lg:px-8 overflow-hidden" id="features">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-2/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-3/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto w-full">
        <div className="text-center mb-16 md:mb-20 animate-slide-up">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest text-purple-1 font-bold px-4 py-2 rounded-full bg-purple-1/10 border border-purple-1/20">
              Platform Features
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 glow-text leading-tight">
            Built for Invisible<br className="hidden sm:block" /> Traders
          </h2>
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Advanced privacy infrastructure designed for complete transaction anonymity
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="glassmorphism border-purple-1/20 hover-elevate overflow-visible animate-slide-up group"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                data-testid={`feature-card-${index}`}
              >
                <CardContent className="p-8 md:p-10 space-y-5">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-1 to-purple-2 flex items-center justify-center glow-primary transition-transform group-hover:scale-110">
                    <Icon className="w-8 h-8 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-base">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
