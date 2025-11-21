import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Activity, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";

interface QuoteResponse {
  success: boolean;
  quote: {
    inputAmount: string;
    outputAmount: string;
    priceImpactPct: string;
  };
  cost?: string;
}

export default function Swap() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [tokenAddress, setTokenAddress] = useState("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC default
  const [tokenSymbol, setTokenSymbol] = useState("USDC");
  const [tokenLogo, setTokenLogo] = useState<string | null>("https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResponse['quote'] | null>(null);
  const [cost, setCost] = useState<string | null>(null);
  const [isFetchingSymbol, setIsFetchingSymbol] = useState(false);

  const { data: balance } = useQuery<{ 
    sol: { amount: string }; 
    totalUsd: string;
    tokens: Array<{
      mint: string;
      symbol: string;
      amount: string;
      priceUsd: string;
      totalUsd: string;
      logoURI?: string;
    }>;
  }>({
    queryKey: ['/api/wallet/balance'],
  });

  // Auto-fetch token symbol AND logo when contract address changes
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!tokenAddress || tokenAddress.length < 32) {
        setTokenSymbol("");
        setTokenLogo(null);
        return;
      }
      
      setIsFetchingSymbol(true);
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
        const data = await response.json();
        
        if (data.pairs && data.pairs.length > 0) {
          const token = data.pairs[0].baseToken;
          setTokenSymbol(token.symbol.toUpperCase());
          setTokenLogo(token.logoURI || null);
        } else {
          setTokenSymbol("UNKNOWN");
          setTokenLogo(null);
        }
      } catch (error) {
        console.error('Failed to fetch token info:', error);
        setTokenSymbol("ERROR");
        setTokenLogo(null);
      } finally {
        setIsFetchingSymbol(false);
      }
    };

    const timeoutId = setTimeout(fetchTokenInfo, 500);
    return () => clearTimeout(timeoutId);
  }, [tokenAddress]);

  const quoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/swap/quote', {
        type,
        tokenAddress,
        amount
      });
      const data = await res.json() as QuoteResponse;
      return data;
    },
    onSuccess: (data) => {
      if (data.success && data.quote) {
        setQuote(data.quote);
        if (data.cost) setCost(data.cost);
        toast({
          title: "Quote Retrieved",
          description: `Estimated ${type === 'buy' ? 'purchase' : 'sale'}: ${parseFloat(data.quote.outputAmount).toFixed(6)} ${type === 'buy' ? tokenSymbol : 'SOL'}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Quote Failed",
        description: error.message || "Failed to get quote",
        variant: "destructive",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/swap/execute', {
        type,
        tokenAddress,
        tokenSymbol,
        amount,
        quote
      });
      const data = await res.json() as {
        success: boolean;
        txhash: string;
        newBalance: string;
        message: string;
        blockchainTx?: string;
      };
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Swap Successful!",
          description: (
            <div className="space-y-2">
              <p>{data.message}</p>
              {data.blockchainTx && (
                <a 
                  href={data.blockchainTx} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm"
                >
                  View Transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ),
          duration: 8000,
        });
        
        // Reset form
        setAmount("");
        setQuote(null);
        setCost(null);
        
        // Invalidate balance cache to reflect updated balance
        queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
        
        // Navigate to explorer after brief delay
        setTimeout(() => navigate('/explorer'), 2000);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Swap Failed",
        description: error.message || "Failed to execute swap",
        variant: "destructive",
      });
    },
  });

  const handleGetQuote = () => {
    if (!tokenAddress || !amount || !tokenSymbol) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    quoteMutation.mutate();
  };

  const handleExecuteSwap = () => {
    if (!quote) {
      toast({
        title: "No Quote",
        description: "Please get a quote first",
        variant: "destructive",
      });
      return;
    }
    executeMutation.mutate();
  };

  const handleSelectPortfolioToken = (token: { mint: string; symbol: string; amount: string; logoURI?: string }) => {
    setTokenAddress(token.mint);
    setTokenSymbol(token.symbol);
    setTokenLogo(token.logoURI || null);
    setAmount("");
    setQuote(null);
    setCost(null);
  };

  const handlePercentageSelect = (percentage: number) => {
    const selectedToken = balance?.tokens.find(t => t.mint === tokenAddress);
    if (!selectedToken) return;
    
    const tokenBalance = parseFloat(selectedToken.amount);
    // For MAX button (100%), use 99% to avoid exceeding balance due to slippage/fees
    const actualPercentage = percentage === 100 ? 99 : percentage;
    const rawAmount = tokenBalance * actualPercentage / 100;
    const sellAmount = Math.floor(rawAmount * 1_000_000) / 1_000_000; // Floor at 6 decimals
    setAmount(sellAmount.toFixed(6));
    setQuote(null);
    setCost(null);
  };

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
            <h1 className="text-4xl font-bold text-white glow-text">Swap</h1>
            <p className="text-gray-400 mt-1">Trade SPL tokens with real on-chain execution</p>
          </div>
        </div>

        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-swap">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Real On-Chain Swap
            </CardTitle>
            <CardDescription className="text-gray-400">
              Powered by Anovex Liquidity Engine for real blockchain transactions
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Balance Display */}
            <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
              <div className="text-sm text-gray-400">Your SOL Balance</div>
              <div className="text-2xl font-bold text-white" data-testid="text-sol-balance">
                {balance?.sol ? parseFloat(balance.sol.amount).toFixed(6) : '0.000000'} SOL
              </div>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex gap-2" data-testid="toggle-swap-type">
              <Button
                variant={type === 'buy' ? 'default' : 'outline'}
                className={`flex-1 ${type === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'border-purple-500/30'}`}
                onClick={() => setType('buy')}
                data-testid="button-type-buy"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Buy Token
              </Button>
              <Button
                variant={type === 'sell' ? 'default' : 'outline'}
                className={`flex-1 ${type === 'sell' ? 'bg-red-600 hover:bg-red-700' : 'border-purple-500/30'}`}
                onClick={() => setType('sell')}
                data-testid="button-type-sell"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Sell Token
              </Button>
            </div>

            {/* Portfolio Token Selector (Sell Mode Only) */}
            {type === 'sell' && balance?.tokens && balance.tokens.length > 0 && (
              <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-3">Your Portfolio</div>
                <div className="grid grid-cols-2 gap-2">
                  {balance.tokens.map((token) => (
                    <Button
                      key={token.mint}
                      variant="outline"
                      className={`justify-start border-purple-500/30 hover-elevate ${
                        tokenAddress === token.mint ? 'bg-purple-600/20 border-purple-500' : ''
                      }`}
                      onClick={() => handleSelectPortfolioToken(token)}
                      data-testid={`button-portfolio-${token.symbol}`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {token.logoURI && (
                          <img 
                            src={token.logoURI} 
                            alt={token.symbol}
                            className="w-6 h-6 rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1 text-left">
                          <div className="text-white font-semibold text-sm">{token.symbol}</div>
                          <div className="text-xs text-gray-400">{parseFloat(token.amount).toFixed(4)}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Token Address */}
            <div className="space-y-2">
              <Label htmlFor="token-address" className="text-gray-400">Token Contract Address</Label>
              <Input
                id="token-address"
                placeholder="Paste SPL token contract address"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                className="bg-black/50 border-purple-500/30 text-white font-mono text-sm"
                data-testid="input-token-address"
              />
              <p className="text-xs text-gray-500">
                Paste any Solana SPL token address (Pump.fun, Raydium, etc.)
              </p>
            </div>

            {/* Auto-Detected Token Info (Symbol + Logo) */}
            {tokenAddress && tokenAddress.length >= 32 && (
              <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Detected Token</div>
                {isFetchingSymbol ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-purple-400">Detecting token...</span>
                  </div>
                ) : tokenSymbol ? (
                  <div className="flex items-center gap-3">
                    {tokenLogo && (
                      <img 
                        src={tokenLogo} 
                        alt={tokenSymbol}
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div className="text-xl font-bold text-white">{tokenSymbol}</div>
                      <div className="text-xs text-gray-500">SPL Token</div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-400">
                Amount {type === 'buy' ? '(SOL to spend)' : `(${tokenSymbol} to sell)`}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.000001"
                placeholder="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-black/50 border-purple-500/30 text-white text-lg"
                data-testid="input-swap-amount"
              />
              
              {/* Percentage Buttons (Sell Mode + Token Selected) */}
              {type === 'sell' && tokenAddress && balance?.tokens.find(t => t.mint === tokenAddress) && (
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePercentageSelect(25)}
                    className="flex-1 border-purple-500/30 hover-elevate text-xs"
                    data-testid="button-percent-25"
                  >
                    25%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePercentageSelect(50)}
                    className="flex-1 border-purple-500/30 hover-elevate text-xs"
                    data-testid="button-percent-50"
                  >
                    50%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePercentageSelect(75)}
                    className="flex-1 border-purple-500/30 hover-elevate text-xs"
                    data-testid="button-percent-75"
                  >
                    75%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePercentageSelect(100)}
                    className="flex-1 border-purple-500/30 hover-elevate text-xs"
                    data-testid="button-percent-100"
                  >
                    100%
                  </Button>
                </div>
              )}
            </div>

            {/* Quote Display */}
            {quote && (
              <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Quote Ready
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">You {type === 'buy' ? 'pay' : 'send'}:</span>
                    <span className="text-white font-mono">
                      {parseFloat(quote.inputAmount).toFixed(6)} {type === 'buy' ? 'SOL' : tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">You {type === 'buy' ? 'receive' : 'get'}:</span>
                    <span className="text-white font-mono">
                      {parseFloat(quote.outputAmount).toFixed(6)} {type === 'buy' ? tokenSymbol : 'SOL'}
                    </span>
                  </div>
                  {cost && type === 'buy' && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total cost:</span>
                      <span className="text-white font-mono">{parseFloat(cost).toFixed(6)} SOL</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price impact:</span>
                    <span className="text-yellow-400">{quote.priceImpactPct}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleGetQuote}
                disabled={quoteMutation.isPending || !tokenAddress || !amount || !tokenSymbol}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                size="lg"
                data-testid="button-get-quote"
              >
                {quoteMutation.isPending ? "Getting Quote..." : "Get Quote"}
              </Button>
              
              <Button
                onClick={handleExecuteSwap}
                disabled={!quote || executeMutation.isPending}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
                size="lg"
                data-testid="button-execute-swap"
              >
                {executeMutation.isPending ? "Executing..." : "Execute Swap"}
              </Button>
            </div>

            <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Privacy Features:</h3>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Real on-chain swaps via Anovex Liquidity Engine</li>
                <li>Executed through privacy-preserving stealth routing</li>
                <li>Verifiable transaction hashes on ANVscan Explorer</li>
                <li>No exposed wallet signatures in Explorer</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
