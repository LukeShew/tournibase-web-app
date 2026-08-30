import { NextResponse, type NextRequest } from "next/server";
import {
  assertRequestHostMatchesAppEnvironment,
  getAppEnvironment,
  getRequestHostname,
  isOfflinePassImageOptimizationSource,
  validateAppRuntimeConfiguration,
} from "@/lib/app-environment";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  try {
    validateAppRuntimeConfiguration();
    assertRequestHostMatchesAppEnvironment(
      getRequestHostname({
        fallbackHostname: request.nextUrl.hostname,
        forwardedHost: request.headers.get("x-forwarded-host"),
        host: request.headers.get("host"),
      }),
    );
  } catch (error) {
    console.error("[runtime-config] invalid deployment configuration", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new NextResponse("Service unavailable.", { status: 503 });
  }

  if (
    request.nextUrl.pathname === "/_next/image" &&
    isOfflinePassImageOptimizationSource(request.nextUrl.searchParams.get("url"))
  ) {
    return new NextResponse("Not found.", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  const response = await updateSession(request);

  if (getAppEnvironment() === "test") {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
