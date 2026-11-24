"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DesktopDownloadOption {
  platform: "darwin" | "win32" | "linux";
  label: string;
  url: string;
  version: string | null;
}

/** The platform of this browser, or null when it is a phone or cannot be told. */
function detectPlatform(): DesktopDownloadOption["platform"] | null {
  const agent = navigator.userAgent;
  if (/android|iphone|ipad|ipod/i.test(agent)) return null;
  if (/windows/i.test(agent)) return "win32";
  if (/mac/i.test(agent)) return "darwin";
  if (/linux|x11/i.test(agent)) return "linux";
  return null;
}

const primaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-primary bg-primary px-5 text-base font-bold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow";
const secondaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-primary px-5 text-base font-bold text-primary outline-none transition-colors hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow";

/**
 * Download buttons for the Edorax desktop app. The button for the visitor's own system comes first;
 * on a phone, or when the system is unknown, every system is shown the same way.
 */
export function DesktopDownloadButtons({ options, className }: { options: DesktopDownloadOption[]; className?: string }) {
  const [platform, setPlatform] = useState<DesktopDownloadOption["platform"] | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const main = options.find((option) => option.platform === platform) ?? null;
  const others = options.filter((option) => option !== main);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-3">
        {main ? (
          <a href={main.url} className={primaryClass} data-testid="desktop-download-main">
            <Download className="size-4" aria-hidden />
            Download for {main.label}
          </a>
        ) : null}
        {others.map((option) => (
          <a key={option.platform} href={option.url} className={main ? secondaryClass : primaryClass}>
            <Download className="size-4" aria-hidden />
            {main ? option.label : `Download for ${option.label}`}
          </a>
        ))}
      </div>
    </div>
  );
}
