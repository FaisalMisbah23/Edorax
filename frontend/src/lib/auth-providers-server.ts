import "server-only";
import { serverApiFetch } from "@/lib/api-server";

/** Which sign-in buttons to show. When the API cannot be reached, none of the extra ones. */
export async function loadAuthProviders(): Promise<{ google: boolean }> {
  try {
    const { google } = await serverApiFetch<{ google: boolean }>("/api/v1/auth/providers", { token: null });
    return { google: google === true };
  } catch {
    return { google: false };
  }
}
