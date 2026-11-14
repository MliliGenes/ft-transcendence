'use client';

import {
  IconBlockquote,
  IconBold,
  IconCode,
  IconItalic,
  IconLink,
  IconList,
  IconSourceCode,
  IconStrikethrough,
} from '@tabler/icons-react';

export type MarkdownFormat =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'codeblock'
  | 'quote'
  | 'list'
  | 'link';

const formats: {
  kind: MarkdownFormat;
  label: string;
  shortcut?: string;
  Icon: typeof IconBold;
}[] = [
  { kind: 'bold', label: 'Bold', shortcut: 'Ctrl+B', Icon: IconBold },
  { kind: 'italic', label: 'Italic', shortcut: 'Ctrl+I', Icon: IconItalic },
  {
    kind: 'strike',
    label: 'Strikethrough',
    shortcut: 'Ctrl+Shift+X',
    Icon: IconStrikethrough,
  },
  { kind: 'code', label: 'Inline code', shortcut: 'Ctrl+E', Icon: IconCode },
  { kind: 'codeblock', label: 'Code block', Icon: IconSourceCode },
  { kind: 'quote', label: 'Quote', Icon: IconBlockquote },
  { kind: 'list', label: 'Bulleted list', Icon: IconList },
  { kind: 'link', label: 'Link', shortcut: 'Ctrl+K', Icon: IconLink },
];

const wrappers: Partial<Record<MarkdownFormat, [string, string, string]>> = {
  bold: ['**', '**', 'bold text'],
  italic: ['_', '_', 'italic text'],
  strike: ['~~', '~~', 'struck text'],
  code: ['`', '`', 'code'],
  codeblock: ['```\n', '\n```', 'code'],
  link: ['[', '](https://)', 'link text'],
};

/** Applies a Markdown format to the textarea selection and returns the new value and selection. */
export function applyMarkdownFormat(
  value: string,
  start: number,
  end: number,
  kind: MarkdownFormat,
) {
  const selected = value.slice(start, end);
  if (kind === 'quote' || kind === 'list') {
    const prefix = kind === 'quote' ? '> ' : '- ';
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const block = value.slice(lineStart, end) || '';
    const lines = block.split('\n');
    const toggledOff = lines.every((line) => line.startsWith(prefix));
    const next = lines
      .map((line) => (toggledOff ? line.slice(prefix.length) : prefix + line))
      .join('\n');
    return {
      value: value.slice(0, lineStart) + next + value.slice(end),
      start: lineStart,
      end: lineStart + next.length,
    };
  }
  const [before, after, placeholder] = wrappers[kind]!;
  // Toggle off when the selection is already wrapped.
  if (
    selected &&
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after
  ) {
    return {
      value:
        value.slice(0, start - before.length) +
        selected +
        value.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    };
  }
  const text = selected || placeholder;
  const nextValue =
    value.slice(0, start) + before + text + after + value.slice(end);
  if (kind === 'link' && selected) {
    const urlStart = start + before.length + text.length + 2;
    return {
      value: nextValue,
      start: urlStart,
      end: urlStart + 'https://'.length,
    };
  }
  return {
    value: nextValue,
    start: start + before.length,
    end: start + before.length + text.length,
  };
}

export function shortcutFormat(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): MarkdownFormat | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (event.shiftKey) return key === 'x' ? 'strike' : null;
  return key === 'b'
    ? 'bold'
    : key === 'i'
      ? 'italic'
      : key === 'e'
        ? 'code'
        : key === 'k'
          ? 'link'
          : null;
}

export function MarkdownToolbar({
  controlsId,
  onFormat,
  disabled,
  preview,
  onPreviewChange,
}: {
  controlsId: string;
  onFormat: (kind: MarkdownFormat) => void;
  disabled?: boolean;
  preview: boolean;
  onPreviewChange: (preview: boolean) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 border-b border-border px-1.5 py-1"
      role="toolbar"
      aria-label="Text formatting"
      aria-controls={controlsId}
    >
      {formats.map(({ kind, label, shortcut, Icon }) => (
        <button
          key={kind}
          type="button"
          disabled={disabled || preview}
          title={shortcut ? `${label} (${shortcut})` : label}
          aria-label={label}
          // Keep focus (and the selection) in the textarea.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onFormat(kind)}
          className="grid size-9 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <Icon size={17} stroke={1.75} aria-hidden="true" />
        </button>
      ))}
      <div className="ml-auto flex" role="group" aria-label="Composer mode">
        {[false, true].map((mode) => (
          <button
            key={String(mode)}
            type="button"
            aria-pressed={preview === mode}
            onClick={() => onPreviewChange(mode)}
            className={`min-h-9 px-3 text-xs font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${preview === mode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {mode ? 'Preview' : 'Write'}
          </button>
        ))}
      </div>
    </div>
  );
}
