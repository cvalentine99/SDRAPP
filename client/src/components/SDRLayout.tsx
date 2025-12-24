import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Command,
  Database,
  Radio,
  Search,
  Settings,
  User,
  Waves,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { GlobalAIChat } from "./GlobalAIChat";
import {
  BookmarkSelector,
  useFrequencyBookmarks,
  type FrequencyBookmark,
} from "./FrequencyBookmarks";

interface SDRLayoutProps {
  children: React.ReactNode;
}

export function SDRLayout({ children }: SDRLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { data: deviceInfo } = trpc.device.getInfo.useQuery();
  const setFrequencyMutation = trpc.device.setFrequency.useMutation();
  const setGainMutation = trpc.device.setGain.useMutation();

  // Frequency bookmarks
  const { bookmarks } = useFrequencyBookmarks();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/";
  };

  const handleBookmarkSelect = async (bookmark: FrequencyBookmark) => {
    try {
      await setFrequencyMutation.mutateAsync({ frequency: bookmark.frequency });
      if (bookmark.gain !== undefined) {
        await setGainMutation.mutateAsync({ gain: bookmark.gain });
      }
    } catch (error) {
      console.error("Failed to apply bookmark:", error);
    }
  };

  const navItems = [
    { path: "/", label: "Spectrum", icon: Waves },
    { path: "/scanner", label: "Scanner", icon: Search },
    { path: "/device", label: "Device", icon: Radio },
    { path: "/recording", label: "Recording", icon: Database },
    { path: "/telemetry", label: "Telemetry", icon: Activity },
    { path: "/settings", label: "Settings", icon: Settings },
  ];
  // AI Assistant is now a global floating chat box (lower right corner)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top HUD Bar */}
      <header className="border-b border-border relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-6 py-4 flex items-center justify-between relative z-10">
          {/* Logo/Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-card border-2 border-primary flex items-center justify-center box-glow-pink">
              <Radio className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold neon-glow-pink text-primary tracking-wider">
                ETTUS SDR
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                B210 Control System
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 ${
                      isActive
                        ? "box-glow-pink"
                        : "hover:text-primary hover:border-primary"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Right side: Bookmarks, Command palette hint, User */}
          <div className="flex items-center gap-3">
            {/* Frequency Bookmarks */}
            <BookmarkSelector
              bookmarks={bookmarks}
              onSelect={handleBookmarkSelect}
            />

            {/* Command palette hint */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border text-muted-foreground hover:text-foreground hidden md:flex"
              onClick={() => {
                // Trigger command palette
                const event = new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                });
                document.dispatchEvent(event);
              }}
            >
              <Command className="w-3 h-3" />
              <span className="text-xs">Search</span>
              <Kbd className="ml-1 text-[10px]">⌘K</Kbd>
            </Button>

            {/* User Profile */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-secondary hover:box-glow-cyan"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-card border-border"
                >
                  <DropdownMenuLabel className="text-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative">{children}</main>

      {/* Bottom HUD Status Bar */}
      <footer className="border-t border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse box-glow-cyan" />
              <span className="text-muted-foreground">SYSTEM ONLINE</span>
            </div>
            <div className="text-muted-foreground">
              <span className="text-secondary">USB 3.0</span> CONNECTED
            </div>
            <div className="text-muted-foreground">
              <span className="text-secondary">{deviceInfo?.name || "--"}</span> [SN: {deviceInfo?.serial || "--"}]
            </div>
            <div className="text-muted-foreground">
              FW: <span className="text-primary">{deviceInfo?.firmwareVersion || "--"}</span> | FPGA: <span className="text-primary">{deviceInfo?.fpgaVersion || "--"}</span>
            </div>
            <div className="text-muted-foreground">
              GPSDO: <span className="text-secondary">{deviceInfo?.gpsdo || "--"}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="hidden lg:inline-flex items-center gap-1">
              Press <Kbd className="text-[10px]">?</Kbd> for shortcuts
            </span>
            <span>© 2025 ETTUS RESEARCH | B210 USRP</span>
          </div>
        </div>
      </footer>

      {/* Global AI Chat Box */}
      <GlobalAIChat />
    </div>
  );
}
