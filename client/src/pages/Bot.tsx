import { ArrowLeft, MessageSquare, Zap, Wallet, TrendingUp, Github, Send } from "lucide-react";
import { RiTwitterXFill } from "react-icons/ri";
import { Link } from "wouter";
import anovexLogo from "@assets/anovex-logo.png";

export default function Bot() {
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
                Telegram Bot
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Trade anonymously from anywhere with our Telegram bot
              </p>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6 border border-primary/20">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Why Use the Bot?</h2>
              </div>
              <p className="text-muted-foreground">
                Access the full power of Anovex directly from Telegram. No browser needed: manage your anonymous wallets, execute trades, and monitor your portfolio all from your messaging app with instant notifications.
              </p>
            </div>

            <div className="space-y-8">
              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Multi-Wallet Management</h3>
                    <p className="text-muted-foreground">
                      Create and manage multiple anonymous ANV wallets. Easily switch between wallets, view balances, and track your portfolio through simple Telegram commands.
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
                    <h3 className="text-xl font-semibold text-white">Instant Trading</h3>
                    <p className="text-muted-foreground">
                      Execute trades by simply pasting a token contract address. Get real-time price quotes, market data, and instant swap execution within seconds.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Real-Time Portfolio Tracking</h3>
                    <p className="text-muted-foreground">
                      Monitor your holdings with live PnL calculations, position tracking, and instant price updates. Use /monitor command to see your complete portfolio with auto-refresh every 20 seconds.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6">
              <h2 className="text-2xl font-semibold text-white">Quick Start Guide</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary text-sm font-medium">
                    1
                  </div>
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Start the bot:</span> Open Telegram and search for @anovexbot, then tap /start
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary text-sm font-medium">
                    2
                  </div>
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Create wallet:</span> Your first ANV wallet is created automatically
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary text-sm font-medium">
                    3
                  </div>
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Deposit funds:</span> Use /deposit to get your deposit address
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary text-sm font-medium">
                    4
                  </div>
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Start trading:</span> Paste any token contract to view details and execute swaps
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center pt-8">
              <a 
                href="https://t.me/anovexbot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                data-testid="button-open-bot"
              >
                <MessageSquare className="w-4 h-4" />
                Open Bot
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
