import { NextRequest, NextResponse } from 'next/server'

const FJ: Record<string,string> = {"1000": "Entrepreneur individuel", "2110": "Indivision", "2210": "GEIE", "2220": "GIE", "3110": "SNC", "3120": "SCS", "3210": "SA", "3220": "SA à directoire", "3310": "SARL", "3410": "EURL", "3420": "SARL", "5202": "SAS", "5308": "SAS", "5410": "SA", "5415": "SA", "5498": "SARL", "5499": "SARL unipersonnelle", "5505": "SAS", "5510": "SAS", "5515": "SASU", "5520": "SAS", "5600": "SA", "5610": "SA", "6100": "Caisse d epargne", "7111": "Association loi 1901", "7112": "Association", "7381": "Syndicat", "8210": "EPIC", "8220": "EPA", "9210": "SCI", "9220": "SCI", "9221": "SCI"}


const NAF_LIBELLES: Record<string,string> = {
  "01.1":"Cultures non permanentes","01.2":"Cultures permanentes","01.3":"Reproduction de plantes",
  "01.4":"Production animale","01.5":"Culture et élevage associés","01.6":"Activités de soutien à l'agriculture",
  "10.1":"Transformation de viande","10.2":"Poisson","10.3":"Fruits et légumes","10.4":"Huiles",
  "10.5":"Produits laitiers","10.6":"Meunerie","10.7":"Boulangerie","10.8":"Autres alimentaires",
  "41.1":"Promotion immobilière","41.2":"Construction","42.1":"Routes","43.1":"Démolition",
  "43.2":"Électricité","43.3":"Finition","45.1":"Commerce véhicules","45.2":"Entretien véhicules",
  "47.1":"Grand commerce","47.2":"Alimentation spécialisée","47.9":"Vente à distance",
  "49.3":"Transports terrestres","55.1":"Hôtels","55.2":"Hébergement touristique",
  "56.1":"Restaurants","56.2":"Traiteurs","56.3":"Débits de boissons",
  "62.0":"Programmation informatique","63.1":"Traitement de données","63.9":"Autres info",
  "64.1":"Intermédiation monétaire","64.9":"Autres financiers","65.1":"Assurance",
  "68.1":"Marchands de biens","68.2":"Location immobilière","68.3":"Agences immobilières",
  "69.1":"Activités juridiques","69.2":"Comptabilité","70.1":"Activités des sièges sociaux",
  "70.2":"Conseil de gestion","71.1":"Architecture","71.2":"Ingénierie",
  "72.1":"Recherche-développement","73.1":"Publicité","73.2":"Études de marché",
  "74.1":"Design","74.2":"Photographie","74.3":"Traduction","74.9":"Autres spécialisées",
  "75.0":"Vétérinaires","77.1":"Location véhicules","77.2":"Location biens personnels",
  "78.1":"Agences emploi","78.2":"Travail temporaire","78.3":"Ressources humaines",
  "79.1":"Voyagistes","80.1":"Activités de sécurité","81.1":"Services aux bâtiments",
  "82.1":"Secrétariat","82.2":"Centres d'appels","85.1":"Enseignement primaire",
  "85.2":"Enseignement secondaire","85.3":"Enseignement supérieur","85.5":"Autres enseignements",
  "86.1":"Hôpitaux","86.2":"Médecins","86.9":"Autres santé","87.1":"Hébergement médicalisé",
  "88.1":"Action sociale","90.0":"Arts","91.0":"Bibliothèques","92.0":"Jeux de hasard",
  "93.1":"Sports","93.2":"Loisirs","94.1":"Organisations patronales","94.9":"Autres organisations",
  "95.1":"Réparation informatique","96.0":"Soins personnels","97.0":"Ménages employeurs",
}

function getNafLibelle(code: string): string {
  if (!code) return ''
  const key4 = code.substring(0, 4)
  const key3 = code.substring(0, 3)
  return NAF_LIBELLES[key4] ?? NAF_LIBELLES[key3] ?? ''
}


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
      libelle_naf:      siege.libelle_activite_principale ?? r.libelle_activite_principale_unite_legale ?? getNafLibelle(siege.activite_principale ?? r.activite_principale ?? ''),
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
