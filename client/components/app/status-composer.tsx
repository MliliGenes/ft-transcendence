'use client';

import { IconMoodSmile, IconX } from '@tabler/icons-react';
import { Label } from '@/components/ui/label';
import {
  StatusPill,
  StatusIcon,
  statusIconLabel,
  statusIconOptions,
} from '@/components/app/status-icon';

const MAX_LENGTH = 100;

type Props = {
  text: string;
  icon: string;
  onTextChange: (value: string) => void;
  onIconChange: (value: string) => void;
};

/** Status editor: icon + text in one field, an icon picker row, and a live preview. */
export function StatusComposer({
  text,
  icon,
  onTextChange,
  onIconChange,
}: Props) {
  const remaining = MAX_LENGTH - text.length;

  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="statusText">Status</Label>
      <div className="border border-input bg-background focus-within:outline-2 focus-within:outline-ring">
        <div className="flex items-center gap-2 p-2">
          <span
            className="flex size-10 shrink-0 items-center justify-center bg-nook-accent-subtle text-primary"
            aria-hidden="true"
          >
            {icon ? (
              <StatusIcon name={icon} size={20} />
            ) : (
              <IconMoodSmile size={20} className="text-muted-foreground" />
            )}
          </span>
          <input
            id="statusText"
            type="text"
            maxLength={MAX_LENGTH}
            placeholder="What are you up to?"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <span
            className={`shrink-0 text-xs tabular-nums ${remaining <= 10 ? 'text-destructive' : 'text-muted-foreground'}`}
            aria-live="polite"
          >
            {remaining}
          </span>
          {(text || icon) && (
            <button
              type="button"
              onClick={() => {
                onTextChange('');
                onIconChange('');
              }}
              aria-label="Clear status"
              className="inline-flex size-10 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <IconX size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Status icon"
          className="flex flex-wrap items-center gap-1 border-t border-border p-2"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!icon}
            aria-label="No icon"
            title="No icon"
            onClick={() => onIconChange('')}
            className={`inline-flex size-10 items-center justify-center focus-visible:outline-2 focus-visible:outline-ring ${!icon ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <IconMoodSmile size={18} aria-hidden="true" />
          </button>
          {statusIconOptions.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={icon === option}
              aria-label={statusIconLabel(option)}
              title={statusIconLabel(option)}
              onClick={() => onIconChange(option)}
              className={`inline-flex size-10 items-center justify-center focus-visible:outline-2 focus-visible:outline-ring ${icon === option ? 'bg-nook-accent-subtle text-primary ring-1 ring-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <StatusIcon name={option} size={18} />
            </button>
          ))}
        </div>
      </div>
      <div className="pb-4 pt-1">
        <p className="mb-2 text-xs text-muted-foreground">
          Preview — shown next to your avatar
        </p>
        {text.trim() ? (
          <StatusPill text={text.trim()} icon={icon} />
        ) : (
          <p className="text-xs italic text-muted-foreground">No status set.</p>
        )}
      </div>
    </div>
  );
}
