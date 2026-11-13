"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { MessageAttachment } from "@/components/app/chat/message-list";
import { cn } from "@/lib/utils";

export function AttachmentCarousel({ conversationId, attachments }: { conversationId: string; attachments: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = attachments.length;

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }, [count]);

  useEffect(() => { setIndex(i => Math.min(i, count - 1)); }, [count]);

  function goTo(next: number) {
    const el = trackRef.current;
    if (!el) return;
    const target = Math.min(count - 1, Math.max(0, next));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  }

  if (count === 0) return null;
  const arrow = "absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow hover:bg-background focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <div className="relative mt-3" role="group" aria-roledescription="carousel" aria-label="Post attachments">
      <div
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={e => {
          if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
          if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {attachments.map((key, i) => (
          <div
            key={key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            className="flex w-full shrink-0 snap-center items-center justify-center bg-muted/30 [&_img]:max-h-[28rem] [&_video]:max-h-[28rem] [&_video]:w-full"
          >
            <MessageAttachment conversationId={conversationId} objectKey={key} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          {index > 0 && <button type="button" onClick={() => goTo(index - 1)} className={cn(arrow, "left-2")} aria-label="Previous attachment"><IconChevronLeft size={18} aria-hidden="true" /></button>}
          {index < count - 1 && <button type="button" onClick={() => goTo(index + 1)} className={cn(arrow, "right-2")} aria-label="Next attachment"><IconChevronRight size={18} aria-hidden="true" /></button>}
          <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium" aria-hidden="true">{index + 1}/{count}</span>
          <div className="mt-2 flex justify-center gap-1.5">
            {attachments.map((key, i) => (
              <button key={key} type="button" onClick={() => goTo(i)} aria-label={`Go to attachment ${i + 1}`} aria-current={i === index} className={cn("size-1.5 rounded-full transition-colors", i === index ? "bg-primary" : "bg-muted-foreground/40")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
