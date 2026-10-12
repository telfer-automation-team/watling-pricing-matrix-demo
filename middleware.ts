import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "wpm_session";
const PUBLIC = ["/login", "/auth"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));
  const signedIn = Boolean(request.cookies.get(COOKIE)?.value);

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (signedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/quote";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Exclude static assets so the logo/fonts never 404 (the LiveLink gotcha).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|otf|ttf|woff|woff2|css|js|json|txt)$).*)",
  ],
};
