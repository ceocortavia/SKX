import { cookies } from "next/headers";

export function getOrgHint(req: Request): { hintedOrgId?: string | null } {
  const url = new URL(req.url);
  const hdr = (req.headers.get("x-org-id") || "").trim();
  const c = cookies().get("orgId")?.value;
  const q = url.searchParams.get("orgId");

  const isProd = process.env.NODE_ENV === "production";
  if (hdr) return { hintedOrgId: hdr };
  if (c) return { hintedOrgId: c };
  if (!isProd && q) return { hintedOrgId: q };
  return {};
}

export function setOrgCookie(orgId: string) {
  const jar = cookies();
  jar.set("orgId", orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
}


