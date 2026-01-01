import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Trash2,
  RefreshCw,
  Search,
  Settings,
  FileText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, unknown>;
}

const levelIcons: Record<LogLevel, React.ReactNode> = {
  debug: <Bug className="w-4 h-4 text-gray-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
  warn: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
};

const levelColors: Record<LogLevel, string> = {
  debug: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  warn: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function LogViewer() {
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  // Fetch logs
  const { data: logsData, refetch: refetchLogs } = trpc.logs.list.useQuery(
    {
      level: levelFilter === "all" ? undefined : levelFilter,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      search: searchQuery || undefined,
      limit: 200,
    },
    {
      refetchInterval: autoRefresh ? 2000 : false,
    }
  );

  // Fetch categories
  const { data: categories } = trpc.logs.categories.useQuery();

  // Fetch stats
  const { data: stats } = trpc.logs.stats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch config
  const { data: config, refetch: refetchConfig } = trpc.logs.config.useQuery();

  // Clear logs mutation
  const clearMutation = trpc.logs.clear.useMutation({
    onSuccess: () => {
      toast.success("Logs cleared");
      refetchLogs();
    },
  });

  // Update config mutation
  const setConfigMutation = trpc.logs.setConfig.useMutation({
    onSuccess: () => {
      toast.success("Logger configuration updated");
      refetchConfig();
    },
  });

  const logs = logsData?.logs || [];

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>System Logs</span>
            {stats && (
              <Badge variant="outline" className="ml-2">
                {stats.total} entries
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchLogs()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config panel */}
        {showConfig && config && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-medium">Logger Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Log Level</Label>
                <Select
                  value={config.minLevel}
                  onValueChange={(value) =>
                    setConfigMutation.mutate({ minLevel: value as LogLevel })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Logging Enabled</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) =>
                    setConfigMutation.mutate({ enabled })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats summary */}
        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Bug className="w-3 h-3 text-gray-400" />
              <span className="text-muted-foreground">{stats.byLevel.debug}</span>
            </div>
            <div className="flex items-center gap-1">
              <Info className="w-3 h-3 text-blue-400" />
              <span className="text-muted-foreground">{stats.byLevel.info}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400" />
              <span className="text-muted-foreground">{stats.byLevel.warn}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-muted-foreground">{stats.byLevel.error}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LogLevel | "all")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh
            </Label>
          </div>
        </div>

        {/* Log entries */}
        <ScrollArea className="h-[400px] rounded-lg border border-border bg-black/50">
          <div className="p-2 space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No logs found
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 p-2 rounded ${levelColors[log.level]} border`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {levelIcons[log.level]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {log.category}
                      </Badge>
                    </div>
                    <div className="text-foreground break-words">
                      {log.message}
                    </div>
                    {log.context && Object.keys(log.context).length > 0 && (
                      <div className="text-muted-foreground mt-1 text-[10px]">
                        {JSON.stringify(log.context)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default LogViewer;
