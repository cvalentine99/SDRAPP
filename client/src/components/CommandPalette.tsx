import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Activity,
  Bookmark,
  Database,
  Radio,
  Search,
  Settings,
  Waves,
  Zap,
  Play,
  Pause,
  Volume2,
  Maximize2,
  RefreshCw,
  Download,
  MessageSquare,
  Keyboard,
  HelpCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CommandPaletteProps {
  onAction?: (action: string, payload?: unknown) => void;
}

// Frequency presets for quick access
const FREQUENCY_PRESETS = [
  { label: "ISM 433 MHz", freq: 433e6, description: "Industrial, Scientific, Medical" },
  { label: "ISM 868 MHz", freq: 868e6, description: "European ISM band" },
  { label: "ISM 915 MHz", freq: 915e6, description: "US ISM band" },
  { label: "WiFi 2.4 GHz", freq: 2.4e9, description: "2.4 GHz WiFi band" },
  { label: "LTE Band 7", freq: 2.6e9, description: "2600 MHz LTE" },
  { label: "WiFi 5 GHz", freq: 5.8e9, description: "5.8 GHz WiFi band" },
  { label: "GPS L1", freq: 1.57542e9, description: "GPS L1 carrier" },
  { label: "ADS-B", freq: 1.090e9, description: "Aircraft transponder" },
  { label: "FM Radio", freq: 100e6, description: "FM broadcast band" },
  { label: "Marine VHF", freq: 156.8e6, description: "Channel 16 emergency" },
];

// Gain presets
const GAIN_PRESETS = [
  { label: "Low Gain (20 dB)", gain: 20, description: "Strong signal handling" },
  { label: "Medium Gain (40 dB)", gain: 40, description: "Balanced sensitivity" },
  { label: "High Gain (60 dB)", gain: 60, description: "Weak signal reception" },
  { label: "Maximum Gain (76 dB)", gain: 76, description: "Maximum sensitivity" },
];

export function CommandPalette({ onAction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const setFrequencyMutation = trpc.device.setFrequency.useMutation();
  const setGainMutation = trpc.device.setGain.useMutation();

  // Listen for keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // Also open on "/" for quick search
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setOpen(true);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const handleNavigate = (path: string) => {
    runCommand(() => setLocation(path));
  };

  const handleFrequencyPreset = async (freq: number) => {
    runCommand(async () => {
      await setFrequencyMutation.mutateAsync({ frequency: freq });
      onAction?.("frequencyChanged", freq);
    });
  };

  const handleGainPreset = async (gain: number) => {
    runCommand(async () => {
      await setGainMutation.mutateAsync({ gain });
      onAction?.("gainChanged", gain);
    });
  };

  const handleAction = (action: string) => {
    runCommand(() => onAction?.(action));
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, frequencies, or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => handleAction("toggleAcquisition")}>
            <Play className="mr-2 h-4 w-4 text-green-500" />
            <span>Start/Stop Acquisition</span>
            <CommandShortcut>Space</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleAction("toggleRecording")}>
            <Database className="mr-2 h-4 w-4 text-red-500" />
            <span>Start/Stop Recording</span>
            <CommandShortcut>R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleAction("reconnect")}>
            <RefreshCw className="mr-2 h-4 w-4 text-blue-500" />
            <span>Reconnect WebSocket</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction("openAI")}>
            <MessageSquare className="mr-2 h-4 w-4 text-purple-500" />
            <span>Open AI Assistant</span>
            <CommandShortcut>I</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleNavigate("/")}>
            <Waves className="mr-2 h-4 w-4 text-primary" />
            <span>Spectrum Analyzer</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/scanner")}>
            <Search className="mr-2 h-4 w-4 text-secondary" />
            <span>Frequency Scanner</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/device")}>
            <Radio className="mr-2 h-4 w-4 text-primary" />
            <span>Device Manager</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/recording")}>
            <Database className="mr-2 h-4 w-4 text-secondary" />
            <span>Recordings</span>
            <CommandShortcut>G R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/telemetry")}>
            <Activity className="mr-2 h-4 w-4 text-primary" />
            <span>Telemetry</span>
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/settings")}>
            <Settings className="mr-2 h-4 w-4 text-secondary" />
            <span>Settings</span>
            <CommandShortcut>G ,</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Frequency Presets */}
        <CommandGroup heading="Frequency Presets">
          {FREQUENCY_PRESETS.map((preset) => (
            <CommandItem
              key={preset.freq}
              onSelect={() => handleFrequencyPreset(preset.freq)}
            >
              <Zap className="mr-2 h-4 w-4 text-yellow-500" />
              <span>{preset.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {preset.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Gain Presets */}
        <CommandGroup heading="Gain Presets">
          {GAIN_PRESETS.map((preset) => (
            <CommandItem
              key={preset.gain}
              onSelect={() => handleGainPreset(preset.gain)}
            >
              <Volume2 className="mr-2 h-4 w-4 text-cyan-500" />
              <span>{preset.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {preset.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* View Options */}
        <CommandGroup heading="View">
          <CommandItem onSelect={() => handleAction("fullscreen")}>
            <Maximize2 className="mr-2 h-4 w-4" />
            <span>Toggle Fullscreen</span>
            <CommandShortcut>F11</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleAction("showKeyboardShortcuts")}>
            <Keyboard className="mr-2 h-4 w-4" />
            <span>Keyboard Shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleAction("showHelp")}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help & Documentation</span>
            <CommandShortcut>F1</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// Export presets for use in other components
export { FREQUENCY_PRESETS, GAIN_PRESETS };
