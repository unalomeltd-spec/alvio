'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type Statut = 'à faire' | 'en cours' | 'fait'
type Priorite = 'Normal' | 'Urgent' | 'Faible'
type Categorie = 'Interface & expérience' | 'Anomalie / Bug' | 'Module métier' | 'Données & import' | 'Infrastructure' | 'Paramétrage' | 'Contenu & libellés' | 'Divers'

const CATEGORIES: Categorie[] = ['Interface & expérience', 'Anomalie / Bug', 'Module métier', 'Données & import', 'Infrastructure', 'Paramétrage', 'Contenu & libellés', 'Divers']

const CAT_COLOR: Record<Categorie, { bg: string; color: string }> = {
  'Interface & expérience': { bg: '#E6F1FB', color: '#185FA5' },
  'Anomalie / Bug':         { bg: '#FAECE7', color: '#993C1D' },
  'Module métier':          { bg: '#EAF3DE', color: '#3B6D11' },
  'Données & import':       { bg: '#EEEDFE', color: '#534AB7' },
  'Infrastructure':         { bg: '#F1EFE8', color: '#5F5E5A' },
  'Paramétrage':            { bg: '#FAEEDA', color: '#854F0B' },
  'Contenu & libellés':     { bg: '#FBEAF0', color: '#993556' },
  'Divers':                 { bg: '#F2F3F5', color: '#8C9BAB' },
}

interface Demande {
  id: string
  created_at: string
  titre: string
  description: string | null
  auteur: string
  destinataire: string
  priorite: Priorite
  statut: Statut
  categorie: Categorie
  fait_le: string | null
}

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

export default function SuiviPage() {
  const [items, setItems] = useState<Demande[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'actif' | 'archive'>('actif')
  const [filter, setFilter] = useState('tous')
  const [catFilter, setCatFilter] = useState<Categorie | 'toutes'>('toutes')
  const [formOpen, setFormOpen] = useState(false)
  const [titre, setTitre] = useState('')
  const [desc, setDesc] = useState('')
  const [auteur, setAuteur] = useState('Jeremy')
  const [dest, setDest] = useState('Val')
  const [prio, setPrio] = useState<Priorite>('Normal')
  const [cat, setCat] = useState<Categorie>('Interface & expérience')
  const [saving, setSaving] = useState(false)
  const [catChosen, setCatChosen] = useState(false)

  const load = async () => {
    const { data } = await sb.from('suivi_demandes').select('*').order('created_at', { ascending: false })
    if (data) setItems(data as Demande[])
    setLoading(false)
  }

  useEffect(() => {
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/'; return }
      load()
    })
  }, [])

  const add = async () => {
    if (!titre.trim()) return
    setSaving(true)
    await sb.from('suivi_demandes').insert({ titre, description: desc || null, auteur, destinataire: dest, priorite: prio, statut: 'à faire', categorie: cat })
    setTitre(''); setDesc(''); setPrio('Normal'); setCat('Interface & expérience'); setCatChosen(false); setFormOpen(false)
    await load()
    setSaving(false)
  }

  const check = async (id: string) => {
    await sb.from('suivi_demandes').update({ statut: 'fait', fait_le: new Date().toISOString() }).eq('id', id)
    await load()
  }

  const uncheck = async (id: string) => {
    await sb.from('suivi_demandes').update({ statut: 'à faire', fait_le: null }).eq('id', id)
    await load()
  }

  const setStatut = async (id: string, statut: Statut) => {
    await sb.from('suivi_demandes').update({ statut, fait_le: statut === 'fait' ? new Date().toISOString() : null }).eq('id', id)
    await load()
  }

  const del = async (id: string) => {
    await sb.from('suivi_demandes').delete().eq('id', id)
    await load()
  }

  const actifs = items.filter(i => i.statut !== 'fait')
  const archives = items.filter(i => i.statut === 'fait')

  const visible = (view === 'archive' ? archives : actifs).filter(i => {
    const matchFilter = filter === 'tous' || i.statut === filter || i.auteur === filter
    const matchCat = catFilter === 'toutes' || i.categorie === catFilter
    return matchFilter && matchCat
  })

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="suivi" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="suivi" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Suivi des demandes</span>
            <span style={{ fontSize: 11, color: '#8C9BAB' }}>Jeremy & Val</span>
          </div>
          <button onClick={() => { setFormOpen(o => !o); setCatChosen(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nouvelle demande
          </button>
        </div>

        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {/* Formulaire */}
          {formOpen && (
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 12 }}>Nouvelle demande</div>
              <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre de la demande"
                style={{ width: '100%', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, outline: 'none', color: '#1A1A1A' }} />
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optionnel)"
                style={{ width: '100%', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', marginBottom: 10, outline: 'none', resize: 'vertical', minHeight: 60, color: '#1A1A1A' }} />

              {/* Catégorie */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: catChosen ? '#8C9BAB' : '#993C1D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Catégorie {!catChosen && <span style={{ fontWeight: 400 }}>— obligatoire</span>}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => { setCat(c); setCatChosen(true) }}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${cat === c ? CAT_COLOR[c].color : 'rgba(0,0,0,0.12)'}`, background: cat === c ? CAT_COLOR[c].bg : '#fff', color: cat === c ? CAT_COLOR[c].color : '#8C9BAB', cursor: 'pointer', fontFamily: 'inherit', fontWeight: cat === c ? 500 : 400 }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auteur / Dest / Priorité */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['Jeremy', 'Val'] as const).map(a => (
                    <button key={a} onClick={() => setAuteur(a)}
                      style={{ padding: '6px 12px', border: `0.5px solid ${auteur === a ? '#1A1A1A' : 'rgba(0,0,0,0.12)'}`, borderRadius: 8, background: auteur === a ? '#1A1A1A' : '#fff', color: auteur === a ? '#fff' : '#8C9BAB', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      De {a}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['Jeremy', 'Val', 'Les deux'] as const).map(d => (
                    <button key={d} onClick={() => setDest(d)}
                      style={{ padding: '6px 12px', border: `0.5px solid ${dest === d ? '#B8A98A' : 'rgba(0,0,0,0.12)'}`, borderRadius: 8, background: dest === d ? 'rgba(184,169,138,0.12)' : '#fff', color: dest === d ? '#B8A98A' : '#8C9BAB', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      → {d}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['Normal', 'Urgent', 'Faible'] as const).map(p => (
                    <button key={p} onClick={() => setPrio(p)}
                      style={{ padding: '6px 12px', border: `0.5px solid ${prio === p ? '#1A1A1A' : 'rgba(0,0,0,0.12)'}`, borderRadius: 8, background: prio === p ? '#1A1A1A' : '#fff', color: prio === p ? '#fff' : '#8C9BAB', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={add} disabled={saving || !titre.trim() || !catChosen}
                  style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: !titre.trim() ? 0.4 : 1 }}>
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
                <button onClick={() => setFormOpen(false)}
                  style={{ background: 'transparent', color: '#8C9BAB', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Compteurs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'À faire', count: actifs.filter(i => i.statut === 'à faire').length, color: '#BA7517' },
              { label: 'En cours', count: actifs.filter(i => i.statut === 'en cours').length, color: '#185FA5' },
              { label: 'Terminé', count: archives.length, color: '#3B6D11' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: '12px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: s.color }}>{s.count}</div>
              </div>
            ))}
          </div>

          {/* Onglets */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['actif', 'archive'] as const).map(v => (
                <button key={v} onClick={() => { setView(v); setFilter('tous'); setCatFilter('toutes') }}
                  style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: 'none', background: view === v ? '#1A1A1A' : 'transparent', color: view === v ? '#fff' : '#8C9BAB', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {v === 'actif' ? `En cours (${actifs.length})` : `Archivé (${archives.length})`}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(view === 'actif' ? ['tous', 'à faire', 'en cours', 'Jeremy', 'Val'] : ['tous', 'Jeremy', 'Val']).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${filter === f ? '#1A1A1A' : 'rgba(0,0,0,0.12)'}`, background: filter === f ? '#1A1A1A' : '#fff', color: filter === f ? '#fff' : '#8C9BAB', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {f === 'tous' ? 'Tous' : f === 'à faire' ? 'À faire' : f === 'en cours' ? 'En cours' : `De ${f}`}
                </button>
              ))}
            </div>
          </div>

          {/* Filtre catégories */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            <button onClick={() => setCatFilter('toutes')}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${catFilter === 'toutes' ? '#1A1A1A' : 'rgba(0,0,0,0.12)'}`, background: catFilter === 'toutes' ? '#1A1A1A' : '#fff', color: catFilter === 'toutes' ? '#fff' : '#8C9BAB', cursor: 'pointer', fontFamily: 'inherit' }}>
              Toutes catégories
            </button>
            {CATEGORIES.map(c => {
              const active = catFilter === c
              return (
                <button key={c} onClick={() => setCatFilter(c)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${active ? CAT_COLOR[c].color : 'rgba(0,0,0,0.12)'}`, background: active ? CAT_COLOR[c].bg : '#fff', color: active ? CAT_COLOR[c].color : '#8C9BAB', cursor: 'pointer', fontFamily: 'inherit', fontWeight: active ? 500 : 400 }}>
                  {c}
                </button>
              )
            })}
          </div>

          {/* Liste */}
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: '#8C9BAB' }}>
              {view === 'archive' ? 'Aucune demande terminée.' : 'Aucune demande en cours.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visible.map(item => {
                const cc = item.categorie ? CAT_COLOR[item.categorie] : CAT_COLOR['Divers']
                return (
                  <div key={item.id} style={{ background: '#fff', border: `0.5px solid ${item.priorite === 'Urgent' ? 'rgba(216,90,48,0.2)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>

                    {/* Checkbox */}
                    <div onClick={() => item.statut === 'fait' ? uncheck(item.id) : check(item.id)}
                      style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${item.statut === 'fait' ? '#1D9E75' : 'rgba(0,0,0,0.2)'}`, background: item.statut === 'fait' ? '#1D9E75' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
                      {item.statut === 'fait' && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: item.statut === 'fait' ? '#8C9BAB' : '#1A1A1A', textDecoration: item.statut === 'fait' ? 'line-through' : 'none', marginBottom: 5 }}>
                        {item.titre}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: '#8C9BAB', marginBottom: 6, lineHeight: 1.5 }}>{item.description}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {/* Catégorie badge */}
                        {item.categorie && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: cc.color, background: cc.bg, padding: '2px 8px', borderRadius: 20 }}>{item.categorie}</span>
                        )}
                        <span style={{ fontSize: 11, color: '#8C9BAB' }}>{item.auteur} → {item.destinataire}</span>
                        <span style={{ fontSize: 11, color: '#8C9BAB' }}>{fmt(item.created_at)}</span>
                        {item.priorite === 'Urgent' && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#993C1D', background: 'rgba(216,90,48,0.1)', padding: '2px 7px', borderRadius: 20 }}>Urgent</span>
                        )}
                        {item.statut === 'fait' && item.fait_le && (
                          <span style={{ fontSize: 10, color: '#3B6D11' }}>Fait le {fmt(item.fait_le)}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {item.statut !== 'fait' && (
                        <select value={item.statut} onChange={e => setStatut(item.id, e.target.value as Statut)}
                          style={{ fontSize: 11, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 20, padding: '3px 8px', background: '#fff', color: '#8C9BAB', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
                          <option value="à faire">À faire</option>
                          <option value="en cours">En cours</option>
                          <option value="fait">Fait</option>
                        </select>
                      )}
                      <button onClick={() => del(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.2)', padding: '2px 4px', fontSize: 16, lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
