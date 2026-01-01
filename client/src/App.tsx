import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { SentryErrorBoundary } from "./components/SentryErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SDRLayout } from "./components/SDRLayout";
import Spectrum from "./pages/Spectrum";
import Scanner from "./pages/Scanner";
import Device from "./pages/Device";
import Recording from "./pages/Recording";
import Telemetry from "./pages/Telemetry";
// AIAssistant page removed - now using global floating chat box
import Settings from "./pages/Settings";

function Router() {
  return (
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
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <SentryErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </SentryErrorBoundary>
  );
}

export default App;
