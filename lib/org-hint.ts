import type { NextResponse } from "next/server";

function parseCookie(headerValue: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headerValue) return out;
  headerValue.split(/;\s*/).forEach((pair) => {
    const [k, v] = pair.split("=");
    if (k) out[k] = decodeURIComponent(v ?? "");
  });
  return out;
}

export function getOrgHint(req: Request): { hintedOrgId?: string | null } {
  const url = new URL(req.url);
  const hdr = (req.headers.get("x-org-id") || "").trim();
  const cookies = parseCookie(req.headers.get("cookie"));
  const c = cookies["orgId"];
  const q = url.searchParams.get("orgId");

  const isProd = process.env.NODE_ENV === "production";
  if (hdr) return { hintedOrgId: hdr };
  if (c) return { hintedOrgId: c };
  if (!isProd && q) return { hintedOrgId: q };
  return {};
}

export function setOrgCookie(res: NextResponse, orgId: string) {
  res.cookies.set("orgId", orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
}


