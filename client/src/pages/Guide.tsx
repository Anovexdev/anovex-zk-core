import { ArrowLeft, Shield, Zap, Lock, Wallet, Github, Send } from "lucide-react";
import { RiTwitterXFill } from "react-icons/ri";
import { Link } from "wouter";
import anovexLogo from "@assets/anovex-logo.png";

export default function Guide() {
  return (
    <div className="min-h-screen bg-bg-1 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-1/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-purple-1/10 px-6 py-4 glassmorphism backdrop-blur-xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-3 hover:opacity-80 transition-opacity" data-testid="link-home">
                <img 
                  src={anovexLogo} 
                  alt="Anovex Logo" 
                  className="w-10 h-10 rounded-md glow-primary"
                />
                <span className="text-white font-semibold text-lg tracking-tight">Anovex</span>
              </a>
            </Link>

            <div className="flex items-center gap-3">
              <a
                href="https://x.com/anovexofficial"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate transition-all"
                aria-label="X (Twitter)"
                data-testid="header-social-x"
              >
                <RiTwitterXFill className="w-4 h-4 text-muted-foreground" />
              </a>
              <a
                href="https://github.com/anovexdev"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate transition-all"
                aria-label="GitHub"
                data-testid="header-social-github"
              >
                <Github className="w-4 h-4 text-muted-foreground" />
              </a>
              <a
                href="https://t.me/anovexbot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate transition-all"
                aria-label="Telegram Bot"
                data-testid="header-social-telegram"
              >
                <Send className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-16">
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                How It Works
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                A step-by-step guide to anonymous trading on Anovex
              </p>
            </div>

            <div className="space-y-8">
              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Step 1: Create Your ANV Wallet</h3>
                    <p className="text-muted-foreground">
                      Start by creating an anonymous ANV wallet address. This address is completely isolated from your real Solana wallet, ensuring no traceable connection between your identity and trading activity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Step 2: Deposit Through ZK Relay</h3>
                    <p className="text-muted-foreground">
                      Deposit funds using our ZK Relay Network. Your transaction is routed through multiple privacy layers that completely break the on-chain connection between your source wallet and destination. Our relay network uses zero-knowledge proofs to ensure untraceable transfers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Step 3: Trade Anonymously</h3>
                    <p className="text-muted-foreground">
                      Execute trades with complete privacy. All swaps are routed through our Anovex Liquidity Router, which aggregates the best prices across decentralized liquidity pools while maintaining your anonymity. Your trading activity is invisible to blockchain analysts.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Step 4: Withdraw Securely</h3>
                    <p className="text-muted-foreground">
                      When ready to withdraw, your funds are routed through the same privacy-preserving relay network. The withdrawal destination has zero traceable connection to your trading history or deposit sources.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-4 border border-primary/20">
              <h3 className="text-xl font-semibold text-white">Privacy Guarantee</h3>
              <p className="text-muted-foreground">
                At no point in this flow can anyone (including blockchain analysts, exchanges, or even Anovex) connect your real identity to your trading activity. Your privacy is mathematically guaranteed through zero-knowledge cryptography.
              </p>
            </div>

            <div className="text-center pt-8">
              <Link href="https://trade.anovex.io">
                <a 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                  data-testid="button-launch-app"
                >
                  Launch App
                </a>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
