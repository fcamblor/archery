# Architecture technique — Towerfall PhaserJS

## Structure du projet

```
src/
  main.ts            — Point d'entrée, config Phaser
  scenes/            — Scènes Phaser (GameScene, etc.)
  entities/          — Entités de jeu (Player, Arrow, Mob)
  levels/            — Données de niveaux (grilles number[][])
```

## Physique

- Wall cling : en l'air, appuyer vers un mur immobilise le joueur (vélocité Y = 0)
- Wall jump : depuis un wall cling, le joueur est éjecté à l'opposé du mur (impulsion horizontale + verticale réduite). Un cooldown empêche le re-cling immédiat et bloque le contrôle horizontal pendant l'éjection.

## Flèches

- Entité `Arrow` (`src/entities/Arrow.ts`) : sprite avec physique arcade, rotation alignée sur la vélocité.
- Body physique carré (4x4) indépendant du sprite visuel (10x3) pour une collision précise quelle que soit la rotation.
- Visée 8 directions via W/S (haut/bas) combiné avec A/D (gauche/droite) au moment du tir (O). Sans direction, tir dans la direction du regard. Le saut est assigné à la touche K (séparé de la visée vers le haut).
- Trajectoire : départ horizontal (gravité désactivée pendant 120ms), puis courbe parabolique. Vitesse plafonnée à `ARROW_SPEED` (500 px/s) via `setMaxSpeed` pour éviter le tunneling à travers les plateformes.
- **Collision par la pointe** : seule la pointe de la flèche (extrémité avant dans la direction de vol, calculée par `getTipPosition()`) peut tuer. La détection utilise un test point-dans-rectangle (`tipHitsSprite`) au lieu d'un overlap de body complet.
- **Protection du tireur** : une flèche en vol ne peut pas tuer son propre tireur (référence `spawner` sur l'Arrow, vérifiée dans GameScene).
- Les flèches se plantent dans les plateformes (`collider` → vélocité 0, gravité désactivée, puis décalage de 4px dans la direction de vol pour enfoncement visuel).
- Les flèches traversent les mobs sans se planter (le mob meurt, la flèche continue).
- Les flèches plantées sont ramassables par le joueur (overlap détecté dans `GameScene.update`).
- Délai d'armement de 100ms après le tir.
- Stock initial : 4 flèches, max : 8. Compteur affiché en HUD (texte en haut à gauche).
- Wrap-around identique au joueur sur les 4 bords.

## Niveaux

Les niveaux sont des grilles 2D (`number[][]`) : `0` = vide, `1` = plateforme solide.
Les plateformes aux bords doivent être cohérentes avec le wrap-around.

Les tuiles verticalement adjacentes sont fusionnées en un seul body physique lors du `buildLevel` pour éviter les collisions parasites aux coutures entre tuiles individuelles.

## Mobs

- Entité `Mob` (`src/entities/Mob.ts`) : cibles mobiles qui patrouillent sur les plateformes.
- Déplacement horizontal à vitesse constante, inversion de direction au contact d'un mur. Les mobs tombent des plateformes (pas de détection de bord).
- Wrap-around sur les 4 bords (même logique que joueur et flèches).
- Tués par la pointe d'une flèche en vol (animation de mort : expansion + fade out).
- Collision pointe-flèche→mob détectée via `tipHitsSprite` dans `GameScene.update`.
- Contact mob→joueur : tue le joueur (détecté via `checkOverlap` dans `GameScene.update`).

## Mort du joueur

- Le joueur peut être tué par la pointe d'une flèche d'un autre joueur (pas par sa propre flèche), ou par contact direct avec un mob.
- La flèche qui tue le joueur continue sa trajectoire (même comportement que pour les mobs).
- Animation de mort identique aux mobs. Respawn automatique après un court délai.
- Le nombre de flèches est conservé au respawn (pas de réinitialisation).

## Stomp (piétinement)

- Un joueur qui tombe (vélocité Y > 0) sur la moitié haute d'un mob le tue par piétinement.
- Après un stomp, le joueur rebondit vers le haut (impulsion de -200).
- Animation de stomp spécifique : écrasement horizontal du mob (scaleX 1.8, scaleY 0.2) + particules jaunes autour du point d'impact.
- La détection se base sur la position du bas du joueur par rapport au centre vertical de la cible.
- La mécanique est prête pour le multijoueur (stomp entre joueurs).

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
