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

type Props = {
  tab: SuperTab;
  onChange: (tab: SuperTab) => void;
};

export default function SuperConsoleTabs({ tab, onChange }: Props) {
  return (
    <div className="suTabs" role="tablist" aria-label="Super Console tabs">
      <button type="button" className={`suTabBtn ${tab === "users" ? "active" : ""}`} onClick={() => onChange("users")}>
        Users & Roles
      </button>
      <button type="button" className={`suTabBtn ${tab === "projects" ? "active" : ""}`} onClick={() => onChange("projects")}>
        Projects
      </button>
      <button type="button" className={`suTabBtn ${tab === "releases" ? "active" : ""}`} onClick={() => onChange("releases")}>
        Releases & Products
      </button>
      <button type="button" className={`suTabBtn ${tab === "awards" ? "active" : ""}`} onClick={() => onChange("awards")}>
        Awards
      </button>
      <button type="button" className={`suTabBtn ${tab === "wallet" ? "active" : ""}`} onClick={() => onChange("wallet")}>
        Wallet
      </button>
      <button type="button" className={`suTabBtn ${tab === "requests" ? "active" : ""}`} onClick={() => onChange("requests")}>
        Requests
      </button>
      <button type="button" className={`suTabBtn ${tab === "inventory" ? "active" : ""}`} onClick={() => onChange("inventory")}>
        Inventory
      </button>
      <button type="button" className={`suTabBtn ${tab === "endpoints" ? "active" : ""}`} onClick={() => onChange("endpoints")}>
        Endpoint Access
      </button>
      <button type="button" className={`suTabBtn ${tab === "arcade_release" ? "active" : ""}`} onClick={() => onChange("arcade_release")}>
        Arcade Release
      </button>
      <button type="button" className={`suTabBtn ${tab === "storage" ? "active" : ""}`} onClick={() => onChange("storage")}>
        Storage Files
      </button>
    </div>
  );
}
