import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { AuthMessage } from "@/components/auth/auth-message";

// Account and checkout pages stay out of search results (and so out of the sitelinks).
export const metadata: Metadata = { title: "Check your email", robots: NOINDEX };

export default function VerifyRequestPage() {
  return (
    <AuthMessage
      mood="happy"
      line="Almost there."
      title="Check your email"
      text="We sent you a link to sign in. It stops working soon, so use it now. No email? Look in your spam folder, or go back and try again."
    />
  );
}
