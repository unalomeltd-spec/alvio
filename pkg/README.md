# Harnais de non-régression — Moteur comptable Alvio

Rejoue 5 dossiers réels (FEC + états Pennylane de référence) et valide la sortie du moteur
`calculer()` **au centime**, à deux niveaux :

1. **Non-régression** (bloquant) — compare la sortie courante à `baseline.json` (sortie gelée).
   Toute dérive ≥ 0,01 € fait échouer `npm test` (exit 1) → à brancher en pré-déploiement.
2. **Précision comptable** (informatif) — compare aux états Pennylane (`refs.json`).
   Les écarts restants sont **connus et documentés** (voir le rapport d'audit) : gross-up des
   comptes bivalents au bilan, routage CA 708/709, ligne AN-6/7 d'APA.

## Lancer
```bash
npm install
npm test
```
Au 1er lancement, `baseline.json` est généré à partir de la sortie courante du moteur.
Relancer `npm test` active alors le contrôle de non-régression.

## Mettre à jour le moteur testé
Remplacer `src/engine.ts` par la version standalone de `src/app/api/etats/route.ts`
(retirer les imports `next/server` + `@supabase/supabase-js`, retirer le handler `GET`,
exporter `calculer` et l'interface `LigneFEC`, et pointer l'import PCG sur `./pcg-reference`).

## Régénérer les références Pennylane
`python3 extract_refs.py` (lit les .xlsx CR + Bilan, écrit `refs.json`).

## Critères de réussite (cible une fois les correctifs comptables livrés)
- gate `passed` = true, `ecartFEC` = 0,00, `comptesNonReconnus` = 0
- régime détecté correct (avant/après affectation)
- bilan interne bouclé (`ecartBilan` ≈ 0) **et** total actif / passif = Pennylane au centime
- CA, REX, RCAI, résultat net, capitaux propres = Pennylane au centime
