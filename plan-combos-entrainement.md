# Plan — Combos en mode entraînement

## Couche 1 — Structure générale

### Contexte

Le mode entraînement (`TrainingScene`) possède déjà deux mécanismes de kill :
- **Kill par flèche** (`updateArrows()`, ligne 254) — détection tip-to-bounds
- **Kill par stomp** (`checkStomps()`, ligne 295) — le joueur retombe sur un mob, rebondit avec `velocityY = -200`

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

### Risques architecturaux

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Timing du debounce vs frame rate | Un debounce trop court rate des combos légitimes | Utiliser `scene.time` (temps réel) et non le delta frame |
| Détection "au sol" fiable | `body.blocked.down` peut flasher sur un frame au bord d'une plateforme | Confirmer le contact au sol sur ≥2 frames ou via un mini-délai de grâce |
| Interaction avec invincibilité/harmless | Le joueur pourrait exploiter l'invincibilité pour farmer des combos | Les kills pendant invincibilité comptent déjà — pas de changement nécessaire, mais à valider |

---

## Couche 2 — Impacts détaillés

### 2.1 ComboTracker — `src/entities/ComboTracker.ts` (nouveau fichier)

**Interface :**
```typescript
type KillType = 'arrow' | 'stomp';

interface ComboState {
  count: number;        // Nombre de kills dans le combo courant (0 = pas de combo)
  active: boolean;      // Combo en cours ?
  lastKillType: KillType | null;
  tier: ComboTier;      // Palier visuel courant
}

type ComboTier = 'none' | 'good' | 'great' | 'amazing';
// none: count < 2, good: 2-3, great: 4-6, amazing: 7+

interface ComboCallbacks {
  onComboHit: (state: ComboState) => void;   // À chaque kill qui prolonge le combo
  onComboEnd: (finalCount: number) => void;  // Quand le combo se termine
}
```

**État interne :**
- `count: number` — compteur de kills enchaînés
- `lastKillTime: number` — timestamp du dernier kill (via `scene.time.now`)
- `airborne: boolean` — true tant que le joueur n'a pas retouché le sol depuis le dernier kill stomp

**Méthodes :**
- `registerKill(type: KillType, now: number): ComboState` — Appelé à chaque kill. Si `now - lastKillTime < COMBO_DEBOUNCE` OU si `airborne === true`, le combo continue. Sinon, le combo précédent se termine et un nouveau commence à 1. Remet `airborne = true` et `lastKillTime = now`.
- `notifyGrounded(now: number)` — Appelé quand `body.blocked.down` est détecté. Si le debounce temporel est aussi expiré, le combo se termine.
- `reset()` — RAZ complète (mort du joueur, changement de scène).
- `update(now: number)` — Vérifie l'expiration du debounce à chaque frame. Si expiré ET `airborne === false`, termine le combo.

**Constantes :**
- `COMBO_DEBOUNCE = 600` ms — Temps max entre deux kills pour maintenir le combo (légèrement au-dessus de 500ms pour laisser de la marge aux kills par flèche enchaînées).

**Logique de rupture du combo — les deux conditions sont indépendantes :**
- Le debounce temporel expire (`now - lastKillTime >= COMBO_DEBOUNCE`)
- Le joueur touche le sol (`notifyGrounded`)
- Le combo ne se casse que quand **les deux** sont réunies : timer expiré ET joueur au sol. Tant qu'une seule condition est vraie, le combo survit (un joueur en l'air garde son combo même si le timer expire ; un joueur au sol a encore le debounce pour scorer).

### 2.2 ComboHUD — `src/ui/ComboHUD.ts` (nouveau fichier)

**Dépendance :** `Phaser.Scene` (passée au constructeur)

**Éléments visuels :**
- Texte principal `"x3"`, `"x7"` etc. — centré horizontalement, ~30% depuis le haut de l'écran
- Label du tier sous le compteur : `"GOOD!"`, `"GREAT!!"`, `"AMAZING!!!"` — avec couleur par palier

**Paliers visuels :**

| Tier | Count | Couleur | Taille police | Effet |
|------|-------|---------|---------------|-------|
| good | 2-3 | `#f4a261` (orange) | 16px | Léger scale-up |
| great | 4-6 | `#e76f51` (rouge-orange) | 20px | Scale-up + léger shake |
| amazing | 7+ | `#e9c46a` (doré) | 24px | Scale-up + shake + flash blanc |

**Animations (tweens Phaser) :**
- `animateHit(state)` : à chaque kill, scale 1→1.3→1 en 150ms (punch effect). Changement de couleur/taille si le tier change.
- `hideCombo()` : fade out alpha 1→0 en 300ms quand le combo se termine. Affiche brièvement le score final du combo avant de disparaître.
- Le texte est créé une seule fois et réutilisé (setVisible/setAlpha), pas recréé à chaque combo.

**Pas de sons ni de camera shake en v1** — on itère sur le visuel d'abord, sons ajoutables plus tard sans impact architectural.

### 2.3 Intégration TrainingScene — `src/scenes/TrainingScene.ts` (modifié)

**Nouveaux imports :**
```typescript
import { ComboTracker } from '../entities/ComboTracker';
import { ComboHUD } from '../ui/ComboHUD';
```

**Nouvelles propriétés :**
```typescript
private comboTracker!: ComboTracker;
private comboHUD!: ComboHUD;
```

**`create()` — ajout :**
- Instancier `ComboTracker` avec les callbacks qui pilotent `ComboHUD`
- Instancier `ComboHUD`

**`updateArrows()` — modification ligne 257 :**
```typescript
// Avant : this.score++;
// Après :
this.score++;
this.comboTracker.registerKill('arrow', this.time.now);
```

**`checkStomps()` — modification ligne 300 :**
```typescript
// Avant : this.score++;
// Après :
this.score++;
this.comboTracker.registerKill('stomp', this.time.now);
```

**`update()` — ajout après `this.localPlayer.update(delta)` :**
```typescript
// Détection du contact au sol pour le combo
const body = this.localPlayer.sprite.body as Phaser.Physics.Arcade.Body;
if (this.localPlayer.alive && body.blocked.down) {
  this.comboTracker.notifyGrounded(this.time.now);
}
this.comboTracker.update(this.time.now);
```

**`scheduleRespawnPlayer()` — ajout :** `this.comboTracker.reset()` quand le joueur meurt (combo cassé).

**`cleanupGame()` — ajout :** détruire `ComboHUD`, reset `ComboTracker`.

### 2.4 Scoring combo

**Approche retenue : pas de multiplicateur de score en v1.** Chaque kill vaut toujours 1 point sur le compteur `score`. Le combo est un feedback visuel pur — satisfaction du joueur et progression skill. Un bonus de scoring pourra s'ajouter plus tard via un callback `onComboEnd(finalCount)` sans modifier la structure.

**Justification :** Le mode entraînement n'a pas de condition de victoire ni de leaderboard. Un multiplicateur n'aurait pas de contexte de comparaison. Le feedback visuel seul suffit comme première itération.

### 2.5 Détection fiable du sol — grace period

Le risque de flash sur `body.blocked.down` est mitigé simplement : `notifyGrounded()` ne casse pas le combo instantanément — il faut aussi que le debounce temporel soit expiré. Pendant un combo actif avec le timer encore valide, un flash au sol d'une frame est sans conséquence car le timer protège le combo.

Pas besoin de compteur multi-frame ou de délai de grâce supplémentaire — le debounce temporel joue ce rôle naturellement.

### 2.6 Fichiers impactés — résumé

| Fichier | Action | Ampleur |
|---------|--------|---------|
| `src/entities/ComboTracker.ts` | **Création** | ~60 lignes |
| `src/ui/ComboHUD.ts` | **Création** | ~80 lignes |
| `src/scenes/TrainingScene.ts` | Modification | ~15 lignes ajoutées |
| `docs/` | Mise à jour | Documenter le système combo |
