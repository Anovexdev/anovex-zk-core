import { ArrowLeft, Code, Key, Zap, ExternalLink, Github, Send } from "lucide-react";
import { RiTwitterXFill } from "react-icons/ri";
import { Link } from "wouter";
import anovexLogo from "@assets/anovex-logo.png";

export default function Api() {
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
                API Documentation
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Build privacy-preserving applications with Anovex API
              </p>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6 border border-primary/20">
              <div className="flex items-center gap-3">
                <Code className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Coming Soon</h2>
              </div>
              <p className="text-muted-foreground">
                The Anovex API is currently in development. We're building a comprehensive REST API that will allow developers to integrate anonymous trading capabilities into their own applications.
              </p>
            </div>

            <div className="space-y-8">
              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Key className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">API Key Authentication</h3>
                    <p className="text-muted-foreground">
                      Secure your API access with key-based authentication. Generate, rotate, and manage API keys through your dashboard. Rate limiting and usage monitoring included.
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
                    <h3 className="text-xl font-semibold text-white">Real-Time WebSocket Feeds</h3>
                    <p className="text-muted-foreground">
                      Subscribe to real-time price updates, transaction status, and portfolio changes through WebSocket connections. Low latency streaming data for responsive applications.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6">
              <h2 className="text-2xl font-semibold text-white">Planned Endpoints</h2>
              <div className="space-y-4 font-mono text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">POST</span>
                    <span className="text-muted-foreground">/api/v1/wallets/create</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-14">Create a new anonymous ANV wallet</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">GET</span>
                    <span className="text-muted-foreground">/api/v1/wallets/:address/balance</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-14">Get wallet balance and holdings</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">POST</span>
                    <span className="text-muted-foreground">/api/v1/swap</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-14">Execute anonymous token swap</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">GET</span>
                    <span className="text-muted-foreground">/api/v1/transactions/:id</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-14">Get transaction status and details</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">GET</span>
                    <span className="text-muted-foreground">/api/v1/tokens/:address/price</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-14">Get real-time token price data</p>
                </div>
              </div>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-4">
              <h3 className="text-xl font-semibold text-white">Stay Updated</h3>
              <p className="text-muted-foreground">
                Join our GitHub to get notified when the API launches. We'll release comprehensive documentation, SDKs for popular languages, and example applications to help you get started.
              </p>
              <a 
                href="https://github.com/anovexdev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                data-testid="link-github"
              >
                Follow on GitHub
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="text-center pt-8">
              <p className="text-sm text-muted-foreground">
                For early API access inquiries, contact us on Telegram.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
