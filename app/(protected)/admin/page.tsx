"use client";
export const dynamic = "force-dynamic";
import useSWR, { mutate } from "swr";
import useSWRInfinite from "swr/infinite";
import { jsonFetcher } from "@/lib/fetcher";
import { toCSV, downloadCSV } from "@/lib/csv";
import { useFuseSearch, memberSearchConfig, invitationSearchConfig, auditSearchConfig } from "@/lib/search";
import { DebouncedInput } from "@/lib/debounced-input";
import { QuickDates } from "@/lib/quick-dates";
import { ExportDropdown } from "@/lib/export-dropdown";
import { BulkRoleChanger } from "@/lib/bulk-role-changer";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import InvitationCopyGenerator from "@/components/admin/InvitationCopyGenerator";
import CsvImportAssistant from "@/components/admin/CsvImportAssistant";
import AdminCopilot from "@/components/admin/AdminCopilot";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Membership = { user_id: string; role: string; status: string; created_at: string };
type Domain = { id: string; domain: string; verified: boolean };
type Invitation = { id: string; email: string; requested_role: string; status: string; created_at: string };
type Audit = { id: string; action: string; created_at: string };
type AuditPage = { items: Audit[]; nextCursor: string | null; hasMore: boolean };

const showAnalytics = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "1";
const tabs = showAnalytics 
  ? ["Members", "Org domains", "Invitations", "Audit", "Copilot", "Analytics", "Profile"] as const
  : ["Members", "Org domains", "Invitations", "Audit", "Copilot", "Profile"] as const;
type Tab = typeof tabs[number];

function RefreshBtn({ keys }: { keys: string[] }) {
  return (
    <button
      className="px-3 py-1 rounded border hover:bg-gray-50"
      onClick={() => keys.forEach(k => mutate(k))}
    >
      🔄 Refresh
    </button>
  );
}

function ExportCSVBtn<T extends object>({ 
  data, 
  headers, 
  filename 
}: { 
  data: T[]; 
  headers: (keyof T)[]; 
  filename: string; 
}) {
  return (
    <ExportDropdown
      data={data}
      headers={headers}
      filename={filename}
      tabName={filename.split('_')[0].charAt(0).toUpperCase() + filename.split('_')[0].slice(1)}
    />
  );
}

function FilterChip({ 
  label, 
  value, 
  options, 
  onChange, 
  onClear 
}: { 
  label: string; 
  value?: string; 
  options: string[]; 
  onChange: (value: string | undefined) => void; 
  onClear: () => void; 
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{label}:</span>
      <select
        className="border px-2 py-1 rounded text-sm"
        value={value || ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      >
        <option value="">Alle</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {value && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function DateFilter({ 
  label, 
  value, 
  onChange, 
  onClear 
}: { 
  label: string; 
  value?: string; 
  onChange: (value: string | undefined) => void; 
  onClear: () => void; 
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{label}:</span>
      <input
        type="datetime-local"
        className="border px-2 py-1 rounded text-sm"
        value={value || ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      />
      {value && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function ClearFiltersBtn({ onClear }: { onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="text-xs text-gray-500 hover:text-gray-700 underline"
    >
      Tøm filtre
    </button>
  );
}

function BulkRevokeBtn({ 
  selectedIds, 
  onSuccess 
}: { 
  selectedIds: string[]; 
  onSuccess: () => void; 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRevoke = async () => {
    if (selectedIds.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/invitations/bulk-revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Revoked ${result.revoked} of ${result.requested} invitations`);
        onSuccess();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Network error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <button
      onClick={handleRevoke}
      disabled={isLoading}
      className="px-3 py-1 rounded border bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      {isLoading ? "🔄 Revoking..." : `🗑️ Revoke ${selectedIds.length} selected`}
    </button>
  );
}

function BulkApproveBtn({ 
  selectedIds, 
  onSuccess 
}: { 
  selectedIds: string[]; 
  onSuccess: () => void; 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    if (selectedIds.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/memberships/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Approved ${result.approved} of ${result.requested} members`);
        onSuccess();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Network error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <button
      onClick={handleApprove}
      disabled={isLoading}
      className="px-3 py-1 rounded border bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
    >
      {isLoading ? "🔄 Approving..." : `✅ Approve ${selectedIds.length} selected`}
    </button>
  );
}

function BulkRevokeMembersBtn({ 
  selectedIds, 
  onSuccess 
}: { 
  selectedIds: string[]; 
  onSuccess: () => void; 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRevoke = async () => {
    if (selectedIds.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/memberships/bulk-revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Revoked ${result.revoked} of ${result.requested} members`);
        onSuccess();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Network error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <button
      onClick={handleRevoke}
      disabled={isLoading}
      className="px-3 py-1 rounded border bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      {isLoading ? "🔄 Revoking..." : `🗑️ Revoke ${selectedIds.length} selected`}
    </button>
  );
}

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabSlug = (value: Tab) => value.toLowerCase().replace(/\s+/g, '-');
  const resolveTabFromQuery = useMemo(() => {
    const param = searchParams.get('tab');
    if (!param) return "Members" as Tab;
    const match = tabs.find((t) => tabSlug(t) === param.toLowerCase());
    return (match ?? "Members") as Tab;
  }, [searchParams]);

  const [tab, setTab] = useState<Tab>(resolveTabFromQuery);

  useEffect(() => {
    if (resolveTabFromQuery !== tab) {
      setTab(resolveTabFromQuery);
    }
  }, [resolveTabFromQuery, tab]);

  const setTabAndSyncQuery = (nextTab: Tab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabSlug(nextTab));
    router.replace(`?${params.toString()}`, { scroll: false });
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvitationIds, setSelectedInvitationIds] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  
  // Filter states
  const [memberRole, setMemberRole] = useState<string>();
  const [memberStatus, setMemberStatus] = useState<string>();
  const [memberFromDate, setMemberFromDate] = useState<string>();
  const [memberToDate, setMemberToDate] = useState<string>();
  const [invitationRole, setInvitationRole] = useState<string>();
  const [invitationStatus, setInvitationStatus] = useState<string>();
  const [invitationFromDate, setInvitationFromDate] = useState<string>();
  const [invitationToDate, setInvitationToDate] = useState<string>();
  const [auditAction, setAuditAction] = useState<string>();
  const [auditFromDate, setAuditFromDate] = useState<string>();
  const [auditToDate, setAuditToDate] = useState<string>();

  const { data: memberships, error: mErr, isLoading: mLoad } =
    useSWR<{ memberships: Membership[] }>("/api/memberships");

  const { data: domains, error: dErr, isLoading: dLoad } =
    useSWR<{ domains: Domain[] }>("/api/org-domains");

  const { data: invitations, error: iErr, isLoading: iLoad } =
    useSWR<{ invitations: Invitation[] }>("/api/invitations");

  // Audit with cursor pagination
  const getAuditKey = (pageIndex: number, previousPageData: AuditPage | null) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    
    const params = new URLSearchParams({ limit: "50" });
    
    if (previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }
    
    if (auditAction) {
      params.set("action", auditAction);
    }
    
    if (auditFromDate) {
      params.set("from", auditFromDate);
    }
    
    if (auditToDate) {
      params.set("to", auditToDate);
    }
    
    return `/api/audit?${params.toString()}`;
  };

  const { data: auditPages, error: aErr, isLoading: aLoad, size, setSize } = useSWRInfinite<AuditPage>(
    getAuditKey,
    jsonFetcher,
    { revalidateFirstPage: false }
  );

  const { data: profile, error: pErr, isLoading: pLoad } =
    useSWR<{ user?: { email: string; id: string } }>("/api/profile");

  // Flatten audit pages
  const allAuditEvents = (auditPages ?? []).flatMap(page => page.items ?? []);

  // Get unique values for filter options
  const memberRoles = useMemo(() => 
    [...new Set(memberships?.memberships?.map(m => m.role) || [])].sort(), 
    [memberships]
  );
  const memberStatuses = useMemo(() => 
    [...new Set(memberships?.memberships?.map(m => m.status) || [])].sort(), 
    [memberships]
  );
  const invitationRoles = useMemo(() => 
    [...new Set(invitations?.invitations?.map(i => i.requested_role) || [])].sort(), 
    [invitations]
  );
  const invitationStatuses = useMemo(() => 
    [...new Set(invitations?.invitations?.map(i => i.status) || [])].sort(), 
    [invitations]
  );
  const auditActions = useMemo(() => 
    [...new Set(allAuditEvents.map(e => e.action).filter(Boolean))].sort(), 
    [allAuditEvents]
  );

  // Apply filters first, then search
  const filteredMemberships = useMemo(() => {
    const fromTs = memberFromDate ? new Date(memberFromDate).getTime() : -Infinity;
    const toTs = memberToDate ? new Date(memberToDate).getTime() : Infinity;

    return (memberships?.memberships ?? []).filter(m => {
      const createdTs = new Date(m.created_at).getTime();
      return (!memberRole || m.role === memberRole) &&
             (!memberStatus || m.status === memberStatus) &&
             createdTs >= fromTs && createdTs <= toTs;
    });
  }, [memberships, memberRole, memberStatus, memberFromDate, memberToDate]);

  const filteredInvitations = useMemo(() => {
    const fromTs = invitationFromDate ? new Date(invitationFromDate).getTime() : -Infinity;
    const toTs = invitationToDate ? new Date(invitationToDate).getTime() : Infinity;

    return (invitations?.invitations ?? []).filter(i => {
      const createdTs = new Date(i.created_at).getTime();
      return (!invitationRole || i.requested_role === invitationRole) &&
             (!invitationStatus || i.status === invitationStatus) &&
             createdTs >= fromTs && createdTs <= toTs;
    });
  }, [invitations, invitationRole, invitationStatus, invitationFromDate, invitationToDate]);

  // Apply advanced search
  const searchedMemberships = useFuseSearch(filteredMemberships, searchQuery, memberSearchConfig);
  const searchedInvitations = useFuseSearch(filteredInvitations, searchQuery, invitationSearchConfig);
  const searchedAudit = useFuseSearch(allAuditEvents, searchQuery, auditSearchConfig);

  const hasMoreAudit = auditPages?.[auditPages.length - 1]?.hasMore;

  const clearMemberFilters = () => {
    setMemberRole(undefined);
    setMemberStatus(undefined);
    setMemberFromDate(undefined);
    setMemberToDate(undefined);
  };

  const clearInvitationFilters = () => {
    setInvitationRole(undefined);
    setInvitationStatus(undefined);
    setInvitationFromDate(undefined);
    setInvitationToDate(undefined);
  };

  const clearAuditFilters = () => {
    setAuditAction(undefined);
    setAuditFromDate(undefined);
    setAuditToDate(undefined);
  };

  const handleSelectAllInvitations = (checked: boolean) => {
    if (checked) {
      const pendingIds = searchedInvitations
        .filter(i => i.status === 'pending')
        .map(i => i.id);
      setSelectedInvitationIds(new Set(pendingIds));
    } else {
      setSelectedInvitationIds(new Set());
    }
  };

  const handleSelectInvitation = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedInvitationIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedInvitationIds(newSelected);
  };

  const handleBulkRevokeSuccess = () => {
    setSelectedInvitationIds(new Set());
    mutate("/api/invitations");
  };

  const handleSelectAllMembers = (checked: boolean) => {
    if (checked) {
      const pendingIds = searchedMemberships
        .filter(m => m.status === 'pending')
        .map(m => m.user_id);
      setSelectedMemberIds(new Set(pendingIds));
    } else {
      setSelectedMemberIds(new Set());
    }
  };

  const handleSelectMember = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedMemberIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedMemberIds(newSelected);
  };

  const handleBulkMembersSuccess = () => {
    setSelectedMemberIds(new Set());
    mutate("/api/memberships");
  };

  const pendingInvitationCount = searchedInvitations.filter(i => i.status === 'pending').length;
  const pendingMemberCount = searchedMemberships.filter(m => m.status === 'pending').length;

  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl p-6"><p>Loading…</p></main>}>
    <main className="mx-auto max-w-5xl p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTabAndSyncQuery(t)}
            className={`px-3 py-1 rounded border ${tab === t ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
            data-testid={`tab-${tabSlug(t)}`}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="rounded-lg border p-4 bg-white">
        {tab === "Members" && (
          <Panel loading={mLoad} err={mErr}>
            <div className="flex justify-between items-center mb-4">
              <DebouncedInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Søk i medlemmer (user_id, rolle, status)..."
              />
              <div className="flex gap-2">
                <BulkApproveBtn 
                  selectedIds={Array.from(selectedMemberIds)}
                  onSuccess={handleBulkMembersSuccess}
                />
                <BulkRevokeMembersBtn 
                  selectedIds={Array.from(selectedMemberIds)}
                  onSuccess={handleBulkMembersSuccess}
                />
                <BulkRoleChanger 
                  selectedIds={Array.from(selectedMemberIds)}
                  onDone={handleBulkMembersSuccess}
                />
                <ExportCSVBtn 
                  data={searchedMemberships}
                  headers={["user_id", "role", "status"]}
                  filename={`members_${new Date().toISOString().slice(0,10)}.csv`}
                />
                <RefreshBtn keys={["/api/memberships"]} />
              </div>
            </div>
            <div className="flex gap-4 mb-4 items-center flex-wrap">
              <FilterChip
                label="Rolle"
                value={memberRole}
                options={memberRoles}
                onChange={setMemberRole}
                onClear={() => setMemberRole(undefined)}
              />
              <FilterChip
                label="Status"
                value={memberStatus}
                options={memberStatuses}
                onChange={setMemberStatus}
                onClear={() => setMemberStatus(undefined)}
              />
              <DateFilter
                label="Fra"
                value={memberFromDate}
                onChange={setMemberFromDate}
                onClear={() => setMemberFromDate(undefined)}
              />
              <DateFilter
                label="Til"
                value={memberToDate}
                onChange={setMemberToDate}
                onClear={() => setMemberToDate(undefined)}
              />
              <QuickDates
                onFromChange={setMemberFromDate}
                onToChange={setMemberToDate}
                fromDate={memberFromDate}
                toDate={memberToDate}
              />
              {(memberRole || memberStatus || memberFromDate || memberToDate) && (
                <ClearFiltersBtn onClear={clearMemberFilters} />
              )}
            </div>
            <CsvImportAssistant />
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedMemberIds.size === pendingMemberCount && pendingMemberCount > 0}
                  onChange={(e) => handleSelectAllMembers(e.target.checked)}
                  className="rounded"
                />
                Velg alle pending ({pendingMemberCount})
              </label>
            </div>
            <Table
              cols={["", "user_id", "role", "status"]}
              rows={searchedMemberships.map(m => [
                <input
                  key={m.user_id}
                  type="checkbox"
                  checked={selectedMemberIds.has(m.user_id)}
                  onChange={(e) => handleSelectMember(m.user_id, e.target.checked)}
                  disabled={m.status !== 'pending'}
                  className="rounded"
                />,
                m.user_id,
                m.role,
                m.status
              ])}
            />
        </Panel>
        )}

        {tab === "Org domains" && (
          <Panel loading={dLoad} err={dErr}>
            <div className="flex justify-end mb-4 gap-2">
              <ExportCSVBtn 
                data={domains?.domains ?? []}
                headers={["domain", "verified"]}
                filename={`domains_${new Date().toISOString().slice(0,10)}.csv`}
              />
              <RefreshBtn keys={["/api/org-domains"]} />
            </div>
            <Table
              cols={["domain", "verified"]}
              rows={(domains?.domains ?? []).map(d => [d.domain, String(d.verified)])}
            />
        </Panel>
        )}

        {tab === "Invitations" && (
          <Panel loading={iLoad} err={iErr}>
            <div className="flex justify-between items-center mb-4">
              <DebouncedInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Søk i invitasjoner (email, rolle, status)..."
              />
              <div className="flex gap-2">
                <BulkRevokeBtn 
                  selectedIds={Array.from(selectedInvitationIds)}
                  onSuccess={handleBulkRevokeSuccess}
                />
                <ExportCSVBtn 
                  data={searchedInvitations}
                  headers={["email", "requested_role", "status"]}
                  filename={`invitations_${new Date().toISOString().slice(0,10)}.csv`}
                />
                <RefreshBtn keys={["/api/invitations"]} />
              </div>
            </div>
            <div className="flex gap-4 mb-4 items-center flex-wrap">
              <FilterChip
                label="Rolle"
                value={invitationRole}
                options={invitationRoles}
                onChange={setInvitationRole}
                onClear={() => setInvitationRole(undefined)}
              />
              <FilterChip
                label="Status"
                value={invitationStatus}
                options={invitationStatuses}
                onChange={setInvitationStatus}
                onClear={() => setInvitationStatus(undefined)}
              />
              <DateFilter
                label="Fra"
                value={invitationFromDate}
                onChange={setInvitationFromDate}
                onClear={() => setInvitationFromDate(undefined)}
              />
              <DateFilter
                label="Til"
                value={invitationToDate}
                onChange={setInvitationToDate}
                onClear={() => setInvitationToDate(undefined)}
              />
              <QuickDates
                onFromChange={setInvitationFromDate}
                onToChange={setInvitationToDate}
                fromDate={invitationFromDate}
                toDate={invitationToDate}
              />
              {(invitationRole || invitationStatus || invitationFromDate || invitationToDate) && (
                <ClearFiltersBtn onClear={clearInvitationFilters} />
              )}
            </div>
            <InvitationCopyGenerator />
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedInvitationIds.size === pendingInvitationCount && pendingInvitationCount > 0}
                  onChange={(e) => handleSelectAllInvitations(e.target.checked)}
                  className="rounded"
                />
                Velg alle pending ({pendingInvitationCount})
              </label>
            </div>
            <Table
              cols={["", "email", "requested_role", "status"]}
              rows={searchedInvitations.map(i => [
                <input
                  key={i.id}
                  type="checkbox"
                  checked={selectedInvitationIds.has(i.id)}
                  onChange={(e) => handleSelectInvitation(i.id, e.target.checked)}
                  disabled={i.status !== 'pending'}
                  className="rounded"
                />,
                i.email,
                i.requested_role,
                i.status
              ])}
            />
        </Panel>
        )}

        {tab === "Audit" && (
          <Panel loading={aLoad} err={aErr}>
            <div className="flex justify-between items-center mb-4">
              <DebouncedInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Søk i audit (action)..."
              />
              <div className="flex gap-2">
                <ExportCSVBtn 
                  data={searchedAudit}
                  headers={["action", "created_at"]}
                  filename={`audit_${new Date().toISOString().slice(0,10)}.csv`}
                />
                <RefreshBtn keys={["/api/audit"]} />
              </div>
            </div>
            <div className="flex gap-4 mb-4 items-center flex-wrap">
              <FilterChip
                label="Handling"
                value={auditAction}
                options={auditActions}
                onChange={setAuditAction}
                onClear={() => setAuditAction(undefined)}
              />
              <DateFilter
                label="Fra"
                value={auditFromDate}
                onChange={setAuditFromDate}
                onClear={() => setAuditFromDate(undefined)}
              />
              <DateFilter
                label="Til"
                value={auditToDate}
                onChange={setAuditToDate}
                onClear={() => setAuditToDate(undefined)}
              />
              {(auditAction || auditFromDate || auditToDate) && (
                <ClearFiltersBtn onClear={clearAuditFilters} />
              )}
            </div>
            <Table
              cols={["action", "created_at"]}
              rows={searchedAudit.map(e => [e.action, new Date(e.created_at).toLocaleString()])}
            />
            {hasMoreAudit && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setSize(size + 1)}
                  className="px-4 py-2 rounded border hover:bg-gray-50"
                >
                  📄 Last flere ({size * 50} events loaded)
                </button>
              </div>
            )}
        </Panel>
        )}

        {tab === "Copilot" && (
          <Panel loading={false}>
            <AdminCopilot />
          </Panel>
        )}

        {tab === "Analytics" && showAnalytics && (
          <AnalyticsPanel />
        )}

        {tab === "Profile" && (
          <Panel loading={pLoad} err={pErr}>
            <div className="flex justify-end mb-4">
              <RefreshBtn keys={["/api/profile"]} />
            </div>
            <pre className="text-sm">{JSON.stringify(profile ?? {}, null, 2)}</pre>
        </Panel>
        )}
      </section>

      {process.env.NEXT_PUBLIC_TEST_BYPASS === "1" && (
        <p className="text-xs text-gray-500">
          Dev bypass aktiv – API-kall tagges med <code>x-test-clerk-*</code> headere.
        </p>
      )}
    </main>
    </Suspense>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl p-6"><p>Loading…</p></main>}>
      <AdminPageInner />
    </Suspense>
  );
}

function Panel({ loading, err, children }: { loading: boolean; err?: any; children: React.ReactNode }) {
  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-600">Error: {String(err.message || err)}</p>;
  return <>{children}</>;
}

function Table({ cols, rows }: { cols: string[]; rows: (string | number | React.ReactElement)[][] }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>{cols.map(c => <th key={c} className="text-left px-3 py-2 border-b">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="px-3 py-3 text-gray-500" colSpan={cols.length}>Ingen treff</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="odd:bg-gray-50">
              {r.map((v, j) => <td key={j} className="px-3 py-2 border-b">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
