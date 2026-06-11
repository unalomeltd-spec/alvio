'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import AlvioInsight from '@/components/AlvioInsight'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
  return d
}

function fmtDate(d: string): string {
  const iso = toIso(d)
  if (!iso) return d
  return iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4)
}

// Mapping label → préfixes de comptes PCG
const PREFIXES: Record<string, string[]> = {
  'ventesMarchandises':    ['707','709'],
  'productionVendue':      ['706','701','702','703','704','705','708','73'],
  'productionStockee':     ['71'],
  'productionImmobilisee': ['72'],
  'subventions':           ['74'],
  'autresProduits':        ['75'],
  'reprises':              ['78'],
  'achatsMarchandises':    ['607','608','609'],
  'variationStocks':       ['603'],
  'autresAchats':          ['604','605','606','601','602'],
  'servicesExt':           ['61','62'],
  'impotsTaxes':           ['63'],
  'chargesPersonnel':      ['64'],
  'dotations':             ['681','682','683','684','685'],
  'autresCharges':         ['65'],
  'produitsFinanciers':    ['76','786'],
  'chargesFinancieres':    ['66','686'],
  'produitsExcep':         ['77','787'],
  'chargesExcep':          ['67','687'],
  'participation':         ['691'],
  'is':                    ['695','696','697','699'],
}

interface Compte {
  num: string
  lib: string
  solde: number
  ecritures: { date: string; lib: string; piece: string; debit: number; credit: number }[]
}

interface PanelData {
  label: string
  comptes: Compte[]
  selectedCompte: Compte | null
}

function SidePanel({ panel, onClose, onSelectCompte }: {
  panel: PanelData
  onClose: () => void
  onSelectCompte: (c: Compte | null) => void
}) {
  const totalSolde = panel.comptes.reduce((s, c) => s + c.solde, 0)
  const nbEcritures = panel.selectedCompte?.ecritures.length ?? panel.comptes.reduce((s, c) => s + c.ecritures.length, 0)

  return (
    <>
      {/* Overlay pour fermer en cliquant à côté */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 8, background: 'transparent' }} />
      <div style={{
        position: 'fixed', top: 12, right: 12, bottom: 12, width: 380, zIndex: 200,
        background: '#fff',
        borderRadius: 16,
        border: '1px solid var(--border-light)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-2px 0 24px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        animation: 'slideIn 0.22s cubic-bezier(0.22,1,0.36,1)'
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        {/* Header */}
        <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', padding: '16px 18px 14px', flexShrink: 0 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            {panel.selectedCompte ? (
              <button onClick={() => onSelectCompte(null)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, color: '#B8A98A' }}>←</span>
                <span style={{ fontSize: 10, color: '#B8A98A', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{panel.label}</span>
              </button>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Détail</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {nbEcritures} écriture{nbEcritures > 1 ? 's' : ''}
            </span>
            <button onClick={onClose} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
          </div>

          {/* Titre principal */}
          {panel.selectedCompte ? (
            <div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#B8A98A', marginBottom: 3, letterSpacing: '0.05em' }}>{panel.selectedCompte.num}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4 }}>{panel.selectedCompte.lib}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#B8A98A' }}>{fmt(Math.abs(panel.selectedCompte.solde))}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4 }}>{panel.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#B8A98A' }}>{fmt(Math.abs(totalSolde))}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{panel.comptes.length} compte{panel.comptes.length > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        {/* Séparateur champagne */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, var(--alvio-champagne), transparent)', flexShrink: 0 }} />

        {/* Liste des comptes */}
        {!panel.selectedCompte && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {panel.comptes.map((c, i) => (
              <div key={i} onClick={() => onSelectCompte(c)}
                style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer', transition: 'background 0.12s', gap: 12 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-soft)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--alvio-champagne-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#B8A98A', fontFamily: 'monospace' }}>{c.num.slice(0, 3)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lib}</div>
                  <div style={{ fontSize: 10, color: '#8C9BAB' }}>{c.num} · {c.ecritures.length} écriture{c.ecritures.length > 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(Math.abs(c.solde))}</div>
                </div>
                <span style={{ fontSize: 9, color: '#B8A98A' }}>▶</span>
              </div>
            ))}
          </div>
        )}

        {/* Détail des écritures */}
        {panel.selectedCompte && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* En-tête colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', gap: 8, padding: '8px 18px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: 'var(--bg-card-soft)' }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Date</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Libellé</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}>Montant</span>
            </div>
            {panel.selectedCompte.ecritures.map((e, i) => {
              const montant = e.debit - e.credit
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', gap: 8, padding: '9px 18px', borderBottom: '0.5px solid rgba(0,0,0,0.04)', alignItems: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = 'var(--bg-card-soft)'}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ fontSize: 10, color: '#8C9BAB', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(e.date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.lib || '—'}>{e.lib || '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: montant > 0 ? '#D85A30' : '#1D9E75', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {montant > 0 ? '+' : ''}{fmt(montant)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function CrRow({ label, value, indent, bold, color, prefixKey, annee, companyId, onDrill, valueN1, hasN1 }: {
  label: string; value: number; indent?: boolean; bold?: boolean; color?: string
  prefixKey?: string; annee: number; companyId: string | null
  onDrill: (label: string, prefixes: string[]) => void
  valueN1?: number; hasN1?: boolean
}) {
  if (Math.abs(value) < 0.5) return null
  const c = color || (value >= 0 ? 'var(--text-primary)' : 'var(--danger)')
  const drillable = !!prefixKey && !!PREFIXES[prefixKey]
  const variation = valueN1 != null && Math.abs(valueN1) > 0.5 ? ((value - valueN1) / Math.abs(valueN1)) * 100 : null

  return (
    <div onClick={() => drillable && onDrill(label, PREFIXES[prefixKey!])}
      style={{ display: 'grid', gridTemplateColumns: hasN1 ? '1fr 110px 110px 80px' : '1fr 110px', alignItems: 'center', padding: '7px 16px', borderTop: '1px solid var(--border-soft)', cursor: drillable ? 'pointer' : 'default', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (drillable) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-soft)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div style={{ fontSize: 12, fontWeight: bold ? 500 : 400, color: 'var(--text-primary)', paddingLeft: indent ? 20 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {drillable && <span style={{ fontSize: 9, color: '#B8A98A' }}>▶</span>}
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: bold ? 500 : 400, color: c, textAlign: 'right' }}>{fmt(value)}</div>
      {hasN1 && (
        <div style={{ fontSize: 12, color: '#8C9BAB', textAlign: 'right' }}>
          {valueN1 != null && Math.abs(valueN1) > 0.5 ? fmt(valueN1) : '—'}
        </div>
      )}
      {hasN1 && (
        <div style={{ textAlign: 'right' }}>
          {variation != null ? (
            <span style={{ fontSize: 11, fontWeight: 500, color: variation >= 0 ? '#1D9E75' : '#D85A30' }}>
              {variation >= 0 ? '+' : ''}{Math.round(variation)}%
            </span>
          ) : <span style={{ fontSize: 10, color: '#8C9BAB' }}>—</span>}
        </div>
      )}
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', background: 'var(--alvio-champagne-subtle)', cursor: 'pointer', borderTop: '1px solid var(--border-soft)' }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#B8A98A', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {title}
        </div>
      </div>
      {open && children}
    </div>
  )
}

function SubTotal({ label, value, color, valueN1, hasN1 }: { label: string; value: number; color?: string; valueN1?: number; hasN1?: boolean }) {
  const c = color || (value >= 0 ? '#1D9E75' : '#D85A30')
  const variation = valueN1 != null && Math.abs(valueN1) > 0.5 ? ((value - valueN1) / Math.abs(valueN1)) * 100 : null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: hasN1 ? '1fr 110px 110px 80px' : '1fr 110px', alignItems: 'center', padding: '9px 16px', background: 'var(--bg-main)', borderTop: '1px solid var(--border-soft)' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: c }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: c, textAlign: 'right' }}>{fmt(value)}</div>
      {hasN1 && <div style={{ fontSize: 12, color: '#8C9BAB', textAlign: 'right' }}>{valueN1 != null && Math.abs(valueN1) > 0.5 ? fmt(valueN1) : '—'}</div>}
      {hasN1 && (
        <div style={{ textAlign: 'right' }}>
          {variation != null ? (
            <span style={{ fontSize: 11, fontWeight: 500, color: variation >= 0 ? '#1D9E75' : '#D85A30' }}>
              {variation >= 0 ? '+' : ''}{Math.round(variation)}%
            </span>
          ) : <span style={{ fontSize: 10, color: '#8C9BAB' }}>—</span>}
        </div>
      )}
    </div>
  )
}

export default function IncomeStatementPage() {
  const [etats, setEtats] = useState<any>(null)
  const [etatsN1, setEtatsN1] = useState<any>(null)
  const [annees, setAnnees] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const { activeId } = useActiveCompany()
  const periodeParams = periodeTab === 'perso' && dateDebut && dateFin
    ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
  const periodeParamsN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1
    ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''
  const [panel, setPanel] = useState<PanelData | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      if (!activeId) return  // attend la résolution du dossier actif (spinner maintenu)
      const { data } = await sb.from('fec_exercices').select('annee').eq('company_id', activeId).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos.includes(anneeActive) ? anneeActive : anneesDispos[0]
        if (annee !== anneeActive) setAnneeActive(annee)
        const fetches: Promise<void>[] = [
          fetch(`/api/etats?annee=${annee}&company_id=${activeId}${periodeParams}`).then(r => r.ok ? r.json() : null).then(d => d && setEtats(d)),
        ]
        if (anneesDispos.includes(annee - 1)) {
          fetches.push(fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}${periodeParamsN1}`).then(r => r.ok ? r.json() : null).then(d => d && setEtatsN1(d)))
        }
        await Promise.all(fetches)
      }
      setLoading(false)
    }
    load()
  }, [activeId])

  // Relance le fetch quand la période change
  useEffect(() => {
    if (!activeId || !annees.length) return
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const paramsN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1
      ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''
    fetch(`/api/etats?annee=${anneeActive}&company_id=${activeId}${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setEtats(d))
    if (annees.includes(anneeActive - 1)) {
      fetch(`/api/etats?annee=${anneeActive - 1}&company_id=${activeId}${paramsN1}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setEtatsN1(d))
    }
  }, [periodeTab, dateDebut, dateFin, dateDebutN1, dateFinN1])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee)
    setPanel(null)
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const paramsN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1
      ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''
    const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${params}`)
    if (res.ok) setEtats(await res.json())
    if (annees.includes(annee - 1)) {
      const resN1 = await fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}${paramsN1}`)
      if (resN1.ok) setEtatsN1(await resN1.json())
    } else {
      }
  }

  const handleDrill = useCallback(async (label: string, prefixes: string[]) => {
    setDrillLoading(true)
    const res = await fetch(`/api/etats/detail?annee=${anneeActive}&company_id=${activeId}&prefixes=${prefixes.join(',')}`)
    if (res.ok) {
      const data = await res.json()
      setPanel({ label, comptes: data.comptes, selectedCompte: null })
    }
    setDrillLoading(false)
  }, [anneeActive, activeId])

  const cr = etats?.cr
  const sig = etats?.sig
  const crN1 = etatsN1?.cr
  const sigN1 = etatsN1?.sig
  const hasN1 = !!crN1

  const rowProps = { annee: anneeActive, companyId: activeId, onDrill: handleDrill }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', fontFamily: 'inherit' }}>
      <Sidebar activePage="income-statement" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--bg-main)', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', fontFamily: 'inherit' }}>
      <Sidebar activePage="income-statement" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar title="Compte de résultat" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee} loading={drillLoading}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut}
          dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1}
          dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1}
          dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {!cr ? (
            <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid var(--border-light)', padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background: 'var(--alvio-champagne)', color: 'var(--brand-dark)', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth: 900 }}>
              {sig && <AlvioInsight payload={{ page: 'income-statement', annee: anneeActive, indicateurs: { ca: sig.ca, mb: sig.margeCommerciale, rex: sig.rex, rnet: sig.resultatNet, rfin: sig.rfin, tauxMb: sig.tauxMb, tauxRnet: sig.tauxRnet } }} />}

              <div style={{ fontSize: 11, color: '#8C9BAB', marginBottom: 12, fontStyle: 'italic' }}>
                Cliquez sur une ligne ▶ pour voir le détail des comptes et écritures
              </div>

              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: hasN1 ? '1fr 110px 110px 80px' : '1fr 110px', background: 'var(--alvio-champagne-subtle)', padding: '10px 16px', gap: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Libellé</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right' }}>Exercice {anneeActive}</div>
                  {hasN1 && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right' }}>{anneeActive - 1}</div>}
                  {hasN1 && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right' }}>Var.</div>}
                </div>

                <Section title="Produits d'exploitation">
                  <CrRow label="Ventes de marchandises" value={cr.produitsExploitation.ventesMarchandises} prefixKey="ventesMarchandises" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.produitsExploitation.ventesMarchandises} />
                  <CrRow label="Production vendue (biens et services)" value={cr.produitsExploitation.productionVendue} prefixKey="productionVendue" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.produitsExploitation.productionVendue} />
                  <CrRow label="Production stockée" value={cr.produitsExploitation.productionStockee} prefixKey="productionStockee" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.produitsExploitation.productionStockee} />
                  <CrRow label="Production immobilisée" value={cr.produitsExploitation.productionImmobilisee} prefixKey="productionImmobilisee" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.produitsExploitation.productionImmobilisee} />
                  <CrRow label="Subventions d'exploitation" value={cr.produitsExploitation.subventions} prefixKey="subventions" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.produitsExploitation.subventions} />
                  <CrRow label="Autres produits de gestion courante" value={cr.produitsExploitation.autresProduits} prefixKey="autresProduits" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.produitsExploitation.autresProduits} />
                  <CrRow label="Reprises sur provisions" value={cr.produitsExploitation.reprises} prefixKey="reprises" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.produitsExploitation.reprises} />
                  <SubTotal label="Total produits d'exploitation" value={cr.produitsExploitation.total} color="#B8A98A" hasN1={hasN1} valueN1={crN1?.produitsExploitation.total} />
                </Section>

                <Section title="Charges d'exploitation">
                  <CrRow label="Achats de marchandises" value={cr.chargesExploitation.achatsMarchandises} prefixKey="achatsMarchandises" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.achatsMarchandises} />
                  <CrRow label="Variation de stocks" value={cr.chargesExploitation.variationStocksMarch} prefixKey="variationStocks" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.variationStocksMarch} />
                  <CrRow label="Autres achats" value={cr.chargesExploitation.autresAchats} prefixKey="autresAchats" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.autresAchats} />
                  <CrRow label="Services extérieurs (61/62)" value={cr.chargesExploitation.servicesExt} prefixKey="servicesExt" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.servicesExt} />
                  <CrRow label="Impôts, taxes et versements assimilés" value={cr.chargesExploitation.impotsTaxes} prefixKey="impotsTaxes" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.impotsTaxes} />
                  <CrRow label="Charges de personnel" value={cr.chargesExploitation.chargesPersonnel} prefixKey="chargesPersonnel" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.chargesPersonnel} />
                  <CrRow label="Dotations aux amortissements et provisions" value={cr.chargesExploitation.dotations} prefixKey="dotations" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.dotations} />
                  <CrRow label="Autres charges de gestion courante" value={cr.chargesExploitation.autresCharges} prefixKey="autresCharges" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.chargesExploitation.autresCharges} />
                  <SubTotal label="Total charges d'exploitation" value={cr.chargesExploitation.total} color="#D85A30" hasN1={hasN1} valueN1={crN1?.chargesExploitation.total} />
                </Section>

                <div style={{ display: 'grid', gridTemplateColumns: hasN1 ? '1fr 110px 110px 80px' : '1fr 110px', alignItems: 'center', padding: '10px 16px', background: 'var(--alvio-champagne-subtle)', borderTop: '1px solid var(--alvio-champagne-light)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Résultat d'exploitation</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: cr.resultatExploitation >= 0 ? '#1D9E75' : '#D85A30', textAlign: 'right' }}>{fmt(cr.resultatExploitation)}</div>
                  {hasN1 && <div style={{ fontSize: 13, color: '#8C9BAB', textAlign: 'right' }}>{crN1?.resultatExploitation != null ? fmt(crN1.resultatExploitation) : '—'}</div>}
                  {hasN1 && (() => { const v = crN1?.resultatExploitation; const variation = v != null && Math.abs(v) > 0.5 ? ((cr.resultatExploitation - v) / Math.abs(v)) * 100 : null; return <div style={{ textAlign: 'right' }}>{variation != null ? <span style={{ fontSize:11, fontWeight:500, color: variation >= 0 ? '#1D9E75' : '#D85A30' }}>{variation >= 0 ? '+' : ''}{Math.round(variation)}%</span> : <span style={{ fontSize:10, color:'#8C9BAB' }}>—</span>}</div> })()}
                </div>

                {Math.abs(cr.resultatFinancier) > 0.5 && (
                  <Section title="Résultat financier" defaultOpen={false}>
                    {sig && <CrRow label="Produits financiers" value={sig.produitsFinanciers} prefixKey="produitsFinanciers" indent {...rowProps} hasN1={hasN1} valueN1={sigN1?.produitsFinanciers} />}
                    {sig && <CrRow label="Charges financières" value={sig.chargesFinancieres} prefixKey="chargesFinancieres" indent {...rowProps} hasN1={hasN1} valueN1={sigN1?.chargesFinancieres} />}
                    <SubTotal label="Résultat financier" value={cr.resultatFinancier} hasN1={hasN1} valueN1={crN1?.resultatFinancier} />
                  </Section>
                )}

                {Math.abs(cr.resultatExceptionnel) > 0.5 && (
                  <Section title="Résultat exceptionnel" defaultOpen={false}>
                    {sig && <CrRow label="Produits exceptionnels" value={sig.produitsExcep} prefixKey="produitsExcep" indent {...rowProps} hasN1={hasN1} valueN1={sigN1?.produitsExcep} />}
                    {sig && <CrRow label="Charges exceptionnelles" value={sig.chargesExcep} prefixKey="chargesExcep" indent {...rowProps} hasN1={hasN1} valueN1={sigN1?.chargesExcep} />}
                    <SubTotal label="Résultat exceptionnel" value={cr.resultatExceptionnel} hasN1={hasN1} valueN1={crN1?.resultatExceptionnel} />
                  </Section>
                )}

                {(Math.abs(cr.participation) > 0.5 || Math.abs(cr.is) > 0.5) && (
                  <Section title="Impôt et participation" defaultOpen={false}>
                    <CrRow label="Participation des salariés" value={cr.participation} prefixKey="participation" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.participation} />
                    <CrRow label="Impôts sur les bénéfices" value={cr.is} prefixKey="is" indent {...rowProps} hasN1={hasN1} valueN1={crN1?.is} />
                  </Section>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: hasN1 ? '1fr 110px 110px 80px' : '1fr 110px', alignItems: 'center', padding: '12px 16px', background: 'var(--brand-dark)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F8F8F6' }}>Résultat net</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: cr.resultatNet >= 0 ? '#1D9E75' : '#D85A30', textAlign: 'right' }}>{fmt(cr.resultatNet)}</div>
                  {hasN1 && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'right' }}>{crN1?.resultatNet != null ? fmt(crN1.resultatNet) : '—'}</div>}
                  {hasN1 && (() => { const v = crN1?.resultatNet; const variation = v != null && Math.abs(v) > 0.5 ? ((cr.resultatNet - v) / Math.abs(v)) * 100 : null; return <div style={{ textAlign: 'right' }}>{variation != null ? <span style={{ fontSize:11, fontWeight:500, color: variation >= 0 ? '#1D9E75' : '#D85A30' }}>{variation >= 0 ? '+' : ''}{Math.round(variation)}%</span> : <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>—</span>}</div> })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {panel && (
        <SidePanel
          panel={panel}
          onClose={() => setPanel(null)}
          onSelectCompte={c => setPanel(prev => prev ? { ...prev, selectedCompte: c } : null)}
        />
      )}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
