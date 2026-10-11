import { RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { cn } from '../../lib/utils';

export function GeneratedIdInput({
  id,
  value,
  onChange,
  onGenerate,
  generateLabel,
  generateTitle,
  generating = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void | Promise<void>;
  generateLabel: string;
  generateTitle?: string;
  generating?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1"
      />
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 px-3"
        title={generateTitle}
        aria-label={generateTitle ?? generateLabel}
        disabled={generating}
        onClick={() => void onGenerate()}
      >
        <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
        {generateLabel}
      </Button>
    </div>
  );
}
