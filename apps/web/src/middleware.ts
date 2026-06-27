import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "../auth.config";
import { cspValue } from "./lib/security-headers";

const { auth } = NextAuth(authConfig);

const isProd = process.env.NODE_ENV === "production";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Per-request nonce so the strict prod CSP can authorize Next's inline
  // hydration/RSC scripts. Next.js reads the nonce from the request's CSP header
  // and stamps it onto every <script> it emits; without it nothing hydrates.
  const nonce = btoa(crypto.randomUUID());
  const csp = cspValue(isProd, nonce);

  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  const role = req.auth?.user?.role;
  const needsAdmin = pathname.startsWith("/issuer") || pathname.startsWith("/admin");
  const needsHolder = pathname.startsWith("/wallet");

  if (needsAdmin || needsHolder) {
    if (!req.auth) {
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("callbackUrl", pathname);
      return withCsp(NextResponse.redirect(url));
    }
    if (needsAdmin && role !== "ADMIN") {
      return withCsp(NextResponse.redirect(new URL("/login", req.nextUrl.origin)));
    }
    if (needsHolder && role !== "HOLDER") {
      return withCsp(NextResponse.redirect(new URL("/login", req.nextUrl.origin)));
    }
  }

  // Forward the nonce on the request so Next can apply it to its <script> tags,
  // and echo the CSP on the response so the browser enforces it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
  // Run on every document route so the CSP+nonce is always present. Exclude API
  // routes, Next internals, and the static prover artifacts (not documents — no
  // nonce needed); those still receive COOP/COEP/etc. from next.config.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|circuit).*)"],
};
