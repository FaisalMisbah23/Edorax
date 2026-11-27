// Maps API error codes (and link-flow outcomes) to the copy shown on the login page.
export function loginErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "Invalid email or password.";
    case "EMAIL_UNVERIFIED":
      return "Verify your email before signing in. Check your inbox for the link.";
    case "RATE_LIMITED":
      return "Too many sign-in attempts. Wait a minute and try again.";
    case "missing":
      return "Enter your email and password.";
    case "missing-email":
      return "Enter your email to receive a sign-in link.";
    case "verify-missing":
    case "verify-invalid":
      return "That verification link is invalid.";
    case "verify-expired":
      return "That verification link has expired. Sign in and request a new one.";
    case "magic-invalid":
      return "That sign-in link is invalid or was already used.";
    case "magic-expired":
      return "That sign-in link has expired. Request a new one.";
    case "google-denied":
      return "Google sign-in was cancelled. You can try again or use your email.";
    case "google-unverified":
      return "Google has not verified that email address, so we cannot use it. Use another Google account or sign in with your email.";
    case "google-disposable":
      return "Please use a non-disposable email address.";
    case "google-mfa":
      return "This account uses an authenticator code. Sign in with your password and the code.";
    case "google-unavailable":
      return "Sign in with Google is not available right now. Use your email instead.";
    case "google-invalid":
    case "google-failed":
      return "Google sign-in did not finish. Try again.";
    case "google-suspended":
    case "ACCOUNT_SUSPENDED":
    case "magic-suspended":
    case "suspended":
      return "This account has been suspended. Contact a platform admin.";
    case "MFA_REQUIRED":
      return "Enter the 6-digit code from your authenticator app, or a backup code.";
    case "MFA_INVALID":
      return "That authenticator code is not valid.";
    default:
      return code ? "Sign in failed. Try again." : null;
  }
}
