'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import AlvioInsight from '@/components/AlvioInsight'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'

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

const PREFIXES_BILAN: Record<string, string[]> = {
  'immoIncorp':         ['20'],
  'immoCorpBrut':       ['21','22','23','24','25'],
  'immoFin':            ['26','27'],
  'amortIncorp':        ['280'],
  'amortCorp':          ['281','282','283','284','285','286','287','288','29'],
  'stocksMarchandises': ['30','36','37'],
  'stocksMatieres':     ['31','32'],
  'creancesClients':    ['41'],
  'creancesEtat':       ['44'],
  'autresCreances':     ['45','46','47','48'],
  'tresorerie':         ['50','51','52','53','54','58'],
  'capital':            ['10','11','12'],
  'subventionsInvest':  ['13'],
  'provisions':         ['14','15'],
  'emprunts':           ['16','17'],
  'dettesFournisseurs': ['40'],
  'dettesSociales':     ['42','43'],
  'dettesFiscales':     ['44'],
  'autresDettes':       ['45','46','47','48'],
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
  const totalSolde = panel.comptes.reduce((s, c) => s + Math.abs(c.solde), 0)

  return (
    <div style={{ width: 360, flexShrink: 0, position: 'fixed' as const, top: 52, right: 0, bottom: 0, zIndex: 100, background: '#fff', borderLeft: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1A1A1A', padding: '14px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              {panel.selectedCompte ? (
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onSelectCompte(null)}>
                  ← {panel.label}
                </span>
              ) : panel.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>
              {panel.selectedCompte ? panel.selectedCompte.num : fmt(totalSolde)}
            </div>
            {panel.selectedCompte && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {panel.selectedCompte.lib} — {fmt(Math.abs(panel.selectedCompte.solde))}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, padding: 0 }}>×</button>
        </div>
      </div>

      {!panel.selectedCompte && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {panel.comptes.map((c, i) => (
            <div key={i} onClick={() => onSelectCompte(c)}
              style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.05)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FA'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#B8A98A', fontFamily: 'monospace', marginBottom: 2 }}>{c.num}</div>
                <div style={{ fontSize: 11, color: '#8C9BAB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{c.lib}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{fmt(Math.abs(c.solde))}</div>
                <div style={{ fontSize: 10, color: '#8C9BAB', marginTop: 2 }}>{c.ecritures.length} écriture{c.ecritures.length > 1 ? 's' : ''}</div>
              </div>
              <span style={{ fontSize: 10, color: '#8C9BAB', marginLeft: 8 }}>▶</span>
            </div>
          ))}
        </div>
      )}

      {panel.selectedCompte && (
        <>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {panel.selectedCompte.ecritures.map((e, i) => {
              const montant = e.debit - e.credit
              return (
                <div key={i} style={{ padding: '9px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 10, color: '#8C9BAB', marginBottom: 2 }}>{fmtDate(e.date)}</div>
                  <div style={{ fontSize: 12, color: '#1A1A1A', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.lib || '—'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#8C9BAB' }}>{e.piece || '—'}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: montant > 0 ? '#D85A30' : '#1D9E75' }}>
                      {montant > 0 ? '+' : ''}{fmt(montant)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '9px 14px', borderTop: '0.5px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.02)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#8C9BAB' }}>{panel.selectedCompte.ecritures.length} écriture{panel.selectedCompte.ecritures.length > 1 ? 's' : ''}</span>
          </div>
        </>
      )}
    </div>
  )
}

function BilanRow({ label, value, indent, bold, color, prefixKey, annee, userId, onDrill }: {
  label: string; value: number; indent?: boolean; bold?: boolean; color?: string
  prefixKey?: string; annee: number; userId: string
  onDrill: (label: string, prefixes: string[]) => void
}) {
  if (Math.abs(value) < 0.5) return null
  const drillable = !!prefixKey && !!PREFIXES_BILAN[prefixKey]
  return (
    <div onClick={() => drillable && onDrill(label, PREFIXES_BILAN[prefixKey!])}
      style={{ display: 'flex', alignItems: 'center', padding: '7px 16px', borderTop: '0.5px solid rgba(0,0,0,0.04)', cursor: drillable ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (drillable) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div style={{ flex: 1, fontSize: 12, fontWeight: bold ? 500 : 400, color: '#1A1A1A', paddingLeft: indent ? 20 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {drillable && <span style={{ fontSize: 9, color: '#B8A98A' }}>▶</span>}
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: bold ? 500 : 400, color: color || '#1A1A1A', minWidth: 110, textAlign: 'right' }}>{fmt(Math.abs(value))}</div>
    </div>
  )
}

function BilanSection({ title, total, children, color }: { title: string; total: number; children: React.ReactNode; color?: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', background: 'rgba(184,169,138,0.06)', cursor: 'pointer', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#B8A98A', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {title}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: color || '#B8A98A', minWidth: 110, textAlign: 'right' }}>{fmt(Math.abs(total))}</div>
      </div>
      {open && children}
    </div>
  )
}

export default function BalanceSheetPage() {
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

  const bilan = etats?.bilan
  const sig = etats?.sig
  const actif = bilan?.actif
  const passif = bilan?.passif

  const rowProps = { annee: anneeActive, userId, onDrill: handleDrill }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="balance-sheet" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="balance-sheet" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginRight: panel ? 360 : 0, transition: 'margin-right 0.3s' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, position: 'sticky' as const, top: 0, zIndex: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Bilan</span>
          {annees.length > 1 && annees.map(a => (
            <button key={a} onClick={() => changerAnnee(a)} style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.12)', background: a === anneeActive ? '#1A1A1A' : '#fff', color: a === anneeActive ? '#fff' : '#1A1A1A', cursor: 'pointer' }}>{a}</button>
          ))}
          {drillLoading && <span style={{ fontSize: 11, color: '#8C9BAB' }}>Chargement...</span>}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {!bilan ? (
            <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background: '#1A1A1A', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth: 1200 }}>
              {sig && <AlvioInsight payload={{ page: 'balance-sheet', annee: anneeActive, indicateurs: { tresorerie: actif?.tresorerie ?? 0, bfr: (actif?.creancesClients ?? 0) - (passif?.dettesFournisseurs ?? 0), totalActif: actif?.totalActif ?? 0, capitauxPropres: passif?.capitauxPropres ?? 0 } }} />}

              {etats?.controles && (
                <div style={{ background: etats.controles.equilibreBilan ? 'rgba(29,158,117,0.08)' : 'rgba(216,90,48,0.08)', border: `0.5px solid ${etats.controles.equilibreBilan ? 'rgba(29,158,117,0.3)' : 'rgba(216,90,48,0.3)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: etats.controles.equilibreBilan ? '#1D9E75' : '#D85A30', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{etats.controles.equilibreBilan ? '✓ Bilan équilibré' : '⚠ Bilan déséquilibré'}</span>
                  <span>Actif {fmt(actif?.totalActif ?? 0)} · Passif {fmt(passif?.totalPassif ?? 0)}</span>
                </div>
              )}

              <div style={{ fontSize: 11, color: '#8C9BAB', marginBottom: 12, fontStyle: 'italic' }}>
                Cliquez sur une ligne ▶ pour voir le détail des comptes et écritures
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* ACTIF */}
                <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ background: '#1A1A1A', padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#F2F3F5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actif</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#B8A98A' }}>{fmt(actif?.totalActif ?? 0)}</span>
                  </div>

                  <BilanSection title="Actif immobilisé" total={actif?.actifImmoNet ?? 0}>
                    <BilanRow label="Immobilisations incorporelles brutes" value={actif?.immoIncorpBrut ?? 0} prefixKey="immoIncorp" indent {...rowProps} />
                    <BilanRow label="Amortissements incorporels" value={actif?.amortIncorp ?? 0} prefixKey="amortIncorp" indent color="#D85A30" {...rowProps} />
                    <BilanRow label="Immobilisations corporelles brutes" value={actif?.immoCorpBrut ?? 0} prefixKey="immoCorpBrut" indent {...rowProps} />
                    <BilanRow label="Amortissements corporels" value={actif?.amortCorp ?? 0} prefixKey="amortCorp" indent color="#D85A30" {...rowProps} />
                    <BilanRow label="Immobilisations financières" value={actif?.immoFinBrut ?? 0} prefixKey="immoFin" indent {...rowProps} />
                    <BilanRow label="Immobilisations nettes" value={actif?.actifImmoNet ?? 0} bold {...rowProps} />
                  </BilanSection>

                  <BilanSection title="Actif circulant" total={(actif?.stocksMarchandises ?? 0) + (actif?.creancesClients ?? 0) + (actif?.creancesEtat ?? 0) + (actif?.autresCreances ?? 0) + (actif?.tresorerie ?? 0)}>
                    <BilanRow label="Stocks marchandises" value={actif?.stocksMarchandises ?? 0} prefixKey="stocksMarchandises" indent {...rowProps} />
                    <BilanRow label="Stocks matières" value={actif?.stocksMatieres ?? 0} prefixKey="stocksMatieres" indent {...rowProps} />
                    <BilanRow label="Clients et comptes rattachés" value={actif?.creancesClients ?? 0} prefixKey="creancesClients" indent {...rowProps} />
                    <BilanRow label="Créances fiscales (État)" value={actif?.creancesEtat ?? 0} prefixKey="creancesEtat" indent {...rowProps} />
                    <BilanRow label="Autres créances" value={actif?.autresCreances ?? 0} prefixKey="autresCreances" indent {...rowProps} />
                    <BilanRow label="Charges constatées d'avance" value={actif?.chargesConstatees ?? 0} indent {...rowProps} />
                    <BilanRow label="Disponibilités" value={actif?.tresorerie ?? 0} prefixKey="tresorerie" indent color="#1D9E75" {...rowProps} />
                  </BilanSection>

                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#1A1A1A' }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#F2F3F5' }}>Total actif</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#B8A98A', minWidth: 110, textAlign: 'right' }}>{fmt(actif?.totalActif ?? 0)}</div>
                  </div>
                </div>

                {/* PASSIF */}
                <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ background: '#1A1A1A', padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#F2F3F5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Passif</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#B8A98A' }}>{fmt(passif?.totalPassif ?? 0)}</span>
                  </div>

                  <BilanSection title="Capitaux propres" total={passif?.capitauxPropres ?? 0} color={(passif?.capitauxPropres ?? 0) >= 0 ? '#1D9E75' : '#D85A30'}>
                    <BilanRow label="Capital et primes d'émission" value={(passif?.capital ?? 0) + (passif?.primes ?? 0)} prefixKey="capital" indent {...rowProps} />
                    <BilanRow label="Réserves" value={passif?.reserves ?? 0} prefixKey="capital" indent {...rowProps} />
                    <BilanRow label="Report à nouveau" value={passif?.reportNouveau ?? 0} prefixKey="capital" indent {...rowProps} />
                    <BilanRow label="Subventions d'investissement" value={passif?.subventionsInvest ?? 0} prefixKey="subventionsInvest" indent {...rowProps} />
                    <BilanRow label="Résultat de l'exercice" value={passif?.resultatNet ?? 0} indent color={(passif?.resultatNet ?? 0) >= 0 ? '#1D9E75' : '#D85A30'} {...rowProps} />
                    <BilanRow label="Capitaux propres" value={passif?.capitauxPropres ?? 0} bold color={(passif?.capitauxPropres ?? 0) >= 0 ? '#1D9E75' : '#D85A30'} {...rowProps} />
                  </BilanSection>

                  <BilanSection title="Dettes" total={(passif?.empruntsEtablissement ?? 0) + (passif?.autresEmpruntsLT ?? 0) + (passif?.dettesFournisseurs ?? 0) + (passif?.dettesSociales ?? 0) + (passif?.dettesFiscales ?? 0) + (passif?.autresDettes ?? 0)}>
                    <BilanRow label="Emprunts établissements de crédit" value={passif?.empruntsEtablissement ?? 0} prefixKey="emprunts" indent {...rowProps} />
                    <BilanRow label="Autres emprunts et dettes" value={passif?.autresEmpruntsLT ?? 0} prefixKey="emprunts" indent {...rowProps} />
                    <BilanRow label="Fournisseurs et comptes rattachés" value={passif?.dettesFournisseurs ?? 0} prefixKey="dettesFournisseurs" indent {...rowProps} />
                    <BilanRow label="Dettes sociales (personnel, URSSAF)" value={passif?.dettesSociales ?? 0} prefixKey="dettesSociales" indent {...rowProps} />
                    <BilanRow label="Dettes fiscales (IS, TVA)" value={passif?.dettesFiscales ?? 0} prefixKey="dettesFiscales" indent {...rowProps} />
                    <BilanRow label="Autres dettes" value={passif?.autresDettes ?? 0} prefixKey="autresDettes" indent {...rowProps} />
                    <BilanRow label="Produits constatés d'avance" value={passif?.produitsConstates ?? 0} indent {...rowProps} />
                  </BilanSection>

                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#1A1A1A' }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#F2F3F5' }}>Total passif</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#B8A98A', minWidth: 110, textAlign: 'right' }}>{fmt(passif?.totalPassif ?? 0)}</div>
                  </div>
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
