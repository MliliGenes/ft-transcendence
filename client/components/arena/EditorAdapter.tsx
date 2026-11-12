"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type { CollabClient } from "@/lib/arena/collab";

export type ArenaLanguage = "C++" | "Python" | "C";

export interface EditorSelection {
  anchor: number;
  head: number;
}

export interface EditorAdapterHandle {
  focus(): void;
  getSelection(): EditorSelection | null;
  setSelection(selection: EditorSelection): void;
}

export interface EditorAdapterProps {
  language: string;
  code: string;
  readOnly: boolean;
  fontSize: number;
  onChange: (code: string) => void;
  collab?: CollabClient;
}

export function resolveEditorLanguage(language: string): "cpp" | "python" | "plain" {
  if (language === "C++" || language === "C") return "cpp";
  if (language === "Python") return "python";
  return "plain";
}

/**
 * The user may type while the collaboration sidecar is still connecting. This
 * describes that local edit relative to the text the editor started from, so
 * it can be replayed on top of the authoritative team document.
 */
interface LocalEdit {
  prefix: string;
  removed: string;
  inserted: string;
  suffix: string;
}

/** Where a local edit lands inside the authoritative team document. */
interface AppliedEdit {
  from: number;
  to: number;
  insert: string;
}

function localEdit(base: string, local: string): LocalEdit | null {
  if (base === local) return null;
  let prefix = 0;
  while (prefix < base.length && prefix < local.length && base[prefix] === local[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < base.length - prefix &&
    suffix < local.length - prefix &&
    base[base.length - 1 - suffix] === local[local.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    prefix: base.slice(0, prefix),
    removed: base.slice(prefix, base.length - suffix),
    inserted: local.slice(prefix, local.length - suffix),
    suffix: base.slice(base.length - suffix),
  };
}

/**
 * Locate the local edit inside the team document. The surrounding text has to
 * still be there, otherwise the edit cannot be replayed and the team document
 * wins: a teammate's work is never overwritten by a stale local edit.
 */
function applyLocalEdit(authoritative: string, local: string, edit: LocalEdit): AppliedEdit | null {
  if (!authoritative) {
    // The team document is still empty, so there is nothing to conflict with.
    return { from: 0, to: 0, insert: local };
  }
  if (edit.removed === "") {
    if (edit.prefix && authoritative.startsWith(edit.prefix)) {
      return { from: edit.prefix.length, to: edit.prefix.length, insert: edit.inserted };
    }
    if (edit.suffix) {
      const at = authoritative.indexOf(edit.suffix, edit.prefix.length);
      if (at >= 0) return { from: at, to: at, insert: edit.inserted };
    }
    return null;
  }
  const at = authoritative.indexOf(edit.removed, edit.prefix.length);
  if (at < 0) return null;
  return { from: at, to: at + edit.removed.length, insert: edit.inserted };
}

function languageExtension(language: string) {
  switch (resolveEditorLanguage(language)) {
    case "cpp":
      return cpp();
    case "python":
      return python();
    default:
      return [];
  }
}

const nookEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--card, #121212)",
    color: "var(--foreground, #F5F5F5)",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  ".cm-content": {
    fontSize: "var(--editor-font-size, 14px)",
    padding: "12px 0",
    caretColor: "var(--primary, #F16B3A)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--card, #121212)",
    color: "var(--muted-foreground, #767676)",
    borderRight: "1px solid var(--border, #292929)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--secondary, #1C1C1C)",
    color: "var(--foreground, #F5F5F5)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(241, 107, 58, 0.05)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--primary, #F16B3A)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(241, 107, 58, 0.25) !important",
  },
  ".cm-ySelection": {
    opacity: 0.3,
  },
  ".cm-ySelectionInfo": {
    padding: "2px 4px",
    fontSize: "11px",
    borderRadius: "2px",
    fontFamily: "var(--font-inter), sans-serif",
    fontWeight: "bold",
    color: "#000000",
  },
});

/** Local-only editing: the editor owns its own undo history. */
function localEditingExtensions() {
  return [history(), keymap.of([...defaultKeymap, ...historyKeymap])];
}

/** Team editing: the shared document owns the undo history. */
function collaborativeExtensions(client: CollabClient) {
  return [yCollab(client.ytext, client.awareness), keymap.of(yUndoManagerKeymap), keymap.of(defaultKeymap)];
}

export const EditorAdapter = forwardRef<EditorAdapterHandle, EditorAdapterProps>(
  function EditorAdapter({ language, code, readOnly, fontSize, onChange, collab }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const confRef = useRef<{
      language: Compartment;
      readOnly: Compartment;
      label: Compartment;
      collab: Compartment;
    } | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const label = `Solution editor (${language})`;

    const initialRef = useRef<{ code: string; language: string; readOnly: boolean; label: string } | null>(null);
    if (initialRef.current === null) {
      initialRef.current = { code: collab ? collab.getSource() : code, language, readOnly, label };
    }
    const collabRef = useRef(collab);
    collabRef.current = collab;
    /** The document the editor is actually attached to; it differs from the
     * `collab` prop while the collaboration sidecar is still connecting. */
    const boundCollabRef = useRef<CollabClient | null>(null);
    /** The text the editor started from: local edits are relative to it. */
    const baseRef = useRef(initialRef.current.code);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const initial = initialRef.current ?? { code: "", language: "Python", readOnly: false, label: "Solution editor" };
      const languageConf = new Compartment();
      const readOnlyConf = new Compartment();
      const labelConf = new Compartment();
      const collabConf = new Compartment();
      confRef.current = { language: languageConf, readOnly: readOnlyConf, label: labelConf, collab: collabConf };
      const binding = collabRef.current ?? null;
      boundCollabRef.current = binding;

      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: binding ? binding.getSource() : initial.code,
          extensions: [
            lineNumbers(),
            collabConf.of(binding ? collaborativeExtensions(binding) : localEditingExtensions()),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            nookEditorTheme,
            languageConf.of(languageExtension(initial.language)),
            readOnlyConf.of([EditorView.editable.of(!initial.readOnly), EditorState.readOnly.of(initial.readOnly)]),
            labelConf.of(
              EditorView.contentAttributes.of({
                "aria-label": initial.label,
                spellcheck: "false",
              }),
            ),
            EditorView.updateListener.of((update) => {
              const active = boundCollabRef.current;
              if (active) {
                if (update.docChanged) onChangeRef.current(active.getSource());
                if (update.selectionSet) {
                  const s = update.state.selection.main;
                  active.setLocalCursor(s.anchor, s.head);
                }
                return;
              }
              if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            }),
          ],
        }),
      });
      viewRef.current = view;

      return () => {
        viewRef.current = null;
        view.destroy();
      };
    }, []);

    /**
     * Collaboration lifecycle. The sidecar resolves asynchronously, so the
     * editor is mounted first and only attached to the team document once a
     * client exists - and re-attached when a new round hands us a new client.
     */
    useEffect(() => {
      const view = viewRef.current;
      const conf = confRef.current;
      if (!view || !conf) return;
      const next = collab ?? null;
      const previous = boundCollabRef.current;
      if (previous === next) return;
      boundCollabRef.current = next;

      if (!next) {
        view.dispatch({ effects: conf.collab.reconfigure(localEditingExtensions()) });
        onChangeRef.current(view.state.doc.toString());
        return;
      }

      const authoritative = next.getSource();
      const local = view.state.doc.toString();
      const edit = previous === null ? localEdit(baseRef.current, local) : null;
      const applied = edit ? applyLocalEdit(authoritative, local, edit) : null;

      if (previous !== null) {
        // `y-codemirror` keeps the sync plugin instance when the extension is
        // reconfigured in place, which would leave the editor attached to the
        // previous document. Detach first so the new client binds a fresh one.
        view.dispatch({ effects: conf.collab.reconfigure([]) });
      }

      if (applied) {
        // The user typed before the team document was attached: keep those
        // edits by replaying them on the shared document before binding it.
        const ytext = next.ytext;
        const from = Math.min(applied.from, ytext.length);
        const to = Math.min(applied.to, ytext.length);
        if (to > from) ytext.delete(from, to - from);
        if (applied.insert) ytext.insert(from, applied.insert);
      }

      // Read the shared document back: it is the single source of truth for
      // the editor, the workspace state and the submission.
      const shared = next.getSource();
      view.dispatch({
        changes: local === shared ? undefined : { from: 0, to: view.state.doc.length, insert: shared },
        effects: conf.collab.reconfigure(collaborativeExtensions(next)),
      });
      onChangeRef.current(shared);
    }, [collab]);

    useEffect(() => {
      if (boundCollabRef.current) return;
      const view = viewRef.current;
      if (!view) return;
      if (view.state.doc.toString() !== code) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: code },
        });
        baseRef.current = code;
      }
    }, [code]);

    useEffect(() => {
      const view = viewRef.current;
      const conf = confRef.current;
      if (!view || !conf) return;
      view.dispatch({
        effects: conf.language.reconfigure(languageExtension(language)),
      });
    }, [language]);

    useEffect(() => {
      const view = viewRef.current;
      const conf = confRef.current;
      if (!view || !conf) return;
      view.dispatch({
        effects: conf.readOnly.reconfigure([
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(readOnly),
        ]),
      });
    }, [readOnly]);

    useEffect(() => {
      const view = viewRef.current;
      const conf = confRef.current;
      if (!view || !conf) return;
      view.dispatch({
        effects: conf.label.reconfigure(
          EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false" }),
        ),
      });
    }, [label]);

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      getSelection: () => {
        const view = viewRef.current;
        if (!view) return null;
        const s = view.state.selection.main;
        return { anchor: s.anchor, head: s.head };
      },
      setSelection: (selection: EditorSelection) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ selection: { anchor: selection.anchor, head: selection.head } });
        view.focus();
      },
    }));

    return (
      <div
        ref={hostRef}
        data-language={language}
        data-testid="solution-editor"
        className="h-full w-full overflow-hidden border border-border bg-card font-mono text-sm leading-relaxed text-foreground focus-within:ring-2 focus-within:ring-primary focus-within:border-primary"
        style={{ "--editor-font-size": `${fontSize}px` } as React.CSSProperties}
      />
    );
  },
);
