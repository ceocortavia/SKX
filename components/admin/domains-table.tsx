"use client";
import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api-client";

type Domain = {
  id: string;
  domain: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
};

interface DomainsTabProps {
  orgId?: string | null;
}

export function DomainsTab({ orgId }: DomainsTabProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setDomains([]);
      setLoading(false);
      return;
    }

    const fetchDomains = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await apiGet<Domain[]>("/api/org-domains");
        if (error) {
          setError(error);
        } else if (data) {
          setDomains(data);
        }
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    };

    fetchDomains();
  }, [orgId]);

  if (loading) return <div>Laster domener...</div>;
  if (error) return <div>Feil: {error}</div>;
  if (!orgId) return <div>Ingen organisasjon valgt</div>;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Organisasjonsdomener</h3>
      {domains.length === 0 ? (
        <p>Ingen domener funnet.</p>
      ) : (
        <div className="space-y-2">
          {domains.map((domain) => (
            <div key={domain.id} className="p-2 border rounded">
              <p><strong>Domene:</strong> {domain.domain}</p>
              <p><strong>Verifisert:</strong> {domain.verified ? "Ja" : "Nei"}</p>
              <p><strong>Opprettet:</strong> {new Date(domain.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
