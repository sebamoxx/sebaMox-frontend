# ROUTER

Se il messaggio inizia con:

SOFT
→ carica e applica integralmente skills/soft_skills.md

PREMIUM
→ carica e applica integralmente skills/soft_skills.md e skills/taste_skills.md

BRUTALIST
→ carica e applica integralmente skills/brutalist_skills.md

REDESIGN
→ carica e applica integralmente skills/redesign_skills.md

MINIMALIST
→ carica e applica integralmente skills/minimalist_skills.md

OUTPUT
→ carica e applica integralmente skills/output_skills.md

Queste modalità sono mutuamente esclusive.
Se viene selezionata una modalità, ignora le altre.

# Design Context

Registro del progetto: **brand** (il design È il prodotto).

Il contesto strategico e visivo vive in due file alla radice — leggili prima di lavorare sulla UI:

- **`PRODUCT.md`** — chi/cosa/perché: pubblico, scopo, personalità del brand, anti-reference, principi di design, accessibilità.
- **`DESIGN.md`** — come appare: palette, tipografia, elevazione, componenti, do's & don'ts (formato Google Stitch; token in frontmatter normativi). Sidecar: `.impeccable/design.json`.

I comandi `/impeccable` leggono questi file automaticamente. In conflitto: DESIGN.md prevale sulle scelte visive, PRODUCT.md su quelle strategiche/di voce.
