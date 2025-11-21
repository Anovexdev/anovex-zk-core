import { Button } from "@/components/ui/button";
import { CircuitBoard } from "./CircuitBoard";
import { ProcessingBadge } from "./ProcessingBadge";
import { Arrow } from "./Arrow";
import { Send } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 md:pt-16 lg:pt-12" role="main">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(168, 85, 247, 0.03) 1px, transparent 0)`,
          backgroundSize: '50px 50px',
        }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-1/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-purple-2/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-3/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-28 lg:gap-12 items-center">
          {/* Left Column: Hero Content */}
          <div className="space-y-8 md:space-y-10 animate-slide-up flex flex-col items-center lg:items-start" style={{ animationDelay: "0.1s" }}>
            <div className="space-y-6 w-full flex flex-col items-center lg:items-start">
              <ProcessingBadge />

              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl font-bold text-white glow-text tracking-tight leading-[1.1] text-center lg:text-left w-full">
                Trade Without<br />a Trace
              </h1>
              
              <p className="text-lg md:text-xl lg:text-xl text-muted-foreground leading-relaxed max-w-xl lg:max-w-none text-center lg:text-left w-full">
                Execute anonymous trades with absolute privacy. Zero-knowledge cryptography meets decentralized relay networks, severing the transaction graph between your wallet and on-chain activity. Every swap flows through encrypted privacy circuits.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center lg:justify-start" data-testid="hero-cta-buttons">
              <a href="https://trade.anovex.io">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-1 to-purple-2 hover:from-purple-2 hover:to-purple-3 text-white glow-primary border-0 w-full sm:w-auto"
                  data-testid="button-launch-anovex"
                >
                  Launch Anovex
                  <Arrow className="ml-2 w-5 h-5" />
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                className="glassmorphism glow-white border-white/30 hover:border-white/50 text-white backdrop-blur-md w-full sm:w-auto"
                data-testid="button-launch-telegram"
              >
                <Send className="mr-2 w-5 h-5" />
                Telegram Bot
              </Button>
            </div>
          </div>

          {/* Right Column: Transaction Flow Legend + Diagram */}
          <div className="flex flex-col lg:flex-col-reverse gap-16 lg:gap-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {/* Transaction Flow Legend */}
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">Transaction Flow</p>
              <div className="flex flex-wrap gap-4 md:gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-[#A855F7] shadow-lg shadow-purple-1/50" />
                  <span className="text-sm text-white/80 font-medium">User</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-[#9333EA] shadow-lg shadow-purple-2/50" />
                  <span className="text-sm text-white/80 font-medium">Relay</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-[#7E22CE] shadow-lg shadow-purple-3/50" />
                  <span className="text-sm text-white/80 font-medium">ZK Batch</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-[#6B21A8] shadow-lg shadow-purple-4/50" />
                  <span className="text-sm text-white/80 font-medium">Pool</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-[#8B5CF6] shadow-lg shadow-purple-1/50" />
                  <span className="text-sm text-white/80 font-medium">Execute</span>
                </div>
              </div>
            </div>

            {/* CircuitBoard Diagram */}
            <div 
              className="relative h-[360px] md:h-[400px] lg:h-[420px]" 
              data-testid="hero-canvas-container"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-1/10 via-transparent to-purple-2/10 rounded-3xl blur-3xl" />
              <div className="relative h-full glassmorphism rounded-2xl md:rounded-3xl overflow-hidden border border-purple-1/20 shadow-2xl shadow-purple-1/10">
                <CircuitBoard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
