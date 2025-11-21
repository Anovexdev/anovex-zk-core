import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, TrendingUp, Copy, CheckCircle2, Clock } from "lucide-react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

interface DepositResponse {
  success: boolean;
  deposit?: {
    id: number;
    status: string;
    usdAmount: string;
    solAmount: string;
    step1DepositAddress: string;
    step1ExchangeId: string;
  };
  error?: string;
}

interface DepositStatusResponse {
  success: boolean;
  depositId: number;
  status: string;
  solAmount: string;
  solReceived: string | null;
  technicalSteps: Array<{
    step: number;
    status: string;
    label: string;
    description: string;
  }>;
}

export default function Deposit() {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositData, setDepositData] = useState<DepositResponse['deposit'] | null>(null);
  const [depositStatus, setDepositStatus] = useState<string | null>(null);
  const [technicalSteps, setTechnicalSteps] = useState<DepositStatusResponse['technicalSteps'] | null>(null);
  const [copied, setCopied] = useState(false);
  const hasShownToastRef = useRef(false);
  const [isLoadingActiveDeposit, setIsLoadingActiveDeposit] = useState(true);

  useEffect(() => {
    const loadActiveDeposit = async () => {
      try {
        const res = await fetch('/api/deposit/history', { credentials: 'include' });
        if (!res.ok) {
          setIsLoadingActiveDeposit(false);
          return;
        }
        
        const data = await res.json();
        if (data.success && data.deposits && data.deposits.length > 0) {
          const terminalStates = ['finished', 'failed', 'refunded', 'expired'];
          const activeDeposit = data.deposits.find((d: any) => !terminalStates.includes(d.status));
          
          if (activeDeposit) {
            setDepositData({
              id: activeDeposit.id,
              status: activeDeposit.status,
              usdAmount: activeDeposit.usdAmount,
              solAmount: activeDeposit.solAmount,
              step1DepositAddress: activeDeposit.step1DepositAddress,
              step1ExchangeId: activeDeposit.step1ExchangeId,
            });
            setDepositStatus(activeDeposit.status);
          }
        }
      } catch (error) {
        console.error('Failed to load active deposit:', error);
      } finally {
        setIsLoadingActiveDeposit(false);
      }
    };

    loadActiveDeposit();
  }, []);

  const handleDeposit = async () => {
    const trimmedAmount = amount.trim();
    const numAmount = parseFloat(trimmedAmount);
    
    if (!trimmedAmount || isNaN(numAmount) || numAmount < 0.05) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount (minimum 0.05 SOL)",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    hasShownToastRef.current = false; // Reset toast guard for new deposit
    
    try {
      const res = await apiRequest('POST', '/api/deposit/initiate', { solAmount: trimmedAmount });
      const response = await res.json() as DepositResponse;

      if (response.success && response.deposit) {
        setDepositData(response.deposit);
        setDepositStatus(response.deposit.status);
        toast({
          title: "Funding Address Created",
          description: "Send SOL to the address below to fund your wallet",
        });
      } else {
        throw new Error(response.error || "Failed to create deposit");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create funding address",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyAddress = () => {
    if (depositData?.step1DepositAddress) {
      navigator.clipboard.writeText(depositData.step1DepositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Funding address copied to clipboard",
      });
    }
  };

  useEffect(() => {
    const terminalStates = ['finished', 'failed', 'refunded', 'expired'];
    if (!depositData || !depositStatus || terminalStates.includes(depositStatus)) {
      return;
    }

    let aborted = false;
    
    const interval = setInterval(async () => {
      if (aborted) return;

      try {
        const url = `/api/deposit/status/${depositData.id}`;
        const res = await fetch(url, { credentials: 'include' });
        
        if (res.status === 401) {
          if (!hasShownToastRef.current) {
            hasShownToastRef.current = true;
            toast({
              title: "Session Expired",
              description: "Please refresh the page to continue monitoring",
              variant: "destructive",
            });
          }
          return;
        }
        
        if (!res.ok) {
          throw new Error(`Status check failed: ${res.status}`);
        }
        
        const response = await res.json() as DepositStatusResponse;

        if (aborted) return;

        if (response.success) {
          const newStatus = response.status;
          setDepositStatus(newStatus);
          setTechnicalSteps(response.technicalSteps || null);
          
          if (newStatus === 'finished' && !hasShownToastRef.current) {
            hasShownToastRef.current = true;
            queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
            queryClient.invalidateQueries({ queryKey: ['/api/explorer/transactions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/deposit/history'] });
            toast({
              title: "Privacy Protocol Complete!",
              description: `${response.solReceived || response.solAmount} SOL anonymously credited to your vault`,
            });
          } else if ((newStatus === 'failed' || newStatus === 'refunded' || newStatus === 'expired') && !hasShownToastRef.current) {
            hasShownToastRef.current = true;
            toast({
              title: "Transaction Failed",
              description: "Privacy relay network encountered an error. Please try again.",
              variant: "destructive",
            });
          }
        }
      } catch (error: any) {
        if (!aborted) {
          console.error("Status check error:", error);
        }
      }
    }, 5000);

    return () => {
      aborted = true;
      clearInterval(interval);
    };
  }, [depositData, depositStatus, toast]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="text-white" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-white glow-text">Add Funds</h1>
            <p className="text-gray-400 mt-1">Fund your anonymous vault</p>
          </div>
        </div>

        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-deposit">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Add Funds
            </CardTitle>
            <CardDescription className="text-gray-400">
              Untraceable funding via cryptographic relay network
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isLoadingActiveDeposit ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Loading active funding session...</p>
              </div>
            ) : !depositData ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Amount (SOL)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-black/50 border-purple-500/30 text-white text-2xl"
                    data-testid="input-deposit-amount"
                  />
                  <p className="text-xs text-gray-500">
                    Minimum: 0.05 SOL
                  </p>
                </div>

                <Button
                  onClick={handleDeposit}
                  disabled={isProcessing || !amount.trim() || isNaN(parseFloat(amount.trim())) || parseFloat(amount.trim()) < 0.05}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
                  size="lg"
                  data-testid="button-create-deposit"
                >
                  {isProcessing ? "Processing..." : "Fund Wallet"}
                </Button>

                <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-2">How it works:</h3>
                  <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                    <li>Enter amount in SOL (minimum 0.05)</li>
                    <li>Receive anonymous deposit address</li>
                    <li>Send SOL to the address</li>
            <li>Multi-layer obfuscation protocol severs transaction graph</li>
                    <li>Balance credited automatically</li>
                  </ol>
                </div>
              </>
            ) : (
              <>
                {/* Deposit Address */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-400">Funding Address</label>
                    {depositStatus === 'finished' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      value={depositData.step1DepositAddress}
                      readOnly
                      className="bg-black/50 border-purple-500/30 text-white font-mono text-sm"
                      data-testid="input-deposit-address"
                    />
                    <Button
                      onClick={copyAddress}
                      size="icon"
                      variant="outline"
                      className="shrink-0"
                      data-testid="button-copy-address"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-gray-400">
                      Amount: <span className="text-white font-semibold">{depositData.solAmount} SOL</span>
                      <span className="text-gray-500 ml-2">(≈ ${depositData.usdAmount} USD)</span>
                    </div>
                    <a
                      href={`https://solscan.io/account/${depositData.step1DepositAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 underline inline-block"
                      data-testid="link-verify-deposit"
                    >
                      View address on Solscan
                    </a>
                  </div>
                </div>

                {/* Dynamic 6-Step Technical Visualization */}
                <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Privacy Protocol Status</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                      <span className="text-xs text-purple-400">Live Monitoring</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {(technicalSteps || [
                      { step: 1, status: 'waiting', label: 'STEALTH FUNDING REQUEST', description: 'Send SOL to privacy relay address' },
                      { step: 2, status: 'waiting', label: 'ZK RELAY NETWORK SYNC', description: 'Privacy relay node coordinating anonymization' },
                      { step: 3, status: 'waiting', label: 'SHADOW CONVERSION INITIATED', description: 'Initiating stealth liquidity conversion' },
                      { step: 4, status: 'waiting', label: 'LIQUIDITY ROUTER PASS', description: 'Routing stealth assets to Anovex Liquidity Router' },
                      { step: 5, status: 'waiting', label: 'RETURN CHANNEL FINALIZATION', description: 'Finalizing return channel conversion' },
                      { step: 6, status: 'waiting', label: 'VAULT BALANCE SETTLEMENT', description: 'Anonymous balance credited to vault' },
                    ]).map((step) => {
                      const isActive = step.status === 'active';
                      const isCompleted = step.status === 'completed';
                      const isFailed = step.status === 'failed';
                      const isWaiting = step.status === 'waiting';
                      
                      return (
                        <div key={step.step} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            isActive ? 'bg-yellow-400 animate-pulse' :
                            isCompleted ? 'bg-green-400' :
                            isFailed ? 'bg-red-400' :
                            'bg-gray-600'
                          }`} />
                          <div className="flex-1">
                            <p className={`text-sm ${
                              isActive ? 'text-yellow-400 font-semibold' :
                              isCompleted ? 'text-green-400' :
                              isFailed ? 'text-red-400' :
                              'text-gray-500'
                            }`}>
                              {step.step}. {step.label}
                            </p>
                            <p className={`text-xs ${
                              isActive ? 'text-gray-300' :
                              isCompleted ? 'text-gray-400' :
                              'text-gray-500'
                            }`}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {depositStatus === 'finished' && (
                    <div className="mt-4 pt-4 border-t border-purple-500/20">
                      <p className="text-sm text-green-400 text-center font-semibold">
                        Privacy protocol complete! Your balance has been credited anonymously.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {depositStatus === 'finished' || depositStatus === 'failed' || depositStatus === 'refunded' || depositStatus === 'expired' ? (
                    <Button
                      onClick={() => {
                        setDepositData(null);
                        setDepositStatus(null);
                        setAmount("");
                        hasShownToastRef.current = false;
                      }}
                      variant="outline"
                      className="w-full"
                      data-testid="button-new-deposit"
                    >
                      Add More Funds
                    </Button>
                  ) : (
                    <>
                      <div className="flex-1 bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-3 flex items-center justify-center">
                        <p className="text-sm text-yellow-400 text-center">
                          Processing...
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setDepositData(null);
                          setDepositStatus(null);
                          setAmount("");
                          hasShownToastRef.current = false;
                        }}
                        variant="destructive"
                        className="shrink-0"
                        data-testid="button-cancel-deposit"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
