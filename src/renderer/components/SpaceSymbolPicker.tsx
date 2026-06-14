import { useState } from 'react';
import { normalizeSpaceSymbol, SPACE_SYMBOL_PRESETS } from '@shared/spaces';

interface SpaceSymbolPickerProps {
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
}

export function SpaceSymbolPicker({ value, onChange, className = '' }: SpaceSymbolPickerProps) {
  const [custom, setCustom] = useState('');

  return (
    <div className={className}>
      <div className="grid grid-cols-9 gap-1 mb-2">
        {SPACE_SYMBOL_PRESETS.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => onChange(sym)}
            className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${
              value === sym
                ? 'bg-merkaba-accent-soft ring-1 ring-merkaba-accent/40'
                : 'hover:bg-merkaba-hover'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-merkaba-muted shrink-0">Свой</span>
        <input
          value={custom}
          onChange={(e) => {
            const next = normalizeSpaceSymbol(e.target.value);
            setCustom(e.target.value);
            if (next) onChange(next);
          }}
          placeholder="эмодзи"
          maxLength={4}
          className="input-field !py-1.5 !text-sm w-20 text-center"
        />
      </div>
    </div>
  );
}
