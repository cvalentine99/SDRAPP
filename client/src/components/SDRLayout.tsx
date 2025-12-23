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
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Database,
  Radio,
  Settings,
  User,
  Waves,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface SDRLayoutProps {
  children: React.ReactNode;
}

export function SDRLayout({ children }: SDRLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { data: sdrMode } = trpc.system.getSDRMode.useQuery();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/";
  };

  const navItems = [
    { path: "/", label: "Spectrum", icon: Waves },
    { path: "/device", label: "Device", icon: Radio },
    { path: "/recording", label: "Recording", icon: Database },
    { path: "/telemetry", label: "Telemetry", icon: Activity },
    { path: "/ai-assistant", label: "AI Assistant", icon: Zap },
  ];

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

          {/* User Profile */}
          <div className="flex items-center gap-4">
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
            {sdrMode && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  sdrMode.isDemo ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <span className="text-muted-foreground uppercase">
                  {sdrMode.mode} MODE
                </span>
                {sdrMode.isDemo && (
                  <span className="text-yellow-500 text-xs">
                    (SIMULATED DATA)
                  </span>
                )}
              </div>
            )}
            <div className="text-muted-foreground">
              <span className="text-secondary">USB 3.0</span> CONNECTED
            </div>
          </div>
          <div className="text-muted-foreground">
            © 2025 ETTUS RESEARCH | B210 USRP
          </div>
        </div>
      </footer>
    </div>
  );
}
