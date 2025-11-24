import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Coins, TrendingUp, Sparkles, Calculator, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RewardsData {
  anvTokenBalance: string;
  tradingVolumeUsd: string;
  holdingMultiplier: string;
  volumeMultiplier: string;
  totalPanvEarned: string;
  calculatedAt: string;
}

export default function Points() {
  const [solAddress, setSolAddress] = useState("");
  const [anvWalletAddress, setAnvWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rewardsData, setRewardsData] = useState<RewardsData | null>(null);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const originalTitle = document.title;
    document.title = "pANV Rewards - Anovex Trading Volume Points System";
    
    const createdTags: HTMLMetaElement[] = [];
    const createdLinks: HTMLLinkElement[] = [];
    const modifiedTags: Array<{ element: Element; property: string; originalContent: string }> = [];
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const originalMetaDescription = metaDescription?.getAttribute('content') || '';
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Earn pANV rewards points by holding 1M+ ANV tokens and trading on Anovex. Get up to 3x multiplier based on your holdings and trading volume.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Earn pANV rewards points by holding 1M+ ANV tokens and trading on Anovex. Get up to 3x multiplier based on your holdings and trading volume.';
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
    
    setOrCreateMetaTag('og:title', 'pANV Rewards - Anovex Points System');
    setOrCreateMetaTag('og:description', 'Earn pANV rewards points by holding 1M+ ANV tokens and trading on Anovex. Get up to 3x multiplier based on your holdings and trading volume.');
    setOrCreateMetaTag('og:type', 'website');
    setOrCreateMetaTag('og:url', 'https://points.anovex.io');
    
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
    
    const modifiedLinks: Array<{ element: HTMLLinkElement; originalHref: string }> = [];
    
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

  const handleCalculate = async () => {
    if (!solAddress || !anvWalletAddress) {
      toast({
        title: "Missing Information",
        description: "Please provide both SOL address and ANV wallet address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const response = await apiRequest("POST", "/api/panv/calculate-rewards", {
        solAddress,
        anvWalletAddress
      });

      const result = await response.json();

      if (result.success) {
        if (result.eligible) {
          setRewardsData(result.data);
          setIsEligible(true);
          toast({
            title: "Rewards Calculated!",
            description: `You've earned ${parseFloat(result.data.totalPanvEarned).toFixed(2)} pANV`
          });
        } else {
          setIsEligible(false);
          setErrorMessage(result.message || "Not eligible for pANV rewards");
        }
      } else {
        throw new Error(result.error || "Failed to calculate rewards");
      }
    } catch (error: any) {
      toast({
        title: "Calculation Failed",
        description: error.message || "Unable to calculate rewards",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-auto">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(168, 85, 247, 0.03) 1px, transparent 0)`,
          backgroundSize: '50px 50px',
        }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Content */}
      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glassmorphism border border-purple-500/30 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Rewards Program</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold glow-text mb-4">
            pANV Rewards
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Hold 1M+ ANV tokens to earn pANV points based on your trading volume and holdings. Higher volume and holdings unlock multiplier bonuses.
          </p>
        </div>

        {/* Calculator Card */}
        <Card className="glassmorphism glow-purple border-purple-500/30 mb-8" data-testid="card-rewards-calculator">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calculator className="w-6 h-6 text-purple-400" />
              Calculate Your Rewards
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Link your SOL address holding ANV tokens to your ANV wallet to calculate rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="solAddress" className="text-sm font-medium mb-2 block">
                  SOL Address (Holding ANV Tokens)
                </Label>
                <Input
                  id="solAddress"
                  placeholder="Enter your Solana wallet address..."
                  value={solAddress}
                  onChange={(e) => setSolAddress(e.target.value)}
                  className="glassmorphism border-purple-500/30 focus:border-purple-500/50"
                  data-testid="input-sol-address"
                />
              </div>

              <div>
                <Label htmlFor="anvWallet" className="text-sm font-medium mb-2 block">
                  ANV Wallet Address
                </Label>
                <Input
                  id="anvWallet"
                  placeholder="Enter your ANV wallet address (ANV...)..."
                  value={anvWalletAddress}
                  onChange={(e) => setAnvWalletAddress(e.target.value)}
                  className="glassmorphism border-purple-500/30 focus:border-purple-500/50"
                  data-testid="input-anv-wallet"
                />
              </div>
            </div>

            <Button
              onClick={handleCalculate}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 glow-primary"
              size="lg"
              data-testid="button-calculate-rewards"
            >
              {isLoading ? "Calculating..." : "Calculate Rewards"}
              <Sparkles className="ml-2 w-5 h-5" />
            </Button>
          </CardContent>
        </Card>

        {/* Error Message */}
        {errorMessage && isEligible === false && (
          <Card className="glassmorphism border-red-500/30 mb-8" data-testid="card-error-message">
            <CardContent className="pt-6">
              <p className="text-red-400 text-center">{errorMessage}</p>
              <p className="text-muted-foreground text-center text-sm mt-2">
                You need to hold at least 1,000,000 ANV tokens to qualify for rewards.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Rewards Display */}
        {rewardsData && isEligible && (
          <div className="space-y-6">
            {/* Total pANV Earned */}
            <Card className="glassmorphism glow-purple border-purple-500/40" data-testid="card-total-panv">
              <CardContent className="pt-8 pb-8">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">Total pANV Earned</p>
                  <h2 className="text-6xl font-bold glow-text mb-2">
                    {parseFloat(rewardsData.totalPanvEarned).toFixed(2)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Calculated at {new Date(rewardsData.calculatedAt).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* ANV Holdings */}
              <Card className="glassmorphism border-purple-500/30" data-testid="card-anv-holdings">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="w-5 h-5 text-purple-400" />
                    ANV Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white mb-2">
                    {parseFloat(rewardsData.anvTokenBalance).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">ANV Tokens</p>
                </CardContent>
              </Card>

              {/* Trading Volume */}
              <Card className="glassmorphism border-purple-500/30" data-testid="card-trading-volume">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    Trading Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white mb-2">
                    ${parseFloat(rewardsData.tradingVolumeUsd).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Total USD Volume</p>
                </CardContent>
              </Card>
            </div>

            {/* Multipliers */}
            <Card className="glassmorphism border-purple-500/30" data-testid="card-multipliers">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-purple-400" />
                  Reward Multipliers
                </CardTitle>
                <CardDescription>
                  Your rewards are multiplied based on holdings and volume
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Holding Multiplier */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Holding Multiplier</span>
                    <span className="text-lg font-bold text-purple-400">{rewardsData.holdingMultiplier}x</span>
                  </div>
                  <div className="w-full bg-purple-900/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-purple-500 h-full rounded-full"
                      style={{ width: `${(parseFloat(rewardsData.holdingMultiplier) / 2) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {parseFloat(rewardsData.holdingMultiplier) >= 2 ? "Max tier (10M+ ANV)" :
                     parseFloat(rewardsData.holdingMultiplier) >= 1.5 ? "Tier 2 (5M-10M ANV)" :
                     "Tier 1 (1M-5M ANV)"}
                  </p>
                </div>

                {/* Volume Multiplier */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Volume Multiplier</span>
                    <span className="text-lg font-bold text-purple-400">{rewardsData.volumeMultiplier}x</span>
                  </div>
                  <div className="w-full bg-purple-900/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-purple-500 h-full rounded-full"
                      style={{ width: `${(parseFloat(rewardsData.volumeMultiplier) / 1.5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {parseFloat(rewardsData.volumeMultiplier) >= 1.5 ? "Max tier ($50k+ volume)" :
                     parseFloat(rewardsData.volumeMultiplier) >= 1.2 ? "Tier 2 ($10k-$50k volume)" :
                     "Tier 1 ($0-$10k volume)"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Rewards Formula */}
            <Card className="glassmorphism border-purple-500/20" data-testid="card-formula">
              <CardContent className="pt-6">
                <p className="text-center text-sm text-muted-foreground">
                  <span className="font-mono">pANV Earned = Trading Volume × Holding Multiplier × Volume Multiplier</span>
                </p>
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Base rate: $1 trading volume = 1 pANV (before multipliers)
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info Cards */}
        {!rewardsData && (
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <Card className="glassmorphism border-purple-500/20">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Wallet className="w-8 h-8 text-purple-400 mx-auto" />
                  <h3 className="font-semibold">Minimum Holdings</h3>
                  <p className="text-2xl font-bold text-purple-400">1M ANV</p>
                  <p className="text-xs text-muted-foreground">Required to qualify</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism border-purple-500/20">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <TrendingUp className="w-8 h-8 text-purple-400 mx-auto" />
                  <h3 className="font-semibold">Volume Based</h3>
                  <p className="text-2xl font-bold text-purple-400">Up to 1.5x</p>
                  <p className="text-xs text-muted-foreground">Multiplier bonus</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism border-purple-500/20">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Coins className="w-8 h-8 text-purple-400 mx-auto" />
                  <h3 className="font-semibold">Holding Bonus</h3>
                  <p className="text-2xl font-bold text-purple-400">Up to 2x</p>
                  <p className="text-xs text-muted-foreground">For 10M+ ANV</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
