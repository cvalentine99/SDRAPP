import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Activity,
  Database,
  MessageSquare,
  Radio,
  Settings,
  Wifi,
} from "lucide-react";
interface CommandPaletteProps {
  onTuneFrequency?: (frequency: string) => void;
}

export function CommandPalette({ onTuneFrequency }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleNavigate = (path: string) => {
    setLocation(path);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search..."
        className="border-border"
      />
      <CommandList className="bg-popover">
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => handleNavigate("/")}
            className="cursor-pointer"
          >
            <Radio className="mr-2 h-4 w-4 text-secondary" />
            <span>Spectrum Analyzer</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleNavigate("/device")}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4 text-secondary" />
            <span>Device Manager</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleNavigate("/recording")}
            className="cursor-pointer"
          >
            <Database className="mr-2 h-4 w-4 text-secondary" />
            <span>Recording</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleNavigate("/telemetry")}
            className="cursor-pointer"
          >
            <Activity className="mr-2 h-4 w-4 text-secondary" />
            <span>Telemetry</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleNavigate("/ai-assistant")}
            className="cursor-pointer"
          >
            <MessageSquare className="mr-2 h-4 w-4 text-secondary" />
            <span>AI Assistant</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem disabled className="text-xs text-muted-foreground">
            <Wifi className="mr-2 h-4 w-4" />
            <span>Start/Stop Streaming</span>
            <span className="ml-auto text-xs">Coming soon</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
