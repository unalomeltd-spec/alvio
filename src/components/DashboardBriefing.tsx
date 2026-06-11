'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BriefingMetrics {
  chiffreAffaires: number;
  resultatNet: number;
  tresorerie: number;
  bfr: number;
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
}

interface DashboardBriefingProps {
  prenom: string;
  metrics: BriefingMetrics;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
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

/* ── KPI card — design v2 ─────────────────────────────────────────── */
function KpiCard({ label, value, delta, deltaType, onClick }: {
  label: string; value: string; delta?: string;
  deltaType: 'up' | 'down' | 'warn' | 'neutral'; onClick?: () => void;
}) {
  const deltaColors: Record<string, string> = {
    up: 'var(--success)', down: 'var(--danger)',
    warn: 'var(--warning)', neutral: 'var(--text-muted)',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="alvio-kpi-card"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 14,
        padding: '14px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        fontFamily: 'inherit',
      }}
    >
      <p style={{ fontSize: '9.5px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px 0' }}>{label}</p>
      <p style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 5px 0', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</p>
      {delta && <p style={{ fontSize: 11, color: deltaColors[deltaType], margin: 0, fontWeight: 500 }}>{delta}</p>}
    </button>
  );
}

/* ── Section label ────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 0' }}>
      {children}
    </p>
  );
}

/* ── Main component ───────────────────────────────────────────────── */
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

  const bfrAlert = metrics.bfr > metrics.tresorerie * 1.5;
  const alertMessage = metrics.alerteMessage ?? (bfrAlert
    ? `Le BFR atteint ${formatEur(metrics.bfr)} — écart significatif avec la trésorerie disponible. Une simulation de financement est recommandée.`
    : null);

  return (
    <>
      {/* ── 1. Bloc greeting — carte compacte ── */}
      <div
        className="briefing-card"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.45s ease, transform 0.45s ease',
        }}
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

      {/* ── 2. Performance — section détachée ── */}
      <div style={{ marginBottom: 12 }}>
        <SectionLabel>Performance</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          <KpiCard
            label="Chiffre d'affaires"
            value={formatEur(metrics.chiffreAffaires)}
            delta={metrics.deltaCA !== undefined ? formatPct(metrics.deltaCA) + ' vs N−1' : undefined}
            deltaType={metrics.deltaCA !== undefined ? (metrics.deltaCA >= 0 ? 'up' : 'down') : 'neutral'}
            onClick={() => router.push('/income-statement')}
          />
          <KpiCard
            label="Marge brute"
            value={formatEur(metrics.margebrute)}
            delta={metrics.tauxMb.toFixed(1) + ' % du CA' + (metrics.deltaMb !== undefined ? ' · ' + formatPct(metrics.deltaMb) + ' vs N−1' : '')}
            deltaType={metrics.tauxMb >= 30 ? 'up' : 'down'}
            onClick={() => router.push('/profitability')}
          />
          <KpiCard
            label="EBITDA"
            value={formatEur(metrics.ebitda)}
            delta={metrics.tauxEbe.toFixed(1) + ' % du CA' + (metrics.deltaEbe !== undefined ? ' · ' + formatPct(metrics.deltaEbe) + ' vs N−1' : '')}
            deltaType={metrics.tauxEbe >= 10 ? 'up' : 'down'}
            onClick={() => router.push('/profitability')}
          />
          <KpiCard
            label="Résultat net"
            value={formatEur(metrics.resultatNet)}
            delta={(metrics.chiffreAffaires > 0 ? (metrics.resultatNet / metrics.chiffreAffaires * 100).toFixed(1) + ' % du CA' : '') + (metrics.deltaRnet !== undefined ? ' · ' + formatPct(metrics.deltaRnet) + ' vs N−1' : '')}
            deltaType={metrics.resultatNet >= 0 ? 'up' : 'down'}
            onClick={() => router.push('/profitability')}
          />
        </div>
      </div>

      {/* ── 3. Santé financière — section détachée ── */}
      <div style={{ marginBottom: 12 }}>
        <SectionLabel>Santé financière</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <KpiCard
            label="Trésorerie"
            value={formatEur(metrics.tresorerie)}
            delta={bfrAlert ? '⚠ BFR à financer' : 'Situation saine'}
            deltaType={bfrAlert ? 'warn' : 'up'}
            onClick={() => router.push('/sante-financiere')}
          />
          <KpiCard
            label="Créances clients"
            value={formatEur(metrics.creancesClients)}
            delta="Comptes 41x"
            deltaType="neutral"
            onClick={() => router.push('/sante-financiere')}
          />
          <KpiCard
            label="Dettes fournisseurs"
            value={formatEur(metrics.detteFournisseurs)}
            delta="Comptes 40x"
            deltaType="neutral"
            onClick={() => router.push('/sante-financiere')}
          />
        </div>
      </div>

      {/* ── Alerte ── */}
      {alertMessage && (
        <div className="briefing-alert">
          <p className="briefing-alert-text"><strong>Point d'attention :</strong> {alertMessage}</p>
          <button className="briefing-alert-btn" onClick={() => router.push('/sante-financiere')}>Voir →</button>
        </div>
      )}
    </>
  );
}
