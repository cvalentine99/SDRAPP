import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/CommandPalette";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SDRLayout } from "./components/SDRLayout";
import Spectrum from "./pages/Spectrum";
import Device from "./pages/Device";
import Recording from "./pages/Recording";
import Telemetry from "./pages/Telemetry";


function Router() {
  return (
    <SDRLayout>
      <Switch>
        <Route path={"/"} component={Spectrum} />
        <Route path={"/device"} component={Device} />
        <Route path={"/recording"} component={Recording} />
        <Route path={"/telemetry"} component={Telemetry} />

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
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <CommandPalette />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
