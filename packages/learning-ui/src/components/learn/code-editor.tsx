"use client";

import { useEffect, useRef, type RefObject } from "react";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { cn } from "../../lib/utils";

export type CodeEditorHandle = {
  applyFormatted: (code: string, cursorOffset?: number) => void;
  getCursorOffset: () => number;
  focus: () => void;
};

export type CodeMirrorEditorProps = {
  value: string;
  onChange: (next: string) => void;
  language?: string;
  readOnly?: boolean;
  ariaLabel: string;
  minHeight?: string;
  maxHeight?: string;
  maxLength?: number;
  onRunShortcut?: () => void;
  onFormatShortcut?: () => void;
  editorRef?: RefObject<CodeEditorHandle | null>;
  className?: string;
};

const edoraxHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword],
    color: "var(--cm-keyword, #2434e0)",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp],
    color: "var(--cm-string, #0b6b45)",
  },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom],
    color: "var(--cm-number, #b45309)",
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--cm-comment, #647099)",
    fontStyle: "italic",
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--cm-function, #6d28d9)",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace],
    color: "var(--cm-type, #0e7490)",
  },
  {
    tag: [tags.operator, tags.punctuation],
    color: "var(--cm-operator, #334155)",
  },
]);

function languageExtension(language: string | undefined): Extension {
  const normalized = (language ?? "javascript").trim().toLowerCase();
  if (normalized === "typescript" || normalized === "ts" || normalized === "tsx") {
    return javascript({ jsx: normalized === "tsx", typescript: true });
  }
  return javascript({ jsx: normalized === "jsx", typescript: false });
}

function readOnlyExtension(readOnly: boolean): Extension {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

/**
 * Shared CodeMirror 6 editor themed to Edorax `--code-*` and `--cm-*` tokens.
 * Mounts purely client-side and keeps Undo history intact across external Format dispatches.
 */
export function CodeMirrorEditor({
  value,
  onChange,
  language = "javascript",
  readOnly = false,
  ariaLabel,
  minHeight = "220px",
  maxHeight = "min(420px, 55vh)",
  maxLength,
  onRunShortcut,
  onFormatShortcut,
  editorRef,
  className,
}: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRunShortcut);
  const onFormatRef = useRef(onFormatShortcut);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRunRef.current = onRunShortcut;
  }, [onRunShortcut]);

  useEffect(() => {
    onFormatRef.current = onFormatShortcut;
  }, [onFormatShortcut]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const theme = EditorView.theme({
      "&": {
        backgroundColor: "var(--code-surface)",
        color: "var(--code-fg)",
        fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "13px",
        lineHeight: "1.65",
      },
      "&.cm-focused": {
        outline: "2px solid var(--ring)",
        outlineOffset: "-2px",
      },
      ".cm-scroller": {
        overflow: "auto",
        minHeight,
        maxHeight,
        fontFamily: "inherit",
        lineHeight: "inherit",
      },
      ".cm-content": {
        padding: "16px 12px",
        caretColor: "var(--primary)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--code-surface)",
        color: "var(--code-lang-fg)",
        borderRight: "1px solid var(--code-border)",
        paddingLeft: "4px",
        paddingRight: "4px",
        userSelect: "none",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--cm-active-line, rgb(36 52 224 / 6%))",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "var(--code-fg)",
        fontWeight: "600",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--cm-selection, rgb(36 52 224 / 16%))",
      },
      ".cm-matchingBracket": {
        backgroundColor: "var(--cm-selection, rgb(36 52 224 / 16%))",
        outline: "1px solid var(--primary)",
      },
    });

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      indentUnit.of("  "),
      syntaxHighlighting(edoraxHighlightStyle),
      languageCompartment.current.of(languageExtension(language)),
      readOnlyCompartment.current.of(readOnlyExtension(readOnly)),
      Prec.high(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              if (!onRunRef.current) return false;
              onRunRef.current();
              return true;
            },
          },
          {
            key: "Shift-Alt-f",
            run: () => {
              if (!onFormatRef.current) return false;
              onFormatRef.current();
              return true;
            },
          },
        ])
      ),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      theme,
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        spellcheck: "false",
        autocapitalize: "off",
        autocorrect: "off",
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];

    if (typeof maxLength === "number") {
      extensions.push(EditorState.changeFilter.of((tr) => tr.newDoc.length <= maxLength));
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions,
      }),
      parent: host,
    });

    viewRef.current = view;
    if (editorRef) {
      editorRef.current = {
        applyFormatted(code: string, cursorOffset?: number) {
          const current = view.state.doc.toString();
          if (code === current) {
            view.focus();
            return;
          }
          const anchor =
            typeof cursorOffset === "number" ? Math.max(0, Math.min(cursorOffset, code.length)) : undefined;
          view.dispatch({
            changes: { from: 0, to: current.length, insert: code },
            ...(anchor !== undefined ? { selection: { anchor } } : {}),
          });
          view.focus();
        },
        getCursorOffset() {
          return view.state.selection.main.head;
        },
        focus() {
          view.focus();
        },
      };
    }

    return () => {
      if (editorRef) editorRef.current = null;
      viewRef.current = null;
      view.destroy();
    };
    // Mount once per configuration surface; language/readOnly/value reconfigure incrementally below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ariaLabel, minHeight, maxHeight, maxLength]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: languageCompartment.current.reconfigure(languageExtension(language)) });
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: readOnlyCompartment.current.reconfigure(readOnlyExtension(readOnly)) });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value === current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div
      ref={hostRef}
      className={cn("w-full bg-[var(--code-surface)]", readOnly && "opacity-90", className)}
      style={{ minHeight }}
    />
  );
}
