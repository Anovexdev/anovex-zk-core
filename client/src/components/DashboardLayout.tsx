import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import TopNav from "./TopNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-black">
      {/* Ambient purple glow background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-purple-900/10 pointer-events-none" />
      
      {/* Top navigation (desktop only) */}
      <TopNav />
      
      {/* Main content with padding for nav bars */}
      <main className="relative pb-20 md:pb-6 md:pt-16">
        {children}
      </main>
      
      {/* Bottom navigation (mobile only) */}
      <BottomNav />
    </div>
  );
}
