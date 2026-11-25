"use client";

import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies the whole feedback list as plain text, ready to paste to whoever will fix it. */
export function CopyFeedbackButton({ text, label = "Copy all as text" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          setCopied(false);
        }
      }}
    >
      <ClipboardCopy aria-hidden /> {copied ? "Copied" : label}
    </Button>
  );
}
