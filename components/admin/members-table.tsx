"use client";
import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api-client";

type Member = {
  user_id: string;
  org_id: string;
  role: string;
  status: string;
  org_name: string;
};

interface MembersTabProps {
  orgId?: string | null;
}

export function MembersTab({ orgId }: MembersTabProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await apiGet<Member[]>(`/api/memberships?orgId=${orgId}`);
        if (error) {
          setError(error);
        } else if (data) {
          setMembers(data);
        }
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [orgId]);

  if (loading) return <div>Laster medlemmer...</div>;
  if (error) return <div>Feil: {error}</div>;
  if (!orgId) return <div>Ingen organisasjon valgt</div>;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Organisasjonsmedlemmer</h3>
      {members.length === 0 ? (
        <p>Ingen medlemmer funnet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.user_id} className="p-2 border rounded">
              <p><strong>Rolle:</strong> {member.role}</p>
              <p><strong>Status:</strong> {member.status}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
