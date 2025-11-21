import { useEffect } from "react";
import { ExternalLink, Github, Send, Globe, FileText, ShieldCheck, Coins, Search, Gift, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import anovexLogo from "@assets/anovex-logo.png";

type LinkItem = {
  title: string;
  description: string;
  url: string;
  icon: LucideIcon;
  highlight?: boolean;
  comingSoon?: boolean;
};

type LinkSection = {
  category: string;
  items: LinkItem[];
};

export default function Links() {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = "Anovex Links - Privacy-Focused Decentralized Trading Platform";
    
    const createdTags: HTMLMetaElement[] = [];
    const modifiedTags: Array<{ element: Element; property: string; originalContent: string }> = [];
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const originalMetaDescription = metaDescription?.getAttribute('content') || '';
    if (metaDescription) {
      metaDescription.setAttribute('content', 'All important links to access Anovex - the privacy-focused decentralized trading platform. Trade on-chain while staying off the radar.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'All important links to access Anovex - the privacy-focused decentralized trading platform. Trade on-chain while staying off the radar.';
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
    
    setOrCreateMetaTag('og:title', 'Anovex Links - Privacy-Focused Trading Platform');
    setOrCreateMetaTag('og:description', 'All important links to access Anovex - the privacy-focused decentralized trading platform. Trade on-chain while staying off the radar.');
    setOrCreateMetaTag('og:type', 'website');
    setOrCreateMetaTag('og:url', 'https://anovex.io/links');
    
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
    
    return () => {
      document.title = originalTitle;
      
      if (metaDescription) {
        metaDescription.setAttribute('content', originalMetaDescription);
      }
      
      modifiedTags.forEach(({ element, originalContent }) => {
        element.setAttribute('content', originalContent);
      });
      
      createdTags.forEach(tag => tag.remove());
      
      if (twitterCard) {
        twitterCard.setAttribute('content', originalTwitterCard);
      }
    };
  }, []);
  const links: LinkSection[] = [
    {
      category: "Platform",
      items: [
        {
          title: "Main Site",
          description: "Official Anovex homepage",
          url: "https://anovex.io",
          icon: Globe,
        },
        {
          title: "Trading Interface",
          description: "Start trading with privacy",
          url: "https://trade.anovex.io",
          icon: ShieldCheck,
          highlight: true,
        },
        {
          title: "Documentation",
          description: "Learn how Anovex works",
          url: "https://docs.anovex.io",
          icon: FileText,
        },
        {
          title: "Telegram Bot",
          description: "@AnovexBot",
          url: "https://t.me/AnovexBot",
          icon: Send,
        },
      ],
    },
    {
      category: "Token",
      items: [
        {
          title: "Buy $ANV Token",
          description: "Get $ANV on Pump.fun",
          url: "https://pump.fun",
          icon: Coins,
        },
        {
          title: "Solscan",
          description: "View on Solscan",
          url: "https://solscan.io",
          icon: Search,
        },
        {
          title: "Earn Rewards",
          description: "Collect points",
          url: "https://points.anovex.io",
          icon: Gift,
        },
      ],
    },
    {
      category: "Blockchain",
      items: [
        {
          title: "ANVscan Explorer",
          description: "Blockchain explorer",
          url: "https://anvscan.com",
          icon: ShieldCheck,
        },
      ],
    },
    {
      category: "Community & Developer",
      items: [
        {
          title: "𝕏 (Twitter)",
          description: "@anovexofficial",
          url: "https://x.com/anovexofficial",
          icon: ExternalLink,
        },
        {
          title: "GitHub",
          description: "Open source repositories",
          url: "https://github.com/anovexdev",
          icon: Github,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 container max-w-4xl mx-auto px-4 py-12 md:py-20">
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 mb-6">
              <img 
                src={anovexLogo} 
                alt="Anovex Logo" 
                className="h-16 w-16 md:h-20 md:w-20 rounded-xl glow-primary"
              />
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              Anovex Links
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              All important links to access Anovex's privacy-focused decentralized trading platform
            </p>
          </div>

          <div className="space-y-8">
            {links.map((section) => (
              <div key={section.category}>
                <h2 className="text-xl md:text-2xl font-semibold mb-4 text-foreground/90">
                  {section.category}
                </h2>
                
                <div className="grid gap-4 md:gap-5">
                  {section.items.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Card 
                        key={link.title}
                        className={`group relative transition-all duration-300 hover-elevate ${
                          link.highlight 
                            ? 'border-primary/40 bg-gradient-to-br from-card to-primary/5' 
                            : ''
                        }`}
                        data-testid={`link-card-${link.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-4 p-5 md:p-6 w-full"
                        >
                          <div className={`shrink-0 h-12 w-12 md:h-14 md:w-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                            link.highlight
                              ? 'bg-primary text-primary-foreground group-hover:scale-110'
                              : 'bg-accent text-accent-foreground group-hover:bg-accent/80'
                          }`}>
                            <Icon className="h-5 w-5 md:h-6 md:w-6" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-base md:text-lg text-foreground group-hover:text-primary transition-colors">
                                {link.title}
                              </h3>
                              {link.comingSoon && (
                                <Badge variant="secondary" className="text-xs">
                                  Soon
                                </Badge>
                              )}
                              {link.highlight && (
                                <Badge variant="default" className="text-xs">
                                  Trade Now
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm md:text-base text-muted-foreground truncate">
                              {link.description}
                            </p>
                          </div>
                          
                          <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </a>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 md:mt-16 text-center">
            <Card className="inline-block p-6 md:p-8 bg-gradient-to-br from-card to-primary/5 border-primary/20">
              <p className="text-sm md:text-base text-muted-foreground mb-4">
                Trade on-chain. Stay off the radar.
              </p>
              <Button 
                asChild 
                size="lg"
                className="w-full md:w-auto"
                data-testid="button-start-trading"
              >
                <a href="https://trade.anovex.io" target="_blank" rel="noopener noreferrer">
                  Start Trading
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
