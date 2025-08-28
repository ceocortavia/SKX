"use client";
import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api-client";

type Invitation = {
  id: string;
  organization_id: string;
  email: string;
  requested_role: string;
  status: string;
  expires_at: string;
};

interface InvitationsTabProps {
  orgId?: string | null;
}

export function InvitationsTab({ orgId }: InvitationsTabProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvitations = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await apiGet<Invitation[]>("/api/invitations");
        if (error) {
          setError(error);
        } else if (data) {
          setInvitations(data);
        }
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    };

    fetchInvitations();
  }, []);

  if (loading) return <div>Laster invitasjoner...</div>;
  if (error) return <div>Feil: {error}</div>;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Invitasjoner</h3>
      {invitations.length === 0 ? (
        <p>Ingen invitasjoner funnet.</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="p-2 border rounded">
              <p><strong>E-post:</strong> {invitation.email}</p>
              <p><strong>Rolle:</strong> {invitation.requested_role}</p>
              <p><strong>Status:</strong> {invitation.status}</p>
              <p><strong>Utløper:</strong> {new Date(invitation.expires_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
