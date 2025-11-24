import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Activity, Send, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Copy, CheckCircle2, Clock, CheckCircle, XCircle, Zap, RotateCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";

interface TokenHolding {
  mint: string;
  symbol: string;
  amount: string;
  priceUsd: string;
  totalUsd: string;
}

interface BalanceResponse {
  sol: {
    amount: string;
    priceUsd: string;
    totalUsd: string;
  };
  tokens: TokenHolding[];
  totalUsd: string;
}

interface Transaction {
  txhash: string;
  type: string;
  tokenSymbol: string;
  amount: string;
  priceUsd: string;
  timestamp: string;
  status: string;
}

interface WalletAddressResponse {
  success: boolean;
  address: string;
  walletId: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const { data: balance, isLoading, error } = useQuery<BalanceResponse>({
    queryKey: ['/api/wallet/balance'],
  });

  const { data: walletAddress } = useQuery<WalletAddressResponse>({
    queryKey: ['/api/wallet/address'],
  });

  const { data: transactionsData } = useQuery<{ success: boolean; transactions: Transaction[] }>({
    queryKey: ['/api/explorer/transactions'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: depositHistoryData } = useQuery<{ success: boolean; deposits: any[] }>({
    queryKey: ['/api/deposit/history'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const recentDeposits = depositHistoryData?.deposits?.slice(0, 3) || [];
  const recentTransactions = transactionsData?.transactions?.slice(0, 5) || [];
  
  const getDepositStatusBadge = (status: string) => {
    switch (status) {
      case 'finished':
        return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
      case 'waiting_step1':
      case 'waiting_step2':
        return <Badge className="bg-yellow-600 text-white"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'failed':
      case 'refunded':
      case 'expired':
        return <Badge className="bg-red-600 text-white"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  // Redirect to login if not authenticated
  if (error && !isLoading) {
    setLocation('/login');
    return null;
  }
  
  const copyAddress = () => {
    if (walletAddress?.address) {
      navigator.clipboard.writeText(walletAddress.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
    }
  };
  
  const shortenAddress = (addr: string) => {
    if (addr.length <= 20) return addr; // Show full if short
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`; // ANVYUGFSXX...Q4049K for 44-char addresses
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'sell':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'deposit':
        return <ArrowDownToLine className="w-4 h-4 text-blue-500" />;
      case 'withdraw':
        return <ArrowUpFromLine className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'text-green-500';
      case 'sell':
        return 'text-red-500';
      case 'deposit':
        return 'text-blue-500';
      case 'withdraw':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white glow-text">Dashboard</h1>
            <p className="text-gray-400 mt-2">Manage your anonymous trading vault</p>
          </div>
        </div>

        {/* Wallet Address Card */}
        {walletAddress?.address && (
          <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-wallet-address">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                Anovex Wallet Address
              </CardTitle>
              <CardDescription className="text-gray-400">
                Your unique internal identifier, only trackable in Anovex Explorer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Address Display with Copy */}
              <div className="flex items-center gap-2 p-3 bg-purple-950/30 border border-purple-500/20 rounded-lg">
                <code className="flex-1 text-sm text-purple-300 font-mono" data-testid="text-wallet-address">
                  {shortenAddress(walletAddress.address)}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={copyAddress}
                  className="text-purple-400 hover:text-purple-300"
                  data-testid="button-copy-address"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {/* Receive/Send Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-950/30 justify-between"
                  disabled
                  data-testid="button-receive"
                >
                  <span className="flex items-center">
                    <ArrowDownToLine className="w-4 h-4 mr-2" />
                    Receive
                  </span>
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-purple-600 text-white border-purple-500 ml-2"
                  >
                    Coming Soon
                  </Badge>
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-950/30 justify-between"
                  disabled
                  data-testid="button-send"
                >
                  <span className="flex items-center">
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </span>
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-purple-600 text-white border-purple-500 ml-2"
                  >
                    Coming Soon
                  </Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance Card */}
        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-balance">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-400" />
              Total Portfolio
            </CardTitle>
            <CardDescription className="text-gray-400">
              SOL and all tokens with real-time USD conversion
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl text-gray-500">Loading...</div>
            ) : !balance ? (
              <div className="text-center py-6 text-red-400" data-testid="text-balance-error">
                Failed to load balance. Please refresh.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Total Portfolio Value (Primary Display) */}
                <div>
                  <div className="text-5xl font-bold text-white glow-text" data-testid="text-total-portfolio">
                    ${parseFloat(balance?.totalUsd || "0").toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Total Portfolio Value</div>
                </div>
                
                {/* SOL Balance */}
                <div className="pt-4 border-t border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-purple-400" data-testid="text-balance-sol">
                        {parseFloat(balance?.sol?.amount || "0").toFixed(4)} SOL
                      </div>
                      <div className="text-xs text-gray-500">@ ${parseFloat(balance?.sol?.priceUsd || "0").toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white" data-testid="text-sol-usd">
                        ${parseFloat(balance?.sol?.totalUsd || "0").toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">USD Value</div>
                    </div>
                  </div>
                </div>

                {/* Token Holdings */}
                {balance?.tokens && balance.tokens.length > 0 && (
                  <div className="pt-4 border-t border-purple-500/20 space-y-3">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Token Holdings
                    </div>
                    {balance.tokens.map((token) => (
                      <div key={token.mint} className="flex items-center justify-between" data-testid={`token-${token.symbol}`}>
                        <div>
                          <div className="text-sm font-semibold text-purple-400">
                            {parseFloat(token.amount).toLocaleString()} {token.symbol}
                          </div>
                          <div className="text-xs text-gray-500">
                            @ ${parseFloat(token.priceUsd).toFixed(6)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white">
                            ${parseFloat(token.totalUsd).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">USD Value</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/deposit">
            <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl hover-elevate cursor-pointer group" data-testid="card-deposit">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Add Funds
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Fund wallet via ZK Relay Network
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="ghost" 
                  className="w-full text-purple-400 group-hover:text-purple-300"
                  data-testid="button-go-deposit"
                >
                  Add Funds
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/swap">
            <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl hover-elevate cursor-pointer group" data-testid="card-swap">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  Swap
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Trade SPL tokens anonymously
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="ghost" 
                  className="w-full text-purple-400 group-hover:text-purple-300"
                  data-testid="button-go-swap"
                >
                  Start Swap
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/portfolio">
            <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl hover-elevate cursor-pointer group" data-testid="card-portfolio">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Portfolio
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Track your PNL & holdings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="ghost" 
                  className="w-full text-purple-400 group-hover:text-purple-300"
                  data-testid="button-go-portfolio"
                >
                  View Portfolio
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/withdraw">
            <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl hover-elevate cursor-pointer group" data-testid="card-withdraw">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-yellow-400" />
                  Withdraw
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Send funds to external wallet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="ghost" 
                  className="w-full text-purple-400 group-hover:text-purple-300"
                  data-testid="button-go-withdraw"
                >
                  Withdraw SOL
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Deposit History */}
        {recentDeposits.length > 0 && (
          <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-deposit-history">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ArrowDownToLine className="w-5 h-5 text-blue-400" />
                    Funding History
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Track your anonymous funding flows in real-time
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDeposits.map((deposit: any) => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-900/10 hover-elevate"
                    data-testid={`deposit-${deposit.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <ArrowDownToLine className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{parseFloat(deposit.solAmount).toFixed(4)} SOL</span>
                          {getDepositStatusBadge(deposit.status)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(deposit.createdAt).toLocaleString()}
                        </p>
                        {deposit.status === 'waiting_step1' && (
                          <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Processing deposit...
                          </p>
                        )}
                        {deposit.status === 'waiting_step2' && (
                          <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                            <RotateCw className="w-3 h-3 animate-spin" />
                            Finalizing transaction...
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {deposit.status === 'finished' ? (
                        <>
                          <p className="text-green-400 font-semibold text-sm">
                            +{parseFloat(deposit.solAmount).toFixed(4)} SOL
                          </p>
                          <p className="text-xs text-gray-500">Credited</p>
                        </>
                      ) : deposit.status === 'failed' || deposit.status === 'refunded' || deposit.status === 'expired' ? (
                        <p className="text-red-400 text-sm">
                          {deposit.status}
                        </p>
                      ) : (
                        <p className="text-gray-400 text-sm">
                          In Progress
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-recent-activity">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Your latest transactions (deposit, buy, sell, withdraw)
                </CardDescription>
              </div>
              <Link href="/explorer">
                <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300" data-testid="button-view-all">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No transactions yet. Start by depositing funds!
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.txhash}
                    className="flex items-center justify-between p-3 rounded-lg border border-purple-500/10 bg-purple-900/5 hover-elevate"
                    data-testid={`activity-${tx.txhash}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={getTypeColor(tx.type)}>
                        {getTypeIcon(tx.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium capitalize">{tx.type}</span>
                          <Badge variant="secondary" className="text-xs">
                            {tx.tokenSymbol || 'SOL'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">
                        {parseFloat(tx.amount).toFixed(4)} {tx.tokenSymbol || 'SOL'}
                      </p>
                      <p className="text-xs text-gray-500">
                        ${parseFloat(tx.priceUsd).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
