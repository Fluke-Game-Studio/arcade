import { useEffect, useMemo, useState } from "react";
import * as QRCode from "qrcode";
import type { ApiWallet, ApiWalletSelfInitiateBody, ApiWalletSelfInitiateResponse } from "../../api";

declare const M: any;

type SelfInitiateWalletApi = {
  selfInitiateWallet: (body: ApiWalletSelfInitiateBody) => Promise<ApiWalletSelfInitiateResponse>;
};

type Props = {
  api: SelfInitiateWalletApi;
  onCompleted?: (wallet?: ApiWallet) => void;
  defaultAmountFgc?: number;
  title?: string;
  description?: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatFgc(value: number) {
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value))} FGC`;
}

function hashSeed(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createFinder(matrix: boolean[][], startX: number, startY: number) {
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const gx = startX + x;
      const gy = startY + y;
      const edge = x === 0 || y === 0 || x === 6 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      matrix[gy][gx] = edge || core;
    }
  }
}

export function buildWalletQrMatrix(seed: string, size = 21): boolean[][] {
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const cleanSeed = String(seed || "wallet-init").trim();
  createFinder(matrix, 0, 0);
  createFinder(matrix, size - 7, 0);
  createFinder(matrix, 0, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let state = hashSeed(cleanSeed) || 1;
  const nextBit = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) & 1;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x >= size - 7 && y < 7) ||
        (x < 7 && y >= size - 7);
      const onTiming = x === 6 || y === 6;
      if (inFinder || onTiming) continue;
      matrix[y][x] = nextBit() === 1;
    }
  }

  return matrix;
}

function parseFgcAmount(value: string) {
  const amount = Number(String(value || "").replace(/,/g, "").trim());
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export default function SelfInitiateWallet({
  api,
  onCompleted,
  defaultAmountFgc = 1000,
  title = "Self-Initiate Wallet",
  description = "Record your commitment payment here. Enter the amount, scan the QR when the real UPI flow is wired, and paste the transaction ID to activate the wallet.",
}: Props) {
  const [amountFgc, setAmountFgc] = useState(String(defaultAmountFgc));
  const [transactionId, setTransactionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const amountValue = useMemo(() => parseFgcAmount(amountFgc), [amountFgc]);
  const amountCents = useMemo(() => Math.trunc(amountValue * 100), [amountValue]);
  const qrPayload = useMemo(() => {
    const params = new URLSearchParams({
      pa: "fluke.games@upi",
      pn: "Fluke Games",
      am: amountValue.toFixed(2),
      cu: "INR",
      tn: "Wallet commitment",
    });
    return `upi://pay?${params.toString()}`;
  }, [amountValue]);
  const qrMatrix = useMemo(() => buildWalletQrMatrix(qrPayload), [qrPayload]);
  const paymentPreviewRows = useMemo(
    () => [
      { label: "Pay to", value: "Fluke Games" },
      { label: "UPI ID", value: "fluke.games@upi" },
      { label: "Amount", value: formatFgc(amountValue) },
      { label: "Currency", value: "INR" },
      { label: "Note", value: "Wallet commitment" },
    ],
    [amountValue]
  );

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  async function submit() {
    const tx = safeStr(transactionId);
    if (amountCents <= 0) {
      setError("Enter a commitment amount greater than zero.");
      return;
    }
    if (!tx) {
      setError("Enter the transaction ID before recording the wallet.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setSuccess("");
      const resp = await api.selfInitiateWallet({
        amount_cents: amountCents,
        transaction_id: tx,
        credit_type: "frozen",
        reason: "Self-initiate wallet commitment",
        meta: {
          paymentFlow: "self-initiate-wallet",
          paymentUri: qrPayload,
        },
      });
      setSuccess(`Wallet recorded successfully with ${formatFgc(safeNum(resp?.credited_fgc ?? resp?.credited ?? amountValue))}.`);
      M?.toast?.({ html: "Wallet commitment recorded.", classes: "green" });
      onCompleted?.(resp?.wallet);
    } catch (e: any) {
      const message = String(e?.message || "Failed to record wallet");
      setError(message);
      M?.toast?.({ html: message, classes: "red" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <style>{`
        .selfInitGrid{
          display:grid;
          grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
          gap: 16px;
          align-items:start;
        }
        @media (max-width: 840px){
          .selfInitGrid{
            grid-template-columns: 1fr;
          }
        }
        .selfInitPanel{
          border-radius: 24px;
          border: 1px solid rgba(148,163,184,.18);
          background: #fff;
          padding: 18px;
          display:grid;
          gap: 14px;
        }
        .selfInitQr{
          width: 220px;
          height: 220px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #e2e8f0;
          padding: 12px;
          display:grid;
          grid-template-columns: repeat(21, 1fr);
          gap: 2px;
        }
        .selfInitQrBox{
          width: 100%;
          height: 100%;
          border-radius: 2px;
        }
        .selfInitPreviewGrid{
          display:grid;
          gap:8px;
        }
        .selfInitPreviewRow{
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:baseline;
          padding:10px 12px;
          border-radius:14px;
          border:1px solid #e2e8f0;
          background:#fff;
        }
        .selfInitPreviewRow .l{
          color:#64748b;
          font-size:11px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.08em;
        }
        .selfInitPreviewRow .r{
          color:#0f172a;
          font-size:13px;
          font-weight:900;
          text-align:right;
          word-break:break-word;
        }
        .selfInitPreviewUri{
          border-radius:14px;
          border:1px solid #dbe5ef;
          background:#f8fafc;
          padding:10px 12px;
          color:#334155;
          font-size:12px;
          line-height:1.5;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
      `}</style>

      <div>
        <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
          {title}
        </div>
        <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.7 }}>
          {description}
        </div>
      </div>

      <div className="selfInitGrid">
        <div className="selfInitPanel" style={{ placeItems: "center" }}>
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 20,
              background: "#fff",
              border: "1px solid #e2e8f0",
              padding: 12,
              display: "grid",
              placeItems: "center",
            }}
            aria-label="Wallet commitment QR code"
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Wallet commitment QR code"
                style={{ width: 196, height: 196, display: "block" }}
              />
            ) : (
              <div className="selfInitQr" aria-label="Wallet commitment QR code preview">
                {qrMatrix.flatMap((row, y) =>
                  row.map((filled, x) => (
                    <span
                      key={`${x}-${y}`}
                      className="selfInitQrBox"
                      style={{ background: filled ? "#0f172a" : "#fff" }}
                    />
                  ))
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", textAlign: "center" }}>
            Commitment QR
          </div>
          <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6, textAlign: "center" }}>
            Scan this with your payment app once the UPI flow is connected.
          </div>
          <div style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0", padding: 12, width: "100%" }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Payment preview
            </div>
            <div className="selfInitPreviewGrid" style={{ marginTop: 8 }}>
              {paymentPreviewRows.map((row) => (
                <div className="selfInitPreviewRow" key={row.label}>
                  <div className="l">{row.label}</div>
                  <div className="r">{row.value}</div>
                </div>
              ))}
              <div className="selfInitPreviewUri" title={qrPayload}>
                {qrPayload}
              </div>
            </div>
          </div>
        </div>

        <div className="selfInitPanel">
          <div style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }}>Record the commitment</div>
          <div style={{ color: "#475569", lineHeight: 1.7 }}>
            Enter the commitment amount, then paste the transaction ID from the payment you made. Once submitted, the amount is recorded
            into your wallet as Frozen FGC.
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Commitment amount
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountFgc}
                onChange={(e) => setAmountFgc(e.target.value)}
                placeholder="1000.00"
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  border: "1px solid #dbe5ef",
                  padding: "12px 14px",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#0f172a",
                  outline: "none",
                  background: "#fff",
                }}
              />
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Wallet impact
              </div>
              <div style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0", padding: 12, display: "grid", gap: 6 }}>
                <div style={{ color: "#0f172a", fontWeight: 900 }}>Will be recorded as {formatFgc(amountValue)}</div>
                <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                  The wallet will become active once this transaction is recorded and synced by the payment service.
                </div>
              </div>
            </div>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Transaction ID
              </span>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="UPI / bank transaction ID"
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  border: "1px solid #dbe5ef",
                  padding: "12px 14px",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#0f172a",
                  outline: "none",
                  background: "#fff",
                }}
              />
            </label>
          </div>

          {error ? (
            <div className="emptyState" style={{ borderColor: "#fecaca", color: "#991b1b", background: "#fff5f5" }}>
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="emptyState" style={{ borderColor: "#bbf7d0", color: "#166534", background: "#f0fdf4" }}>
              {success}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 10 }}>
            {[
              "Scan the QR with the future UPI flow.",
              "Make the payment for your commitment amount.",
              "Paste the transaction ID here to load the value into your wallet.",
            ].map((line) => (
              <div key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#334155", lineHeight: 1.6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, marginTop: 8, background: "#0f766e", flex: "0 0 auto" }} />
                <span>{line}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || amountCents <= 0 || !safeStr(transactionId)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
                borderRadius: 16,
                border: "1px solid rgba(37,99,235,.18)",
                background:
                  busy || amountCents <= 0 || !safeStr(transactionId)
                    ? "rgba(148,163,184,.16)"
                    : "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
                color: busy || amountCents <= 0 || !safeStr(transactionId) ? "#94a3b8" : "#fff",
                padding: "12px 18px",
                fontWeight: 900,
                cursor: busy || amountCents <= 0 || !safeStr(transactionId) ? "not-allowed" : "pointer",
                boxShadow: busy || amountCents <= 0 || !safeStr(transactionId) ? "none" : "0 16px 34px rgba(37,99,235,.18)",
              }}
            >
              {busy ? "Recording..." : "Record wallet"}
              <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
