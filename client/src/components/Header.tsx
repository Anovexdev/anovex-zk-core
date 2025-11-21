import { Github, Send } from "lucide-react";
import { RiTwitterXFill } from "react-icons/ri";
import anovexLogo from "@assets/anovex-logo.png";

export function Header() {
  return (
    <header 
      className="md:hidden fixed top-0 left-0 right-0 z-50 glassmorphism animate-fade-in"
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3" data-testid="logo-container">
            <img 
              src={anovexLogo} 
              alt="Anovex Logo" 
              className="w-10 h-10 rounded-md glow-primary"
            />
            <span className="text-white font-semibold text-lg tracking-tight">
              Anovex
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://twitter.com/anovex"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate transition-all"
              aria-label="X (Twitter)"
              data-testid="header-social-x"
            >
              <RiTwitterXFill className="w-4 h-4 text-muted-foreground" />
            </a>
            <a
              href="https://github.com/anovexdev"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate transition-all"
              aria-label="GitHub"
              data-testid="header-social-github"
            >
              <Github className="w-4 h-4 text-muted-foreground" />
            </a>
            <a
              href="https://t.me/anovex"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate transition-all"
              aria-label="Telegram"
              data-testid="header-social-telegram"
            >
              <Send className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
