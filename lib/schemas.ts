import { z } from "zod";

export const userIdsSchema = z.object({
  // Ikke krev UUID i denne fasen – testene sender ofte frie strenger
  userIds: z.array(z.string()).min(1).max(100),
});

export const targetRoleSchema = z.object({
  targetRole: z.enum(["member", "admin"]),
});

export const bulkRoleSchema = userIdsSchema.and(targetRoleSchema);

export const bulkUserIdsSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
});

export const bulkInvitationIdsSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});


// Ny: spesifikk schema for invitations med presise reason-koder
export const invitationIdsSchema = z.object({
  invitationIds: z
    .array(z.string())
    .min(1, { message: "empty_invitationIds" })
    .max(100, { message: "too_many_invitationIds" }),
});

export const platformMemberUpdateSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]).optional(),
  status: z.enum(["approved", "pending"]).optional(),
});

