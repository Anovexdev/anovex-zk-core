import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import anovexLogo from "@assets/file_00000000967071fa82ee6d0e14c9e5cc_1763224947806.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if already authenticated on mount
  useEffect(() => {
    fetch('/api/wallet/balance', { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          // Already authenticated, redirect to dashboard
          setLocation('/dashboard');
        } else {
          // Not authenticated, stay on login page
          setIsCheckingAuth(false);
        }
      })
      .catch(() => {
        // Error checking auth, stay on login page
        setIsCheckingAuth(false);
      });
  }, [setLocation]);

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400">Checking authentication...</div>
      </div>
    );
  }

  const handleLogin = async () => {
    setIsLoading(true);
    
    try {
      // Parse private key from input
      let privateKey: number[];
      
      try {
        privateKey = JSON.parse(privateKeyInput);
        
        if (!Array.isArray(privateKey) || privateKey.length !== 64) {
          throw new Error("Invalid format");
        }
      } catch {
        toast({
          title: "Invalid Private Key",
          description: "Please paste a valid 64-byte array in JSON format",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Login request (MUST include credentials for session cookie!)
      const response = await fetch('/api/wallet/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey }),
        credentials: 'include', // CRITICAL: Required to save/send session cookies!
      });

      if (!response.ok) {
        throw new Error('Invalid private key');
      }

      const data = await response.json();
      
      // Redirect to dashboard without toast (silent login)
      setLocation('/dashboard');
      
    } catch (error: any) {
      toast({
        title: "Authentication Failed",
        description: error.message || "Invalid private key",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      {/* Ambient purple glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-purple-900/10 pointer-events-none" />
      
      <Card className="relative w-full max-w-md border-purple-500/20 bg-black/80 backdrop-blur-xl" data-testid="card-login">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={anovexLogo} 
              alt="Anovex Logo" 
              className="w-20 h-20 object-contain"
              data-testid="img-anovex-logo"
            />
          </div>
          <CardTitle className="text-3xl text-white">Access Stealth Vault</CardTitle>
          <CardDescription className="text-gray-400">
            Enter your private key to unlock your anonymous wallet
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-mono">
              PRIVATE KEY (64-BYTE ARRAY)
            </label>
            <Textarea
              value={privateKeyInput}
              onChange={(e) => setPrivateKeyInput(e.target.value)}
              placeholder='[174, 47, 154, 16, 202, 193, ...]'
              className="min-h-[120px] font-mono text-xs bg-black/50 border-purple-500/30 focus:border-purple-500 text-white"
              data-testid="input-private-key"
            />
            <p className="text-xs text-gray-500">
              Paste the 64-byte array you saved when creating your wallet
            </p>
          </div>

          <Button
            onClick={handleLogin}
            disabled={isLoading || !privateKeyInput.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
            size="lg"
            data-testid="button-login"
          >
            {isLoading ? "Authenticating..." : "Unlock Wallet"}
          </Button>

          {/* Security Note */}
          <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
            <p className="text-xs text-gray-400 text-center">
              <Shield className="w-3 h-3 inline mr-1" />
              Your private key never leaves your device. All transactions are anonymous.
            </p>
          </div>
        </CardContent>

        <CardFooter className="justify-center">
          <Button
            variant="ghost"
            onClick={() => setLocation('/create')}
            className="text-purple-400 hover:text-purple-300"
            data-testid="link-create-wallet"
          >
            Don't have a wallet? Create one
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
