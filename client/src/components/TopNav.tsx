import { Link, useLocation } from "wouter";
import anovexLogo from "@assets/anovex-logo.png";

export default function TopNav() {
  const [location] = useLocation();

  const navItems = [
    {
      href: "/dashboard",
      label: "Home",
      active: location === "/dashboard"
    },
    {
      href: "/deposit",
      label: "Deposit",
      active: location === "/deposit"
    },
    {
      href: "/swap",
      label: "Swap",
      active: location === "/swap"
    },
    {
      href: "/portfolio",
      label: "Portfolio",
      active: location === "/portfolio"
    },
    {
      href: "/withdraw",
      label: "Withdraw",
      active: location === "/withdraw"
    },
    {
      href: "/settings",
      label: "Settings",
      active: location === "/settings"
    }
  ];

  return (
    <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 border-b border-purple-500/20 bg-black/80 backdrop-blur-xl">
      {/* Purple glow at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard">
            <button 
              className="flex items-center gap-3 hover-elevate active-elevate-2 px-3 py-2 rounded-lg transition-all"
              data-testid="nav-logo"
            >
              <img 
                src={anovexLogo} 
                alt="Anovex" 
                className="h-8 w-8 rounded-lg glow-primary"
              />
              <span className="text-lg font-semibold text-foreground">
                Anovex
              </span>
            </button>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <button
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`
                    px-4 py-2 rounded-lg transition-all font-medium text-sm
                    ${item.active 
                      ? "text-purple-400 bg-purple-500/10" 
                      : "text-muted-foreground hover:text-foreground hover-elevate"
                    }
                  `}
                >
                  {item.label}
                </button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
