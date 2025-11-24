import { Button } from "@/components/ui/button";
import { Arrow } from "./Arrow";
import { Send } from "lucide-react";
import { Link } from "wouter";

export function CtaBand() {
  return (
    <section className="relative py-24 md:py-32 lg:py-40 px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-1/10 via-purple-2/15 to-purple-1/10 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-3/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-2/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative max-w-5xl mx-auto">
        <div className="glassmorphism rounded-3xl p-12 md:p-16 lg:p-20 text-center space-y-10 md:space-y-12 border-purple-1/30 animate-slide-up shadow-2xl shadow-purple-1/10">
          <div className="space-y-6">
            <div className="inline-block mb-2">
              <span className="text-xs uppercase tracking-widest text-purple-1 font-bold px-4 py-2 rounded-full bg-purple-1/10 border border-purple-1/20">
                Ready to Trade?
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white glow-text leading-tight">
              Go Invisible
            </h2>
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Join the stealth revolution. Trade with complete anonymity on the world's most private DEX.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center" data-testid="cta-band-buttons">
            <a href="https://trade.anovex.io" target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-1 to-purple-2 hover:from-purple-2 hover:to-purple-3 text-white glow-primary border-0"
                data-testid="button-cta-launch-anovex"
              >
                Launch Anovex
                <Arrow className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <Button
              size="lg"
              variant="outline"
              className="glassmorphism glow-white border-white/30 hover:border-white/50 text-white backdrop-blur-md"
              data-testid="button-cta-telegram"
            >
              <Send className="mr-2 w-5 h-5" />
              Telegram Bot
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
