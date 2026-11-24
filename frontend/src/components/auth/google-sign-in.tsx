import { cn } from "@/lib/utils";

/**
 * "Continue with Google" for the sign-in and sign-up pages. It is a plain link, so it works before
 * any script loads. Signing in and signing up are the same step: the API creates the account when
 * the Google email is new.
 */
export function GoogleSignIn({ redirectTo, className }: { redirectTo?: string | null; className?: string }) {
  const href = redirectTo ? `/api/v1/auth/google?redirectTo=${encodeURIComponent(redirectTo)}` : "/api/v1/auth/google";
  return (
    <div className={cn("mb-6", className)}>
      {/* A full page load on purpose: the API answers with a redirect to Google. */}
      <a
        href={href}
        data-testid="google-sign-in"
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md border-2 border-input bg-card px-4 text-[15px] font-bold text-foreground outline-none transition-colors hover:border-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
      >
        <GoogleMark />
        Continue with Google
      </a>
      <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
