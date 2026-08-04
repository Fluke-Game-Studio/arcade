import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
};

export default function OnboardingFooterButton({
  children,
  icon,
  onClick,
  disabled,
  primary,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minHeight: 48,
        borderRadius: 16,
        border: primary ? "1px solid rgba(37,99,235,.18)" : "1px solid rgba(148,163,184,.22)",
        background: disabled
          ? "rgba(148,163,184,.16)"
          : primary
            ? "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)"
            : "#fff",
        color: disabled ? "#94a3b8" : primary ? "#fff" : "#0f172a",
        padding: "12px 18px",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled || !primary ? "none" : "0 16px 34px rgba(37,99,235,.18)",
      }}
    >
      <i className="material-icons" style={{ fontSize: 18 }}>{icon}</i>
      {children}
    </button>
  );
}
