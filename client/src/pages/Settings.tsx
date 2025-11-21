import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Key, 
  PlusCircle, 
  Download, 
  Wallet, 
  LogOut,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";

interface WalletInfo {
  id: string;
  walletAddress: string;
  isActive: boolean;
  walletName: string | null;
  createdAt: string;
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Export Private Key states
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [acceptedRisks, setAcceptedRisks] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  
  // Import Wallet states
  const [importKey, setImportKey] = useState("");
  
  // Fetch all wallets
  const { data: walletsData, isLoading } = useQuery<{ success: boolean; wallets: WalletInfo[] }>({
    queryKey: ['/api/wallet/list'],
  });

  const wallets = walletsData?.wallets || [];
  const activeWallet = wallets.find(w => w.isActive);

  // Export Private Key mutation
  const exportKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('GET', '/api/wallet/export-key');
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setRevealedKey(data.privateKey);
        setShowExportWarning(false);
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
          setRevealedKey(null);
          setKeyVisible(false);
          setAcceptedRisks(false);
        }, 30000);
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export private key",
      });
    }
  });

  // Create New Wallet mutation
  const createWalletMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/wallet/create');
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/wallet/list'] });
        toast({
          title: "Success",
          description: "New wallet created successfully",
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create wallet",
      });
    }
  });

  // Import Wallet mutation
  const importWalletMutation = useMutation({
    mutationFn: async (privateKey: string) => {
      const res = await apiRequest('POST', '/api/wallet/import', { privateKey });
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/wallet/list'] });
        setImportKey("");
        toast({
          title: "Success",
          description: "Wallet imported successfully",
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to import wallet. Check your private key format.",
      });
    }
  });

  // Switch Wallet mutation
  const switchWalletMutation = useMutation({
    mutationFn: async (walletId: string) => {
      const res = await apiRequest('POST', '/api/wallet/switch', { walletId });
      const data = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
      toast({
        title: "Success",
        description: "Active wallet switched",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to switch wallet",
      });
    }
  });

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/wallet/logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
      
      if (response.ok) {
        queryClient.clear();
        setLocation('/login');
        toast({
          title: "Success",
          description: "Logged out successfully",
        });
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout. Please try again.",
      });
    }
  };

  const copyPrivateKey = () => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Private key copied to clipboard",
      });
    }
  };

  const shortenAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white glow-text">Settings</h1>
          <p className="text-gray-400 mt-2">Manage your wallets and security settings</p>
        </div>

        {/* Wallet Management Section */}
        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-wallet-management">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              Wallet Management
            </CardTitle>
            <CardDescription className="text-gray-400">
              Secure access to your private keys and wallet creation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export Private Key */}
            <div className="space-y-3">
              <Label className="text-white text-sm font-semibold">Export Private Key</Label>
              {!revealedKey ? (
                <div className="space-y-3">
                  {!showExportWarning ? (
                    <Button
                      variant="outline"
                      className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-950/20"
                      onClick={() => setShowExportWarning(true)}
                      data-testid="button-export-key"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Export Active Wallet Private Key
                    </Button>
                  ) : (
                    <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-lg space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2 text-sm text-gray-300">
                          <p className="font-semibold text-red-400">WARNING: Extreme Security Risk</p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>Anyone with your private key can steal ALL your funds</li>
                            <li>Never share this key with anyone, including Anovex support</li>
                            <li>Make sure you're in a private location</li>
                            <li>Key will auto-hide after 30 seconds</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="accept-risks"
                          checked={acceptedRisks}
                          onCheckedChange={(checked) => setAcceptedRisks(checked as boolean)}
                          data-testid="checkbox-accept-risks"
                        />
                        <Label htmlFor="accept-risks" className="text-white text-sm cursor-pointer">
                          I understand the risks and have secured my location
                        </Label>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          disabled={!acceptedRisks || exportKeyMutation.isPending}
                          onClick={() => exportKeyMutation.mutate()}
                          className="flex-1"
                          data-testid="button-reveal-key"
                        >
                          {exportKeyMutation.isPending ? "Loading..." : "Reveal Private Key"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowExportWarning(false);
                            setAcceptedRisks(false);
                          }}
                          data-testid="button-cancel-export"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Private key revealed (auto-hiding in 30s)</span>
                  </div>
                  
                  <div className="relative">
                    <div className={`p-3 bg-black/50 border border-purple-500/20 rounded-lg font-mono text-sm ${keyVisible ? "text-purple-300" : "blur-sm select-none"}`}>
                      {revealedKey}
                    </div>
                    {!keyVisible && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button
                          size="sm"
                          onClick={() => setKeyVisible(true)}
                          data-testid="button-show-key"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Show Key
                        </Button>
                      </div>
                    )}
                  </div>

                  {keyVisible && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyPrivateKey}
                        className="flex-1"
                        data-testid="button-copy-key"
                      >
                        {keyCopied ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy to Clipboard
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setKeyVisible(false)}
                        data-testid="button-hide-key"
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        Hide
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Create New Wallet */}
            <div className="space-y-2 pt-4 border-t border-purple-500/20">
              <Label className="text-white text-sm font-semibold">Create New Wallet</Label>
              <Button
                variant="outline"
                className="w-full border-green-500/30 text-green-400 hover:bg-green-950/20"
                onClick={() => createWalletMutation.mutate()}
                disabled={createWalletMutation.isPending}
                data-testid="button-create-wallet"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                {createWalletMutation.isPending ? "Creating..." : "Generate New Wallet"}
              </Button>
            </div>

            {/* Import Wallet */}
            <div className="space-y-2 pt-4 border-t border-purple-500/20">
              <Label className="text-white text-sm font-semibold">Import Existing Wallet</Label>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Paste private key as JSON array [64,23,145,...]"
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  className="bg-black/50 border-purple-500/20 text-white"
                  data-testid="input-import-key"
                />
                <Button
                  variant="outline"
                  className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-950/20"
                  onClick={() => importWalletMutation.mutate(importKey)}
                  disabled={!importKey || importWalletMutation.isPending}
                  data-testid="button-import-wallet"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {importWalletMutation.isPending ? "Importing..." : "Import Wallet"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Wallets Section */}
        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-active-wallets">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-400" />
              Active Wallets ({wallets.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              Switch between your wallets - only one can be active at a time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-gray-400">Loading wallets...</div>
            ) : wallets.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No wallets found</div>
            ) : (
              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className={`p-4 rounded-lg border transition-all ${
                      wallet.isActive
                        ? "bg-purple-950/30 border-purple-500/50"
                        : "bg-black/30 border-purple-500/20 hover-elevate cursor-pointer"
                    }`}
                    onClick={() => !wallet.isActive && switchWalletMutation.mutate(wallet.id)}
                    data-testid={`wallet-${wallet.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${wallet.isActive ? "bg-green-400" : "bg-gray-600"}`} />
                        <div>
                          <code className="text-sm text-purple-300 font-mono">
                            {shortenAddress(wallet.walletAddress)}
                          </code>
                          <p className="text-xs text-gray-500 mt-1">
                            Created {new Date(wallet.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {wallet.isActive && (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card className="border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-account">
          <CardHeader>
            <CardTitle className="text-white">Account</CardTitle>
            <CardDescription className="text-gray-400">
              Session and account management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full border-red-500/30 text-red-400 hover:bg-red-950/20"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
