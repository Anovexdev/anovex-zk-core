import { shouldUsePathBasedExplorer } from "@/config/domains";

/**
 * Hook for generating correct explorer paths in both domain-based and path-based routing modes.
 * 
 * Usage:
 * - Domain-based (anvscan.com): Returns "/" for home, "/tx/:hash" for detail
 * - Path-based (/explorer): Returns "/explorer" for home, "/explorer/tx/:hash" for detail
 * 
 * Path mode is determined by hostname only (not current pathname) to ensure correct
 * link generation regardless of current location.
 */

export function useExplorerPaths() {
  const hostname = window.location.hostname;
  
  // Determine if we should use path-based routing based on hostname only
  const isPathBased = shouldUsePathBasedExplorer(hostname);
  const prefix = isPathBased ? '/explorer' : '';
  
  return {
    home: prefix || '/',
    transaction: (hash: string) => `${prefix}/tx/${hash}`,
    wallet: (anvAddress: string) => `${prefix}/wallet/${anvAddress}`,
    isPathBased,
  };
}

/**
 * Standalone helper function for generating explorer paths (non-hook version).
 * Use this when you can't use hooks (e.g., in event handlers).
 */
export function getExplorerPath(path: string): string {
  const hostname = window.location.hostname;
  
  const isPathBased = shouldUsePathBasedExplorer(hostname);
  const prefix = isPathBased ? '/explorer' : '';
  
  // If path already has prefix, don't add it again
  if (path.startsWith(prefix)) return path;
  
  // Handle root path
  if (path === '/') return prefix || '/';
  
  // Add prefix to path
  return `${prefix}${path}`;
}
