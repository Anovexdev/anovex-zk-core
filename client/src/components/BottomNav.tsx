import { Link, useLocation } from "wouter";
import { Home, ArrowDownToLine, Repeat, TrendingUp, Send, Settings } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    {
      href: "/dashboard",
      label: "Home",
      icon: Home,
      active: location === "/dashboard"
    },
    {
      href: "/deposit",
      label: "Deposit",
      icon: ArrowDownToLine,
      active: location === "/deposit"
    },
    {
      href: "/swap",
      label: "Swap",
      icon: Repeat,
      active: location === "/swap"
    },
    {
      href: "/portfolio",
      label: "Portfolio",
      icon: TrendingUp,
      active: location === "/portfolio"
    },
    {
      href: "/withdraw",
      label: "Withdraw",
      icon: Send,
      active: location === "/withdraw"
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      active: location === "/settings"
    }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-purple-500/20 bg-black/95 backdrop-blur-xl">
      {/* Purple glow at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-1">
        <div className="flex items-center justify-around py-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`
                    flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg transition-all min-w-0
                    ${item.active 
                      ? "text-purple-400 bg-purple-500/10" 
                      : "text-gray-400 hover:text-purple-300 hover-elevate"
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${item.active ? "glow-icon" : ""}`} />
                  <span className="text-[10px] font-medium truncate max-w-[60px] text-center">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
