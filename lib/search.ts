import Fuse from 'fuse.js';
import { useMemo } from 'react';

export interface SearchConfig<T> {
  keys: (keyof T)[];
  threshold?: number;
  minMatchCharLength?: number;
}

export function useFuseSearch<T>(
  data: T[],
  query: string,
  config: SearchConfig<T>
): T[] {
  return useMemo(() => {
    if (!query.trim()) return data;
    
    const fuse = new Fuse(data, {
      keys: config.keys as string[],
      threshold: config.threshold ?? 0.3,
      minMatchCharLength: config.minMatchCharLength ?? 2,
      includeScore: false,
      includeMatches: false,
    });
    
    const results = fuse.search(query);
    return results.map(result => result.item);
  }, [data, query, config]);
}

// Predefined search configs for common data types
export const memberSearchConfig: SearchConfig<{ user_id: string; role: string; status: string }> = {
  keys: ['user_id', 'role', 'status'],
  threshold: 0.3,
  minMatchCharLength: 2,
};

export const invitationSearchConfig: SearchConfig<{ email: string; requested_role: string; status: string }> = {
  keys: ['email', 'requested_role', 'status'],
  threshold: 0.3,
  minMatchCharLength: 2,
};

export const auditSearchConfig: SearchConfig<{ action: string; created_at: string; metadata?: any }> = {
  keys: ['action'],
  threshold: 0.4,
  minMatchCharLength: 2,
};














