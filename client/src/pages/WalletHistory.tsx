import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExplorerPaths } from "@/hooks/use-explorer-paths";

interface Transaction {
  txhash: string;
  category: string;
  type: string;
  tokenSymbol: string;
  amount: string;
  usdValue: string;
  status: string;
  timestamp: string;
}

interface WalletResponse {
  success: boolean;
  wallet: {
    anvAddress: string;
    createdAt: string;
  };
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  error?: string;
}

export default function WalletHistory() {
  const paths = useExplorerPaths();
  const routePattern = paths.isPathBased ? "/explorer/wallet/:anvAddress" : "/wallet/:anvAddress";
  const [, params] = useRoute(routePattern);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<WalletResponse>({
    queryKey: [`/api/explorer/wallet/${params?.anvAddress}`, { page, type: typeFilter }],
    enabled: !!params?.anvAddress,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Wallet address copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    } as const;
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
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
      <Badge className={`${colors[category as keyof typeof colors] || ""} border`}>
        {category}
      </Badge>
    );
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-muted-foreground">Loading wallet history...</p>
        </Card>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h2 className="text-xl font-bold mb-2">Wallet Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The wallet you're looking for doesn't exist or couldn't be loaded.
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
                Transaction History
              </h1>
              <p className="text-xs text-muted-foreground">ANVscan Explorer</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Transaction Statistics */}
        <Card className="p-6 mb-8 border-border/40 bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4">Statistics</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(data.wallet.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Transactions</span>
              <span className="font-medium">{data.pagination.totalCount}</span>
            </div>
          </div>
        </Card>

        {/* Type Filter */}
        <Card className="p-4 mb-6 border-border/40 bg-card/50 backdrop-blur-sm">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger data-testid="select-type-filter">
              <SelectValue placeholder="All Transaction Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="deposit">Transfer In (Deposit)</SelectItem>
              <SelectItem value="withdraw">Transfer Out (Withdraw)</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Transactions List */}
        {data.transactions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No transactions found</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.transactions.map((tx) => (
              <Link key={tx.txhash} href={paths.transaction(tx.txhash)} data-testid={`link-transaction-${tx.txhash}`}>
                <Card className="p-4 hover-elevate active-elevate-2 cursor-pointer border-border/40 bg-card/50 backdrop-blur-sm" data-testid={`card-transaction-${tx.txhash}`}>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    {/* Transaction Hash */}
                    <div className="md:col-span-2">
                      <p className="text-sm font-mono text-muted-foreground">Transaction</p>
                      <p className="font-medium truncate" data-testid={`text-txhash-${tx.txhash}`}>{tx.txhash}</p>
                    </div>

                    {/* Category */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Type</p>
                      {getCategoryBadge(tx.category)}
                    </div>

                    {/* Amount */}
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{parseFloat(tx.amount).toFixed(4)}</span>
                        <span className="text-xs text-muted-foreground">{tx.tokenSymbol}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">${parseFloat(tx.usdValue).toFixed(2)}</p>
                    </div>

                    {/* Status & Time */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Status</p>
                      {getStatusBadge(tx.status)}
                      <p className="text-xs text-muted-foreground mt-2">{formatDate(tx.timestamp)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
