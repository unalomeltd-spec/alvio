'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

interface MensuelPoint { mois: number; label: string; produits: number; charges: number; }
interface ChargeNature { key?: string; label: string; montant: number; }

interface BriefingMetrics {
  chiffreAffaires: number;
  resultatNet: number;
  tresorerie: number;
  margebrute: number;
  tauxMb: number;
  ebitda: number;
  tauxEbe: number;
  detteFournisseurs: number;
  creancesClients: number;
  alerteMessage?: string;
  deltaCA?: number;
  deltaMb?: number;
  deltaEbe?: number;
  deltaRnet?: number;
  mensuel?: MensuelPoint[];
  chargesParNature?: ChargeNature[];
}

interface DashboardBriefingProps {
  prenom: string;
  metrics: BriefingMetrics;
}

const COL = { gold: '#C6A275', goldD: '#B08D5E', arg: '#8C9BAB' };
const DONUT_COLORS = ['#C6A275', '#B08D5E', '#D4BC97', '#8C9BAB', '#B9C2CB', '#6E7378', '#A99672', '#CBD2D9'];

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}
function formatEurK(value: number): string {
  const k = Math.round((value || 0) / 1000);
  return k.toLocaleString('fr-FR') + ' k€';
}
function formatPct(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(1) + ' %';
}
function getTodayLabel(): string {
  const now = new Date();
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

/* ── Section label ────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 0' }}>
      {children}
    </p>
  );
}

/* ── Sparkline animée (tracé progressif) ──────────────────────────── */
function Sparkline({ points, up }: { points: string; up: boolean }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 280); return () => clearTimeout(t); }, []);
  return (
    <svg width="48" height="20" viewBox="0 0 60 22" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline
        points={points}
        stroke={up ? COL.gold : COL.arg}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="alvio-spark"
        pathLength={100}
        style={{ strokeDasharray: 100, strokeDashoffset: drawn ? 0 : 100 }}
      />
    </svg>
  );
}

/* ── Carte KPI ────────────────────────────────────────────────────── */
function KpiCard({ label, value, spark, footer, onClick }: {
  label: string; value: string; spark?: ReactNode; footer: ReactNode; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="alvio-kpi-card"
      style={{
        background: 'var(--bg-card)', border: `1px solid ${hovered ? '#C6A275' : 'var(--border-light)'}`, borderRadius: 14,
        padding: '13px 15px', textAlign: 'left', cursor: 'pointer', width: '100%', fontFamily: 'inherit',
        transition: 'border-color .18s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <p className="alvio-kpi-label">{label}</p>
          <p className="alvio-kpi-value alvio-num">{value}</p>
        </div>
        {spark}
      </div>
      <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>{footer}</div>
    </button>
  );
}

/* ── Pastille de variation N−1 ────────────────────────────────────── */
function DeltaPill({ value }: { value?: number }) {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  const up = value >= 0;
  return (
    <span className="alvio-dpill" style={{ background: up ? '#E7F3EC' : '#FBEAEA', color: up ? 'var(--success)' : 'var(--danger)' }}>
      <span style={{ fontSize: 12, lineHeight: 1 }}>{up ? '↑' : '↓'}</span>{formatPct(value)}
    </span>
  );
}

/* ── Histogramme mensuel produits / charges (croissance animée) ───── */
function ProduitsChargesChart({ data }: { data: MensuelPoint[] }) {
  const [vis, setVis] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setVis(true), 220); return () => clearTimeout(t); }, []);

  const W = 600, H = 210, base = 120, upMax = 80, dnMax = 72, slot = W / 12, bw = 14;
  const max = Math.max(1, ...data.map(d => Math.max(d.produits, d.charges)));

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Produits et charges par mois">
        <line x1="8" y1={base} x2={W - 8} y2={base} stroke="var(--border-light)" strokeWidth="1" />
        {hover !== null && (
          <rect x={slot * hover + 3} y="4" width={slot - 6} height={H - 26} rx="6" fill="var(--alvio-champagne-subtle)" />
        )}
        {data.map((d, i) => {
          const cx = slot * i + slot / 2;
          const ph = d.produits > 0 ? (d.produits / max) * upMax : 0;
          const ch = d.charges > 0 ? (d.charges / max) * dnMax : 0;
          const on = hover === i;
          return (
            <g key={i}>
              <rect x={cx - bw / 2} y={base - ph} width={bw} height={ph} rx="4" fill={on ? COL.goldD : COL.gold}
                className="alvio-bar" style={{ transformBox: 'fill-box', transformOrigin: 'bottom', transform: vis ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${i * 40}ms` }} />
              <rect x={cx - bw / 2} y={base} width={bw} height={ch} rx="4" fill={on ? '#7C8A99' : COL.arg}
                className="alvio-bar" style={{ transformBox: 'fill-box', transformOrigin: 'top', transform: vis ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${i * 40 + 60}ms` }} />
            </g>
          );
        })}
        {data.map((d, i) => (
          <rect key={'h' + i} x={slot * i} y="0" width={slot} height={H - 22} fill="transparent"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        <g fontFamily="Inter" fontSize="11" fill="var(--text-muted)" textAnchor="middle">
          {data.map((d, i) => <text key={'l' + i} x={slot * i + slot / 2} y={H - 5}>{d.label}</text>)}
        </g>
      </svg>
      {hover !== null && (
        <div className="alvio-chart-tip" style={{ left: `${Math.min(88, Math.max(12, ((hover + 0.5) / 12) * 100))}%`, top: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 3, textTransform: 'capitalize' }}>{data[hover].label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: COL.gold }} />Produits {formatEur(data[hover].produits)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: COL.arg }} />Charges {formatEur(data[hover].charges)}</div>
        </div>
      )}
    </div>
  );
}

/* ── Donut « répartition des charges » (tracé progressif + survol) ── */
function DonutCharges({ data }: { data: ChargeNature[] }) {
  const [vis, setVis] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setVis(true), 260); return () => clearTimeout(t); }, []);

  const total = data.reduce((s, d) => s + d.montant, 0) || 1;
  const r = 58, cx = 80, cy = 80, C = 2 * Math.PI * r;
  let cum = 0;
  const segs = data.map((d, i) => {
    const frac = d.montant / total;
    const arc = frac * C;
    const start = cum; cum += arc;
    return { ...d, frac, arc, start, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  const centerVal = hover !== null ? Math.round(segs[hover].frac * 100) + ' %' : formatEurK(total);
  const centerLabel = hover !== null ? segs[hover].label : 'Charges';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
      <svg width="150" height="150" viewBox="0 0 160 160" style={{ flexShrink: 0 }} role="img" aria-label="Répartition des charges par nature">
        <g transform="rotate(-90 80 80)" fill="none">
          {segs.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} stroke={s.color}
              className="alvio-donut-seg"
              strokeWidth={hover === i ? 22 : 18}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{
                strokeDasharray: vis ? `${s.arc} ${C - s.arc}` : `0 ${C}`,
                strokeDashoffset: -s.start,
                transitionDelay: `${i * 90}ms`,
              }} />
          ))}
        </g>
        <text x="80" y="77" textAnchor="middle" fontFamily="Inter" fontSize="18" fontWeight="600" fill="var(--text-primary)">{centerVal}</text>
        <text x="80" y="94" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--text-muted)">{centerLabel}</text>
      </svg>
      <div style={{ flex: '1 1 150px', minWidth: 150, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segs.map((s, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'default', padding: '3px 6px', margin: '0 -6px', borderRadius: 8, background: hover === i ? 'var(--alvio-champagne-subtle)' : 'transparent', transition: 'background .15s ease' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="alvio-num">{Math.round(s.frac * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Composant principal ──────────────────────────────────────────── */
export default function DashboardBriefing({ prenom, metrics }: DashboardBriefingProps) {
  const router = useRouter();
  const nameRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible || !nameRef.current) return;
    const el = nameRef.current;
    el.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
      if (i < prenom.length) { el.textContent += prenom[i++]; }
      else {
        clearInterval(interval);
        setTimeout(() => { if (cursorRef.current) cursorRef.current.style.display = 'none'; }, 1400);
      }
    }, 85);
    return () => clearInterval(interval);
  }, [visible, prenom]);

  const rev = (delay: number): CSSProperties => ({ transitionDelay: `${delay}ms` });
  const cls = (extra = '') => `alvio-reveal${visible ? ' in' : ''} ${extra}`.trim();

  const tauxRnet = metrics.chiffreAffaires > 0 ? (metrics.resultatNet / metrics.chiffreAffaires) * 100 : 0;

  const mensuel = metrics.mensuel ?? [];
  const charges = metrics.chargesParNature ?? [];
  const hasMensuel = mensuel.some(m => m.produits !== 0 || m.charges !== 0);
  const hasCharges = charges.length > 0;

  let insightText: string;
  let insightDanger = false;
  if (metrics.resultatNet < 0) {
    insightText = 'Votre résultat net est négatif sur la période. Priorité : identifier les postes de charges qui pèsent le plus.';
    insightDanger = true;
  } else if (metrics.deltaEbe !== undefined && metrics.deltaCA !== undefined && metrics.deltaEbe > metrics.deltaCA) {
    insightText = `Votre EBE progresse plus vite que le chiffre d'affaires (${formatPct(metrics.deltaEbe)} vs ${formatPct(metrics.deltaCA)}) : la rentabilité d'exploitation s'améliore.`;
  } else {
    insightText = metrics.alerteMessage ?? "États financiers à jour. Aucun point d'attention majeur détecté sur la période.";
  }

  return (
    <>
      {/* ── 1. Bloc greeting ── */}
      <div
        className="briefing-card"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.45s ease, transform 0.45s ease' }}
      >
        <div className="briefing-accent-line" />
        <div className="briefing-header">
          <div className="briefing-header-left">
            <div className="alvio-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span className="alvio-online-dot" />
            </div>
            <div>
              <p className="alvio-name">Alvio</p>
              <p className="alvio-status">CFO Digital · En ligne</p>
            </div>
          </div>
          <span className="briefing-date">{getTodayLabel()}</span>
        </div>
        <p className="briefing-greeting">Bonjour,&nbsp;<strong ref={nameRef} /><span ref={cursorRef} className="tw-cursor" /></p>
        <p className="briefing-sub" style={{ marginBottom: 0 }}>Votre briefing financier est prêt.</p>
      </div>

      {/* ── 2. Performance ── */}
      <div style={{ marginBottom: 18 }}>
        <SectionLabel>Performance</SectionLabel>
        <div className="dash-kpi4">
          <div className={cls()} style={rev(60)}>
            <KpiCard
              label="Chiffre d'affaires"
              value={formatEur(metrics.chiffreAffaires)}
              footer={<><DeltaPill value={metrics.deltaCA} /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs N−1</span></>}
              onClick={() => router.push('/performances')}
            />
          </div>
          <div className={cls()} style={rev(120)}>
            <KpiCard
              label="Marge brute"
              value={formatEur(metrics.margebrute)}
              footer={<><span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{metrics.tauxMb.toFixed(1)} % du CA</span><DeltaPill value={metrics.deltaMb} /></>}
              onClick={() => router.push('/performances')}
            />
          </div>
          <div className={cls()} style={rev(180)}>
            <KpiCard
              label="EBITDA"
              value={formatEur(metrics.ebitda)}
              footer={<><span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{metrics.tauxEbe.toFixed(1)} % du CA</span><DeltaPill value={metrics.deltaEbe} /></>}
              onClick={() => router.push('/performances')}
            />
          </div>
          <div className={cls()} style={rev(240)}>
            <KpiCard
              label="Résultat net"
              value={formatEur(metrics.resultatNet)}
              footer={<><span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{tauxRnet.toFixed(1)} % du CA</span><DeltaPill value={metrics.deltaRnet} /></>}
              onClick={() => router.push('/performances')}
            />
          </div>
        </div>
      </div>

      {/* ── 3. Graphiques ── */}
      {(hasMensuel || hasCharges) && (
        <div className="dash-charts" style={{ marginBottom: 18 }}>
          {hasMensuel && (
            <div className={cls('alvio-chart-card')} style={rev(300)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p className="alvio-chart-title">Produits &amp; charges</p>
                  <p className="alvio-chart-sub">Vue mensuelle</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: COL.gold }} />Produits</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: COL.arg }} />Charges</span>
              </div>
              <ProduitsChargesChart data={mensuel} />
            </div>
          )}
          {hasCharges && (
            <div className={cls('alvio-chart-card')} style={rev(360)}>
              <p className="alvio-chart-title" style={{ marginBottom: 12 }}>Répartition des charges</p>
              <DonutCharges data={charges} />
            </div>
          )}
        </div>
      )}

      {/* ── 4. Santé financière ── */}
      <div style={{ marginBottom: 18 }}>
        <SectionLabel>Santé financière</SectionLabel>
        <div className="dash-kpi3">
          <div className={cls()} style={rev(420)}>
            <KpiCard
              label="Trésorerie"
              value={formatEur(metrics.tresorerie)}
              footer={<span className="alvio-dpill" style={{ background: metrics.tresorerie >= 0 ? '#E7F3EC' : '#FBEAEA', color: metrics.tresorerie >= 0 ? 'var(--success)' : 'var(--danger)' }}>{metrics.tresorerie >= 0 ? 'Situation saine' : 'Trésorerie négative'}</span>}
              onClick={() => router.push('/sante-financiere')}
            />
          </div>
          <div className={cls()} style={rev(470)}>
            <KpiCard
              label="Créances clients"
              value={formatEur(metrics.creancesClients)}
              footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Comptes 41x</span>}
              onClick={() => router.push('/sante-financiere')}
            />
          </div>
          <div className={cls()} style={rev(520)}>
            <KpiCard
              label="Dettes fournisseurs"
              value={formatEur(metrics.detteFournisseurs)}
              footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Comptes 40x</span>}
              onClick={() => router.push('/sante-financiere')}
            />
          </div>
        </div>
      </div>

      {/* ── 5. Analyse Alvio ── */}
      <div className={cls(`alvio-insight ${insightDanger ? 'alvio-insight--danger' : 'alvio-insight--gold'}`)} style={rev(580)}>
        <div className="alvio-insight-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={insightDanger ? '#B42318' : '#B08D5E'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: insightDanger ? '#633806' : '#5c4f3a', lineHeight: 1.5, flex: 1 }}>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Analyse Alvio —</strong> {insightText}
        </p>
        <button onClick={() => router.push('/performances')} style={{ fontSize: 12, fontWeight: 600, color: insightDanger ? '#B42318' : '#B08D5E', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Voir →</button>
      </div>
    </>
  );
}
