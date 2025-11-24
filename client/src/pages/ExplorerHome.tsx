import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Copy, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Check, Activity, Shield, TrendingUp, FileText } from "lucide-react";
import { SiX, SiTelegram } from "react-icons/si";
import { Link } from "wouter";
import { useExplorerPaths } from "@/hooks/use-explorer-paths";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/StatCard";
import anovexLogo from "@assets/file_00000000967071fa82ee6d0e14c9e5cc_1763224947806.png";

interface Transaction {
  txhash: string;
  category: string;
  type: string;
  tokenSymbol: string;
  amount: string;
  usdValue: string;
  solValue: string;
  status: string;
  timestamp: string;
  wallet: string;
  blockNumber: string;
  instructions: string;
}

interface ExplorerResponse {
  success: boolean;
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

interface StatsResponse {
  success: boolean;
  stats: {
    totalTransactions: number;
    completedTransactions: number;
    uniqueWallets: number;
    allTimeVolume: string;
    volume24h: string;
    avgTransactionValue: string;
    transactions24h: number;
    networkStatus: "Online" | "Offline";
    networkActivity: number;
  };
}

export default function ExplorerHome() {
  const [page, setPage] = useState(1);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const paths = useExplorerPaths();
  const { toast } = useToast();

  // Social media links
  const socialLinks = {
    twitter: "https://x.com/anovexofficial",
    telegram: "https://t.me/anovexbot",
    docs: "https://docs.anovex.io",
  };

  // Fetch statistics
  const { data: statsData, error: statsError } = useQuery<StatsResponse>({
    queryKey: ["/api/explorer/stats"],
    queryFn: async () => {
      const res = await fetch("/api/explorer/stats", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.statusText}`);
      }
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Show error toast if stats fetch fails
  if (statsError) {
    console.error("Stats fetch error:", statsError);
  }

  const stats = statsData?.stats || {
    totalTransactions: 0,
    completedTransactions: 0,
    uniqueWallets: 0,
    allTimeVolume: "0.00",
    volume24h: "0.00",
    avgTransactionValue: "0.00",
    transactions24h: 0,
    networkStatus: "Offline" as const,
    networkActivity: 0,
  };

  // Fetch transactions with 10 items per page
  const { data, isLoading } = useQuery<ExplorerResponse>({
    queryKey: ["/api/explorer/transactions", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      const res = await fetch(`/api/explorer/transactions?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.statusText}`);
      }
      return res.json();
    },
  });

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, totalCount: 0, limit: 10 };

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    toast({ title: "Transaction hash copied!" });
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const truncateHash = (hash: string) => {
    if (!hash || hash.length < 12) return hash;
    return `${hash.slice(0, 8)}...`;
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const txTime = new Date(timestamp);
    const diffMs = now.getTime() - txTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs} secs ago`;
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const goToFirstPage = () => setPage(1);
  const goToLastPage = () => setPage(pagination.totalPages);
  const goToPrevPage = () => setPage(Math.max(1, page - 1));
  const goToNextPage = () => setPage(Math.min(pagination.totalPages, page + 1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Enhanced Header with Social Links */}
      <header className="border-b border-primary/20 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <img 
                src={anovexLogo} 
                alt="Anovex Logo" 
                className="h-8 w-8 md:h-10 md:w-10 rounded-md object-contain"
                data-testid="img-anovex-logo"
              />
              <div>
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                  ANVscan
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Privacy-First Transaction Explorer
                </p>
              </div>
            </div>

            {/* Social Media Links */}
            <div className="flex items-center gap-2 md:gap-3">
              <a
                href={socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                data-testid="link-twitter"
              >
                <SiX className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground hover:text-primary transition-colors" />
              </a>
              <a
                href={socialLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                data-testid="link-telegram"
              >
                <SiTelegram className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground hover:text-primary transition-colors" />
              </a>
              <a
                href={socialLinks.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                data-testid="link-docs"
              >
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground hover:text-primary transition-colors" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Statistics Dashboard - Enhanced 6-Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 md:mb-8">
          <StatCard
            icon={Activity}
            title="All-Time Transactions"
            value={stats.totalTransactions.toLocaleString()}
            badge={{ text: "Total", variant: "default" }}
          />
          <StatCard
            icon={TrendingUp}
            title="All-Time Volume"
            value={`$${parseFloat(stats.allTimeVolume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            badge={{ text: "All-Time", variant: "default" }}
          />
          <StatCard
            icon={Shield}
            title="Anonymous Sessions"
            value={stats.uniqueWallets.toLocaleString()}
            badge={{ text: "Active", variant: "secondary" }}
          />
          <StatCard
            icon={TrendingUp}
            title="24h Volume"
            value={`$${parseFloat(stats.volume24h).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            badge={{ text: "24h", variant: "outline" }}
          />
          <StatCard
            icon={Activity}
            title="24h Transactions"
            value={stats.transactions24h.toLocaleString()}
            badge={{ text: "24h", variant: "outline" }}
          />
          <StatCard
            icon={Activity}
            title="Privacy Protocol"
            value={stats.networkStatus}
            status={stats.networkStatus.toLowerCase() as "online" | "offline"}
          />
        </div>

        {/* Transaction List Card */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-primary/20 shadow-lg">
          {/* Transaction List Header */}
          <div className="px-4 py-3 border-b border-primary/10">
            <h2 className="text-sm md:text-base font-semibold text-foreground">
              Recent Activity
            </h2>
            <p className="text-xs text-muted-foreground">
              All transactions cryptographically anonymized
            </p>
          </div>

          {/* Transaction Table - Proper table structure */}
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead data-testid="header-txn-hash">Transaction Hash</TableHead>
                    <TableHead data-testid="header-block" className="hidden sm:table-cell">Block</TableHead>
                    <TableHead data-testid="header-instructions">Instructions</TableHead>
                    <TableHead data-testid="header-sol-value" className="text-right hidden md:table-cell">SOL Value</TableHead>
                    <TableHead data-testid="header-time" className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.txhash} data-testid={`transaction-row-${tx.txhash}`}>
                      {/* Transaction Hash Column */}
                      <TableCell className="font-mono" data-testid={`cell-hash-${tx.txhash}`}>
                        <div className="flex items-center gap-2">
                          {/* Status Dot */}
                          <div
                            className={`h-2 w-2 rounded-full flex-shrink-0 ${
                              tx.status === "completed"
                                ? "bg-green-500"
                                : tx.status === "failed"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                            data-testid={`status-dot-${tx.status}`}
                          />
                          
                          {/* Hash Link */}
                          <Link href={paths.transaction(tx.txhash)}>
                            <button
                              className="text-primary hover:underline text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]"
                              data-testid={`link-transaction-${tx.txhash}`}
                            >
                              {truncateHash(tx.txhash)}
                            </button>
                          </Link>
                          
                          {/* Copy Button */}
                          <button
                            onClick={() => copyToClipboard(tx.txhash)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            data-testid={`button-copy-${tx.txhash}`}
                          >
                            {copiedHash === tx.txhash ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          
                          {/* View Button */}
                          <Link href={paths.transaction(tx.txhash)}>
                            <button
                              className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                              data-testid={`button-view-${tx.txhash}`}
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                          </Link>
                        </div>
                      </TableCell>

                      {/* Block Column - Hidden on mobile */}
                      <TableCell className="font-mono text-primary hidden sm:table-cell" data-testid={`text-block-${tx.txhash}`}>
                        {tx.blockNumber || '-'}
                      </TableCell>

                      {/* Instructions Column */}
                      <TableCell data-testid={`cell-instructions-${tx.txhash}`}>
                        {tx.instructions ? (
                          <span 
                            className="px-1.5 py-0.5 sm:px-2 rounded-md bg-primary/10 text-primary text-[10px] sm:text-xs font-medium inline-block whitespace-nowrap"
                            data-testid={`text-instructions-${tx.txhash}`}
                          >
                            {tx.instructions}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* SOL Value Column - Hidden on small screens */}
                      <TableCell className="text-right text-muted-foreground hidden md:table-cell" data-testid={`text-sol-${tx.txhash}`}>
                        {tx.solValue ? `${parseFloat(tx.solValue).toFixed(4)} SOL` : '-'}
                      </TableCell>

                      {/* Time Column */}
                      <TableCell className="text-right text-muted-foreground whitespace-nowrap" data-testid={`text-time-${tx.txhash}`}>
                        {getTimeAgo(tx.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoading && transactions.length > 0 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-primary/10">
              {/* First Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={goToFirstPage}
                disabled={page === 1}
                data-testid="button-first-page"
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>

              {/* Previous Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={page === 1}
                data-testid="button-prev-page"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page Info */}
              <span className="text-xs sm:text-sm text-foreground mx-2" data-testid="text-page-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              {/* Next Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={page === pagination.totalPages}
                data-testid="button-next-page"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Last Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={goToLastPage}
                disabled={page === pagination.totalPages}
                data-testid="button-last-page"
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
