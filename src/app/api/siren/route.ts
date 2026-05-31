import { NextRequest, NextResponse } from 'next/server'

const FJ: Record<string,string> = {"1000": "Entrepreneur individuel", "2110": "Indivision", "2210": "GEIE", "2220": "GIE", "3110": "SNC", "3120": "SCS", "3210": "SA", "3220": "SA à directoire", "3310": "SARL", "3410": "EURL", "3420": "SARL", "5202": "SAS", "5308": "SAS", "5410": "SA", "5415": "SA", "5498": "SARL", "5499": "SARL unipersonnelle", "5505": "SAS", "5510": "SAS", "5515": "SASU", "5520": "SAS", "5600": "SA", "5610": "SA", "6100": "Caisse d epargne", "7111": "Association loi 1901", "7112": "Association", "7381": "Syndicat", "8210": "EPIC", "8220": "EPA", "9210": "SCI", "9220": "SCI", "9221": "SCI"}


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
      const prenom = (d.prenom ?? d.prenoms ?? '').trim()
      const nomFam = (d.nom ?? '').trim()
      const nom = prenom && nomFam ? prenom + ' ' + nomFam : (prenom || nomFam || (d.denomination ?? ''))
      return { nom, fonction: d.qualite ?? '' }
    })

    return NextResponse.json({
      siren:            r.siren ?? siren,
      siret_siege:      siege.siret ?? '',
      nom:              r.nom_raison_sociale ?? r.nom_complet ?? '',
      forme_juridique:  FJ[r.nature_juridique] ?? r.nature_juridique ?? '',
      capital:          null,
      date_creation:    r.date_creation ?? '',
      code_naf:         siege.activite_principale ?? r.activite_principale ?? '',
      libelle_naf:      siege.libelle_activite_principale ?? r.libelle_activite_principale_unite_legale ?? '',
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
