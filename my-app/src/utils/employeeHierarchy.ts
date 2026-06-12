import type { ApiUser } from "../api";

function safeStr(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeKey(value: any) {
  return safeStr(value).toLowerCase();
}

export function extractManagerKey(raw: string) {
  if (!raw) return "";
  const match = raw.match(/\(([^)]+@[^)]+)\)/);
  if (match) return match[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

export function getUserIdentityKeys(user: any) {
  const keys = [
    (user as any)?.username,
    (user as any)?.employee_email,
    (user as any)?.email,
    (user as any)?.name,
    (user as any)?.employee_name,
  ]
    .map(normalizeKey)
    .filter(Boolean);

  return Array.from(new Set(keys));
}

export function getDirectReports(users: ApiUser[], manager: any) {
  const managerKeys = new Set(getUserIdentityKeys(manager));
  if (!managerKeys.size) return [];

  return users.filter((user) => {
    const managerKey = extractManagerKey(safeStr((user as any)?.employee_manager));
    return managerKey ? managerKeys.has(managerKey) : false;
  });
}

export function hasDirectReports(users: ApiUser[], manager: any) {
  return getDirectReports(users, manager).length > 0;
}
