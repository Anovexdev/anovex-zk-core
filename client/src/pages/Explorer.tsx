import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Link, useRoute } from "wouter";

interface Transaction {
  txhash: string;
  type: string;
  tokenSymbol: string;
  amount: string;
  priceUsd: string;
  timestamp: string;
  status: string;
}

interface NetworkStats {
  totalTransactions: number;
  activeUsers: number;
  relayStatus: string;
  networkUptime: number;
  last24hActivity: number;
  totalVolumeUsd: string;
  networkHealth: number;
}

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 6V12C4 16.55 7.16 20.74 12 22C16.84 20.74 20 16.55 20 12V6L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NetworkIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M9.5 10.5L7.5 8M14.5 10.5L16.5 8M9.5 13.5L7.5 16M14.5 13.5L16.5 16" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const RelayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12H8M16 12H20M8 12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12M8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="2" cy="12" r="2" fill="currentColor"/>
    <circle cx="22" cy="12" r="2" fill="currentColor"/>
  </svg>
);

const ActivityIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12L7 8L11 14L15 6L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function Explorer() {
  const [match, params] = useRoute("/tx/:hash");
  const txHash = params?.hash;

  const { data: transactionData, isLoading: txLoading } = useQuery<{ success: boolean; transactions: Transaction[] }>({
    queryKey: ['/api/explorer/global'],
    refetchInterval: 5000,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: NetworkStats }>({
    queryKey: ['/api/explorer/stats'],
    refetchInterval: 10000,
  });

  const stats = statsData?.stats;

  useEffect(() => {
    const originalTitle = document.title;
    document.title = "ANVscan - Anovex Blockchain Explorer | Privacy-First Transaction Explorer";
    
    const createdTags: HTMLMetaElement[] = [];
    const createdLinks: HTMLLinkElement[] = [];
    const modifiedTags: Array<{ element: Element; property: string; originalContent: string }> = [];
    const modifiedLinks: Array<{ element: HTMLLinkElement; originalHref: string }> = [];
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const originalMetaDescription = metaDescription?.getAttribute('content') || '';
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Explore Anovex blockchain transactions with complete privacy. View real-time network stats, transaction history, and wallet activity on ANVscan - the privacy-preserving blockchain explorer.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Explore Anovex blockchain transactions with complete privacy. View real-time network stats, transaction history, and wallet activity on ANVscan - the privacy-preserving blockchain explorer.';
      document.head.appendChild(meta);
      createdTags.push(meta);
    }
    
    const setOrCreateMetaTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (tag) {
        modifiedTags.push({ element: tag, property, originalContent: tag.getAttribute('content') || '' });
        tag.setAttribute('content', content);
      } else {
        const newTag = document.createElement('meta');
        newTag.setAttribute('property', property);
        newTag.setAttribute('content', content);
        document.head.appendChild(newTag);
        createdTags.push(newTag);
      }
    };
    
    setOrCreateMetaTag('og:title', 'ANVscan - Anovex Blockchain Explorer');
    setOrCreateMetaTag('og:description', 'Privacy-first blockchain explorer for Anovex network. View transactions, network stats, and wallet activity with complete anonymity.');
    setOrCreateMetaTag('og:type', 'website');
    setOrCreateMetaTag('og:url', 'https://anvscan.com');
    setOrCreateMetaTag('og:image', 'https://anovex.io/og-image.png');
    
    const twitterCard = document.querySelector('meta[name="twitter:card"]');
    const originalTwitterCard = twitterCard?.getAttribute('content') || '';
    if (twitterCard) {
      twitterCard.setAttribute('content', 'summary_large_image');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'twitter:card';
      meta.content = 'summary_large_image';
      document.head.appendChild(meta);
      createdTags.push(meta);
    }
    
    const setOrCreateIconLink = (rel: string, href: string, sizes?: string) => {
      const selector = sizes 
        ? `link[rel="${rel}"][sizes="${sizes}"]`
        : `link[rel="${rel}"]:not([sizes])`;
      
      let link = document.querySelector(selector) as HTMLLinkElement | null;
      if (link) {
        modifiedLinks.push({ element: link, originalHref: link.getAttribute('href') || '' });
        link.setAttribute('href', href);
      } else {
        const newLink = document.createElement('link');
        newLink.setAttribute('rel', rel);
        newLink.setAttribute('href', href);
        if (sizes) {
          newLink.setAttribute('sizes', sizes);
        }
        document.head.appendChild(newLink);
        createdLinks.push(newLink);
      }
    };
    
    setOrCreateIconLink('icon', '/favicon.png');
    setOrCreateIconLink('icon', '/favicon-16x16.png', '16x16');
    setOrCreateIconLink('icon', '/favicon-32x32.png', '32x32');
    setOrCreateIconLink('apple-touch-icon', '/apple-touch-icon.png');
    
    return () => {
      document.title = originalTitle;
      
      if (metaDescription) {
        metaDescription.setAttribute('content', originalMetaDescription);
      }
      
      modifiedTags.forEach(({ element, originalContent }) => {
        element.setAttribute('content', originalContent);
      });
      
      modifiedLinks.forEach(({ element, originalHref }) => {
        element.setAttribute('href', originalHref);
      });
      
      createdTags.forEach(tag => tag.remove());
      createdLinks.forEach(link => link.remove());
      
      if (twitterCard) {
        twitterCard.setAttribute('content', originalTwitterCard);
      }
    };
  }, []);
  
  const selectedTx = txHash && transactionData?.transactions 
    ? transactionData.transactions.find(tx => tx.txhash === txHash)
    : null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <TrendingUp className="w-4 h-4" />;
      case 'sell':
        return <TrendingDown className="w-4 h-4" />;
      case 'deposit':
        return <ArrowDownToLine className="w-4 h-4" />;
      case 'withdraw':
        return <ArrowUpFromLine className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'text-green-400';
      case 'sell':
        return 'text-red-400';
      case 'deposit':
        return 'text-blue-400';
      case 'withdraw':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  if (selectedTx) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Link href="/explorer">
            <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-to-explorer">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Explorer
            </Button>
          </Link>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <div className="p-6 border-b border-zinc-800">
              <h1 className="text-2xl font-bold text-white mb-2">Transaction Details</h1>
              <p className="text-sm text-gray-400">Cryptographically anonymized transaction</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-zinc-800">
                <div className={`w-16 h-16 rounded-lg bg-zinc-800/50 flex items-center justify-center ${getTypeColor(selectedTx.type)}`}>
                  {getTypeIcon(selectedTx.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-white capitalize">{selectedTx.type}</span>
                    <Badge variant="secondary">{selectedTx.tokenSymbol || 'SOL'}</Badge>
                  </div>
                  <Badge variant={selectedTx.status === 'completed' ? 'default' : 'secondary'}>
                    {selectedTx.status === 'completed' ? 'Confirmed' : 'Pending'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Amount</p>
                  <p className="text-xl font-bold text-white">{parseFloat(selectedTx.amount).toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Value (USD)</p>
                  <p className="text-xl font-bold text-white">${parseFloat(selectedTx.priceUsd).toFixed(2)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-400 mb-1">Timestamp</p>
                  <p className="text-white">
                    {new Date(selectedTx.timestamp).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-400 mb-2">Transaction Hash</p>
                  <a
                    href={`https://anvscan.com/tx/${selectedTx.txhash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-zinc-800/50 rounded-lg text-purple-400 hover:text-purple-300 font-mono text-sm break-all underline"
                  >
                    {selectedTx.txhash}
                  </a>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-900/10 to-emerald-900/5 border-green-500/20 mt-6">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <h3 className="font-semibold text-green-400">Privacy Features Active</h3>
              </div>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Transaction executed through privacy-preserving dual-wallet system</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>No wallet address linkage or exposure in blockchain explorer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Cryptographic anonymization via ZK relay network</span>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-purple-600 bg-clip-text text-transparent mb-2">
            Privacy Explorer
          </h1>
          <p className="text-gray-400">
            Real-time network activity with complete transaction anonymity
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-500/20 hover-elevate" data-testid="stat-transactions">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <NetworkIcon />
                </div>
                <Badge variant="secondary" className="text-xs">Live</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Network Transactions</p>
                <p className="text-3xl font-bold text-white" data-testid="stat-transactions-value">
                  {statsLoading ? '...' : (stats?.totalTransactions?.toLocaleString() ?? '0')}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-violet-900/20 to-violet-800/10 border-violet-500/20 hover-elevate" data-testid="stat-users">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                  <ShieldIcon />
                </div>
                <Badge variant="secondary" className="text-xs">Active</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Anonymous Sessions</p>
                <p className="text-3xl font-bold text-white" data-testid="stat-users-value">
                  {statsLoading ? '...' : (stats?.activeUsers ?? '0')}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/20 to-violet-900/10 border-purple-500/20 hover-elevate" data-testid="stat-relay">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                  <RelayIcon />
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400">Online</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">ZK Relay Network</p>
                <p className="text-3xl font-bold text-white" data-testid="stat-relay-value">
                  {statsLoading ? '...' : (stats?.relayStatus === 'operational' ? 'Active' : 'Offline')}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-violet-900/20 to-purple-900/10 border-violet-500/20 hover-elevate" data-testid="stat-uptime">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                  <ActivityIcon />
                </div>
                <Badge variant="secondary" className="text-xs">24h</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Network Uptime</p>
                <p className="text-3xl font-bold text-white" data-testid="stat-uptime-value">
                  {statsLoading ? '...' : `${stats?.networkUptime ?? 0}%`}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
                <p className="text-sm text-gray-400 mt-1">
                  All transactions cryptographically anonymized
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                Auto-refresh: 5s
              </Badge>
            </div>
          </div>
          
          <div className="p-6">
            {txLoading ? (
              <div className="text-center py-12 text-gray-400">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading network activity...
              </div>
            ) : !transactionData?.transactions || transactionData.transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <NetworkIcon />
                <p className="mt-2">No transactions recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactionData.transactions.map((tx) => (
                  <div
                    key={tx.txhash}
                    className="border border-zinc-800/50 rounded-lg p-5 hover-elevate bg-gradient-to-r from-purple-900/5 to-transparent"
                    data-testid={`transaction-${tx.txhash}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg bg-zinc-800/50 flex items-center justify-center ${getTypeColor(tx.type)}`}>
                          {getTypeIcon(tx.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white capitalize">{tx.type}</span>
                            <Badge variant="secondary" className="text-xs">
                              {tx.tokenSymbol || 'SOL'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(tx.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-lg text-white" data-testid={`amount-${tx.txhash}`}>
                          {parseFloat(tx.amount).toFixed(6)}
                        </p>
                        <p className="text-sm text-gray-500" data-testid={`price-${tx.txhash}`}>
                          ${parseFloat(tx.priceUsd).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">TX Hash:</span>
                        <a
                          href={`https://anvscan.com/tx/${tx.txhash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300 font-mono underline"
                          data-testid={`txhash-${tx.txhash}`}
                        >
                          {tx.txhash}
                        </a>
                      </div>

                      <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                        {tx.status === 'completed' ? 'Confirmed' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-green-900/10 to-emerald-900/5 border-green-500/20">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <h3 className="font-semibold text-green-400">Privacy Protocol Active</h3>
              </div>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Zero wallet address disclosure</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Multi-hop stealth routing network</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Cryptographic graph obfuscation</span>
                </li>
              </ul>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/10 to-violet-900/5 border-purple-500/20">
            <div className="p-5">
              <h3 className="font-semibold text-purple-400 mb-3">Network Statistics</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">24h Activity</span>
                  <span className="font-semibold text-white">{statsLoading ? '...' : `${stats?.last24hActivity ?? 0} tx`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Volume</span>
                  <span className="font-semibold text-white">${statsLoading ? '...' : (stats?.totalVolumeUsd ?? '0.00')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Network Health</span>
                  <span className="font-semibold text-green-400">{statsLoading ? '...' : `${stats?.networkHealth ?? 100}%`}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
