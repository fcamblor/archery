# Plan — Combos en mode entraînement

## Couche 1 — Structure générale

### Contexte

Le mode entraînement (`TrainingScene`) possède déjà deux mécanismes de kill :
- **Kill par flèche** (`updateArrows()`) — détection tip-to-bounds
- **Kill par stomp** (`checkStomps()`) — le joueur retombe sur un mob, rebondit avec `velocityY = -200`

Actuellement chaque kill incrémente un simple compteur `score++`. Aucun système de combo n'existe.

### Objectif

Implémenter un **système de combo** qui reconnaît les enchaînements de kills via deux mécanismes mixables :

| Mécanisme | Déclencheur | Condition de chaînage |
|-----------|-------------|----------------------|
| Combo flèche | Kill par flèche | Kill suivant dans un délai < debounce (≈500 ms) |
| Combo rebond | Kill par stomp | Joueur ne retouche pas le sol entre deux kills |

Les deux types sont **combinables** dans un même combo : un kill flèche peut prolonger un combo rebond et inversement. Chaque kill (quel que soit le type) réinitialise le timer debounce ET le flag "au sol".

### Architecture cible

```
┌────────────────────────────────────────────┐
│              TrainingScene                  │
│                                            │
│  updateArrows() ──┐                        │
│                   ├──► ComboTracker         │
│  checkStomps() ───┘    ├─ registerKill()   │
│                        ├─ breakCombo()     │
│                        └─ getComboCount()  │
│                              │             │
│                              ▼             │
│                        ComboHUD            │
│                        ├─ showCombo()      │
│                        ├─ animateHit()     │
│                        └─ hideCombo()      │
└────────────────────────────────────────────┘
```

**Trois composants :**

1. **ComboTracker** (logique pure, pas de dépendance Phaser) — Machine à état qui reçoit des événements kill et détecte les enchaînements. Gère le debounce temporel et le suivi du contact au sol. Émet l'état courant du combo (count, actif/terminé).

2. **ComboHUD** (affichage Phaser) — Affiche le compteur de combo à l'écran avec feedback visuel progressif (taille, couleur, animation selon le palier atteint).

3. **Intégration TrainingScene** — Points d'accroche dans `updateArrows()` et `checkStomps()` pour notifier le tracker. Détection du retour au sol dans `update()` pour casser le combo rebond.

### Décisions UX à trancher en Couche 2

- Paliers visuels (à partir de quel combo le feedback change)
- Sons / shakes caméra
- Scoring bonus (multiplicateur ou points fixes par palier)
- Position et style du compteur combo
- Durée exacte du debounce

### Risques architecturaux

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Timing du debounce vs frame rate | Un debounce trop court rate des combos légitimes | Utiliser `scene.time` (temps réel) et non le delta frame |
| Détection "au sol" fiable | `body.blocked.down` peut flasher sur un frame au bord d'une plateforme | Confirmer le contact au sol sur ≥2 frames ou via un mini-délai de grâce |
| Interaction avec invincibilité/harmless | Le joueur pourrait exploiter l'invincibilité pour farmer des combos | Les kills pendant invincibilité comptent déjà — pas de changement nécessaire, mais à valider |
