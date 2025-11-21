import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";

interface PortfolioSummary {
  totalPnl: string;
  unrealizedPnl: string;
  realizedPnl: string;
  totalTrades: number;
  winRate: string;
  totalValue: string;
}

interface Holding {
  mint: string;
  symbol: string;
  amount: string;
  entryPrice: string;
  currentPrice: string;
  costBasis: string;
  currentValue: string;
  unrealizedPnl: string;
  pnlPercent: string;
}

interface Trade {
  txhash: string;
  type: string;
  tokenSymbol: string;
  amount: string;
  priceUsd: string;
  timestamp: string;
}

interface PortfolioData {
  success: boolean;
  summary: PortfolioSummary;
  holdings: Holding[];
  recentTrades: Trade[];
}

export default function Portfolio() {
  const { data, isLoading } = useQuery<PortfolioData>({
    queryKey: ['/api/portfolio'],
    refetchInterval: 10000
  });

  const summary = data?.summary;
  const holdings = data?.holdings || [];
  const recentTrades = data?.recentTrades || [];

  const pnlColor = (pnl: string) => {
    const value = parseFloat(pnl);
    if (value > 0) return "text-green-400";
    if (value < 0) return "text-red-400";
    return "text-gray-400";
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="text-white" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-white glow-text">Portfolio</h1>
            <p className="text-gray-400 mt-1">Live PnL tracking for your holdings</p>
          </div>
        </div>

        {/* PNL Summary */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-total-pnl">
            <CardHeader>
              <CardTitle className="text-white text-lg">Total PNL</CardTitle>
              <CardDescription className="text-gray-400">All-time profit & loss</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-3xl font-bold text-gray-500">Loading...</div>
              ) : (
                <div className={`text-3xl font-bold ${pnlColor(summary?.totalPnl || "0")}`}>
                  ${summary?.totalPnl || "0.00"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-trades">
            <CardHeader>
              <CardTitle className="text-white text-lg">Total Trades</CardTitle>
              <CardDescription className="text-gray-400">Completed sells</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {isLoading ? "..." : summary?.totalTrades || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-win-rate">
            <CardHeader>
              <CardTitle className="text-white text-lg">Win Rate</CardTitle>
              <CardDescription className="text-gray-400">Profitable sells</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">
                {isLoading ? "..." : `${summary?.winRate || "0.0"}%`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Holdings */}
        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-holdings">
          <CardHeader>
            <CardTitle className="text-white">Current Holdings</CardTitle>
            <CardDescription className="text-gray-400">
              Live unrealized PnL
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading holdings...</div>
            ) : holdings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No holdings yet. Start trading to build your portfolio!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-holdings">
                  <thead>
                    <tr className="border-b border-purple-500/20">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Token</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Amount</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Entry Price</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Current Price</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => (
                      <tr key={holding.mint} className="border-b border-purple-500/10 hover-elevate" data-testid={`row-holding-${holding.symbol}`}>
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{holding.symbol}</div>
                          <div className="text-xs text-gray-500 font-mono">{holding.mint.slice(0, 8)}...</div>
                        </td>
                        <td className="text-right py-3 px-4 text-white">{parseFloat(holding.amount).toFixed(4)}</td>
                        <td className="text-right py-3 px-4 text-gray-400">${parseFloat(holding.entryPrice).toFixed(6)}</td>
                        <td className="text-right py-3 px-4 text-white">${parseFloat(holding.currentPrice).toFixed(6)}</td>
                        <td className="text-right py-3 px-4 text-white">${holding.currentValue}</td>
                        <td className={`text-right py-3 px-4 font-medium ${pnlColor(holding.unrealizedPnl)}`}>
                          <div>{parseFloat(holding.unrealizedPnl) >= 0 ? '+' : ''}${holding.unrealizedPnl}</div>
                          <div className="text-xs">({parseFloat(holding.pnlPercent) >= 0 ? '+' : ''}{holding.pnlPercent}%)</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-recent-trades">
          <CardHeader>
            <CardTitle className="text-white">Recent Trades</CardTitle>
            <CardDescription className="text-gray-400">
              Your latest swap transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading trades...</div>
            ) : recentTrades.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No trades yet. Execute your first swap to see history!
              </div>
            ) : (
              <div className="space-y-3">
                {recentTrades.map((trade) => (
                  <div 
                    key={trade.txhash} 
                    className="flex items-center justify-between p-4 rounded-md border border-purple-500/10 hover-elevate"
                    data-testid={`trade-${trade.txhash}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-md text-sm font-medium ${
                        trade.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.type.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium">{trade.tokenSymbol}</div>
                        <div className="text-xs text-gray-500">{format(new Date(trade.timestamp), 'MMM d, h:mm a')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white">{parseFloat(trade.amount).toFixed(4)} {trade.tokenSymbol}</div>
                      <div className="text-xs text-gray-500">@ ${parseFloat(trade.priceUsd || "0").toFixed(6)}</div>
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
