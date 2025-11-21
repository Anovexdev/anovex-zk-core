import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import Landing from "@/pages/Landing";
import Links from "@/pages/Links";
import About from "@/pages/About";
import Guide from "@/pages/Guide";
import Security from "@/pages/Security";
import Bot from "@/pages/Bot";
import Api from "@/pages/Api";
import CreateWallet from "@/pages/CreateWallet";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Deposit from "@/pages/Deposit";
import Swap from "@/pages/Swap";
import Portfolio from "@/pages/Portfolio";
import Withdraw from "@/pages/Withdraw";
import Explorer from "@/pages/Explorer";
import ExplorerHome from "@/pages/ExplorerHome";
import TransactionDetail from "@/pages/TransactionDetail";
import WalletHistory from "@/pages/WalletHistory";
import Settings from "@/pages/Settings";
import Documentation from "./pages/Documentation";
import Points from "@/pages/Points";
import NotFound from "@/pages/not-found";
import {
  isOnExplorerDomain,
  shouldUsePathBasedExplorer,
  isTradeDomain,
  isDocsDomain,
  isPointsDomain,
  validateDomainConfig
} from "./config/domains";

function TradeRoot() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    console.log('[TradeRoot] Checking authentication...');
    // Check authentication and redirect accordingly
    fetch('/api/wallet/balance', { credentials: 'include' })
      .then(res => {
        console.log('[TradeRoot] Auth check response:', res.status, res.ok);
        if (res.ok) {
          console.log('[TradeRoot] Authenticated - redirecting to /dashboard');
          setLocation('/dashboard');
        } else {
          console.log('[TradeRoot] Not authenticated - redirecting to /login');
          setLocation('/login');
        }
      })
      .catch(err => {
        console.log('[TradeRoot] Auth check error:', err);
        setLocation('/login');
      });
  }, [setLocation]);
  
  // Show loading while checking auth
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-purple-400">Loading...</div>
    </div>
  );
}

function SubdomainRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    const hostname = window.location.hostname;
    const currentPath = window.location.pathname;
    
    // Redirect docs domain root to /documentation
    if (isDocsDomain(hostname, currentPath) && currentPath === '/') {
      setLocation('/documentation');
    }
    
    // Explorer is handled by direct routing, no redirect needed
  }, [setLocation]);
  
  return null;
}

function Router() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  // Use domain configuration module for env-aware routing
  const isTrade = isTradeDomain(hostname, pathname);
  const isDocs = isDocsDomain(hostname, pathname);
  const isPoints = isPointsDomain(hostname, pathname);
  const isExplorerDomain = isOnExplorerDomain(hostname);
  
  // Main domain routes (when not on trade/docs/points/explorer domains)
  const isMain = !isTrade && !isDocs && !isPoints && !isExplorerDomain;
  
  return (
    <>
      <SubdomainRedirect />
      <Switch>
        {/* Main domain routes */}
        {isMain && <Route path="/" component={Landing} />}
        {isMain && <Route path="/about" component={About} />}
        {isMain && <Route path="/guide" component={Guide} />}
        {isMain && <Route path="/security" component={Security} />}
        {isMain && <Route path="/bot" component={Bot} />}
        {isMain && <Route path="/api" component={Api} />}
        {isTrade && <Route path="/" component={TradeRoot} />}
        {isDocs && <Route path="/" component={Documentation} />}
        {isPoints && <Route path="/" component={Points} />}
        
        {/* Explorer routes - EXACTLY ONE SET based on domain */}
        {isExplorerDomain ? (
          /* Domain-based routing (anvscan.com): Routes at root */
          <>
            <Route path="/" component={ExplorerHome} />
            <Route path="/tx/:hash" component={TransactionDetail} />
            <Route path="/wallet/:anvAddress" component={WalletHistory} />
          </>
        ) : (
          /* Path-based routing (main/trade/docs domains): Routes under /explorer prefix */
          <>
            <Route path="/explorer" component={ExplorerHome} />
            <Route path="/explorer/tx/:hash" component={TransactionDetail} />
            <Route path="/explorer/wallet/:anvAddress" component={WalletHistory} />
          </>
        )}
        
        {/* Trade app routes - ONLY accessible from trade.anovex.io subdomain */}
        {isTrade && (
          <>
            <Route path="/create" component={CreateWallet} />
            <Route path="/login" component={Login} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/deposit" component={Deposit} />
            <Route path="/swap" component={Swap} />
            <Route path="/portfolio" component={Portfolio} />
            <Route path="/withdraw" component={Withdraw} />
            <Route path="/settings" component={Settings} />
          </>
        )}
        
        {/* Documentation route - accessible from main domain and trade domain for convenience */}
        {!isExplorerDomain && <Route path="/documentation" component={Documentation} />}
        
        {/* Links page - available on all domains */}
        <Route path="/links" component={Links} />
        
        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  // Validate domain configuration on app startup
  useEffect(() => {
    validateDomainConfig();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
