import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorMap, ColorStop, colorMapToGradient } from "@/lib/colorMaps";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface GradientEditorProps {
  initialColorMap?: ColorMap;
  onSave: (colorMap: ColorMap) => void;
}

export function GradientEditor({ initialColorMap, onSave }: GradientEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialColorMap?.name || "Custom");
  const [stops, setStops] = useState<ColorStop[]>(
    initialColorMap?.stops || [
      { position: 0.0, color: "#000000" },
      { position: 1.0, color: "#ffffff" },
    ]
  );

  const addStop = () => {
    const newPosition = stops.length > 0 
      ? (stops[stops.length - 1].position + 0.1) 
      : 0.5;
    setStops([...stops, { position: Math.min(1.0, newPosition), color: "#808080" }]);
  };

  const removeStop = (index: number) => {
    if (stops.length > 2) {
      setStops(stops.filter((_, i) => i !== index));
    }
  };

  const updateStop = (index: number, field: keyof ColorStop, value: string | number) => {
    const newStops = [...stops];
    if (field === "position") {
      newStops[index] = { ...newStops[index], position: Math.max(0, Math.min(1, Number(value))) };
    } else {
      newStops[index] = { ...newStops[index], color: value as string };
    }
    // Sort by position
    newStops.sort((a, b) => a.position - b.position);
    setStops(newStops);
  };

  const handleSave = () => {
    onSave({ name, stops });
    setIsOpen(false);
  };

  const currentColorMap: ColorMap = { name, stops };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full border-secondary hover:box-glow-cyan"
        >
          <Plus className="w-3 h-3 mr-2" />
          Custom Gradient
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="neon-glow-pink text-primary">
            Custom Gradient Editor
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Gradient Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preview</Label>
            <div 
              className="w-full h-12 rounded border border-border"
              style={{ background: colorMapToGradient(currentColorMap) }}
            />
          </div>

          {/* Gradient Name */}
          <div className="space-y-2">
            <Label htmlFor="gradient-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id="gradient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input border-border"
              placeholder="Custom Gradient"
            />
          </div>

          {/* Color Stops */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Color Stops</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs border-secondary hover:box-glow-cyan"
                onClick={addStop}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stops.map((stop, index) => (
                <div key={index} className="flex items-center gap-2 bg-black/50 rounded p-2 border border-border">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16">Position</Label>
                      <Input
                        type="number"
                        value={stop.position}
                        onChange={(e) => updateStop(index, "position", e.target.value)}
                        className="bg-input border-border h-7 text-xs"
                        min="0"
                        max="1"
                        step="0.01"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16">Color</Label>
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="color"
                          value={stop.color}
                          onChange={(e) => updateStop(index, "color", e.target.value)}
                          className="bg-input border-border h-7 w-12 p-1"
                        />
                        <Input
                          type="text"
                          value={stop.color}
                          onChange={(e) => updateStop(index, "color", e.target.value)}
                          className="bg-input border-border h-7 text-xs font-mono flex-1"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => removeStop(index)}
                    disabled={stops.length <= 2}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-border"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 box-glow-pink"
              onClick={handleSave}
            >
              Save Gradient
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
