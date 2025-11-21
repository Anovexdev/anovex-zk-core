import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, Eye, EyeOff } from "lucide-react";
import anovexLogo from "@assets/file_00000000967071fa82ee6d0e14c9e5cc_1763224947806.png";

export default function CreateWallet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [privateKey, setPrivateKey] = useState<number[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCreateWallet = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to create wallet');
      }

      const data = await response.json();
      setPrivateKey(data.privateKey);
      
      toast({
        title: "Stealth Vault Created",
        description: "Your private key has been generated. Save it securely!",
      });
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = () => {
    if (!privateKey) return;
    navigator.clipboard.writeText(JSON.stringify(privateKey));
    toast({
      title: "Copied",
      description: "Private key copied to clipboard",
    });
  };

  const handleDownloadKey = () => {
    if (!privateKey) return;
    const blob = new Blob([JSON.stringify(privateKey)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anovex-key-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "Private key saved to file",
    });
  };

  const handleConfirmAndLogin = () => {
    if (!confirmed) {
      toast({
        title: "Confirm Security",
        description: "Please confirm you've saved your private key",
        variant: "destructive",
      });
      return;
    }
    // Session already created on backend, go straight to dashboard
    setLocation('/dashboard');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      {/* Ambient purple glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-purple-900/10 pointer-events-none" />
      
      <Card className="relative w-full max-w-md border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-create-wallet">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={anovexLogo} 
              alt="Anovex Logo" 
              className="w-20 h-20 object-contain"
              data-testid="img-anovex-logo"
            />
          </div>
          <CardTitle className="text-3xl text-white">Create Stealth Vault</CardTitle>
          <CardDescription className="text-gray-400">
            {!privateKey 
              ? "Generate your anonymous Anovex wallet"
              : "Save your private key - you won't see this again"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!privateKey ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-400">
                Your private key is the only way to access your wallet.
                <strong className="text-white"> There is no recovery if lost.</strong>
              </p>
              
              <Button 
                onClick={handleCreateWallet}
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
                size="lg"
                data-testid="button-generate-wallet"
              >
                {isCreating ? "Generating..." : "Generate Private Key"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Private Key Display */}
              <div className="bg-black/50 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-mono">PRIVATE KEY (64-BYTE ARRAY)</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyKey}
                      className="h-8 w-8 p-0"
                      data-testid="button-copy-key"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowKey(!showKey)}
                      className="h-8 w-8 p-0"
                      data-testid="button-toggle-visibility"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="font-mono text-xs text-white break-all max-h-32 overflow-y-auto" data-testid="text-private-key">
                  {showKey ? JSON.stringify(privateKey) : "••••••••••••••••••••••••••••••••••••"}
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="flex items-start space-x-3 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-confirm-saved"
                />
                <label className="text-sm text-gray-300 cursor-pointer" onClick={() => setConfirmed(!confirmed)}>
                  I have saved my private key securely. I understand that losing it means permanent loss of access to my wallet.
                </label>
              </div>

              <Button
                onClick={handleConfirmAndLogin}
                disabled={!confirmed}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
                size="lg"
                data-testid="button-proceed-login"
              >
                Proceed to Login
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Button
            variant="ghost"
            onClick={() => setLocation('/login')}
            className="text-purple-400 hover:text-purple-300"
            data-testid="link-login"
          >
            Already have a private key? Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
