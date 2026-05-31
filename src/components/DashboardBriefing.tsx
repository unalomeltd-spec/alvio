'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BriefingMetrics {
  chiffreAffaires: number;
  resultatNet: number;
  tresorerie: number;
  bfr: number;
  alerteMessage?: string;
  deltaCA?: number; // % vs N-1
}

interface DashboardBriefingProps {
  prenom: string;
  metrics: BriefingMetrics;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(1) + ' %';
}

function getTodayLabel(): string {
  const now = new Date();
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardBriefing({ prenom, metrics }: DashboardBriefingProps) {
  const router = useRouter();
  const nameRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  // Trigger entrance animation on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Typewriter effect on the first name
  useEffect(() => {
    if (!visible || !nameRef.current) return;
    const el = nameRef.current;
    el.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
      if (i < prenom.length) {
        el.textContent += prenom[i++];
      } else {
        clearInterval(interval);
        setTimeout(() => {
          if (cursorRef.current) cursorRef.current.style.display = 'none';
        }, 1400);
      }
    }, 85);
    return () => clearInterval(interval);
  }, [visible, prenom]);

  const bfrAlert = metrics.bfr > metrics.tresorerie * 1.5;
  const alertMessage =
    metrics.alerteMessage ??
    (bfrAlert
      ? `Le BFR atteint ${formatEur(metrics.bfr)} — écart significatif avec la trésorerie disponible. Une simulation de financement est recommandée.`
      : null);

  return (
    <div
      className="briefing-card"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
      }}
    >
      {/* Accent line champagne */}
      <div className="briefing-accent-line" />

      {/* Header — logo Alvio + date */}
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

      {/* Greeting */}
      <p className="briefing-greeting">
        Bonjour,&nbsp;<strong ref={nameRef} /><span ref={cursorRef} className="tw-cursor" />
      </p>
      <p className="briefing-sub">Votre briefing financier est prêt.</p>

      {/* Metric pills */}
      <div className="briefing-metrics">
        <MetricCard
          label="Chiffre d'affaires"
          value={formatEur(metrics.chiffreAffaires)}
          delta={metrics.deltaCA !== undefined ? formatPct(metrics.deltaCA) + ' vs N−1' : undefined}
          deltaType={metrics.deltaCA !== undefined ? (metrics.deltaCA >= 0 ? 'up' : 'down') : 'neutral'}
          onClick={() => router.push('/rentabilite')}
        />
        <MetricCard
          label="Résultat net"
          value={formatEur(metrics.resultatNet)}
          delta={`${((metrics.resultatNet / metrics.chiffreAffaires) * 100).toFixed(1)} % du CA`}
          deltaType="up"
          onClick={() => router.push('/compte-de-resultat')}
        />
        <MetricCard
          label="Trésorerie"
          value={formatEur(metrics.tresorerie)}
          delta={bfrAlert ? '⚠ BFR à financer' : 'Situation saine'}
          deltaType={bfrAlert ? 'warn' : 'up'}
          onClick={() => router.push('/tresorerie')}
        />
      </div>

      {/* Alert banner — affiché seulement si pertinent */}
      {alertMessage && (
        <div className="briefing-alert">
          <p className="briefing-alert-text">
            <strong>Point d'attention :</strong> {alertMessage}
          </p>
          <button
            className="briefing-alert-btn"
            onClick={() => router.push('/simulations')}
          >
            Simuler →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MetricCard sub-component ─────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  delta,
  deltaType,
  onClick,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaType: 'up' | 'down' | 'warn' | 'neutral';
  onClick?: () => void;
}) {
  const deltaColors: Record<string, string> = {
    up: '#0F6E56',
    down: '#993C1D',
    warn: '#854F0B',
    neutral: '#8C9BAB',
  };

  return (
    <button className="metric-card" onClick={onClick} type="button">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {delta && (
        <p className="metric-delta" style={{ color: deltaColors[deltaType] }}>
          {delta}
        </p>
      )}
    </button>
  );
}
