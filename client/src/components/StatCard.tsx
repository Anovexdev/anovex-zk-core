import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  status?: "online" | "offline" | "active";
  className?: string;
}

export function StatCard({ icon: Icon, title, value, badge, status, className = "" }: StatCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border border-primary/20 
        bg-gradient-to-br from-background/80 via-background/60 to-primary/5
        backdrop-blur-md p-4 md:p-6
        transition-all duration-300
        hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10
        hover:-translate-y-1
        ${className}
      `}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Background gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        {/* Header with icon and badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            {status && (
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-2 w-2 rounded-full animate-pulse ${
                    status === "online" || status === "active"
                      ? "bg-green-500"
                      : "bg-gray-500"
                  }`}
                  data-testid={`status-indicator-${status}`}
                />
                <span className="text-xs text-muted-foreground capitalize">{status}</span>
              </div>
            )}
          </div>
          {badge && (
            <Badge
              variant={badge.variant || "secondary"}
              className="text-xs"
              data-testid={`badge-${badge.text.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {badge.text}
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xs md:text-sm text-muted-foreground mb-1" data-testid="stat-title">
          {title}
        </h3>

        {/* Value */}
        <p
          className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent"
          data-testid="stat-value"
        >
          {value}
        </p>
      </div>
    </div>
  );
}
