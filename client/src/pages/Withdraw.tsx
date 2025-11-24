import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Send, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";

interface WithdrawResponse {
  success: boolean;
  withdrawal?: {
    id: string;
    status: string;
    solDeducted: string;
    step1DepositAddress: string;
    step1ExchangeId: string;
  };
  error?: string;
}

interface WithdrawStatusResponse {
  success: boolean;
  withdrawal: {
    id: string;
    status: string;
    destinationAddress: string;
    solDeducted: string;
    solSent: string | null;
    step2TxTo: string | null;
  };
  technicalSteps: Array<{
    step: number;
    status: string;
    label: string;
    description: string;
  }>;
}

const WITHDRAWAL_STORAGE_KEY = 'anovex_active_withdrawal';

export default function Withdraw() {
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawalData, setWithdrawalData] = useState<WithdrawResponse['withdrawal'] | null>(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string | null>(null);
  const [technicalSteps, setTechnicalSteps] = useState<WithdrawStatusResponse['technicalSteps'] | null>(null);
  const [step2TxTo, setStep2TxTo] = useState<string | null>(null);
  const hasShownToastRef = useRef(false);
  const [isLoadingPending, setIsLoadingPending] = useState(true);

  // Get balance for max amount
  const { data: balanceData } = useQuery<{ 
    success: boolean; 
    sol: { amount: string; priceUsd: string; totalUsd: string }; 
    tokens: any[];
    totalUsd: string;
  }>({
    queryKey: ['/api/wallet/balance'],
  });

  const currentBalance = parseFloat(balanceData?.sol?.amount || "0");

  // Auto-resume pending withdrawal on mount
  useEffect(() => {
    const checkPendingWithdrawal = async () => {
      try {
        const savedWithdrawalId = localStorage.getItem(WITHDRAWAL_STORAGE_KEY);
        if (!savedWithdrawalId) {
          setIsLoadingPending(false);
          return;
        }

        // Fetch withdrawal status
        const res = await fetch(`/api/withdraw/status/${savedWithdrawalId}`, {
          credentials: 'include'
        });
        const response = await res.json() as WithdrawStatusResponse;

        if (response.success && response.withdrawal) {
          const status = response.withdrawal.status;
          
          // If still pending, resume tracking
          if (status === 'waiting_step1' || status === 'waiting_step2') {
            setWithdrawalData({
              id: response.withdrawal.id,
              status: status,
              solDeducted: response.withdrawal.solDeducted,
              step1DepositAddress: '',
              step1ExchangeId: ''
            });
            setAddress(response.withdrawal.destinationAddress);
            setWithdrawalStatus(status);
            setTechnicalSteps(response.technicalSteps || null);
            setStep2TxTo(response.withdrawal.step2TxTo || null);
          } else {
            // Terminal state - clear localStorage
            localStorage.removeItem(WITHDRAWAL_STORAGE_KEY);
          }
        } else {
          // Invalid withdrawal - clear localStorage
          localStorage.removeItem(WITHDRAWAL_STORAGE_KEY);
        }
      } catch (error: any) {
        console.error("Failed to check pending withdrawal:", error);
        localStorage.removeItem(WITHDRAWAL_STORAGE_KEY);
      } finally {
        setIsLoadingPending(false);
      }
    };

    checkPendingWithdrawal();
  }, []);

  const handleWithdraw = async () => {
    const trimmedAmount = amount.trim();
    const trimmedAddress = address.trim();
    const numAmount = parseFloat(trimmedAmount);
    
    if (!trimmedAddress) {
      toast({
        title: "Missing Address",
        description: "Please enter your Solana wallet address",
        variant: "destructive",
      });
      return;
    }
    
    if (!trimmedAmount || isNaN(numAmount) || numAmount < 0.05) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount (minimum 0.05 SOL)",
        variant: "destructive",
      });
      return;
    }
    
    if (numAmount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${currentBalance.toFixed(4)} SOL available`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    hasShownToastRef.current = false;
    
    try {
      const res = await apiRequest('POST', '/api/withdraw/initiate', {
        destinationAddress: trimmedAddress,
        solAmount: trimmedAmount
      });
      const response = await res.json() as WithdrawResponse;

      if (response.success && response.withdrawal) {
        setWithdrawalData(response.withdrawal);
        setWithdrawalStatus(response.withdrawal.status);
        
        // Save to localStorage for persistence across refresh
        localStorage.setItem(WITHDRAWAL_STORAGE_KEY, response.withdrawal.id);
        
        toast({
          title: "Withdrawal Initiated",
          description: `${trimmedAmount} SOL withdrawal in progress`,
        });
      } else {
        throw new Error(response.error || "Failed to initiate withdrawal");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Status polling
  useEffect(() => {
    const terminalStates = ['finished', 'failed', 'refunded', 'expired'];
    if (!withdrawalData || !withdrawalStatus || terminalStates.includes(withdrawalStatus)) {
      return;
    }

    let aborted = false;
    
    const interval = setInterval(async () => {
      if (aborted) return;

      try {
        const res = await fetch(`/api/withdraw/status/${withdrawalData.id}`, {
          credentials: 'include'
        });
        const response = await res.json() as WithdrawStatusResponse;

        if (aborted) return;

        if (response.success && response.withdrawal) {
          const newStatus = response.withdrawal.status;
          setWithdrawalStatus(newStatus);
          setTechnicalSteps(response.technicalSteps || null);
          setStep2TxTo(response.withdrawal.step2TxTo || null);
          
          if (newStatus === 'finished' && !hasShownToastRef.current) {
            hasShownToastRef.current = true;
            localStorage.removeItem(WITHDRAWAL_STORAGE_KEY);
            queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
            toast({
              title: "Withdrawal Complete!",
              description: `${response.withdrawal.solSent || response.withdrawal.solDeducted} SOL sent to your wallet`,
            });
          } else if ((newStatus === 'failed' || newStatus === 'refunded' || newStatus === 'expired') && !hasShownToastRef.current) {
            hasShownToastRef.current = true;
            localStorage.removeItem(WITHDRAWAL_STORAGE_KEY);
            toast({
              title: "Withdrawal Failed",
              description: "Your withdrawal could not be processed. Balance has been refunded.",
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
  }, [withdrawalData, withdrawalStatus, toast]);

  // Show loading while checking for pending withdrawal
  if (isLoadingPending) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Checking for pending withdrawal...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

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
            <h1 className="text-4xl font-bold text-white glow-text">Withdraw</h1>
            <p className="text-gray-400 mt-1">Send SOL to external wallet</p>
          </div>
        </div>

        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-withdraw">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-yellow-400" />
              Withdraw SOL
            </CardTitle>
            <CardDescription className="text-gray-400">
              Available: {currentBalance.toFixed(4)} SOL
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!withdrawalData ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Destination Wallet Address</label>
                  <Input
                    placeholder="Your Solana wallet address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-black/50 border-purple-500/30 text-white font-mono text-sm"
                    data-testid="input-withdraw-address"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-400">Amount (SOL)</label>
                    <button
                      onClick={() => setAmount(currentBalance.toFixed(9))}
                      className="text-xs text-purple-400 hover:text-purple-300"
                      data-testid="button-max-amount"
                    >
                      Max: {currentBalance.toFixed(4)} SOL
                    </button>
                  </div>
                  <Input
                    type="number"
                    step="0.000000001"
                    placeholder="0.1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-black/50 border-purple-500/30 text-white text-2xl"
                    data-testid="input-withdraw-amount"
                  />
                  <p className="text-xs text-gray-500">
                    Minimum: 0.05 SOL
                  </p>
                </div>

                <Button
                  onClick={handleWithdraw}
                  disabled={isProcessing || !address.trim() || !amount.trim() || isNaN(parseFloat(amount.trim())) || parseFloat(amount.trim()) < 0.05}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
                  size="lg"
                  data-testid="button-execute-withdraw"
                >
                  {isProcessing ? "Processing..." : "Withdraw SOL"}
                </Button>

                <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-2">How it works:</h3>
                  <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                    <li>Enter SOL amount and your wallet address</li>
                    <li>Multi-hop stealth routing severs on-chain linkability</li>
                    <li>SOL sent directly to your wallet address</li>
                    <li>Verify transaction on Solscan after completion</li>
                    <li>Fully anonymous - no on-chain traces to Anovex platform</li>
                  </ol>
                </div>
              </>
            ) : (
              <>
                {/* Withdrawal Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-400">Destination Address</label>
                    {withdrawalStatus === 'finished' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
                    )}
                  </div>
                  
                  <Input
                    value={address}
                    readOnly
                    className="bg-black/50 border-purple-500/30 text-white font-mono text-sm"
                    data-testid="input-destination-address"
                  />

                  <div className="text-sm text-gray-400">
                    Amount: <span className="text-white font-semibold">{withdrawalData.solDeducted} SOL</span>
                  </div>

                  {withdrawalStatus === 'finished' && step2TxTo && (
                    <a
                      href={`https://solscan.io/tx/${step2TxTo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 underline block flex items-center gap-1"
                      data-testid="link-verify-withdrawal"
                    >
                      View transaction on Solscan
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
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
                      { step: 1, status: 'waiting', label: 'VAULT BALANCE DEDUCTION', description: 'Deducting SOL from anonymous vault' },
                      { step: 2, status: 'waiting', label: 'STEALTH LIQUIDITY EXTRACTION', description: 'Extracting funds from Anovex Liquidity Router' },
                      { step: 3, status: 'waiting', label: 'SHADOW CONVERSION INITIATED', description: 'Initiating stealth liquidity conversion' },
                      { step: 4, status: 'waiting', label: 'ZK RELAY NETWORK PASS', description: 'Routing through privacy relay network' },
                      { step: 5, status: 'waiting', label: 'RETURN CHANNEL FINALIZATION', description: 'Finalizing outbound conversion' },
                      { step: 6, status: 'waiting', label: 'DESTINATION SETTLEMENT', description: 'SOL delivered to recipient wallet' },
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

                  {withdrawalStatus === 'finished' && (
                    <div className="mt-4 pt-4 border-t border-purple-500/20">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <p className="text-sm text-green-400 font-semibold">
                          Privacy Protocol Complete
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 text-center mb-3">
                        SOL has been delivered anonymously to your wallet
                      </p>
                      {step2TxTo && (
                        <a
                          href={`https://solscan.io/tx/${step2TxTo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                          data-testid="link-verify-transaction"
                        >
                          Verify Transaction on Solscan
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    setWithdrawalData(null);
                    setWithdrawalStatus(null);
                    setTechnicalSteps(null);
                    setStep2TxTo(null);
                    setAmount("");
                    setAddress("");
                    hasShownToastRef.current = false;
                    localStorage.removeItem(WITHDRAWAL_STORAGE_KEY);
                  }}
                  variant="outline"
                  className="w-full"
                  data-testid="button-new-withdrawal"
                >
                  Create New Withdrawal
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {!withdrawalData && (
          <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-4">
            <h3 className="text-yellow-500 font-semibold mb-2">Important Notice</h3>
            <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
              <li>Double-check your wallet address before confirming</li>
              <li>Withdrawals routed through encrypted relay nodes for anonymity</li>
              <li>Processing time: Usually 5-15 minutes</li>
              <li>Minimum withdrawal: 0.05 SOL</li>
              <li>ZK relay network fees are automatically absorbed by the platform</li>
            </ul>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
