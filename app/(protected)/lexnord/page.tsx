"use client";

import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";
import { CaseAssignmentPanel } from "@/components/org/CaseAssignmentPanel";
import { ToDoAttestPanel } from "@/components/org/ToDoAttestPanel";

interface LexCase {
  id: string;
  title: string;
  client_name: string | null;
  status: string;
  assigned_user_id: string | null;
  assigned_user_email?: string | null;
}

interface UserOption {
  id: string;
  full_name: string | null;
  primary_email: string | null;
  role?: string | null;
}

export default function LexNordPanel() {
  const { data: casesData, mutate: mutateCases } = useSWR<{ cases: LexCase[] }>(
    "/api/lexnord/cases",
    jsonFetcher
  );
  const { data: usersData } = useSWR<{ users: UserOption[] }>("/api/lexnord/users", jsonFetcher);
  const { data: summaryData } = useSWR<{ agg: { case_id: string }[] }>(
    "/api/org/compliance/summary?mine=1",
    jsonFetcher
  );

  const cases = casesData?.cases ?? [];
  const users = usersData?.users ?? [];
  const pendingCases = cases.filter((c) => c.status === "pending_assignment");
  const awaiting = cases.filter((c) => c.status === "awaiting_ocg");

  const myCaseIds = new Set((summaryData?.agg || []).map((item) => item.case_id));
  const myCases = cases.filter((c) => myCaseIds.has(c.id));

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold">LexNord Mission Control</h1>
        <p className="text-sm text-gray-600">
          Tildel saker, følg attestasjonskrav og sikre at alle står klar før arbeid igangsettes.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Saker som venter på tildeling</h2>
        {pendingCases.length === 0 ? (
          <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Ingen saker venter på tildeling.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingCases.map((lexCase) => (
              <div key={lexCase.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <div className="text-sm font-semibold">{lexCase.title}</div>
                  <div className="text-xs text-gray-500">Klient: {lexCase.client_name ?? "ukjent"}</div>
                </div>
                <CaseAssignmentPanel
                  caseId={lexCase.id}
                  members={users.map((u) => ({
                    user_id: u.id,
                    name: u.full_name,
                    email: u.primary_email,
                    role: u.role,
                  }))}
                  onAssigned={() => mutateCases()}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Saker som venter OCG</h2>
        {awaiting.length === 0 ? (
          <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Alle tildelte saker har levert OCG.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {awaiting.map((lexCase) => (
              <div key={lexCase.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{lexCase.title}</div>
                    <div className="text-xs text-gray-500">Tildelt: {lexCase.assigned_user_email ?? "ukjent"}</div>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-amber-700">awaiting_ocg</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Mine attestasjonskrav</h2>
        {myCases.length === 0 ? (
          <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Du har ingen aktive saker som krever attest per nå.
          </p>
        ) : (
          <div className="space-y-4">
            {myCases.map((lexCase) => (
              <div key={lexCase.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{lexCase.title}</div>
                    <div className="text-xs text-gray-500">Status: {lexCase.status}</div>
                  </div>
                </div>
                <ToDoAttestPanel caseId={lexCase.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
