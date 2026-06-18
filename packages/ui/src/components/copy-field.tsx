'use client';

import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';

export interface CopyFieldProps {
  value: string;
  placeholder?: string;
  className?: string;
}

export function CopyField({ value, placeholder, className }: CopyFieldProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className={`flex items-center gap-2 w-full ${className || ''}`}>
      <Input
        readOnly
        value={value}
        placeholder={placeholder}
        className="font-mono text-xs flex-1 select-all bg-muted/20"
        onClick={(e) => {
          (e.target as HTMLInputElement).select();
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={`shrink-0 transition-all duration-200 cursor-pointer ${
          copied
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : ''
        }`}
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="size-4 text-emerald-500 stroke-[3]" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
    </div>
  );
}
