import type { ApiUser } from "../../api";

type AssignableRole = "employee" | "admin" | "super";
type ReadScope = "employee" | "admin" | "super";

type Props = {
  users: ApiUser[];
  filteredUsers: ApiUser[];
  loading: boolean;
  query: string;
  currentUsername?: string;
  isSuperUser: boolean;
  adminAndSupers: ApiUser[];
  onQueryChange: (value: string) => void;
  onSetRole: (username: string, role: AssignableRole) => void;
  onSetReadScope: (username: string, readScope: ReadScope) => void;
  onSetAccessFlag: (username: string, field: "portal_access" | "project_access" | "version_control_access", value: boolean) => void;
  roleFor: (value: any) => string;
  readScopeFor: (u: ApiUser) => ReadScope;
  safeStr: (value: any) => string;
};

const ASSIGNABLE_ROLES: AssignableRole[] = ["employee", "admin", "super"];

export default function SuperUsersTab({
  users,
  filteredUsers,
  loading,
  query,
  currentUsername,
  isSuperUser,
  onQueryChange,
  onSetRole,
  onSetReadScope,
  onSetAccessFlag,
  roleFor,
  readScopeFor,
  safeStr,
}: Props) {
  return (
    <div className="suCard">
      <div className="card-content">
        <div className="suToolbar">
          <span className="card-title" style={{ fontWeight: 1000, margin: 0 }}>
            Users ({users.length})
          </span>
          <div className="suCellMuted">{loading ? "Loading users..." : `${filteredUsers.length} shown`}</div>
        </div>
        <div className="input-field suSearch">
          <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search..." />
          <label className="active">Search</label>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="suUserList">
            {filteredUsers.map((u) => {
              const isSelf = u.username === currentUsername;
              const portal = (u as any).portal_access !== false;
              const project = (u as any).project_access !== false;
              const vcs = (u as any).version_control_access === true;
              const readScope = readScopeFor(u);
              const roleKey = roleFor(u.employee_role);
              return (
                <div key={u.username} className="suUserRow">
                  <div className="suUserIdentity">
                    <div className="suAvatarWrap">
                      <div className="suAvatar">
                        {(safeStr((u as any).employee_profilepicture || (u as any).employee_picture) || "").trim() ? (
                          <img
                            src={safeStr((u as any).employee_profilepicture || (u as any).employee_picture)}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span>{safeStr(u.employee_name || u.username).slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                    <div className="suUserMeta">
                      <div className="suUserTop">
                        <div className="suUserName">{u.employee_name || u.username}</div>
                        <span className={`suChip ${roleKey}`}>{roleKey.toUpperCase()}</span>
                      </div>
                      <div className="suUserLine"><code>{u.username}</code></div>
                      <div className="suUserLine"><code>{u.employee_email}</code></div>
                    </div>
                  </div>

                  <div className="suUserRight">
                    <div className="suSelectPanel">
                      <div className="suStackLabel">Read Scope</div>
                      <select
                        className="browser-default suMiniSelect"
                        disabled={!isSuperUser || isSelf}
                        value={readScope}
                        onChange={(e) => onSetReadScope(u.username, e.target.value as ReadScope)}
                      >
                        <option value="employee">employee</option>
                        <option value="admin">admin</option>
                        <option value="super">super</option>
                      </select>
                      <div className="suStackLabel" style={{ marginTop: 6 }}>Write Scope</div>
                      <select
                        className="browser-default suMiniSelect"
                        disabled={!isSuperUser || isSelf}
                        value={roleKey as any}
                        onChange={(e) => {
                          const nextRole = e.target.value as AssignableRole;
                          if (!nextRole || nextRole === roleKey) return;
                          onSetRole(u.username, nextRole);
                        }}
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="suAccessPanel">
                      <div className="suStackLabel">Access</div>
                      <div className="suAccessChecks">
                        <label className="suCheckItem">
                          <input type="checkbox" checked={portal} disabled={!isSuperUser} onChange={(e) => onSetAccessFlag(u.username, "portal_access", e.target.checked)} />
                          <span>Portal</span>
                        </label>
                        <label className="suCheckItem">
                          <input type="checkbox" checked={project} disabled={!isSuperUser} onChange={(e) => onSetAccessFlag(u.username, "project_access", e.target.checked)} />
                          <span>Project</span>
                        </label>
                        <label className="suCheckItem">
                          <input type="checkbox" checked={vcs} disabled={!isSuperUser} onChange={(e) => onSetAccessFlag(u.username, "version_control_access", e.target.checked)} />
                          <span>VCS</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
