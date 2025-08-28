"use client";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api-client";

type AuditEvent = {
  id: string;
  actor_user_id: string;
  actor_org_id: string;
  action: string;
  target_table: string;
  target_pk: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

interface AuditTabProps {
  orgId?: string | null;
}

export function AuditTab({ orgId }: AuditTabProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await apiGet<AuditEvent[]>("/api/audit");
        if (error) {
          setError(error);
        } else if (data) {
          setEvents(data);
        }
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) return <div>Laster audit-hendelser...</div>;
  if (error) return <div>Feil: {error}</div>;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Audit-hendelser</h3>
      {events.length === 0 ? (
        <p>Ingen audit-hendelser funnet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="p-2 border rounded">
              <p><strong>Handling:</strong> {event.action}</p>
              <p><strong>Tabell:</strong> {event.target_table}</p>
              <p><strong>Tidspunkt:</strong> {new Date(event.created_at).toLocaleString()}</p>
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <p><strong>Metadata:</strong> {JSON.stringify(event.metadata)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
