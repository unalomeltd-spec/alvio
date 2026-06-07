'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
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
        position: 'fixed', top: 64, right: 12, bottom: 12, width: 380, zIndex: 9,
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 8px 40px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        animation: 'slideIn 0.22s cubic-bezier(0.22,1,0.36,1)'
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        {/* Header */}
        <div style={{ background: '#1A1A1A', padding: '16px 18px 14px', flexShrink: 0 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            {panel.selectedCompte ? (
              <button onClick={() => onSelectCompte(null)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, color: '#B8A98A' }}>←</span>
                <span style={{ fontSize: 10, color: '#B8A98A', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{panel.label}</span>
              </button>
            ) : (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Détail</span>
            )}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
              {nbEcritures} écriture{nbEcritures > 1 ? 's' : ''}
            </span>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
          </div>

          {/* Titre principal */}
          {panel.selectedCompte ? (
            <div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#B8A98A', marginBottom: 3, letterSpacing: '0.05em' }}>{panel.selectedCompte.num}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>{panel.selectedCompte.lib}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#B8A98A' }}>{fmt(Math.abs(panel.selectedCompte.solde))}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>{panel.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#B8A98A' }}>{fmt(Math.abs(totalSolde))}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{panel.comptes.length} compte{panel.comptes.length > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        {/* Séparateur champagne */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #B8A98A, rgba(184,169,138,0.2))', flexShrink: 0 }} />

        {/* Liste des comptes */}
        {!panel.selectedCompte && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {panel.comptes.map((c, i) => (
              <div key={i} onClick={() => onSelectCompte(c)}
                style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: '0.5px solid rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'background 0.12s', gap: 12 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FA'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(184,169,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#B8A98A', fontFamily: 'monospace' }}>{c.num.slice(0, 3)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lib}</div>
                  <div style={{ fontSize: 10, color: '#8C9BAB' }}>{c.num} · {c.ecritures.length} écriture{c.ecritures.length > 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{fmt(Math.abs(c.solde))}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', gap: 8, padding: '8px 18px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: '#F7F8FA' }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Date</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Libellé</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}>Montant</span>
            </div>
            {panel.selectedCompte.ecritures.map((e, i) => {
              const montant = e.debit - e.credit
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', gap: 8, padding: '9px 18px', borderBottom: '0.5px solid rgba(0,0,0,0.04)', alignItems: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = '#F7F8FA'}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ fontSize: 10, color: '#8C9BAB', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(e.date)}</div>
                  <div style={{ fontSize: 11, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.lib || '—'}>{e.lib || '—'}</div>
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

function CrRow({ label, value, indent, bold, color, prefixKey, annee, userId, onDrill }: {
  label: string; value: number; indent?: boolean; bold?: boolean; color?: string
  prefixKey?: string; annee: number; userId: string
  onDrill: (label: string, prefixes: string[]) => void
}) {
  if (Math.abs(value) < 0.5) return null
  const c = color || (value >= 0 ? '#1A1A1A' : '#D85A30')
  const drillable = !!prefixKey && !!PREFIXES[prefixKey]

  return (
    <div onClick={() => drillable && onDrill(label, PREFIXES[prefixKey!])}
      style={{ display: 'flex', alignItems: 'center', padding: '7px 16px', borderTop: '0.5px solid rgba(0,0,0,0.04)', cursor: drillable ? 'pointer' : 'default', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (drillable) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div style={{ flex: 1, fontSize: 12, fontWeight: bold ? 500 : 400, color: '#1A1A1A', paddingLeft: indent ? 20 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {drillable && <span style={{ fontSize: 9, color: '#B8A98A' }}>▶</span>}
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: bold ? 500 : 400, color: c, minWidth: 110, textAlign: 'right' }}>{fmt(value)}</div>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', background: 'rgba(184,169,138,0.06)', cursor: 'pointer', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#B8A98A', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {title}
        </div>
      </div>
      {open && children}
    </div>
  )
}

function SubTotal({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color || (value >= 0 ? '#1D9E75' : '#D85A30')
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', background: 'rgba(0,0,0,0.02)', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
      <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: c }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: c, minWidth: 110, textAlign: 'right' }}>{fmt(value)}</div>
    </div>
  )
}

export default function IncomeStatementPage() {
  const [etats, setEtats] = useState<any>(null)
  const [annees, setAnnees] = useState<number[]>([])
  const [anneeActive, setAnneeActive] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const [panel, setPanel] = useState<PanelData | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUserId(user.id)
      const { data } = await sb.from('fec_exercices').select('annee').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos[0]
        setAnneeActive(annee)
        const res = await fetch(`/api/etats?annee=${annee}&user_id=${user.id}`)
        if (res.ok) setEtats(await res.json())
      }
      setLoading(false)
    }
    load()
  }, [])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee)
    setEtats(null)
    setPanel(null)
    const res = await fetch(`/api/etats?annee=${annee}&user_id=${userId}`)
    if (res.ok) setEtats(await res.json())
  }

  const handleDrill = useCallback(async (label: string, prefixes: string[]) => {
    setDrillLoading(true)
    const res = await fetch(`/api/etats/detail?annee=${anneeActive}&user_id=${userId}&prefixes=${prefixes.join(',')}`)
    if (res.ok) {
      const data = await res.json()
      setPanel({ label, comptes: data.comptes, selectedCompte: null })
    }
    setDrillLoading(false)
  }, [anneeActive, userId])

  const cr = etats?.cr
  const sig = etats?.sig

  const rowProps = { annee: anneeActive, userId, onDrill: handleDrill }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="income-statement" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="income-statement" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginRight: panel ? 360 : 0, transition: 'margin-right 0.3s' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, position: 'sticky' as const, top: 0, zIndex: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Compte de résultat</span>
          {annees.length > 1 && annees.map(a => (
            <button key={a} onClick={() => changerAnnee(a)} style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.12)', background: a === anneeActive ? '#1A1A1A' : '#fff', color: a === anneeActive ? '#fff' : '#1A1A1A', cursor: 'pointer' }}>{a}</button>
          ))}
          {drillLoading && <span style={{ fontSize: 11, color: '#8C9BAB' }}>Chargement...</span>}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {!cr ? (
            <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background: '#1A1A1A', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth: 900 }}>
              {sig && <AlvioInsight payload={{ page: 'income-statement', annee: anneeActive, indicateurs: { ca: sig.ca, mb: sig.margeCommerciale, rex: sig.rex, rnet: sig.resultatNet, rfin: sig.rfin, tauxMb: sig.tauxMb, tauxRnet: sig.tauxRnet } }} />}

              <div style={{ fontSize: 11, color: '#8C9BAB', marginBottom: 12, fontStyle: 'italic' }}>
                Cliquez sur une ligne ▶ pour voir le détail des comptes et écritures
              </div>

              <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: '#1A1A1A', padding: '10px 16px' }}>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 500, color: '#F2F3F5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Libellé</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#F2F3F5', minWidth: 110, textAlign: 'right' }}>Exercice {anneeActive}</div>
                </div>

                <Section title="Produits d'exploitation">
                  <CrRow label="Ventes de marchandises" value={cr.produitsExploitation.ventesMarchandises} prefixKey="ventesMarchandises" indent {...rowProps} />
                  <CrRow label="Production vendue (biens et services)" value={cr.produitsExploitation.productionVendue} prefixKey="productionVendue" indent {...rowProps} />
                  <CrRow label="Production stockée" value={cr.produitsExploitation.productionStockee} prefixKey="productionStockee" indent {...rowProps} />
                  <CrRow label="Production immobilisée" value={cr.produitsExploitation.productionImmobilisee} prefixKey="productionImmobilisee" indent {...rowProps} />
                  <CrRow label="Subventions d'exploitation" value={cr.produitsExploitation.subventions} prefixKey="subventions" indent {...rowProps} />
                  <CrRow label="Autres produits de gestion courante" value={cr.produitsExploitation.autresProduits} prefixKey="autresProduits" indent {...rowProps} />
                  <CrRow label="Reprises sur provisions" value={cr.produitsExploitation.reprises} prefixKey="reprises" indent {...rowProps} />
                  <SubTotal label="Total produits d'exploitation" value={cr.produitsExploitation.total} color="#B8A98A" />
                </Section>

                <Section title="Charges d'exploitation">
                  <CrRow label="Achats de marchandises" value={cr.chargesExploitation.achatsMarchandises} prefixKey="achatsMarchandises" indent {...rowProps} />
                  <CrRow label="Variation de stocks" value={cr.chargesExploitation.variationStocksMarch} prefixKey="variationStocks" indent {...rowProps} />
                  <CrRow label="Autres achats" value={cr.chargesExploitation.autresAchats} prefixKey="autresAchats" indent {...rowProps} />
                  <CrRow label="Services extérieurs (61/62)" value={cr.chargesExploitation.servicesExt} prefixKey="servicesExt" indent {...rowProps} />
                  <CrRow label="Impôts, taxes et versements assimilés" value={cr.chargesExploitation.impotsTaxes} prefixKey="impotsTaxes" indent {...rowProps} />
                  <CrRow label="Charges de personnel" value={cr.chargesExploitation.chargesPersonnel} prefixKey="chargesPersonnel" indent {...rowProps} />
                  <CrRow label="Dotations aux amortissements et provisions" value={cr.chargesExploitation.dotations} prefixKey="dotations" indent {...rowProps} />
                  <CrRow label="Autres charges de gestion courante" value={cr.chargesExploitation.autresCharges} prefixKey="autresCharges" indent {...rowProps} />
                  <SubTotal label="Total charges d'exploitation" value={cr.chargesExploitation.total} color="#D85A30" />
                </Section>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: 'rgba(184,169,138,0.08)', borderTop: '0.5px solid rgba(184,169,138,0.2)' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>Résultat d'exploitation</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: cr.resultatExploitation >= 0 ? '#1D9E75' : '#D85A30', minWidth: 110, textAlign: 'right' }}>{fmt(cr.resultatExploitation)}</div>
                </div>

                {Math.abs(cr.resultatFinancier) > 0.5 && (
                  <Section title="Résultat financier" defaultOpen={false}>
                    {sig && <CrRow label="Produits financiers" value={sig.produitsFinanciers} prefixKey="produitsFinanciers" indent {...rowProps} />}
                    {sig && <CrRow label="Charges financières" value={sig.chargesFinancieres} prefixKey="chargesFinancieres" indent {...rowProps} />}
                    <SubTotal label="Résultat financier" value={cr.resultatFinancier} />
                  </Section>
                )}

                {Math.abs(cr.resultatExceptionnel) > 0.5 && (
                  <Section title="Résultat exceptionnel" defaultOpen={false}>
                    {sig && <CrRow label="Produits exceptionnels" value={sig.produitsExcep} prefixKey="produitsExcep" indent {...rowProps} />}
                    {sig && <CrRow label="Charges exceptionnelles" value={sig.chargesExcep} prefixKey="chargesExcep" indent {...rowProps} />}
                    <SubTotal label="Résultat exceptionnel" value={cr.resultatExceptionnel} />
                  </Section>
                )}

                {(Math.abs(cr.participation) > 0.5 || Math.abs(cr.is) > 0.5) && (
                  <Section title="Impôt et participation" defaultOpen={false}>
                    <CrRow label="Participation des salariés" value={cr.participation} prefixKey="participation" indent {...rowProps} />
                    <CrRow label="Impôts sur les bénéfices" value={cr.is} prefixKey="is" indent {...rowProps} />
                  </Section>
                )}

                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#1A1A1A', borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#F2F3F5' }}>Résultat net</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: cr.resultatNet >= 0 ? '#1D9E75' : '#D85A30', minWidth: 110, textAlign: 'right' }}>{fmt(cr.resultatNet)}</div>
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
