import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useExplorerPaths } from "@/hooks/use-explorer-paths";

interface TransactionDetailType {
  txhash: string;
  chainTxhash: string | null;
  category: string;
  type: string;
  tokenAddress: string | null;
  tokenSymbol: string;
  amount: string;
  priceUsd: string;
  usdValue: string;
  solValue: string;
  costBasisAtSale: string | null;
  realizedPnl: string | null;
  status: string;
  timestamp: string;
  wallet: string;
  blockNumber: string;
  instructions: string;
}

interface TransactionResponse {
  success: boolean;
  transaction: TransactionDetailType;
  error?: string;
}

export default function TransactionDetail() {
  const paths = useExplorerPaths();
  const routePattern = paths.isPathBased ? "/explorer/tx/:hash" : "/tx/:hash";
  const [, params] = useRoute(routePattern);
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, error} = useQuery<TransactionResponse>({
    queryKey: [`/api/explorer/tx/${params?.hash}`],
    enabled: !!params?.hash,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    } as const;
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"} className="text-sm">
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      "Transfer In": "bg-green-500/10 text-green-400 border-green-500/20",
      "Transfer Out": "bg-red-500/10 text-red-400 border-red-500/20",
      "Buy": "bg-blue-500/10 text-blue-400 border-blue-500/20",
      "Sell": "bg-orange-500/10 text-orange-400 border-orange-500/20",
    };
    return (
      <Badge className={`${colors[category as keyof typeof colors] || ""} border text-sm px-3 py-1`}>
        {category}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-muted-foreground">Loading transaction...</p>
        </Card>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h2 className="text-xl font-bold mb-2">Transaction Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The transaction you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Link href={paths.home} data-testid="link-back-error">
            <Button data-testid="button-back-to-explorer">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Explorer
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const tx = data.transaction;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href={paths.home} data-testid="link-back">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                Transaction Details
              </h1>
              <p className="text-xs text-muted-foreground">ANVscan Explorer</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Transaction Hash */}
        <Card className="p-6 mb-6 border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Transaction Hash</h2>
            {getStatusBadge(tx.status)}
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg font-mono text-sm break-all">
            <span className="flex-1" data-testid="text-txhash">{tx.txhash}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(tx.txhash, "Transaction hash")}
              data-testid="button-copy-txhash"
            >
              {copied === "Transaction hash" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>

        {/* Transaction Info */}
        <Card className="p-6 mb-6 border-border/40 bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4">Transaction Information</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border/40">
              <span className="text-muted-foreground">Category</span>
              <span>{getCategoryBadge(tx.category)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border/40">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline">{tx.type.toUpperCase()}</Badge>
            </div>
            {tx.blockNumber && (
              <div className="flex justify-between items-center py-3 border-b border-border/40">
                <span className="text-muted-foreground">Block Number</span>
                {(tx.type === 'deposit' || tx.type === 'withdraw') ? (
                  <a
                    href={`https://solscan.io/block/${tx.blockNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-medium text-primary hover:underline flex items-center gap-1"
                    data-testid="link-block-number"
                  >
                    {tx.blockNumber}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono font-medium" data-testid="text-block-number">{tx.blockNumber}</span>
                )}
              </div>
            )}
            {tx.instructions && (
              <div className="flex justify-between items-center py-3 border-b border-border/40">
                <span className="text-muted-foreground">Instructions</span>
                <Badge variant="secondary">{tx.instructions}</Badge>
              </div>
            )}
            <div className="flex justify-between items-center py-3 border-b border-border/40">
              <span className="text-muted-foreground">Token</span>
              <span className="font-medium">{tx.tokenSymbol}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border/40">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium" data-testid="text-token-amount">{parseFloat(tx.amount).toFixed(6)} {tx.tokenSymbol}</span>
            </div>
            {tx.solValue && (
              <div className="flex justify-between items-center py-3 border-b border-border/40">
                <span className="text-muted-foreground">SOL Value</span>
                <span className="font-medium" data-testid="text-sol-value">{parseFloat(tx.solValue).toFixed(6)} SOL</span>
              </div>
            )}
            {(tx.type === 'buy' || tx.type === 'sell') && tx.solValue && (
              <div className="flex justify-between items-center py-3 border-b border-border/40">
                <span className="text-muted-foreground">
                  {tx.type === 'buy' ? 'Total SOL Spent' : 'Total SOL Received'}
                </span>
                <span className="font-medium" data-testid="text-total-sol">{parseFloat(tx.solValue).toFixed(9)} SOL</span>
              </div>
            )}
            {tx.realizedPnl && (
              <div className="flex justify-between items-center py-3 border-b border-border/40">
                <span className="text-muted-foreground">Realized P&L</span>
                <span className={`font-medium ${parseFloat(tx.realizedPnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${parseFloat(tx.realizedPnl).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-3">
              <span className="text-muted-foreground">Timestamp</span>
              <span className="font-medium">{new Date(tx.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Blockchain Hash (only for deposit/withdraw) */}
        {tx.chainTxhash && (tx.type === 'deposit' || tx.type === 'withdraw') && (
          <Card className="p-6 border-border/40 bg-card/50 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4">Blockchain Transaction</h2>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <span className="font-mono text-sm flex-1 truncate">{tx.chainTxhash}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(tx.chainTxhash!, "Blockchain hash")}
                data-testid="button-copy-chain-hash"
              >
                {copied === "Blockchain hash" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(`https://solscan.io/tx/${tx.chainTxhash}`, '_blank')}
                data-testid="button-view-on-solscan"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
