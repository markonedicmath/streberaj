import { authClient } from "@/lib/auth";
import { failure } from "@/lib/http";
import { directGoogleAuth, finishGoogleLogin } from "@/lib/google-login";
export async function GET(request: Request) {
  try {
    if (directGoogleAuth()) return await finishGoogleLogin(request);
    const code = new URL(request.url).searchParams.get("code");
    if (!code)
      return Response.redirect(new URL("/?login=failed", request.url), 303);
    const client = await authClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error)
      return Response.redirect(new URL("/?login=failed", request.url), 303);
    return Response.redirect(
      new URL("/", process.env.APP_URL ?? request.url),
      303,
    );
  } catch (e) {
    return failure(e);
  }
}
