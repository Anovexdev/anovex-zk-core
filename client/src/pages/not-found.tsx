import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-purple-900/10 pointer-events-none" />
      
      <Card className="w-full max-w-md mx-4 bg-zinc-900/50 border-purple-500/20 backdrop-blur-xl relative">
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-purple-400" />
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">404</h1>
              <p className="text-xl font-semibold text-gray-300 mb-3">Page Not Found</p>
              <p className="text-sm text-gray-400 max-w-sm">
                The page you're looking for doesn't exist or has been moved. Please check the URL or return to the homepage.
              </p>
            </div>

            <Link href="/">
              <Button 
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-home"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
