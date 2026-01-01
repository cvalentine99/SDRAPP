import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { GAIN_PRESETS, GainPreset, getPresetColorClass, getPresetGlowClass } from '@/lib/gain-presets';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Check, Info } from 'lucide-react';

interface GainPresetsProps {
  /** Current frequency in MHz (for smart preset suggestions) */
  currentFrequency?: number;
  /** Callback when preset is applied */
  onPresetApplied?: (preset: GainPreset) => void;
  /** Show as compact button or full panel */
  variant?: 'button' | 'panel';
}

export function GainPresets({ 
  currentFrequency, 
  onPresetApplied,
  variant = 'button' 
}: GainPresetsProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<GainPreset | null>(null);

  const setGain = trpc.device.setGain.useMutation();
  const setSampleRate = trpc.device.setSampleRate.useMutation();

  const handleApplyPreset = async (preset: GainPreset) => {
    setApplyingPreset(preset.id);
    logger.device.info('Applying gain preset', { presetId: preset.id, presetName: preset.name });

    try {
      // Apply gain first
      await setGain.mutateAsync({ gain: preset.gain });
      
      // Apply sample rate
      await setSampleRate.mutateAsync({ sampleRate: preset.sampleRate });

      toast.success(`${preset.icon} ${preset.name} Applied`, {
        description: `Gain: ${preset.gain} dB, Sample Rate: ${preset.sampleRateMSPS} MSPS`,
      });

      logger.device.info('Gain preset applied successfully', { 
        presetId: preset.id, 
        gain: preset.gain, 
        sampleRate: preset.sampleRate 
      });

      onPresetApplied?.(preset);
      setIsOpen(false);
    } catch (error) {
      logger.device.error('Failed to apply gain preset', { presetId: preset.id, error });
      toast.error('Failed to Apply Preset', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setApplyingPreset(null);
    }
  };

  const PresetCard = ({ preset }: { preset: GainPreset }) => {
    const isApplying = applyingPreset === preset.id;
    const colorClass = getPresetColorClass(preset.color);
    const glowClass = getPresetGlowClass(preset.color);

    return (
      <button
        onClick={() => setSelectedPreset(preset)}
        disabled={isApplying}
        className={`
          relative p-4 rounded-lg border-2 bg-black/40 backdrop-blur-sm
          transition-all duration-200 text-left w-full
          ${colorClass}
          ${selectedPreset?.id === preset.id ? glowClass : ''}
          hover:bg-black/60
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {selectedPreset?.id === preset.id && (
          <div className="absolute top-2 right-2">
            <Check className="w-4 h-4 text-green-400" />
          </div>
        )}
        
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{preset.icon}</span>
          <span className="font-semibold text-white">{preset.name}</span>
        </div>
        
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">
          {preset.description}
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
            {preset.gain} dB
          </Badge>
          <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
            {preset.sampleRateMSPS} MSPS
          </Badge>
        </div>
      </button>
    );
  };

  const PresetDetails = ({ preset }: { preset: GainPreset }) => {
    const colorClass = getPresetColorClass(preset.color);
    
    return (
      <div className={`p-4 rounded-lg border bg-black/60 ${colorClass}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{preset.icon}</span>
          <div>
            <h3 className="text-lg font-bold text-white">{preset.name}</h3>
            <p className="text-sm text-gray-400">{preset.frequencyRange}</p>
          </div>
        </div>
        
        <p className="text-sm text-gray-300 mb-4">{preset.description}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded bg-black/40">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Gain</div>
            <div className="text-xl font-mono text-white">{preset.gain} dB</div>
          </div>
          <div className="p-3 rounded bg-black/40">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Sample Rate</div>
            <div className="text-xl font-mono text-white">{preset.sampleRateMSPS} MSPS</div>
          </div>
          {preset.bandwidth && (
            <div className="p-3 rounded bg-black/40 col-span-2">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Bandwidth</div>
              <div className="text-xl font-mono text-white">{preset.bandwidth} MHz</div>
            </div>
          )}
        </div>
        
        <div className="mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Best For</div>
          <div className="flex flex-wrap gap-1">
            {preset.useCases.map((useCase, i) => (
              <Badge key={i} variant="secondary" className="text-xs bg-gray-800 text-gray-300">
                {useCase}
              </Badge>
            ))}
          </div>
        </div>
        
        <Button
          onClick={() => handleApplyPreset(preset)}
          disabled={applyingPreset !== null}
          className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400"
        >
          {applyingPreset === preset.id ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Apply Preset
            </>
          )}
        </Button>
      </div>
    );
  };

  if (variant === 'panel') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Gain Presets</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {GAIN_PRESETS.map(preset => (
            <PresetCard key={preset.id} preset={preset} />
          ))}
        </div>
        
        {selectedPreset && (
          <div className="mt-4">
            <PresetDetails preset={selectedPreset} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400"
        >
          <Settings2 className="w-4 h-4 mr-2" />
          Presets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-cyan-400" />
            Gain Staging Presets
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            One-click configurations optimized for common SDR use cases on the Ettus B210.
          </DialogDescription>
        </DialogHeader>
        
        {currentFrequency && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 mb-4">
            <Info className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300">
              Current frequency: <span className="font-mono font-bold">{currentFrequency.toFixed(3)} MHz</span>
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {GAIN_PRESETS.map(preset => (
            <PresetCard key={preset.id} preset={preset} />
          ))}
        </div>
        
        {selectedPreset && (
          <PresetDetails preset={selectedPreset} />
        )}
        
        {!selectedPreset && (
          <div className="text-center text-gray-500 py-8">
            <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Select a preset to view details and apply</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact preset quick-apply buttons for inline use
 */
export function QuickPresetButtons({ 
  onPresetApplied 
}: { 
  onPresetApplied?: (preset: GainPreset) => void 
}) {
  
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  const setGain = trpc.device.setGain.useMutation();
  const setSampleRate = trpc.device.setSampleRate.useMutation();

  const quickPresets = GAIN_PRESETS.slice(0, 4); // First 4 presets for quick access

  const handleQuickApply = async (preset: GainPreset) => {
    setApplyingPreset(preset.id);
    
    try {
      await setGain.mutateAsync({ gain: preset.gain });
      await setSampleRate.mutateAsync({ sampleRate: preset.sampleRate });

      toast.success(`${preset.icon} ${preset.name}`, {
        description: `Applied: ${preset.gain} dB, ${preset.sampleRateMSPS} MSPS`,
      });

      onPresetApplied?.(preset);
    } catch (error) {
      toast.error('Failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setApplyingPreset(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {quickPresets.map(preset => {
        const colorClass = getPresetColorClass(preset.color);
        const isApplying = applyingPreset === preset.id;
        
        return (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => handleQuickApply(preset)}
            disabled={isApplying}
            className={`${colorClass} bg-transparent hover:bg-black/40`}
          >
            {isApplying ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <span className="mr-1">{preset.icon}</span>
            )}
            {preset.name}
          </Button>
        );
      })}
    </div>
  );
}
