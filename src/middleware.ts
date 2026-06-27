import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/login", "/register"];
// Accessible to everyone (authenticated or not) — no redirect either way
const openRoutes = ["/pitch"];

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isOpenRoute = openRoutes.some((r) => nextUrl.pathname === r || nextUrl.pathname.startsWith(r + "/"));

  if (isOpenRoute) return NextResponse.next();

  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/employee/my-skills", nextUrl));
  }

  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
