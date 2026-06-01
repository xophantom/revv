import { auth } from "@/auth";
export default auth((req) => {
  const p = req.nextUrl.pathname;
  const isApp = p.startsWith("/garage") || p.startsWith("/dashboard");
  if (isApp && !req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});
export const config = { matcher: ["/garage/:path*", "/dashboard/:path*"] };
