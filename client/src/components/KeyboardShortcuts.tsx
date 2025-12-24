import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutSection {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["/"], description: "Quick search" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialog / Cancel action" },
    ],
  },
  {
    title: "Acquisition",
    shortcuts: [
      { keys: ["Space"], description: "Start/Stop acquisition" },
      { keys: ["R"], description: "Start/Stop recording" },
      { keys: ["↑"], description: "Increase frequency (1 MHz)" },
      { keys: ["↓"], description: "Decrease frequency (1 MHz)" },
      { keys: ["Shift", "↑"], description: "Increase frequency (10 MHz)" },
      { keys: ["Shift", "↓"], description: "Decrease frequency (10 MHz)" },
      { keys: ["+"], description: "Increase gain (1 dB)" },
      { keys: ["-"], description: "Decrease gain (1 dB)" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["G", "S"], description: "Go to Spectrum page" },
      { keys: ["G", "C"], description: "Go to Scanner page" },
      { keys: ["G", "D"], description: "Go to Device page" },
      { keys: ["G", "R"], description: "Go to Recordings page" },
      { keys: ["G", "T"], description: "Go to Telemetry page" },
      { keys: ["G", ","], description: "Go to Settings page" },
    ],
  },
  {
    title: "AI Assistant",
    shortcuts: [
      { keys: ["I"], description: "Toggle AI Assistant" },
      { keys: ["⌘", "Enter"], description: "Send message" },
      { keys: ["⌘", "Shift", "C"], description: "Clear chat history" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["F11"], description: "Toggle fullscreen" },
      { keys: ["⌘", "B"], description: "Toggle sidebar" },
      { keys: ["⌘", "\\"], description: "Toggle spectrum/waterfall split" },
    ],
  },
  {
    title: "Bookmarks",
    shortcuts: [
      { keys: ["⌘", "D"], description: "Bookmark current frequency" },
      { keys: ["⌘", "Shift", "B"], description: "Show all bookmarks" },
      { keys: ["1-9"], description: "Jump to bookmark 1-9" },
    ],
  },
];

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl neon-glow-pink text-primary">
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Master the SDR control system with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 mt-4">
          {SHORTCUT_SECTIONS.map((section, index) => (
            <div key={section.title}>
              {index > 0 && <Separator className="mb-4 bg-border" />}
              <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="grid gap-2">
                {section.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j} className="flex items-center">
                          {j > 0 && (
                            <span className="text-muted-foreground mx-1">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-3 bg-muted/30 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Pro tip:</strong> Press{" "}
            <Kbd>⌘</Kbd> <Kbd>K</Kbd> to open the command palette for quick access
            to all features, frequency presets, and gain settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for keyboard shortcut handling
export function useKeyboardShortcuts(
  handlers: Record<string, () => void>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const keySequence: string[] = [];
    let keySequenceTimeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const key = e.key.toLowerCase();

      // Clear sequence after 1 second
      if (keySequenceTimeout) clearTimeout(keySequenceTimeout);
      keySequenceTimeout = setTimeout(() => {
        keySequence.length = 0;
      }, 1000);

      // Handle modifier combinations
      if (e.metaKey || e.ctrlKey) {
        const combo = `cmd+${key}`;
        if (handlers[combo]) {
          e.preventDefault();
          handlers[combo]();
          return;
        }
      }

      if (e.shiftKey && !e.metaKey && !e.ctrlKey) {
        const combo = `shift+${key}`;
        if (handlers[combo]) {
          e.preventDefault();
          handlers[combo]();
          return;
        }
      }

      // Build key sequence for multi-key shortcuts like "g s"
      keySequence.push(key);
      const sequence = keySequence.join(" ");

      // Check for sequence matches
      if (handlers[sequence]) {
        e.preventDefault();
        handlers[sequence]();
        keySequence.length = 0;
        return;
      }

      // Check for single key matches
      if (keySequence.length === 1 && handlers[key]) {
        e.preventDefault();
        handlers[key]();
        keySequence.length = 0;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (keySequenceTimeout) clearTimeout(keySequenceTimeout);
    };
  }, [handlers, enabled]);
}
