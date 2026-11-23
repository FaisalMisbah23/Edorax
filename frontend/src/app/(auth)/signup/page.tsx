import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import Link from "next/link";
import { AuthCard, AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { safeRedirectTo } from "@/shared/lib/safe-redirect";
import { getSessionUser } from "@/server/auth/guards";
import { homeRouteForRole } from "@/server/auth/access-rules";
import { redirect } from "next/navigation";

// Account and checkout pages stay out of search results (and so out of the sitelinks).
export const metadata: Metadata = { title: "Create your account", robots: NOINDEX };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const redirectTo = safeRedirectTo((await searchParams).redirectTo);
  const user = await getSessionUser();
  if (user) {
    if (user.role !== "ADMIN" && !user.emailVerified) redirect("/verify-email");
    redirect(redirectTo ?? homeRouteForRole(user.role));
  }
  return (
    <AuthPageShell>
      <AuthCard
        title="Create your account"
        description="We email you a link to confirm. Then you can start."
        mood="happy"
        line="Glad you are here."
      >
        <SignupForm redirectTo={redirectTo} />
        <p className="mt-6 text-center text-base text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login"}
            className="font-bold text-primary underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthPageShell>
  );
}
