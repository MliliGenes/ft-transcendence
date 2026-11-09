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

export const EditorAdapter = forwardRef<EditorAdapterHandle, EditorAdapterProps>(
  function EditorAdapter({ language, code, readOnly, fontSize, onChange, collab }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const confRef = useRef<{
      language: Compartment;
      readOnly: Compartment;
      label: Compartment;
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

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const initial = initialRef.current ?? { code: "", language: "Python", readOnly: false, label: "Solution editor" };
      const languageConf = new Compartment();
      const readOnlyConf = new Compartment();
      const labelConf = new Compartment();
      confRef.current = { language: languageConf, readOnly: readOnlyConf, label: labelConf };
      const binding = collabRef.current;

      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: binding ? binding.getSource() : initial.code,
          extensions: [
            lineNumbers(),
            ...(binding
              ? [keymap.of(yUndoManagerKeymap), keymap.of(defaultKeymap)]
              : [history(), keymap.of([...defaultKeymap, ...historyKeymap])]),
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
            ...(binding ? [yCollab(binding.ytext, binding.awareness)] : []),
            EditorView.updateListener.of((update) => {
              if (binding) {
                if (update.docChanged) onChangeRef.current(binding.getSource());
                if (update.selectionSet) {
                  const s = update.state.selection.main;
                  binding.setLocalCursor(s.anchor, s.head);
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

    useEffect(() => {
      if (collabRef.current) return;
      const view = viewRef.current;
      if (!view) return;
      if (view.state.doc.toString() !== code) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: code },
        });
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
