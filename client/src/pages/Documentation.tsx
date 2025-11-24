import { useState, useEffect } from "react";
import { Starfield } from "@/components/Starfield";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Arrow } from "@/components/Arrow";
import { Check, Info, Zap } from "lucide-react";
import anovexLogo from "@assets/anovex-logo.png";

export default function Documentation() {
  const [activeTab, setActiveTab] = useState("getting-started");

  useEffect(() => {
    // Check URL hash on mount and handle tab navigation
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['getting-started', 'privacy', 'anv', 'security', 'faq'];
    
    if (hash && validTabs.includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg-1 relative">
      <Starfield />
      
      <div className="relative z-10 min-h-screen">
        <header className="fixed top-0 left-0 right-0 z-50 glassmorphism border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <img 
                  src={anovexLogo} 
                  alt="Anovex Logo" 
                  className="w-8 h-8 rounded-md glow-primary"
                />
                <span className="text-white font-semibold text-lg">Anovex Docs</span>
              </div>
              <div className="flex items-center gap-4">
                <a 
                  href="https://anovex.io" 
                  className="text-sm text-muted-foreground hover:text-white transition-colors"
                  data-testid="link-main-site"
                >
                  Main Site
                </a>
                <a 
                  href="https://trade.anovex.io" 
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  data-testid="link-launch-app"
                >
                  Launch App
                </a>
              </div>
            </div>
          </div>
        </header>

        <main className="pt-32 pb-20 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-4 animate-slide-up px-4">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white glow-text">
                Documentation
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
                Complete guide to anonymous trading on Anovex
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
              <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0">
                <TabsList className="inline-flex lg:grid min-w-max lg:w-full lg:grid-cols-5 bg-black/40 border border-purple-500/20">
                  <TabsTrigger value="getting-started" data-testid="tab-getting-started" className="whitespace-nowrap">Getting Started</TabsTrigger>
                  <TabsTrigger value="privacy" data-testid="tab-privacy" className="whitespace-nowrap">Privacy Architecture</TabsTrigger>
                  <TabsTrigger value="anv" data-testid="tab-anv" className="whitespace-nowrap">ANV Address</TabsTrigger>
                  <TabsTrigger value="security" data-testid="tab-security" className="whitespace-nowrap">Security</TabsTrigger>
                  <TabsTrigger value="faq" data-testid="tab-faq" className="whitespace-nowrap">FAQ</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="getting-started" className="space-y-6 animate-fade-in">
                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Create Your Wallet</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Access Anovex by creating a new wallet or logging in with an existing private key. Your ANV address is deterministically derived from your private key using SHA-256, meaning the same key always generates the same address across any device.
                    </p>
                    <div className="p-4 bg-black/60 rounded-lg border border-purple-500/20 space-y-2">
                      <p className="text-white font-semibold">New Wallet</p>
                      <p className="text-sm">Generate a fresh private key and ANV address. Save your private key securely, it cannot be recovered if lost.</p>
                    </div>
                    <div className="p-4 bg-black/60 rounded-lg border border-purple-500/20 space-y-2">
                      <p className="text-white font-semibold">Import Wallet</p>
                      <p className="text-sm">Use your existing private key to access your account from any device. Same key, same ANV address, always.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Deposit Funds</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Fund your Anovex wallet through the Privacy Relay Network. Your deposit is routed through multiple intermediary addresses to sever the on-chain link between your external wallet and trading activity.
                    </p>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">1.</span>
                        <p className="text-sm">Initiate deposit and receive a unique relay address</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">2.</span>
                        <p className="text-sm">Send SOL from your external wallet to the relay address</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">3.</span>
                        <p className="text-sm">Funds are routed through the Privacy Relay Network</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">4.</span>
                        <p className="text-sm">Balance appears in your Anovex wallet after processing</p>
                      </div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <p className="text-yellow-400 text-sm font-semibold">Minimum Deposit: 0.05 SOL</p>
                      <p className="text-sm mt-1">All relay network fees are absorbed by the platform.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Execute Swaps</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Trade tokens anonymously using the Liquidity Router. All transactions are executed on-chain through the dual-wallet circuit, isolating your ANV address from public blockchain explorers.
                    </p>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">1.</span>
                        <p className="text-sm">Select input and output tokens</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">2.</span>
                        <p className="text-sm">Review routing path and estimated output</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">3.</span>
                        <p className="text-sm">Confirm swap execution</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">4.</span>
                        <p className="text-sm">Transaction is processed through the circuit and confirmed</p>
                      </div>
                    </div>
                    <p className="text-sm">
                      Track your transaction in the Privacy Explorer. All swap activity remains unlinkable to your external wallet addresses.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Withdraw Funds</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Extract funds to your external wallet through reverse Privacy Relay Network routing. The same obfuscation process applies to withdrawals, maintaining transaction graph isolation.
                    </p>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">1.</span>
                        <p className="text-sm">Enter destination address and withdrawal amount</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">2.</span>
                        <p className="text-sm">Confirm withdrawal through the relay network</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">3.</span>
                        <p className="text-sm">Funds are routed through intermediary addresses</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-400 font-mono text-sm">4.</span>
                        <p className="text-sm">SOL arrives at your external wallet</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="privacy" className="space-y-6 animate-fade-in">
                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Dual-Wallet Circuit System</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Anovex employs a dual-wallet architecture to break on-chain transaction linkability. Your deposits and withdrawals are routed through two isolated wallet nodes that never interact directly with your ANV address on the public ledger.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div className="p-4 bg-black/60 rounded-lg border border-purple-500/20">
                        <p className="text-white font-semibold mb-2">Privacy Relay Node</p>
                        <p className="text-sm">Intermediary wallet that receives user deposits and initiates withdrawals. Operates on a separate blockchain to eliminate direct transaction paths.</p>
                      </div>
                      <div className="p-4 bg-black/60 rounded-lg border border-purple-500/20">
                        <p className="text-white font-semibold mb-2">Liquidity Router Node</p>
                        <p className="text-sm">System pool wallet that executes all swap transactions. Holds aggregated liquidity and processes anonymous trading activity.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Zero-Knowledge Relay Protocol</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      The relay network processes deposits and withdrawals through encrypted routing channels. Each transaction passes through multiple intermediary addresses, with timing randomization and amount obfuscation to prevent statistical correlation attacks.
                    </p>
                    <div className="p-4 bg-black/60 rounded-lg border border-purple-500/20 space-y-2">
                      <p className="text-white font-semibold">Deposit Flow</p>
                      <p className="text-sm font-mono text-purple-300 flex items-center gap-2 flex-wrap">
                        <span>External Wallet</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>Relay Node</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>Shadow Converter</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>Router Node</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>ANV Balance</span>
                      </p>
                    </div>
                    <div className="p-4 bg-black/60 rounded-lg border border-purple-500/20 space-y-2">
                      <p className="text-white font-semibold">Withdrawal Flow</p>
                      <p className="text-sm font-mono text-purple-300 flex items-center gap-2 flex-wrap">
                        <span>ANV Balance</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>Router Node</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>Shadow Converter</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>Relay Node</span>
                        <Arrow className="text-purple-400 flex-shrink-0" />
                        <span>External Wallet</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Transaction Graph Obfuscation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      By routing all user activity through the dual-wallet circuit, Anovex severs the direct transaction path between your external wallet and on-chain swap execution. Public blockchain explorers cannot link your deposit addresses to your trading activity.
                    </p>
                    <p>
                      The system maintains complete transaction isolation. Your ANV address exists only in the internal ledger and never appears in public blockchain transactions. All swaps are executed by the Liquidity Router Node using aggregated pool funds.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Stealth Routing Technology</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Every swap request passes through encrypted routing channels before execution. The Liquidity Router aggregates multiple user trades into batch transactions, further obscuring individual trading patterns from chain analysis tools.
                    </p>
                    <p>
                      Timing obfuscation and randomized transaction scheduling prevent temporal correlation between deposit events and swap execution, adding an additional layer of privacy protection.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="anv" className="space-y-6 animate-fade-in">
                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Deterministic Address Derivation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Your ANV address is cryptographically derived from your private key using SHA-256 hashing. This deterministic process ensures that the same private key always generates the same ANV address, enabling seamless cross-device access without manual address configuration.
                    </p>
                    <div className="p-4 bg-black/60 rounded-lg border border-purple-500/20 space-y-2">
                      <p className="text-sm font-mono text-purple-300">
                        ANV Address = SHA-256(Private Key)[0:16]
                      </p>
                      <p className="text-sm mt-2">
                        The first 16 characters of the hash create a unique, human-readable identifier tied permanently to your private key.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Cross-Device Access</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Log in from any device using your private key. The deterministic derivation process recreates your exact ANV address, granting immediate access to your balance and transaction history. No seed phrases, no recovery emails, just your private key.
                    </p>
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <p className="text-yellow-400 text-sm font-semibold">Private Key Security</p>
                      <p className="text-sm mt-1">
                        Your private key is the only credential needed to access your funds. Store it securely offline. Anovex cannot recover lost private keys.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Permanent Address Binding</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Once created, your ANV address is permanently bound to your private key. This eliminates address rotation risks and simplifies wallet management. The same address persists across all sessions and devices.
                    </p>
                    <p>
                      Internal balance tracking uses this ANV address as the primary identifier. All deposits, withdrawals, and swap history are indexed against your ANV address in the encrypted internal ledger.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-6 animate-fade-in">
                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Self-Custody Model</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Anovex operates on a self-custody principle. Your private key controls your funds. The platform cannot freeze, seize, or access your balance without your private key. You maintain complete financial sovereignty.
                    </p>
                    <p>
                      Private keys are encrypted using AES-256-GCM before database storage. Decryption occurs only during authenticated session operations, and keys are never transmitted or logged in plaintext.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">End-to-End Encryption</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      All sensitive data is encrypted at rest and in transit. Session authentication uses secure cookie-based tokens with HttpOnly and Secure flags. Database connections enforce SSL/TLS encryption.
                    </p>
                    <p>
                      Transaction signing occurs server-side within isolated execution contexts. Private keys remain encrypted in memory during signing operations and are immediately purged after transaction broadcast.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">No KYC, No Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Anovex does not collect personal information. No email verification, no identity documents, no IP logging. Access requires only a private key.
                    </p>
                    <p>
                      Session data is ephemeral and not correlated with external identifiers. Transaction history is indexed solely by ANV address and stored in encrypted form.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Transaction Privacy Guarantees</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      The dual-wallet circuit architecture ensures that your external wallet addresses never appear in the same transaction graph as your trading activity. Public blockchain explorers cannot link deposits to swap execution.
                    </p>
                    <p>
                      All user operations are batched and routed through system wallets, providing transaction-level privacy that extends beyond simple address mixing. The relay network introduces temporal and spatial decorrelation to resist advanced chain analysis.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="faq" className="animate-fade-in">
                <div className="max-w-4xl mx-auto space-y-8">
                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Current Fee Structure (v1.0)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Anovex currently operates with a zero-fee model for most operations. The platform absorbs relay network costs to provide a seamless anonymous trading experience.
                    </p>
                    
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Deposit: FREE</p>
                          <p className="text-sm">All relay network processing fees are absorbed by the platform. Minimum deposit: 0.05 SOL to cover blockchain gas costs.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Buy/Swap: FREE</p>
                          <p className="text-sm">No trading fees. Execute unlimited swaps without platform commission. Only standard blockchain transaction fees apply.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Sell: FREE</p>
                          <p className="text-sm">No platform fees on token sales. Full proceeds are credited to your balance minus blockchain gas costs.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Withdraw: ~0.01 SOL per transaction</p>
                          <p className="text-sm">Network cost covers SOL blockchain transaction fees and reverse relay routing through the Privacy Network. This fee ensures complete transaction graph obfuscation during withdrawal.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <p className="text-yellow-400 text-sm font-semibold mb-1">Withdrawal Fee Breakdown</p>
                      <div className="text-sm space-y-1">
                        <p>• SOL network transaction fee: ~0.000005 SOL</p>
                        <p>• Privacy relay routing cost: ~0.009995 SOL</p>
                        <p>• Total: ~0.01 SOL (covers multi-hop anonymization)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Future Fee Structure (v2.0 - $ANV Token)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Anovex will introduce the $ANV utility token to create a sustainable, decentralized fee model. All platform operations will transition to using $ANV tokens for gas fees, replacing the current zero-fee model.
                    </p>
                    
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Deposit Gas Fees</p>
                          <p className="text-sm">Users will pay a small amount of $ANV tokens to process deposits through the Privacy Relay Network. This replaces platform-absorbed costs with token-based fees.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Buy/Swap Gas Fees</p>
                          <p className="text-sm">Trading operations will require $ANV tokens for gas. Fees will be dynamically calculated based on transaction complexity and network conditions.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Sell Gas Fees</p>
                          <p className="text-sm">Token sales will deduct $ANV gas fees from the transaction. This ensures platform sustainability while maintaining low-cost operations.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-black/60 rounded-lg border border-purple-500/20">
                        <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white font-semibold mb-1">Withdraw Gas Fees</p>
                          <p className="text-sm">Withdrawals will use $ANV tokens instead of SOL for relay network costs. This creates consistent fee structure across all operations.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <p className="text-purple-400 text-sm font-semibold mb-2">Benefits of $ANV Token Model</p>
                      <div className="text-sm space-y-1">
                        <p>• Lower fees compared to platform-absorbed costs</p>
                        <p>• Decentralized fee structure with token utility</p>
                        <p>• Sustainable long-term platform operations</p>
                        <p>• Token holders benefit from ecosystem growth</p>
                        <p>• Transparent, predictable fee calculations</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <p className="text-blue-400 text-sm font-semibold mb-1">Implementation Timeline</p>
                      <p className="text-sm">The $ANV token integration is planned for v2.0. Current users can continue using the zero-fee model until the transition. Migration details and $ANV token distribution will be announced before deployment.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Supported Assets</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                      Anovex supports SOL and all SPL tokens available through the Liquidity Router. Token selection is dynamically updated based on on-chain liquidity availability.
                    </p>
                    <p>
                      Deposits and withdrawals are processed in SOL only. Internal swaps support the full range of SPL token pairs with sufficient liquidity depth.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Processing Times</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <div className="space-y-3">
                      <div>
                        <p className="text-white font-semibold mb-1">Deposits</p>
                        <p className="text-sm">Relay network processing typically completes within 5-15 minutes. Delays may occur during high network congestion.</p>
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-1">Swaps</p>
                        <p className="text-sm">On-chain execution completes within seconds. Balance updates are reflected immediately after blockchain confirmation.</p>
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-1">Withdrawals</p>
                        <p className="text-sm">Reverse relay routing takes 5-15 minutes. Funds arrive at your external wallet after final blockchain confirmation.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Troubleshooting</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-muted-foreground">
                    <div className="space-y-3">
                      <div>
                        <p className="text-white font-semibold mb-1">Deposit Not Appearing</p>
                        <p className="text-sm">Check the Privacy Explorer for relay network status. Deposits below 0.05 SOL are rejected. Verify you sent to the correct relay address.</p>
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-1">Swap Failed</p>
                        <p className="text-sm">Insufficient balance or slippage tolerance exceeded. Verify your balance covers both swap amount and estimated fees. Try increasing slippage tolerance for volatile pairs.</p>
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-1">Withdrawal Pending</p>
                        <p className="text-sm">Relay network processing can take up to 15 minutes. Check withdrawal status in transaction history. Contact support if processing exceeds 30 minutes.</p>
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-1">Lost Private Key</p>
                        <p className="text-sm">Private keys cannot be recovered. Anovex does not store backup copies or recovery mechanisms. Ensure you save your private key securely before depositing funds.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
