/**
 * useAuth hook - Standalone deployment mode
 *
 * OAuth authentication is disabled for local/self-hosted deployments.
 * This mock implementation allows the app to run without an OAuth server.
 */

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// Mock user for standalone mode
const STANDALONE_USER = {
  id: "local-user",
  name: "Local User",
  email: "local@localhost",
};

export function useAuth(_options?: UseAuthOptions) {
  return {
    user: STANDALONE_USER,
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: () => Promise.resolve(),
    logout: () => {
      console.log("[Auth] Logout called in standalone mode - no-op");
      return Promise.resolve();
    },
  };
}
