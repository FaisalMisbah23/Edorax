"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";

export function CopyJoinLinkButton({ joinUrl, size = "xs" }: { joinUrl: string; size?: "xs" | "sm" }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    const ok = await copyToClipboard(joinUrl);
    setCopied(ok);
    setFailed(!ok);
    window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 2000);
  };

  return (
    <Button type="button" variant="outline" size={size} onClick={() => void copy()}>
      {copied ? <Check /> : <Link2 />}
      {copied ? "Copied" : failed ? "Could not copy" : "Copy join link"}
    </Button>
  );
}
