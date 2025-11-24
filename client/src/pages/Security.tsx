import { ArrowLeft, Shield, Lock, Eye, Server, Github, Send } from "lucide-react";
import { RiTwitterXFill } from "react-icons/ri";
import { Link } from "wouter";
import anovexLogo from "@assets/anovex-logo.png";

export default function Security() {
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
                Security Architecture
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                How we protect your privacy and funds
              </p>
            </div>

            <div className="space-y-8">
              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Zero-Knowledge Cryptography</h3>
                    <p className="text-muted-foreground">
                      Anovex leverages advanced zero-knowledge proofs to ensure complete transaction privacy. Our cryptographic protocols mathematically guarantee that no third party can link your deposits, trades, or withdrawals together.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Server className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Decentralized Relay Network</h3>
                    <p className="text-muted-foreground">
                      Our relay infrastructure operates on a decentralized network of nodes. No single entity controls the flow of transactions, eliminating central points of failure and ensuring censorship resistance. The network uses threshold cryptography for enhanced security.
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
                    <h3 className="text-xl font-semibold text-white">Non-Custodial Architecture</h3>
                    <p className="text-muted-foreground">
                      You maintain complete control of your funds at all times. Anovex operates as a non-custodial service: we never hold your private keys or have access to your assets. Your wallet, your keys, your crypto.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glassmorphism p-8 rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Eye className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-semibold text-white">Graph Analysis Protection</h3>
                    <p className="text-muted-foreground">
                      Advanced blockchain analytics and transaction graph analysis tools are rendered completely ineffective against Anovex. Our privacy architecture breaks all on-chain connections between your real wallet and trading activity, making forensic analysis impossible.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glassmorphism p-8 rounded-lg space-y-6">
              <h2 className="text-2xl font-semibold text-white">Security Guarantees</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Transaction Privacy:</span> Zero-knowledge proofs ensure no one can link your transactions together
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Identity Protection:</span> ANV addresses are completely isolated from your real Solana identity
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Fund Security:</span> Non-custodial design means you always control your assets
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <p className="text-muted-foreground">
                    <span className="text-white font-medium">Network Resilience:</span> Decentralized infrastructure ensures 24/7 availability
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center pt-8">
              <p className="text-sm text-muted-foreground">
                Privacy is a right, not a privilege.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
