import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";

export const dynamic = "force-dynamic";

// Simple rate limiting
const rateLimit = new Map<string, number>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const lastCall = rateLimit.get(userId) || 0;
  
  if (now - lastCall < 5000) { // 5 seconds
    return false;
  }
  
  rateLimit.set(userId, now);
  return true;
}

export async function GET(req: Request) {
  try {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_EXPORTS_ENABLED !== "1") {
      return NextResponse.json({
        error: "PDF exports not enabled"
      }, { status: 403 });
    }

    const authContext = await getAuthContext(req);
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clerkUserId, email, mfaVerified } = authContext;

    // Rate limiting
    if (!checkRateLimit(clerkUserId)) {
      return NextResponse.json({
        error: "Rate limited. Please wait 5 seconds between exports."
      }, { status: 429 });
    }

    const url = new URL(req.url);
    const tab = url.searchParams.get("tab");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 10000);

    if (!tab || !["members", "invitations", "audit"].includes(tab)) {
      return NextResponse.json({
        error: "Invalid tab parameter"
      }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);

      if (!org) {
        return NextResponse.json({ error: "No organization access" }, { status: 403 });
      }

      const data = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        switch (tab) {
          case "members":
            const membersRes = await client.query(`
              select user_id, role, status, created_at
              from memberships
              where organization_id = nullif(current_setting('request.org_id', true), '')::uuid
              order by role desc, status asc, user_id asc
              limit $1
            `, [limit]);
            return membersRes.rows;

          case "invitations":
            const invitationsRes = await client.query(`
              select email, requested_role, status, created_at
              from invitations
              where organization_id = nullif(current_setting('request.org_id', true), '')::uuid
              order by created_at desc
              limit $1
            `, [limit]);
            return invitationsRes.rows;

          case "audit":
            const auditRes = await client.query(`
              select action, created_at, metadata
              from audit_events
              where actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid
              order by created_at desc
              limit $1
            `, [limit]);
            return auditRes.rows;

          default:
            return [];
        }
      });

      // Generate HTML table
      const headers = Object.keys(data[0] || {});
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${tab.charAt(0).toUpperCase() + tab.slice(1)} Export</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .meta { color: #666; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>${tab.charAt(0).toUpperCase() + tab.slice(1)} Export</h1>
          <div class="meta">
            Organization: ${org?.id}<br>
            Generated: ${new Date().toLocaleString()}<br>
            Total records: ${data.length}
          </div>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Generate PDF
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(html);
      
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true
      });

      await browser.close();

      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${tab}_export_${new Date().toISOString().slice(0,10)}.pdf"`,
        },
      });

    } finally {
      client.release();
    }

  } catch (err: any) {
    console.error("GET /api/export/pdf error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}


















