import { NextResponse } from "next/server";
import { setOrgCookie } from "@/lib/org-hint";

export async function POST(req: Request) {
  const hdr = req.headers.get("x-org-id");
  if (!hdr) return NextResponse.json({ error: "Missing x-org-id" }, { status: 400 });
  const res = new NextResponse(null, { status: 204 });
  setOrgCookie(res, hdr);
  return res;
}


