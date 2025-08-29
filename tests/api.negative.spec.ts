import { test } from "@playwright/test";
import { expectProtected } from "./utils";

// NB: ikke send bypass-headere her – disse testene simulerer "uten auth"

test("org-domains without auth returns redirect/401", async ({ request }) => {
  const res = await request.post("/api/org-domains", {
    data: { domain: "unauthorized.example" },
  });
  await expectProtected(res);
});

test("invitations without auth returns redirect/401", async ({ request }) => {
  const res = await request.post("/api/invitations", {
    data: { email: "new@user.dev", requested_role: "member" },
  });
  await expectProtected(res);
});

test("memberships without auth returns redirect/401", async ({ request }) => {
  const res = await request.get("/api/memberships");
  await expectProtected(res);
});

test("audit without auth returns redirect/401", async ({ request }) => {
  const res = await request.get("/api/audit");
  await expectProtected(res);
});

test("users update-safe without auth returns redirect/401", async ({ request }) => {
  const res = await request.post("/api/users/update-safe", {
    data: { full_name: "Test Name" },
  });
  await expectProtected(res);
});
