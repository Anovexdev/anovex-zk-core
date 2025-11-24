/**
 * Domain Configuration Module
 * 
 * Centralizes domain routing logic for multi-domain architecture (anovex.io, trade.anovex.io, docs.anovex.io, points.anovex.io, anvscan.com).
 * Supports env-driven configuration for production/staging/preview environments.
 * 
 * Environment Variables (optional):
 * - VITE_MAIN_DOMAIN: Main landing page domain (default: anovex.io)
 * - VITE_TRADE_DOMAIN: Trading app domain (default: trade.anovex.io)
 * - VITE_DOCS_DOMAIN: Documentation domain (default: docs.anovex.io)
 * - VITE_POINTS_DOMAIN: pANV rewards domain (default: points.anovex.io)
 * - VITE_EXPLORER_DOMAIN: Explorer domain (default: anvscan.com)
 */

interface DomainConfig {
  main: string | null;
  trade: string | null;
  docs: string | null;
  points: string | null;
  explorer: string | null;
}

// Read from environment variables with sensible defaults
const config: DomainConfig = {
  main: import.meta.env.VITE_MAIN_DOMAIN || null,
  trade: import.meta.env.VITE_TRADE_DOMAIN || null,
  docs: import.meta.env.VITE_DOCS_DOMAIN || null,
  points: import.meta.env.VITE_POINTS_DOMAIN || null,
  explorer: import.meta.env.VITE_EXPLORER_DOMAIN || null,
};

/**
 * Check if hostname matches a configured domain.
 * Supports exact match and subdomain prefix matching.
 * 
 * @param hostname Current window hostname
 * @param domain Configured domain (can be null)
 * @returns True if hostname matches domain pattern
 */
export function isDomain(hostname: string, domain: string | null): boolean {
  if (!domain) return false;
  
  // Exact match
  if (hostname === domain) return true;
  
  // Subdomain match (e.g., trade.anovex.io matches *.anovex.io pattern)
  if (domain.includes('.')) {
    const domainParts = domain.split('.');
    const hostnameParts = hostname.split('.');
    
    // If domain starts with subdomain pattern, check if hostname matches
    if (domainParts.length >= 2) {
      const baseDomain = domainParts.slice(-2).join('.');
      const hostnameBaseDomain = hostnameParts.slice(-2).join('.');
      
      // Check if they share the same base domain
      if (hostnameBaseDomain === baseDomain) {
        // Check subdomain prefix
        const expectedSubdomain = domainParts[0];
        const actualSubdomain = hostnameParts[0];
        return actualSubdomain === expectedSubdomain || expectedSubdomain === '*';
      }
    }
  }
  
  return false;
}

/**
 * Check if hostname matches any of the provided domain patterns.
 * 
 * @param hostname Current window hostname
 * @param patterns Array of domain patterns
 * @returns True if hostname matches any pattern
 */
export function matchesAny(hostname: string, patterns: (string | null)[]): boolean {
  return patterns.some(pattern => isDomain(hostname, pattern));
}

/**
 * Check if current environment is the explorer domain (hostname-only check).
 * This determines if explorer routes should be at root (true) or under /explorer prefix (false).
 */
export function isOnExplorerDomain(hostname: string): boolean {
  // Hardcoded fallbacks for known production domains
  if (hostname === 'anvscan.com') return true;
  if (hostname.includes('anvscan')) return true;
  
  // Env-configured domain check
  if (config.explorer && isDomain(hostname, config.explorer)) return true;
  
  return false;
}

/**
 * Check if current environment should use path-based explorer routing.
 * Path-based means explorer is accessible via /explorer/* paths (not at root).
 */
export function shouldUsePathBasedExplorer(hostname: string): boolean {
  return !isOnExplorerDomain(hostname);
}

/**
 * Check if current environment is the trade domain.
 * Falls back to subdomain pattern matching if domain not configured.
 */
export function isTradeDomain(hostname: string, pathname: string): boolean {
  // Subdomain pattern match (trade.*)
  if (hostname.startsWith('trade.')) return true;
  
  // Env-configured domain check
  if (config.trade && isDomain(hostname, config.trade)) return true;
  
  // Path-based fallback
  if (pathname.startsWith('/trade')) return true;
  
  return false;
}

/**
 * Check if current environment is the docs domain.
 * Falls back to subdomain pattern matching if domain not configured.
 */
export function isDocsDomain(hostname: string, pathname: string): boolean {
  // Subdomain pattern match (docs.*)
  if (hostname.startsWith('docs.')) return true;
  
  // Env-configured domain check
  if (config.docs && isDomain(hostname, config.docs)) return true;
  
  // Path-based fallback
  if (pathname.startsWith('/docs') || pathname.startsWith('/documentation')) return true;
  
  return false;
}

/**
 * Check if current environment is the points domain.
 * Falls back to subdomain pattern matching if domain not configured.
 */
export function isPointsDomain(hostname: string, pathname: string): boolean {
  // Subdomain pattern match (points.*)
  if (hostname.startsWith('points.')) return true;
  
  // Env-configured domain check
  if (config.points && isDomain(hostname, config.points)) return true;
  
  // Path-based fallback
  if (pathname.startsWith('/points')) return true;
  
  return false;
}

/**
 * Check if current environment is the main domain.
 */
export function isMainDomain(hostname: string, pathname: string): boolean {
  return !isTradeDomain(hostname, pathname) && 
         !isDocsDomain(hostname, pathname) && 
         !isPointsDomain(hostname, pathname) &&
         !isOnExplorerDomain(hostname);
}

/**
 * Validate domain configuration on app startup.
 * Logs warnings for missing configuration but doesn't block app.
 */
export function validateDomainConfig(): void {
  const missingDomains: string[] = [];
  
  if (!config.main) missingDomains.push('VITE_MAIN_DOMAIN');
  if (!config.trade) missingDomains.push('VITE_TRADE_DOMAIN');
  if (!config.docs) missingDomains.push('VITE_DOCS_DOMAIN');
  if (!config.points) missingDomains.push('VITE_POINTS_DOMAIN');
  if (!config.explorer) missingDomains.push('VITE_EXPLORER_DOMAIN');
  
  if (missingDomains.length > 0) {
    console.warn(
      '[Domain Config] Optional environment variables not set:',
      missingDomains.join(', '),
      '- Using fallback pattern matching'
    );
  }
}

export default config;
