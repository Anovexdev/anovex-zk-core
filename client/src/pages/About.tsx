import { ArrowLeft, Github, Send } from "lucide-react";
import { RiTwitterXFill } from "react-icons/ri";
import { Link } from "wouter";
import anovexLogo from "@assets/anovex-logo.png";

export default function About() {
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
                About Anovex
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Building the world's first truly untrackable decentralized exchange
              </p>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6">
              <h2 className="text-2xl font-semibold text-white">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                Anovex is pioneering a new era of financial privacy in the blockchain space. We believe that privacy is a fundamental right, not a luxury. Our mission is to provide traders with absolute anonymity while maintaining the security and transparency that blockchain technology offers.
              </p>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6">
              <h2 className="text-2xl font-semibold text-white">What Makes Us Different</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-white">Zero-Knowledge Privacy</h3>
                  <p className="text-muted-foreground">
                    We utilize advanced zero-knowledge cryptography to completely break the transaction graph between your wallet and on-chain activity. No one can trace your trades back to you.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-white">Decentralized Architecture</h3>
                  <p className="text-muted-foreground">
                    Our relay network operates without central points of failure. Every transaction is routed through our decentralized infrastructure, ensuring maximum security and uptime.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-white">Real Trading</h3>
                  <p className="text-muted-foreground">
                    Unlike other privacy solutions, Anovex provides real on-chain trading through our advanced Liquidity Router, giving you access to the best prices across decentralized liquidity pools while maintaining complete anonymity.
                  </p>
                </div>
              </div>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6">
              <h2 className="text-2xl font-semibold text-white">Our Vision</h2>
              <p className="text-muted-foreground leading-relaxed">
                We envision a future where financial privacy is the default, not the exception. Anovex is just the beginning of a broader ecosystem of privacy-preserving financial tools that empower individuals to trade, invest, and transact without fear of surveillance or censorship.
              </p>
            </div>

            <div className="text-center pt-8">
              <p className="text-sm text-muted-foreground">
                Built for invisible traders.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
