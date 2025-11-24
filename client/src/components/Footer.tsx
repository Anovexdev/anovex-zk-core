import { Github, Send } from "lucide-react";
import { RiTwitterXFill } from "react-icons/ri";
import anovexLogo from "@assets/anovex-logo.png";

const FOOTER_LINKS = {
  anovex: {
    title: "Anovex",
    links: [
      { label: "About", href: "/about" },
      { label: "How It Works", href: "/guide" },
      { label: "Security", href: "/security" },
      { label: "FAQ", href: "https://docs.anovex.io#faq", external: true },
    ],
  },
  product: {
    title: "Product",
    links: [
      { label: "Launch App", href: "https://trade.anovex.io", external: true },
      { label: "Telegram Bot", href: "/bot" },
      { label: "Documentation", href: "https://docs.anovex.io", external: true },
      { label: "API", href: "/api" },
    ],
  },
  connect: {
    title: "Connect",
    links: [
      { label: "X (Twitter)", href: "https://x.com/anovexofficial", external: true },
      { label: "Telegram", href: "https://t.me/anovexbot", external: true },
      { label: "GitHub", href: "https://github.com/anovexdev", external: true },
    ],
  },
};

export function Footer() {
  return (
    <footer className="relative border-t border-purple-1/10 py-12 md:py-16 px-6 lg:px-8" role="contentinfo">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img 
                src={anovexLogo} 
                alt="Anovex Logo" 
                className="w-10 h-10 rounded-md glow-primary"
              />
              <span className="text-white font-semibold text-lg">Anovex</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The world's first truly untrackable decentralized exchange.
            </p>
            <div className="flex gap-4">
              <a
                href="https://x.com/anovexofficial"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate"
                aria-label="X (Twitter)"
                data-testid="social-twitter"
              >
                <RiTwitterXFill className="w-4 h-4 text-muted-foreground" />
              </a>
              <a
                href="https://t.me/anovexbot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate"
                aria-label="Telegram Bot"
                data-testid="social-telegram"
              >
                <Send className="w-4 h-4 text-muted-foreground" />
              </a>
              <a
                href="https://github.com/anovexdev"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md glassmorphism flex items-center justify-center hover-elevate"
                aria-label="GitHub"
                data-testid="social-github"
              >
                <Github className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([key, section]) => (
            <div key={key} className="space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      {...('external' in link && link.external && {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      })}
                      data-testid={`footer-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-purple-1/10">
          <p className="text-sm text-muted-foreground text-center">
            © 2025 Anovex — Built for invisible traders.
          </p>
        </div>
      </div>
    </footer>
  );
}
