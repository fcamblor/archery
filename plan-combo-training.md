# Plan : Système de combos en mode entraînement

## Couche 1 — Structure générale

### Concept

Un **combo** est une séquence de kills enchaînés sans interruption. Deux mécaniques de continuation coexistent et se mixent :

1. **Kill par flèche** : le combo continue si le kill suivant arrive dans un délai court (~500 ms) après le précédent.
2. **Kill par stomp** : le combo continue tant que le joueur ne retouche pas le sol (rebond de mob en mob, éventuellement mixé avec des kills flèche en l'air).

Un kill par stomp relance aussi le timer flèche, et inversement un kill par flèche en l'air maintient le combo aérien. Le combo se reset quand **les deux conditions sont cassées** : le timer a expiré ET le joueur touche le sol.

### Architecture

```
TrainingScene
  ├── ComboTracker          ← NOUVEAU : logique pure de suivi combo
  │     • onKill(type)      — notifié à chaque kill (flèche / stomp)
  │     • onGrounded()      — notifié quand le joueur atterrit
  │     • count / active    — état courant du combo
  │     • reset()           — RAZ (mort joueur, etc.)
  │
  └── ComboDisplay          ← NOUVEAU : affichage HUD du compteur
        • update(count)     — met à jour le texte / animation
        • hide()            — masque quand combo terminé
```

**Composants existants touchés** :
- `TrainingScene` — branchement des hooks kill et grounded, instanciation des deux nouveaux modules
- Aucun changement dans `Player`, `Mob` ou `Arrow` (on se branche sur les flux existants)

### Flux principal

1. Kill détecté (flèche ou stomp) → `ComboTracker.onKill()`  
2. Combo incrémenté, timer (re)lancé  
3. `ComboDisplay` mis à jour chaque frame depuis `update()`  
4. Joueur touche le sol → `ComboTracker.onGrounded()`  
5. Si timer déjà expiré → combo reset + affichage masqué  
6. Mort du joueur → combo reset immédiat  

### Risques architecturaux

- **Détection du "grounded"** : `body.blocked.down` est la seule source fiable en Arcade Physics. Il faut détecter la **transition** (airborne → grounded) pour ne pas reset en permanence quand le joueur marche au sol.
- **Timing serré** : le debounce flèche doit être assez court pour que le combo soit un vrai exploit, mais assez long pour ne pas frustrer avec les temps de vol de flèche. ~400-600 ms à calibrer en jeu.
- **Stomp bounce** : le `setVelocityY(-200)` actuel assure le rebond ; le combo aérien repose entièrement sur le fait que ce rebond empêche `blocked.down` de passer à `true`.
