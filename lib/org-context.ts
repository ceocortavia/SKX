import { PoolClient } from 'pg';

export interface OrgContext {
  id: string;
  role: string;
  status: string;
}

/**
 * Resolve organization context from request headers or user's primary organization
 */
export async function resolveOrgContext(
  client: PoolClient, 
  clerkUserId: string, 
  req: Request
): Promise<{ userId: string; org: OrgContext | null }> {
  try {
    // First get the user ID
    const userResult = await client.query(
      `SELECT id FROM public.users WHERE clerk_user_id = $1`,
      [clerkUserId]
    );
    
    if (!userResult.rows[0]) {
      throw new Error('User not found');
    }
    
    const userId = userResult.rows[0].id;
    
    // Check for org context in headers (for multi-org scenarios)
    const orgIdHeader = req.headers.get('x-org-id');
    
    if (orgIdHeader) {
      // Verify user has access to this organization
      const result = await client.query(
        `SELECT organization_id, role, status 
         FROM public.memberships 
         WHERE user_id = $1 AND organization_id = $2 AND status = 'approved'`,
        [userId, orgIdHeader]
      );
      
      if (result.rows[0]) {
        return {
          userId,
          org: {
            id: result.rows[0].organization_id,
            role: result.rows[0].role,
            status: result.rows[0].status
          }
        };
      }
    }
    
    // Fallback: get user's primary organization
    const result = await client.query(
      `SELECT organization_id, role, status 
       FROM public.memberships 
       WHERE user_id = $1 AND status = 'approved' 
       ORDER BY role = 'admin' DESC, created_at ASC 
       LIMIT 1`,
      [userId]
    );
    
    if (result.rows[0]) {
      return {
        userId,
        org: {
          id: result.rows[0].organization_id,
          role: result.rows[0].role,
          status: result.rows[0].status
        }
      };
    }
    
    return { userId, org: null };
  } catch (error) {
    console.error('Error resolving org context:', error);
    throw error;
  }
}
