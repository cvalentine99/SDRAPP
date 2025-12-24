import { useState, useEffect, useCallback } from "react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkPlus, Star, Trash2, Edit2, Radio } from "lucide-react";
import { trpc } from "@/lib/trpc";

export interface FrequencyBookmark {
  id: string;
  name: string;
  frequency: number; // Hz
  gain?: number; // dB
  sampleRate?: number; // Hz
  description?: string;
  category?: string;
  isFavorite?: boolean;
  createdAt: number;
}

const BOOKMARK_STORAGE_KEY = "sdr-frequency-bookmarks";

// Categories for organizing bookmarks
const CATEGORIES = [
  "Amateur Radio",
  "ISM Band",
  "Cellular",
  "WiFi",
  "GPS/Navigation",
  "Aviation",
  "Marine",
  "Emergency",
  "Broadcast",
  "Custom",
];

// Format frequency for display
function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(4)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz} Hz`;
}

// Hook for managing bookmarks
export function useFrequencyBookmarks() {
  const [bookmarks, setBookmarks] = useState<FrequencyBookmark[]>([]);

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (stored) {
      try {
        setBookmarks(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse bookmarks:", e);
      }
    }
  }, []);

  // Save bookmarks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const addBookmark = useCallback((bookmark: Omit<FrequencyBookmark, "id" | "createdAt">) => {
    const newBookmark: FrequencyBookmark = {
      ...bookmark,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [...prev, newBookmark]);
    return newBookmark;
  }, []);

  const updateBookmark = useCallback((id: string, updates: Partial<FrequencyBookmark>) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  }, []);

  const deleteBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isFavorite: !b.isFavorite } : b))
    );
  }, []);

  const getFavorites = useCallback(() => {
    return bookmarks.filter((b) => b.isFavorite);
  }, [bookmarks]);

  const getByCategory = useCallback((category: string) => {
    return bookmarks.filter((b) => b.category === category);
  }, [bookmarks]);

  return {
    bookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    getFavorites,
    getByCategory,
  };
}

// Add Bookmark Dialog
interface AddBookmarkDialogProps {
  currentFrequency: number;
  currentGain?: number;
  currentSampleRate?: number;
  onAdd: (bookmark: Omit<FrequencyBookmark, "id" | "createdAt">) => void;
  trigger?: React.ReactNode;
}

export function AddBookmarkDialog({
  currentFrequency,
  currentGain,
  currentSampleRate,
  onAdd,
  trigger,
}: AddBookmarkDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Custom");

  const handleAdd = () => {
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      frequency: currentFrequency,
      gain: currentGain,
      sampleRate: currentSampleRate,
      description: description.trim() || undefined,
      category,
      isFavorite: false,
    });

    setName("");
    setDescription("");
    setCategory("Custom");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <BookmarkPlus className="w-4 h-4" />
            Bookmark
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="neon-glow-pink text-primary">
            Add Frequency Bookmark
          </DialogTitle>
          <DialogDescription>
            Save the current frequency for quick access later
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Current Frequency</div>
            <div className="text-lg font-mono text-primary">
              {formatFrequency(currentFrequency)}
            </div>
            {currentGain !== undefined && (
              <div className="text-sm text-muted-foreground mt-1">
                Gain: {currentGain} dB
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Local FM Station"
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-input text-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this frequency..."
              className="bg-input border-border"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim()} className="box-glow-pink">
            <Bookmark className="w-4 h-4 mr-2" />
            Save Bookmark
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Bookmarks Manager Dialog
interface BookmarksManagerProps {
  bookmarks: FrequencyBookmark[];
  onSelect: (bookmark: FrequencyBookmark) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookmarksManager({
  bookmarks,
  onSelect,
  onDelete,
  onToggleFavorite,
  open,
  onOpenChange,
}: BookmarksManagerProps) {
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(filter.toLowerCase()) ||
      b.description?.toLowerCase().includes(filter.toLowerCase()) ||
      formatFrequency(b.frequency).toLowerCase().includes(filter.toLowerCase());

    const matchesCategory = !categoryFilter || b.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const favorites = filteredBookmarks.filter((b) => b.isFavorite);
  const regular = filteredBookmarks.filter((b) => !b.isFavorite);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="neon-glow-cyan text-secondary">
            Frequency Bookmarks
          </DialogTitle>
          <DialogDescription>
            Manage your saved frequencies for quick access
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 my-2">
          <Input
            placeholder="Search bookmarks..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-input border-border"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-32">
                {categoryFilter || "All Categories"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover border-border">
              <DropdownMenuItem onClick={() => setCategoryFilter(null)}>
                All Categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {CATEGORIES.map((cat) => (
                <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)}>
                  {cat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredBookmarks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No bookmarks found</p>
              <p className="text-sm mt-2">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘ D</kbd> to bookmark the current frequency
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {favorites.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-yellow-500 mb-2 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Favorites
                  </h4>
                  <BookmarkTable
                    bookmarks={favorites}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onToggleFavorite={onToggleFavorite}
                  />
                </div>
              )}

              {regular.length > 0 && (
                <div>
                  {favorites.length > 0 && (
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      All Bookmarks
                    </h4>
                  )}
                  <BookmarkTable
                    bookmarks={regular}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onToggleFavorite={onToggleFavorite}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Bookmark table component
function BookmarkTable({
  bookmarks,
  onSelect,
  onDelete,
  onToggleFavorite,
}: {
  bookmarks: FrequencyBookmark[];
  onSelect: (bookmark: FrequencyBookmark) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="w-8"></TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookmarks.map((bookmark) => (
          <TableRow
            key={bookmark.id}
            className="border-border cursor-pointer hover:bg-muted/50"
            onClick={() => onSelect(bookmark)}
          >
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(bookmark.id);
                }}
              >
                <Star
                  className={`w-4 h-4 ${
                    bookmark.isFavorite
                      ? "fill-yellow-500 text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
              </Button>
            </TableCell>
            <TableCell>
              <div className="font-medium">{bookmark.name}</div>
              {bookmark.description && (
                <div className="text-xs text-muted-foreground">
                  {bookmark.description}
                </div>
              )}
            </TableCell>
            <TableCell>
              <span className="font-mono text-primary">
                {formatFrequency(bookmark.frequency)}
              </span>
              {bookmark.gain !== undefined && (
                <span className="text-xs text-muted-foreground ml-2">
                  @ {bookmark.gain} dB
                </span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {bookmark.category}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(bookmark.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Quick bookmark selector for toolbar
interface BookmarkSelectorProps {
  bookmarks: FrequencyBookmark[];
  onSelect: (bookmark: FrequencyBookmark) => void;
}

export function BookmarkSelector({ bookmarks, onSelect }: BookmarkSelectorProps) {
  const favorites = bookmarks.filter((b) => b.isFavorite).slice(0, 5);
  const recent = bookmarks
    .filter((b) => !b.isFavorite)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  if (bookmarks.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-secondary">
          <Bookmark className="w-4 h-4" />
          <span className="hidden md:inline">Bookmarks</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 bg-popover border-border">
        {favorites.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-yellow-500">
              <Star className="w-3 h-3" />
              Favorites
            </DropdownMenuLabel>
            {favorites.map((bookmark) => (
              <DropdownMenuItem
                key={bookmark.id}
                onClick={() => onSelect(bookmark)}
                className="flex justify-between"
              >
                <span className="truncate">{bookmark.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatFrequency(bookmark.frequency)}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {recent.length > 0 && (
          <>
            <DropdownMenuLabel className="text-muted-foreground">
              Recent
            </DropdownMenuLabel>
            {recent.map((bookmark) => (
              <DropdownMenuItem
                key={bookmark.id}
                onClick={() => onSelect(bookmark)}
                className="flex justify-between"
              >
                <span className="truncate">{bookmark.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatFrequency(bookmark.frequency)}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
