import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bookmark, Plus, Star, Trash2, MoreVertical, Radio } from "lucide-react";
import { cn } from "@/lib/utils";


interface FrequencyBookmarksProps {
  currentFrequency: number; // Hz
  currentSampleRate: number; // SPS
  currentGain: number; // dB
  onSelectBookmark: (frequency: number, sampleRate: number, gain: number) => void;
  className?: string;
}

interface BookmarkData {
  id: number;
  name: string;
  frequency: number;
  sampleRate: number;
  gain: number;
  description: string | null;
  color: string | null;
}

/**
 * Frequency bookmarks component for quick access to saved frequencies
 */
export function FrequencyBookmarks({
  currentFrequency,
  currentSampleRate,
  currentGain,
  onSelectBookmark,
  className,
}: FrequencyBookmarksProps) {

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBookmarkName, setNewBookmarkName] = useState("");
  const [newBookmarkDescription, setNewBookmarkDescription] = useState("");

  // Fetch user bookmarks
  const { data: userBookmarks = [], refetch: refetchBookmarks } = trpc.bookmark.list.useQuery();
  
  // Fetch preset bookmarks
  const { data: presetBookmarks = [] } = trpc.bookmark.getPresets.useQuery();

  // Mutations
  const createBookmark = trpc.bookmark.create.useMutation({
    onSuccess: () => {
      refetchBookmarks();
      setIsAddDialogOpen(false);
      setNewBookmarkName("");
      setNewBookmarkDescription("");
      logger.bookmarks.info("Bookmark saved", { name: newBookmarkName });
    },
    onError: (error) => {
      logger.bookmarks.error("Failed to save bookmark", { error: error.message });
    },
  });

  const deleteBookmark = trpc.bookmark.delete.useMutation({
    onSuccess: () => {
      refetchBookmarks();
      logger.bookmarks.info("Bookmark deleted");
    },
    onError: (error) => {
      logger.bookmarks.error("Failed to delete bookmark", { error: error.message });
    },
  });

  const handleAddBookmark = () => {
    if (!newBookmarkName.trim()) {
      logger.bookmarks.warn("Bookmark name required");
      return;
    }

    createBookmark.mutate({
      name: newBookmarkName.trim(),
      frequency: currentFrequency,
      sampleRate: currentSampleRate,
      gain: currentGain,
      description: newBookmarkDescription.trim() || undefined,
    });
  };

  const handleSelectBookmark = (bookmark: BookmarkData) => {
    onSelectBookmark(bookmark.frequency, bookmark.sampleRate, bookmark.gain);
    logger.bookmarks.info("Tuned to bookmark", { name: bookmark.name, frequency: bookmark.frequency });
  };

  const handleDeleteBookmark = (id: number) => {
    deleteBookmark.mutate({ id });
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Bookmark className="w-4 h-4" />
          <span>Bookmarks</span>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Save Frequency Bookmark</DialogTitle>
              <DialogDescription>
                Save the current frequency settings for quick access later.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bookmark-name">Name</Label>
                <Input
                  id="bookmark-name"
                  placeholder="e.g., Local FM Station"
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookmark-description">Description (optional)</Label>
                <Input
                  id="bookmark-description"
                  placeholder="e.g., Strong signal in my area"
                  value={newBookmarkDescription}
                  onChange={(e) => setNewBookmarkDescription(e.target.value)}
                />
              </div>
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frequency:</span>
                  <span className="font-mono">{formatFrequency(currentFrequency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sample Rate:</span>
                  <span className="font-mono">{formatSampleRate(currentSampleRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gain:</span>
                  <span className="font-mono">{currentGain} dB</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddBookmark} disabled={createBookmark.isPending}>
                {createBookmark.isPending ? "Saving..." : "Save Bookmark"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* User Bookmarks */}
      {userBookmarks.length > 0 && (
        <div className="space-y-1">
          {userBookmarks.map((bookmark) => (
            <BookmarkItem
              key={bookmark.id}
              bookmark={bookmark}
              onSelect={() => handleSelectBookmark(bookmark)}
              onDelete={() => handleDeleteBookmark(bookmark.id)}
              canDelete
            />
          ))}
        </div>
      )}

      {/* Preset Bookmarks */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Star className="w-3 h-3" />
          <span>Presets</span>
        </div>
        <div className="space-y-1">
          {presetBookmarks.map((bookmark) => (
            <BookmarkItem
              key={bookmark.id}
              bookmark={bookmark}
              onSelect={() => handleSelectBookmark(bookmark)}
              isPreset
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface BookmarkItemProps {
  bookmark: BookmarkData;
  onSelect: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  isPreset?: boolean;
}

function BookmarkItem({ bookmark, onSelect, onDelete, canDelete, isPreset }: BookmarkItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
        "hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onSelect}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: bookmark.color || "#00d4ff" }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{bookmark.name}</div>
        <div className="text-xs text-muted-foreground font-mono">
          {formatFrequency(bookmark.frequency)}
        </div>
      </div>
      {canDelete && onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              <Radio className="w-4 h-4 mr-2" />
              Tune to frequency
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete bookmark
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {isPreset && (
        <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />
      )}
    </div>
  );
}

// Helper functions
function formatFrequency(hz: number): string {
  if (hz >= 1e9) {
    return `${(hz / 1e9).toFixed(3)} GHz`;
  } else if (hz >= 1e6) {
    return `${(hz / 1e6).toFixed(3)} MHz`;
  } else if (hz >= 1e3) {
    return `${(hz / 1e3).toFixed(1)} kHz`;
  }
  return `${hz} Hz`;
}

function formatSampleRate(sps: number): string {
  if (sps >= 1e6) {
    return `${(sps / 1e6).toFixed(2)} MSPS`;
  } else if (sps >= 1e3) {
    return `${(sps / 1e3).toFixed(0)} kSPS`;
  }
  return `${sps} SPS`;
}

/**
 * Compact bookmark selector for tight spaces
 */
export function BookmarkSelector({
  onSelectBookmark,
  className,
}: {
  onSelectBookmark: (frequency: number, sampleRate: number, gain: number) => void;
  className?: string;
}) {
  const { data: presetBookmarks = [] } = trpc.bookmark.getPresets.useQuery();
  const { data: userBookmarks = [] } = trpc.bookmark.list.useQuery();

  const allBookmarks = [...userBookmarks, ...presetBookmarks];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Bookmark className="w-4 h-4" />
          <span>Bookmarks</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {allBookmarks.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No bookmarks yet
          </div>
        ) : (
          allBookmarks.map((bookmark) => (
            <DropdownMenuItem
              key={bookmark.id}
              onClick={() => onSelectBookmark(bookmark.frequency, bookmark.sampleRate, bookmark.gain)}
            >
              <div
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: bookmark.color || "#00d4ff" }}
              />
              <div className="flex-1">
                <div className="font-medium">{bookmark.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {formatFrequency(bookmark.frequency)}
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
