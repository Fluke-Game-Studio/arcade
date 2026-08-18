import Tabs, { type TabDef } from "../shared/Tabs";

export type SuperTab =
  | "users"
  | "projects"
  | "releases"
  | "awards"
  | "wallet"
  | "requests"
  | "inventory"
  | "endpoints"
  | "arcade_release"
  | "storage";

export const SUPER_TAB_KEYS: SuperTab[] = [
  "users",
  "projects",
  "releases",
  "awards",
  "wallet",
  "requests",
  "inventory",
  "endpoints",
  "arcade_release",
  "storage",
];

const SUPER_TABS: TabDef<SuperTab>[] = [
  { key: "users", label: "Users & Roles", icon: "group" },
  { key: "projects", label: "Projects", icon: "dashboard_customize" },
  { key: "releases", label: "Releases & Products", icon: "inventory_2" },
  { key: "awards", label: "Awards", icon: "emoji_events" },
  { key: "wallet", label: "Wallet", icon: "account_balance_wallet" },
  { key: "requests", label: "Requests", icon: "assignment" },
  { key: "inventory", label: "Inventory", icon: "warehouse" },
  { key: "endpoints", label: "Endpoint Access", icon: "api" },
  { key: "arcade_release", label: "Arcade Release", icon: "rocket_launch" },
  { key: "storage", label: "Storage Files", icon: "folder" },
];

type Props = {
  tab: SuperTab;
  onChange: (tab: SuperTab) => void;
};

export default function SuperConsoleTabs({ tab, onChange }: Props) {
  return <Tabs tabs={SUPER_TABS} activeKey={tab} onChange={onChange} ariaLabel="Super Console tabs" />;
}
