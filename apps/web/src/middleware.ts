import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "../auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  const needsAdmin = pathname.startsWith("/issuer") || pathname.startsWith("/admin");
  const needsHolder = pathname.startsWith("/wallet");
  if (!needsAdmin && !needsHolder) return NextResponse.next();

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (needsAdmin && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (needsHolder && role !== "HOLDER") {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/issuer/:path*", "/admin/:path*", "/wallet/:path*"],
};
