import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bookmark, Plus, Radio, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BookmarkPanelProps {
  onTuneToFrequency: (frequency: string) => void;
}

export function BookmarkPanel({ onTuneToFrequency }: BookmarkPanelProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBookmark, setNewBookmark] = useState({
    name: "",
    frequency: "",
    description: "",
    category: "General",
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const utils = trpc.useUtils();
  const bookmarks = trpc.bookmarks.list.useQuery();
  const createBookmark = trpc.bookmarks.create.useMutation({
    onSuccess: () => {
      utils.bookmarks.list.invalidate();
      setIsCreateDialogOpen(false);
      setNewBookmark({ name: "", frequency: "", description: "", category: "General" });
      toast.success("Bookmark created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create bookmark: ${error.message}`);
    },
  });
  const deleteBookmark = trpc.bookmarks.delete.useMutation({
    onSuccess: () => {
      utils.bookmarks.list.invalidate();
      toast.success("Bookmark deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete bookmark: ${error.message}`);
    },
  });

  const handleCreateBookmark = () => {
    if (!newBookmark.name || !newBookmark.frequency) {
      toast.error("Name and frequency are required");
      return;
    }

    createBookmark.mutate({
      name: newBookmark.name,
      frequency: newBookmark.frequency,
      description: newBookmark.description || undefined,
      category: newBookmark.category || undefined,
    });
  };

  const handleDeleteBookmark = (id: number, name: string) => {
    if (confirm(`Delete bookmark "${name}"?`)) {
      deleteBookmark.mutate({ id });
    }
  };

  const categories = ["all", ...Array.from(new Set(bookmarks.data?.map((b) => b.category).filter((c): c is string => c !== null) || []))];
  const filteredBookmarks =
    selectedCategory === "all"
      ? bookmarks.data
      : bookmarks.data?.filter((b) => b.category === selectedCategory);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-secondary" />
            <span className="neon-glow-cyan text-secondary">BOOKMARKS</span>
          </CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-secondary hover:box-glow-cyan"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="neon-glow-pink text-primary">Create Bookmark</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Save a frequency for quick access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="bookmark-name" className="text-xs">
                    Name *
                  </Label>
                  <Input
                    id="bookmark-name"
                    value={newBookmark.name}
                    onChange={(e) => setNewBookmark({ ...newBookmark, name: e.target.value })}
                    placeholder="ISM 915 MHz"
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bookmark-frequency" className="text-xs">
                    Frequency (MHz) *
                  </Label>
                  <Input
                    id="bookmark-frequency"
                    type="number"
                    value={newBookmark.frequency}
                    onChange={(e) => setNewBookmark({ ...newBookmark, frequency: e.target.value })}
                    placeholder="915.0"
                    step="0.1"
                    className="bg-input border-border font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bookmark-category" className="text-xs">
                    Category
                  </Label>
                  <Select
                    value={newBookmark.category}
                    onValueChange={(value) => setNewBookmark({ ...newBookmark, category: value })}
                  >
                    <SelectTrigger id="bookmark-category" className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="ISM">ISM Bands</SelectItem>
                      <SelectItem value="Amateur">Amateur Radio</SelectItem>
                      <SelectItem value="Aviation">Aviation</SelectItem>
                      <SelectItem value="Satellite">Satellite</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bookmark-description" className="text-xs">
                    Description
                  </Label>
                  <Textarea
                    id="bookmark-description"
                    value={newBookmark.description}
                    onChange={(e) => setNewBookmark({ ...newBookmark, description: e.target.value })}
                    placeholder="Optional notes about this frequency..."
                    className="bg-input border-border resize-none"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="border-border"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateBookmark}
                  disabled={createBookmark.isPending}
                  className="box-glow-pink"
                >
                  {createBookmark.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category Filter */}
        {categories.length > 1 && (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="bg-input border-border h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Categories</SelectItem>
              {categories
                .filter((c) => c !== "all")
                .map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {/* Bookmark List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {bookmarks.isLoading && (
            <div className="text-xs text-muted-foreground text-center py-4">Loading bookmarks...</div>
          )}
          {filteredBookmarks && filteredBookmarks.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              No bookmarks yet. Click Add to create one.
            </div>
          )}
          {filteredBookmarks?.map((bookmark) => (
            <div
              key={bookmark.id}
              className="bg-black/50 rounded p-2 border border-border hover:border-secondary/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{bookmark.name}</div>
                  <div className="text-xs font-mono text-primary">{bookmark.frequency} MHz</div>
                  {bookmark.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {bookmark.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-secondary/20 hover:text-secondary"
                    onClick={() => bookmark.frequency && onTuneToFrequency(bookmark.frequency)}
                  >
                    <Radio className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => handleDeleteBookmark(bookmark.id, bookmark.name)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {bookmark.category && (
                <div className="mt-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-secondary/20 text-secondary border border-secondary/30">
                    {bookmark.category}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
