import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const siren = request.nextUrl.searchParams.get('siren')

  if (!siren || siren.length !== 9 || isNaN(Number(siren))) {
    return NextResponse.json({ error: 'SIREN invalide' }, { status: 400 })
  }

  try {
    const url = 'https://recherche-entreprises.api.gouv.fr/search?q=' + siren + '&page=1&per_page=1'
    const res = await fetch(url)

    if (!res.ok) {
      return NextResponse.json({ error: 'Entreprise non trouvee' }, { status: 404 })
    }

    const data = await res.json()
    const r = data.results?.[0]

    if (!r) {
      return NextResponse.json({ error: 'Entreprise non trouvee' }, { status: 404 })
    }

    const siege = r.siege ?? {}

    const dirigeants = (r.dirigeants ?? []).slice(0, 5).map((d: Record<string, string>) => {
      const nom = ((d.prenom ?? '') + ' ' + (d.nom ?? '')).trim() || (d.denomination ?? '')
      return { nom, fonction: d.qualite ?? '' }
    })

    return NextResponse.json({
      siren:            r.siren ?? siren,
      siret_siege:      siege.siret ?? '',
      nom:              r.nom_raison_sociale ?? r.nom_complet ?? '',
      forme_juridique:  r.nature_juridique ?? '',
      capital:          null,
      date_creation:    r.date_creation ?? '',
      code_naf:         siege.activite_principale ?? r.activite_principale ?? '',
      libelle_naf:      r.libelle_activite_principale_unite_legale ?? '',
      adresse:          siege.adresse ?? '',
      ville:            siege.libelle_commune ?? '',
      code_postal:      siege.code_postal ?? '',
      tranche_effectif: r.tranche_effectif_salarie ?? '',
      dirigeants,
    })
  } catch {
    return NextResponse.json({ error: 'Erreur reseau' }, { status: 500 })
  }
}
