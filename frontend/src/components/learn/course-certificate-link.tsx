"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MyCertificateState } from "@/shared/lib/certificates";

/** A "View certificate" button for a finished course card. It renders nothing until a certificate exists. */
export function CourseCertificateLink({ courseSlug, className }: { courseSlug: string; className?: string }) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<MyCertificateState>(`/api/v1/courses/${encodeURIComponent(courseSlug)}/certificate`)
      .then((state) => {
        if (live && state.certificate) setCode(state.certificate.code);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [courseSlug]);

  if (!code) return null;
  return (
    <Link href={`/verify/${code}`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11", className)}>
      <Award aria-hidden /> View certificate
    </Link>
  );
}
