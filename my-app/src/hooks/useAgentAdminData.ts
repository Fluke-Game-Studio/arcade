import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api/config";

type AgentConfig = {
  agentId: string;
  name: string;
  description?: string;
  role?: string;
  systemPrompt?: string;
  allowedActions: string[];
  allowedContexts?: string[];
  defaultContext?: string;
  actionExecutor?: string;
  sourcesByContext?: Record<string, string[]>;
  approvalPolicy?: { mode?: string };
};

type MpcPolicy = {
  action: string;
  policyName: string;
  description?: string;
  allowedRoles: string[];
  requireApproval: boolean;
};

type AgentAssignment = {
  username: string;
  defaultAgentId?: string;
  allowedAgents?: string[];
};

type EmployeeLite = {
  username: string;
  employee_name?: string;
};

type Definitions = {
  capabilities: string[];
  roles: string[];
  actionCapabilityMap: Record<string, string>;
};

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_CACHE_KEY = "mgr_builder_admin_cache_v4";

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function useAgentAdminData(token: string, username: string) {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [policies, setPolicies] = useState<MpcPolicy[]>([]);
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [definitions, setDefinitions] = useState<Definitions>({
    capabilities: [],
    roles: [],
    actionCapabilityMap: {},
  });
  const [loading, setLoading] = useState(false);

  const cacheKey = useMemo(
    () => `${ADMIN_CACHE_KEY}__${safeStr(username || "anon").toLowerCase()}`,
    [username]
  );

  const invalidate = useCallback(() => {
    try {
      localStorage.removeItem(cacheKey);
    } catch {}
  }, [cacheKey]);

  const load = useCallback(
    async (force = false) => {
      if (!token) return;
      setLoading(true);
      try {
        const cachedRaw = force ? "" : localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const ts = Number(cached?.ts || 0);
          if (Date.now() - ts < ADMIN_CACHE_TTL_MS) {
            setAgents(Array.isArray(cached?.agents) ? cached.agents : []);
            setPolicies(Array.isArray(cached?.policies) ? cached.policies : []);
            setAssignments(Array.isArray(cached?.assignments) ? cached.assignments : []);
            setEmployees(Array.isArray(cached?.employees) ? cached.employees : []);
            setDefinitions(
              cached?.definitions && typeof cached.definitions === "object"
                ? cached.definitions
                : { capabilities: [], roles: [], actionCapabilityMap: {} }
            );
            return;
          }
        }

        const [defsRes, agentsRes, policiesRes, assignmentsRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/admin/ai/definitions`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/admin/ai/agents`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/admin/ai/mcp-policies`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/admin/ai/agent-assignments`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const defsJson = await defsRes.json().catch(() => ({}));
        const agentsJson = await agentsRes.json().catch(() => ({}));
        const policiesJson = await policiesRes.json().catch(() => ({}));
        const assignmentsJson = await assignmentsRes.json().catch(() => ({}));
        const usersJson = await usersRes.json().catch(() => ({}));

        const nextDefinitions: Definitions =
          defsJson?.definitions && typeof defsJson.definitions === "object"
            ? {
                capabilities: Array.isArray(defsJson.definitions.capabilities)
                  ? defsJson.definitions.capabilities
                  : [],
                roles: Array.isArray(defsJson.definitions.roles) ? defsJson.definitions.roles : [],
                actionCapabilityMap:
                  defsJson.definitions.actionCapabilityMap &&
                  typeof defsJson.definitions.actionCapabilityMap === "object"
                    ? defsJson.definitions.actionCapabilityMap
                    : {},
              }
            : { capabilities: [], roles: [], actionCapabilityMap: {} };

        const nextAgents = Array.isArray(agentsJson?.agents) ? agentsJson.agents : [];
        const nextPolicies = Array.isArray(policiesJson?.policies) ? policiesJson.policies : [];
        const nextAssignments = Array.isArray(assignmentsJson?.assignments)
          ? assignmentsJson.assignments
          : [];
        const usersRaw = Array.isArray(usersJson) ? usersJson : Array.isArray(usersJson?.items) ? usersJson.items : [];
        const nextEmployees: EmployeeLite[] = usersRaw
          .map((u: any) => ({
            username: safeStr(u?.username).toLowerCase(),
            employee_name: safeStr(u?.employee_name),
          }))
          .filter((u: EmployeeLite) => !!u.username);

        setDefinitions(nextDefinitions);
        setAgents(nextAgents);
        setPolicies(nextPolicies);
        setAssignments(nextAssignments);
        setEmployees(nextEmployees);

        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              ts: Date.now(),
              definitions: nextDefinitions,
              agents: nextAgents,
              policies: nextPolicies,
              assignments: nextAssignments,
              employees: nextEmployees,
            })
          );
        } catch {}
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, token]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return {
    loading,
    definitions,
    agents,
    policies,
    assignments,
    employees,
    load,
    invalidate,
  };
}
