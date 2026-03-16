// src/pages/Employee.tsx
import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser } from "../api";

type RecognitionItem = {
  id?: string;
  title?: string;
  description?: string;
  requirement?: string;
  notes?: string;
  tier?: string;
  metric?: string;
  threshold?: number;
  awardedAt?: string;
  at?: string;
  awardedBy?: string;
  by?: string;
  type?: string;
  eventType?: string;
  icon?: string;
  [k: string]: any;
};

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(v?: string) {
  const s = safeStr(v);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeArray(value: any): RecognitionItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
}

function getRequirementText(item: RecognitionItem) {
  const explicit =
    safeStr(item.requirement) ||
    safeStr(item.notes) ||
    safeStr(item.description);

  if (explicit) return explicit;

  const metric = safeStr(item.metric);
  const threshold = safeNum(item.threshold);

  if (metric && threshold) return `Requirement: ${threshold} ${metric}`;
  if (metric) return `Metric: ${metric}`;
  if (safeStr(item.tier)) return `Tier: ${safeStr(item.tier)}`;
  return "No extra details available.";
}

function getRecognitionDate(item: RecognitionItem) {
  return safeStr(item.awardedAt || item.at);
}

function getRecognitionType(item: RecognitionItem): "achievement" | "trophy" {
  const t = safeStr(item.type || item.eventType).toLowerCase();
  if (t.includes("troph")) return "trophy";
  return "achievement";
}


function dedupeRecognition(items: RecognitionItem[]) {
  const seen = new Set<string>();
  const out: RecognitionItem[] = [];

  for (const item of items) {
    const key =
      safeStr(item.id) ||
      [
        safeStr(item.title),
        safeStr(item.tier),
        safeStr(item.awardedAt || item.at),
        safeStr(item.awardedBy || item.by),
      ].join("|");

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out.sort((a, b) => {
    const da = new Date(getRecognitionDate(a) || 0).getTime();
    const db = new Date(getRecognitionDate(b) || 0).getTime();
    return db - da;
  });
}

function TooltipIcon({
  item,
  fallbackType,
}: {
  item: RecognitionItem;
  fallbackType?: "achievement" | "trophy";
}) {
  const actualType = fallbackType || getRecognitionType(item);
  const icon = actualType === "trophy" ? "emoji_events" : "military_tech";
  const tone = actualType === "trophy" ? "amber" : "green";

  return (
    <div className={`empAwardWrap ${tone}`}>
      <div className={`empAwardIcon ${tone}`}>
        <i className="material-icons">{icon}</i>
      </div>

      <div className="empAwardTooltip" role="tooltip">
        <div className="empAwardTooltipTitle">
          {safeStr(item.title) || (actualType === "trophy" ? "Trophy" : "Achievement")}
        </div>

        {!!safeStr(item.tier) && (
          <div className="empAwardTooltipRow">
            <b>Tier:</b> {safeStr(item.tier)}
          </div>
        )}

        <div className="empAwardTooltipRow">
          <b>Date:</b> {fmtDate(getRecognitionDate(item))}
        </div>

        {!!safeStr(item.awardedBy || item.by) && (
          <div className="empAwardTooltipRow">
            <b>By:</b> {safeStr(item.awardedBy || item.by)}
          </div>
        )}

        <div className="empAwardTooltipDesc">{getRequirementText(item)}</div>
      </div>
    </div>
  );
}

export default function Employee() {
  const { user, api } = useAuth();
  const [me, setMe] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!user) return;

    (async () => {
      try {
        setLoading(true);
        const list = await api.getUsers();
        const mine =
          list.find((u) => u.username === user.username) ||
          list.find(
            (u) =>
              (u.employee_email || "").toLowerCase() ===
              (user.username || "").toLowerCase()
          );

        if (mounted) setMe(mine || null);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, api]);

  const displayName = me?.employee_name || user?.name || user?.username || "—";
  const email = me?.employee_email || user?.username || "—";
  const role = (me?.employee_role || user?.role || "employee").toUpperCase();
  const avatar = me?.employee_profilepicture;

  const achievements = useMemo(() => {
    const raw =
      normalizeArray((me as any)?.achievements) ||
      normalizeArray((me as any)?.employee_achievements);
    return dedupeRecognition(raw);
  }, [me]);

  const trophies = useMemo(() => {
    const raw =
      normalizeArray((me as any)?.trophies) ||
      normalizeArray((me as any)?.employee_trophies);
    return dedupeRecognition(raw);
  }, [me]);

  return (
    <>
      <Navbar />

      <main className="container" style={{ paddingTop: 24, maxWidth: 1100 }}>
        <style>{`
          .empPageCard{
            border-radius:24px;
            overflow:visible;
          }

          .empProfileHead{
            display:grid;
            grid-template-columns:140px minmax(0,1fr);
            gap:20px;
            align-items:center;
          }

          .empAvatarShell{
            width:120px;
            height:120px;
            margin:0 auto;
            border-radius:999px;
            overflow:hidden;
            background:#eceff1;
            border:1px solid #dde5ea;
            box-shadow:0 8px 20px rgba(15,23,42,.08);
          }

          .empAvatarShell img{
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
          }

          .empName{
            margin:0;
            font-size:1.55rem;
            font-weight:800;
            color:#1b2733;
          }

          .empSubRow{
            margin-top:8px;
            display:flex;
            flex-wrap:wrap;
            align-items:center;
            gap:8px;
            color:#607d8b;
          }

          .empCode{
            padding:4px 8px;
            border-radius:10px;
            background:#f7fafc;
            border:1px solid #e2e8f0;
            font-size:.92rem;
          }

          .empSection{
            margin-top:22px;
          }

          .empSectionTitle{
            margin:0 0 12px 0;
            font-size:1.1rem;
            font-weight:800;
            color:#22313f;
          }

          .empInfoGrid{
            display:grid;
            grid-template-columns:repeat(2, minmax(0,1fr));
            gap:12px;
          }

          .empInfoItem{
            border:1px solid #e5edf3;
            background:linear-gradient(180deg,#fff 0%, #fbfdff 100%);
            border-radius:16px;
            padding:12px 14px;
            min-width:0;
          }

          .empInfoLabel{
            font-size:.78rem;
            font-weight:800;
            text-transform:uppercase;
            letter-spacing:.06em;
            color:#78909c;
          }

          .empInfoValue{
            margin-top:6px;
            font-size:.98rem;
            font-weight:700;
            color:#263238;
            word-break:break-word;
          }

          .empRecognitionCard{
            border:1px solid #e5edf3;
            background:linear-gradient(180deg,#fff 0%, #fbfdff 100%);
            border-radius:18px;
            padding:14px;
          }

          .empRecognitionHead{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            margin-bottom:12px;
          }

          .empRecognitionLabel{
            display:flex;
            align-items:center;
            gap:8px;
            font-size:1rem;
            font-weight:800;
            color:#22313f;
          }

          .empRecognitionLabel i{
            font-size:20px;
          }

          .empRecognitionCount{
            padding:6px 10px;
            border-radius:999px;
            font-size:.82rem;
            font-weight:800;
            background:#f4f8fb;
            border:1px solid #dfe8ef;
            color:#546e7a;
          }

          .empIconsGrid{
            display:flex;
            flex-wrap:wrap;
            gap:12px;
          }

          .empEmpty{
            border:1px dashed #d9e5ee;
            border-radius:16px;
            padding:16px;
            color:#78909c;
            background:#fcfdff;
            font-weight:600;
          }

          .empAwardWrap{
            position:relative;
            display:inline-flex;
            align-items:center;
            justify-content:center;
          }

          .empAwardIcon{
            width:54px;
            height:54px;
            border-radius:16px;
            display:grid;
            place-items:center;
            border:1px solid #e2ebf3;
            background:#fff;
            box-shadow:0 8px 18px rgba(15,23,42,.08);
            cursor:default;
            transition:transform .15s ease, box-shadow .15s ease;
          }

          .empAwardIcon i{
            font-size:26px;
          }

          .empAwardIcon.green{
            color:#166534;
            background:linear-gradient(180deg, rgba(34,197,94,.08), #fff 60%);
          }

          .empAwardIcon.amber{
            color:#92400e;
            background:linear-gradient(180deg, rgba(245,158,11,.10), #fff 60%);
          }

          .empAwardWrap:hover .empAwardIcon{
            transform:translateY(-2px);
            box-shadow:0 12px 22px rgba(15,23,42,.12);
          }

          .empAwardTooltip{
            position:absolute;
            left:50%;
            bottom:calc(100% + 10px);
            transform:translateX(-50%) translateY(6px);
            width:260px;
            max-width:min(260px, 80vw);
            padding:12px 13px;
            border-radius:14px;
            background:rgba(18,28,39,.98);
            color:#fff;
            box-shadow:0 18px 36px rgba(15,23,42,.28);
            opacity:0;
            visibility:hidden;
            pointer-events:none;
            transition:all .16s ease;
            z-index:30;
            text-align:left;
          }

          .empAwardTooltip::after{
            content:"";
            position:absolute;
            left:50%;
            top:100%;
            transform:translateX(-50%);
            border-width:7px;
            border-style:solid;
            border-color:rgba(18,28,39,.98) transparent transparent transparent;
          }

          .empAwardWrap:hover .empAwardTooltip{
            opacity:1;
            visibility:visible;
            transform:translateX(-50%) translateY(0);
          }

          .empAwardTooltipTitle{
            font-size:.95rem;
            font-weight:800;
            line-height:1.25;
            margin-bottom:8px;
            color:#fff;
            word-break:break-word;
          }

          .empAwardTooltipRow{
            font-size:.8rem;
            line-height:1.45;
            color:#d7e3ea;
            margin-bottom:4px;
            word-break:break-word;
          }

          .empAwardTooltipDesc{
            margin-top:8px;
            padding-top:8px;
            border-top:1px solid rgba(255,255,255,.12);
            font-size:.82rem;
            line-height:1.5;
            color:#f3f7fa;
            word-break:break-word;
          }

          @media (max-width: 700px){
            .empProfileHead{
              grid-template-columns:1fr;
              text-align:center;
            }

            .empSubRow{
              justify-content:center;
            }

            .empInfoGrid{
              grid-template-columns:1fr;
            }
          }
        `}</style>

        <div className="card empPageCard">
          <div className="card-content">
            <span className="card-title" style={{ fontWeight: 800 }}>
              My Profile
            </span>

            {loading ? (
              <p>Loading…</p>
            ) : (
              <>
                <div className="empProfileHead">
                  <div className="center">
                    <div className="empAvatarShell">
                      {avatar ? <img src={avatar} alt="me" /> : null}
                    </div>
                  </div>

                  <div>
                    <h5 className="empName">{displayName}</h5>

                    <div className="empSubRow">
                      <span className="empCode">{email}</span>
                      <span className="chip" style={{ fontWeight: 700 }}>
                        {role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="empSection">
                  <h6 className="empSectionTitle">Details</h6>

                  <div className="empInfoGrid">
                    <div className="empInfoItem">
                      <div className="empInfoLabel">Title</div>
                      <div className="empInfoValue">{me?.employee_title || "—"}</div>
                    </div>

                    <div className="empInfoItem">
                      <div className="empInfoLabel">DOB</div>
                      <div className="empInfoValue">{me?.employee_dob || "—"}</div>
                    </div>

                    <div className="empInfoItem">
                      <div className="empInfoLabel">Employment</div>
                      <div className="empInfoValue">{(me as any)?.employment_type || "—"}</div>
                    </div>

                    <div className="empInfoItem">
                      <div className="empInfoLabel">Department</div>
                      <div className="empInfoValue">{(me as any)?.department || "—"}</div>
                    </div>

                    <div className="empInfoItem">
                      <div className="empInfoLabel">Location</div>
                      <div className="empInfoValue">{(me as any)?.location || "—"}</div>
                    </div>

                    <div className="empInfoItem">
                      <div className="empInfoLabel">Phone</div>
                      <div className="empInfoValue">{me?.employee_phonenumber || "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="empSection">
                  <h6 className="empSectionTitle">Recognition</h6>

                  <div className="row" style={{ marginBottom: 0 }}>
                    <div className="col s12 m6" style={{ marginBottom: 16 }}>
                      <div className="empRecognitionCard">
                        <div className="empRecognitionHead">
                          <div className="empRecognitionLabel">
                            <i className="material-icons" style={{ color: "#166534" }}>
                              military_tech
                            </i>
                            Achievements
                          </div>
                          <div className="empRecognitionCount">{achievements.length}</div>
                        </div>

                        {!achievements.length ? (
                          <div className="empEmpty">No achievements recorded yet.</div>
                        ) : (
                          <div className="empIconsGrid">
                            {achievements.map((item, idx) => (
                              <TooltipIcon
                                key={safeStr(item.id) || `achievement-${idx}`}
                                item={item}
                                fallbackType="achievement"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col s12 m6" style={{ marginBottom: 16 }}>
                      <div className="empRecognitionCard">
                        <div className="empRecognitionHead">
                          <div className="empRecognitionLabel">
                            <i className="material-icons" style={{ color: "#92400e" }}>
                              emoji_events
                            </i>
                            Trophies
                          </div>
                          <div className="empRecognitionCount">{trophies.length}</div>
                        </div>

                        {!trophies.length ? (
                          <div className="empEmpty">No trophies recorded yet.</div>
                        ) : (
                          <div className="empIconsGrid">
                            {trophies.map((item, idx) => (
                              <TooltipIcon
                                key={safeStr(item.id) || `trophy-${idx}`}
                                item={item}
                                fallbackType="trophy"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}