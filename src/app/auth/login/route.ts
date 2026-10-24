import { authClient } from "@/lib/auth";
import { failure } from "@/lib/http";
import { directGoogleAuth, startGoogleLogin } from "@/lib/google-login";
export async function GET(request: Request) {
  try {
    if (directGoogleAuth()) return await startGoogleLogin(request);
    const client = await authClient();
    const origin = process.env.APP_URL ?? new URL(request.url).origin;
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: origin + "/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url) throw error;
    return Response.redirect(data.url, 303);
  } catch (e) {
    return failure(e);
  }
}
