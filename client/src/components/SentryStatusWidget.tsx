import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, RefreshCw, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SentryStats {
  totalErrors: number;
  unresolvedErrors: number;
  lastErrorTime: number | null;
  errorRate: number; // errors per hour
  status: "healthy" | "warning" | "critical";
}

/**
 * Sentry Status Widget
 * Displays error monitoring stats from Sentry
 */
export function SentryStatusWidget() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fetch Sentry stats from backend
  const { data: stats, refetch, isLoading } = trpc.debug.getSentryStats.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "warning":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "warning":
      case "critical":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const formatLastError = (timestamp: number | null) => {
    if (!timestamp) return "No errors recorded";
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Error Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayStats: SentryStats = stats || {
    totalErrors: 0,
    unresolvedErrors: 0,
    lastErrorTime: null,
    errorRate: 0,
    status: "healthy",
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {getStatusIcon(displayStats.status)}
            <span>Error Monitoring</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={getStatusColor(displayStats.status)}
            >
              {displayStats.status.toUpperCase()}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/30 rounded p-2 border border-border">
            <div className="text-muted-foreground">Unresolved</div>
            <div className="text-lg font-mono text-primary">
              {displayStats.unresolvedErrors}
            </div>
          </div>
          <div className="bg-black/30 rounded p-2 border border-border">
            <div className="text-muted-foreground">Total (24h)</div>
            <div className="text-lg font-mono text-secondary">
              {displayStats.totalErrors}
            </div>
          </div>
        </div>

        {/* Error Rate */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Error Rate</span>
          <span className="font-mono">
            {displayStats.errorRate.toFixed(2)}/hr
          </span>
        </div>

        {/* Last Error */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Last Error</span>
          <span className="font-mono">
            {formatLastError(displayStats.lastErrorTime)}
          </span>
        </div>

        {/* Sentry Link */}
        <a
          href="https://sentry.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors pt-2 border-t border-border"
        >
          <span>View in Sentry</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version of the Sentry status widget for sidebar/header
 */
export function SentryStatusBadge() {
  const { data: stats } = trpc.debug.getSentryStats.useQuery(undefined, {
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "critical":
        return "bg-red-500 animate-pulse";
      default:
        return "bg-gray-500";
    }
  };

  const status = stats?.status || "healthy";
  const unresolvedCount = stats?.unresolvedErrors || 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
      <span className="text-muted-foreground">
        {unresolvedCount > 0 ? `${unresolvedCount} errors` : "No errors"}
      </span>
    </div>
  );
}
