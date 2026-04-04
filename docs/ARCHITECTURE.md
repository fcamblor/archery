# Architecture technique — Towerfall PhaserJS

## Structure du projet

```
src/
  main.ts            — Point d'entrée, config Phaser
  scenes/
    TitleScene.ts    — Écran titre (Héberger / Rejoindre)
    LobbyScene.ts    — Lobby (joueurs connectés, code, lancement)
    GameScene.ts     — Scène de jeu principale (multijoueur réseau)
  entities/          — Entités de jeu (Player, Arrow, Mob)
  network/
    NetworkManager.ts — Singleton Socket.io (connexion, rooms, gameplay)
  shared/
    types.ts         — Types partagés client/serveur (PlayerInfo, RoomInfo, événements gameplay)
  levels/            — Données de niveaux (grilles number[][])
server/
  index.ts           — Serveur Node.js + Socket.io (rooms, lobby, relay gameplay, victoire)
  tsconfig.json      — Config TypeScript serveur
```

## Architecture réseau

- **Serveur** : Node.js + Socket.io sur le port 3001 (`pnpm dev:server`).
- **Client** : Socket.io-client via `NetworkManager` (singleton).
- **Flux** : TitleScene → LobbyScene (connexion + room) → GameScene (rounds successifs) → LobbyScene (retour après game-over à 5 pts).
- **Rooms** : code à 4 caractères, max 6 joueurs. L'hôte crée la room et lance la partie. Si l'hôte quitte, le rôle est transféré au premier joueur restant.
- **Nom du joueur** : saisie via input HTML (max 12 caractères) dans le lobby, avant la création/join de room. Le nom est transmis au serveur via les événements `create-room` / `join-room`. Le nom est persisté dans `localStorage` pour pré-remplir le champ lors des sessions suivantes.
- Les types partagés (`src/shared/types.ts`) définissent les événements client↔serveur de manière typée.

## Modèle de synchronisation réseau (itération 6)

### Architecture semi-autoritative (relay)

Le serveur agit principalement comme un relais. Chaque client exécute sa propre simulation physique localement.

- **État joueur** : le joueur local envoie sa position/vélocité au serveur à 20 Hz (`player-update`). Le serveur relaie à tous les autres clients (`player-state`).
- **Flèches** : le tireur envoie `arrow-fired` au tir, `arrow-stuck` au plantage, `arrow-pickup` au ramassage. Le serveur relaie à tous les autres.
- **Kills** : le client de l'attaquant détecte le hit localement et envoie `player-hit`. Le serveur broadcast `player-died` à tous.
- **Victoire** : le serveur maintient un `Set` des joueurs vivants par room. Quand il ne reste qu'un survivant, il émet `round-over`.

### Joueurs locaux vs distants

- **Joueur local** : contrôlé par le clavier, physique Arcade complète. Envoie son état au réseau.
- **Joueurs distants** : pas de contrôle clavier, position appliquée directement depuis les messages réseau (`applyRemoteState` via `body.reset()`). Physique arcade active uniquement pour les collisions avec les plateformes.

### Points de spawn

Le serveur attribue un point de spawn fixe à chaque joueur au lancement (6 positions prédéfinies réparties sur le niveau). Les spawn points sont envoyés via l'événement `game-starting`.

## Physique

- Wall cling : en l'air, appuyer vers un mur immobilise le joueur (vélocité Y = 0)
- Wall jump : depuis un wall cling, le joueur est éjecté à l'opposé du mur (impulsion horizontale + verticale réduite). Un cooldown empêche le re-cling immédiat et bloque le contrôle horizontal pendant l'éjection.

## Flèches

- Entité `Arrow` (`src/entities/Arrow.ts`) : sprite avec physique arcade, rotation alignée sur la vélocité.
- Chaque flèche possède un `arrowId` unique (pour la synchronisation réseau) et un `ownerId` (identifiant du tireur).
- Body physique carré (4x4) indépendant du sprite visuel (10x3) pour une collision précise quelle que soit la rotation.
- Visée 8 directions via W/S (haut/bas) combiné avec A/D (gauche/droite) au moment du tir (O). Sans direction, tir dans la direction du regard. Le saut est assigné à la touche K (séparé de la visée vers le haut). Les contrôles utilisent `event.code` (position physique des touches) pour être indépendants du layout clavier (AZERTY/QWERTY).
- Trajectoire : départ horizontal (gravité désactivée pendant 120ms), puis courbe parabolique. Vitesse plafonnée à `ARROW_SPEED` (500 px/s) via `setMaxSpeed` pour éviter le tunneling à travers les plateformes.
- **Collision par la pointe** : seule la pointe de la flèche (extrémité avant dans la direction de vol, calculée par `getTipPosition()`) peut tuer. La détection utilise un test point-dans-rectangle (`tipHitsSprite`) au lieu d'un overlap de body complet.
- **Auto-kill** : une flèche peut tuer son propre tireur, mais seulement après avoir quitté sa hitbox (flag `canHitOwner` activé via `hasLeftOwner`). L'auto-kill entraîne une perte d'1 point (min 0, géré côté serveur).
- Les flèches se plantent dans les plateformes (`collider` → vélocité 0, gravité désactivée, puis décalage de 4px dans la direction de vol pour enfoncement visuel). Méthode `stickAt()` pour la synchronisation réseau.
- Les flèches traversent les joueurs tués (la flèche continue).
- Les flèches plantées sont ramassables par n'importe quel joueur (overlap détecté dans `GameScene.update`).
- Délai d'armement de 100ms après le tir.
- Stock initial : 4 flèches, max : 8. Compteur affiché au-dessus de chaque joueur (▲ par flèche, X quand le stock est vide).
- Wrap-around identique au joueur sur les 4 bords.

## Niveaux

Les niveaux sont des grilles 2D (`number[][]`) : `0` = vide, `1` = plateforme solide.
Les plateformes aux bords doivent être cohérentes avec le wrap-around.

Les tuiles verticalement adjacentes sont fusionnées en un seul body physique lors du `buildLevel` pour éviter les collisions parasites aux coutures entre tuiles individuelles.

## Joueurs

- Entité `Player` (`src/entities/Player.ts`) : sprite avec physique arcade, couleur configurable, nom et compteur de flèches affichés au-dessus.
- Mode local (contrôle clavier) ou remote (état réseau).
- Méthodes `die(stomped?)` et `respawn(x, y)` pour la gestion de la mort/résurrection.
- Chaque joueur a un `playerId` correspondant à son socket ID.

## Mort du joueur

- Un joueur peut être tué par la pointe d'une flèche d'un autre joueur (pas par sa propre flèche), ou par piétinement (stomp).
- La détection de kill est faite par le client de l'attaquant, qui envoie `player-hit` au serveur.
- Animation de mort : expansion + fade out (flèche) ou écrasement (stomp).
- Pas de respawn dans un round — le joueur reste mort jusqu'à la fin du round.

## Collision entre joueurs

- Les colliders Arcade ne fonctionnent pas avec les joueurs distants (téléportation via `body.reset()` bypass la détection physique).
- La collision est résolue manuellement à chaque frame dans `GameScene.resolvePlayerCollisions()` : calcul de l'overlap entre le joueur local et chaque joueur distant, puis poussée sur l'axe de moindre pénétration.
- Si le joueur est repoussé vers le haut (posé sur un autre joueur), `body.blocked.down` est activé pour permettre le saut.

## Stomp (piétinement)

- Un joueur qui tombe (vélocité Y > 0) sur la moitié haute d'un autre joueur le tue par piétinement.
- Le stomp est vérifié **avant** la résolution de collision pour que l'overlap soit encore présent.
- Après un stomp, le joueur rebondit vers le haut (impulsion de -200).
- Animation de stomp spécifique : écrasement horizontal du joueur (scaleX 1.8, scaleY 0.2) + particules jaunes autour du point d'impact.
- La détection se base sur la position du bas du joueur par rapport au centre vertical de la cible.

## Système de score et rounds

- **Scores** : le serveur maintient un `ScoreBoard` (`{ [playerId]: number }`) par room, initialisé à 0 au début de la partie.
- **Round gagné** : le gagnant reçoit 1 point. En cas d'égalité, pas de point.
- **Auto-kill** : perte de 1 point (min 0), détecté quand `victimId === socket.id` dans l'événement `player-hit`.
- **Fin de round** : le serveur émet `round-over` (avec scores) puis, après 3 secondes, `new-round` avec les nouveaux spawn points.
- **Fin de partie** : quand un joueur atteint 5 points (`SCORE_TO_WIN`), le serveur émet `game-over` au lieu de `new-round`. Retour au lobby après 5 secondes.
- **Nouveau round** : tous les joueurs sont respawnés, les flèches sont détruites, le stock de flèches est réinitialisé à 4.

## Flèches — couleur du propriétaire

- Chaque flèche porte un `ownerColor` (couleur du joueur tireur), transmis via `ArrowData`.
- Quand une flèche se plante (`stick()` ou `stickAt()`), un `setTint(ownerColor)` est appliqué au sprite pour indiquer visuellement le propriétaire.

## Outils de développement

### Profilage avec Chrome DevTools MCP

Pour profiler les performances directement depuis Claude Code, ajouter le serveur MCP suivant (`.claude/settings.json` ou config MCP globale) :

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--autoConnect",
        "--channel=beta"
      ]
    }
  }
}
```

Prérequis : activer le remote debugging sur Chrome (`--remote-debugging-port=9222`).
Référence : https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session
