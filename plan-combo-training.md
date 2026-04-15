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

---

## Couche 2 — Impacts détaillés

### 2.1 ComboTracker (`src/training/ComboTracker.ts` — nouveau fichier)

**Interface publique :**
```ts
class ComboTracker {
  count: number;          // kills dans le combo courant (0 = pas de combo)
  bestCombo: number;      // meilleur combo de la session
  
  onKill(): void;         // appelé à chaque kill (flèche ou stomp)
  onGrounded(): void;     // appelé quand transition airborne → sol détectée
  reset(): void;          // RAZ immédiate (mort joueur)
  update(delta: number): void;  // tick : gère le timer debounce
}
```

**État interne :**
- `timerMs: number` — temps restant avant expiration du debounce (initialisé à `COMBO_TIMEOUT` à chaque kill, décrémenté dans `update()`)
- `timerExpired: boolean` — passe à `true` quand `timerMs <= 0`
- Constante `COMBO_TIMEOUT = 500` (ms) — à exposer en haut de fichier pour calibrage facile

**Logique `onKill()` :**
1. `count++`
2. `timerMs = COMBO_TIMEOUT`, `timerExpired = false`

**Logique `onGrounded()` :**
1. Si `timerExpired` → `reset()` (le combo est cassé)
2. Sinon → rien (le joueur a touché le sol mais a encore du temps pour enchaîner)

**Logique `update(delta)` :**
1. Si `count === 0` → return
2. `timerMs -= delta`
3. Si `timerMs <= 0` → `timerExpired = true`. Si joueur est au sol à ce moment → `reset()` immédiat

**Logique `reset()` :**
1. Met à jour `bestCombo` si `count > bestCombo`
2. `count = 0`, `timerMs = 0`, `timerExpired = false`

**Point d'attention** : `update()` a besoin de savoir si le joueur est au sol au moment où le timer expire. On passe un callback `isGrounded: () => boolean` au constructeur plutôt qu'un couplage direct à Player.

### 2.2 ComboDisplay (`src/training/ComboDisplay.ts` — nouveau fichier)

**Interface publique :**
```ts
class ComboDisplay {
  constructor(scene: Phaser.Scene);
  update(count: number): void;
  destroy(): void;
}
```

**Éléments visuels :**
- Un `Phaser.GameObjects.Text` centré horizontalement, positionné en haut de l'écran (~y=40), `scrollFactor(0)`, `depth(100)`
- Police plus grande que le HUD (ex : `'16px'`, couleur jaune/orange `#f4a261`)
- Affiché uniquement quand `count >= 2` (un seul kill n'est pas un "combo")
- Format : `"COMBO x3"`, `"COMBO x4"`, etc.

**Comportement visuel :**
- Apparition : léger scale-up (tween `scale 1.3 → 1` en ~150ms) à chaque incrément pour du punch visuel
- Disparition : fondu alpha quand le combo se termine

### 2.3 TrainingScene — modifications (`src/scenes/TrainingScene.ts`)

**Nouvelles propriétés :**
```ts
private comboTracker!: ComboTracker;
private comboDisplay!: ComboDisplay;
private wasGrounded = false;  // pour détecter la transition airborne → sol
```

**`create()` — ajouts :**
- Instancier `ComboTracker` avec callback `isGrounded` : `() => (this.localPlayer.sprite.body as Phaser.Physics.Arcade.Body).blocked.down`
- Instancier `ComboDisplay`

**`update()` — ajouts (3 lignes de branchement) :**
1. Détection de transition grounded :
   ```ts
   const grounded = (body).blocked.down;
   if (grounded && !this.wasGrounded) this.comboTracker.onGrounded();
   this.wasGrounded = grounded;
   ```
2. `this.comboTracker.update(delta)`
3. `this.comboDisplay.update(this.comboTracker.count)`

**Points de kill — ajouts (1 ligne chacun) :**
- Après `this.score++` dans `updateArrows()` (ligne 257) : `this.comboTracker.onKill()`
- Après `this.score++` dans `checkStomps()` (ligne 300) : `this.comboTracker.onKill()`

**Mort du joueur :**
- Après `this.localPlayer.die()` (lignes 266 et 304) : `this.comboTracker.reset()`

**`updateHUD()` — ajout optionnel :**
- Afficher `bestCombo` dans le HUD existant (ex : `| best combo: 5`)

**`cleanupGame()` — ajout :**
- `this.comboDisplay.destroy()`

### 2.4 Résumé des fichiers

| Fichier | Action | Ampleur |
|---------|--------|---------|
| `src/training/ComboTracker.ts` | **Création** | ~50 lignes |
| `src/training/ComboDisplay.ts` | **Création** | ~40 lignes |
| `src/scenes/TrainingScene.ts` | **Modification** | ~15 lignes ajoutées |
