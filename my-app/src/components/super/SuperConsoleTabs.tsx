export type SuperTab = "users" | "projects" | "releases" | "storage";

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
      <button type="button" className={`suTabBtn ${tab === "storage" ? "active" : ""}`} onClick={() => onChange("storage")}>
        Storage Files
      </button>
    </div>
  );
}
