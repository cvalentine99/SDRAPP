import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SDRLayout } from "./components/SDRLayout";
import { CommandPalette } from "./components/CommandPalette";
import { KeyboardShortcuts, useKeyboardShortcuts } from "./components/KeyboardShortcuts";
import Spectrum from "./pages/Spectrum";
import Scanner from "./pages/Scanner";
import Device from "./pages/Device";
import Recording from "./pages/Recording";
import Telemetry from "./pages/Telemetry";
// AIAssistant page removed - now using global floating chat box
import Settings from "./pages/Settings";

function Router() {
  const [, setLocation] = useLocation();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Command palette action handler
  const handleCommandAction = useCallback((action: string, payload?: unknown) => {
    switch (action) {
      case "showKeyboardShortcuts":
        setShowShortcuts(true);
        break;
      case "fullscreen":
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
        break;
      case "showHelp":
        window.open("https://files.ettus.com/manual/", "_blank");
        break;
      default:
        console.log("Command action:", action, payload);
    }
  }, []);

  // Keyboard shortcuts for navigation and common actions
  const keyboardHandlers = {
    "?": () => setShowShortcuts(true),
    "g s": () => setLocation("/"),
    "g c": () => setLocation("/scanner"),
    "g d": () => setLocation("/device"),
    "g r": () => setLocation("/recording"),
    "g t": () => setLocation("/telemetry"),
    "g ,": () => setLocation("/settings"),
    escape: () => setShowShortcuts(false),
  };

  useKeyboardShortcuts(keyboardHandlers);

  return (
    <>
      <SDRLayout>
        <Switch>
          <Route path={"/"} component={Spectrum} />
          <Route path={"/scanner"} component={Scanner} />
          <Route path={"/device"} component={Device} />
          <Route path={"/recording"} component={Recording} />
          <Route path={"/telemetry"} component={Telemetry} />
          {/* AI Assistant is now a global floating chat box */}
          <Route path={"/settings"} component={Settings} />
          <Route path={"/404"} component={NotFound} />
          {/* Final fallback route */}
          <Route component={NotFound} />
        </Switch>
      </SDRLayout>

      {/* Global command palette (Cmd/Ctrl+K) */}
      <CommandPalette onAction={handleCommandAction} />

      {/* Keyboard shortcuts reference dialog */}
      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
