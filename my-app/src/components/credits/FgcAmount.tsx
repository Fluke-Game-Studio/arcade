import type { CSSProperties, ReactNode } from "react";

type Props = {
  amount: number;
  divisor?: number;
  fractionDigits?: number;
  className?: string;
  style?: CSSProperties;
  iconSize?: number;
  showSuffix?: boolean;
  children?: ReactNode;
};

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(amount: number, divisor: number, fractionDigits: number) {
  const value = safeNum(amount) / (divisor || 1);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export default function FgcAmount({
  amount,
  divisor = 100,
  fractionDigits,
  className = "",
  style,
  iconSize = 64,
  showSuffix = true,
  children,
}: Props) {
  const digits = fractionDigits ?? (divisor === 1 ? 0 : 2);
  const label = children ?? formatAmount(amount, divisor, digits);
  const resolvedIconSize = Math.max(1, safeNum(iconSize) || 30);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <img
        src="/logos/FlukeGameCreditIcon.png"
        alt="Fluke Game Credits"
        style={{
          width: resolvedIconSize,
          height: resolvedIconSize,
          objectFit: "contain",
          display: "block",
          flex: "0 0 auto",
        }}
      />
      <span>{label}</span>
      {showSuffix ? <span>FGC</span> : null}
    </span>
  );
}
