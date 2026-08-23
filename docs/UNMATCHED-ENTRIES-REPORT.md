# UnmatchedEntriesReport

Les régénérations `current` ne publient plus un compteur de non-matchés sans contexte. Le pipeline construit un rapport versionné `UnmatchedEntriesReport@1` dans `current.diagnostics.unmatchedReport` et conserve `unmatchedEntries` comme façade de compatibilité.

Chaque entrée contient obligatoirement `provider`, `sourceId`, `name`, `sourceValue`, `reason`, `candidates`, `confidence`, `destination` et `status`. Les informations de forme, costume, image, fichier local et payload source restent disponibles pour l’audit.

La raison appartient à une taxonomie fermée :

- `NO_CANONICAL_MATCH` ;
- `AMBIGUOUS_MATCH` ;
- `SOURCE_ID_UNKNOWN` ;
- `FORM_MISMATCH` ;
- `VARIANT_MISMATCH` ;
- `NAME_MISMATCH` ;
- `MISSING_ALIAS`.

Le normaliseur accepte les causes historiques des générateurs (`unknown-form`, `unknown-costume`, `unknown-alias`, `multiple-candidates`, etc.) et les projette sans modifier la valeur source. `confidence` est bornée entre 0 et 1. `destination` désigne l’identité ou le fichier canonique proposé lorsqu’il existe. Une entrée non traitée reçoit le statut `open`.

Le rapport expose `total`, `detailedCount`, `missingDetailCount` et `complete`. Les anciennes exécutions qui ne contenaient qu’un compteur restent lisibles mais sont signalées comme incomplètes. Toute nouvelle exécution stocke les entrées normalisées dans le document `current`, le `DatasetRun` et la réponse de polling asynchrone.

Le Game Master Explorer suit le même contrat. Les exécutions Dashboard natives (Events et Community Days) normalisent également leur tableau avant persistance.
