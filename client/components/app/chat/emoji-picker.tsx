"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { IconClock, IconMoodSmile, IconSearch } from "@tabler/icons-react";
import { allEmojis, emojiCategories, type Emoji } from "@/lib/chat/emoji-data";

const columns = 8;
const recentKey = "nook.chat.recent-emojis";
const maxRecent = 16;

function readRecent(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(recentKey) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, maxRecent) : [];
  } catch { return []; }
}

function writeRecent(list: string[]) {
  try { window.localStorage.setItem(recentKey, JSON.stringify(list)); } catch { /* Private mode or blocked storage: recents are a convenience. */ }
}

/** Emoji button + popover for the chat composer. Calls `onSelect` with the native emoji. */
export function EmojiPicker({ onSelect, disabled }: { onSelect: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger
      type="button"
      disabled={disabled}
      aria-label="Insert emoji"
      title="Emoji"
      className="grid size-11 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
    ><IconMoodSmile size={20} aria-hidden="true" /></Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner side="top" align="end" sideOffset={8} className="z-50 outline-none">
        <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] border border-border bg-popover text-popover-foreground shadow-lg outline-none">
          <Popover.Title className="sr-only">Emoji</Popover.Title>
          <EmojiPanel onPick={emoji => { onSelect(emoji); setOpen(false); }} />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [category, setCategory] = useState(recent.length ? "recent" : emojiCategories[0].id);
  const [hovered, setHovered] = useState<Emoji | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const term = query.trim().toLowerCase();
  const results = useMemo(() => term ? allEmojis.filter(emoji => emoji.name.includes(term) || emoji.keywords?.includes(term)) : null, [term]);
  const recentEmojis = useMemo(() => recent.map(char => allEmojis.find(emoji => emoji.char === char) ?? { char, name: char }), [recent]);
  const visible = results ?? (category === "recent" ? recentEmojis : emojiCategories.find(item => item.id === category)?.emojis ?? []);
  const heading = results ? `${results.length} ${results.length === 1 ? "result" : "results"}` : category === "recent" ? "Recently used" : emojiCategories.find(item => item.id === category)?.label;

  function pick(emoji: Emoji) {
    const next = [emoji.char, ...recent.filter(char => char !== emoji.char)].slice(0, maxRecent);
    setRecent(next);
    writeRecent(next);
    onPick(emoji.char);
  }

  // Arrow keys move through the grid like a spreadsheet.
  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns, Home: -index, End: buttons.length - 1 - index }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    buttons[Math.min(buttons.length - 1, Math.max(0, index + step))]?.focus();
  }

  return <div className="flex flex-col">
    <div className="border-b border-border p-2">
      <label className="relative block">
        <span className="sr-only">Search emoji</span>
        <IconSearch size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); gridRef.current?.querySelector("button")?.focus(); } if (event.key === "Enter" && results?.[0]) { event.preventDefault(); pick(results[0]); } }} placeholder="Search emoji" className="h-10 w-full border border-input bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring" />
      </label>
    </div>
    {!results && <div role="tablist" aria-label="Emoji categories" className="flex border-b border-border px-1">
      {[...(recent.length ? [{ id: "recent", label: "Recently used", icon: "" }] : []), ...emojiCategories].map(item => <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={category === item.id}
        aria-label={item.label}
        title={item.label}
        onClick={() => setCategory(item.id)}
        className={`grid h-10 flex-1 place-items-center border-b-2 text-lg outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${category === item.id ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
      >{item.id === "recent" ? <IconClock size={18} aria-hidden="true" /> : <span aria-hidden="true">{item.icon}</span>}</button>)}
    </div>}
    <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground" aria-live="polite">{heading}</p>
    <div ref={gridRef} onKeyDown={onGridKeyDown} className="grid h-56 auto-rows-min grid-cols-8 content-start overflow-y-auto px-2 pb-2" role="group" aria-label={heading}>
      {visible.map(emoji => <button
        key={emoji.char}
        type="button"
        aria-label={emoji.name}
        title={`:${emoji.name.replace(/\s+/g, "_")}:`}
        onClick={() => pick(emoji)}
        onMouseEnter={() => setHovered(emoji)}
        onFocus={() => setHovered(emoji)}
        className="grid aspect-square place-items-center text-[22px] leading-none outline-none hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >{emoji.char}</button>)}
      {visible.length === 0 && <p className="col-span-8 py-8 text-center text-sm text-muted-foreground">No emoji match “{query.trim()}”.</p>}
    </div>
    <div className="flex h-11 items-center gap-2 border-t border-border px-3 text-sm" aria-hidden="true">
      {hovered ? <><span className="text-xl">{hovered.char}</span><span className="truncate text-muted-foreground">:{hovered.name.replace(/\s+/g, "_")}:</span></> : <span className="text-muted-foreground">Pick an emoji</span>}
    </div>
  </div>;
}
