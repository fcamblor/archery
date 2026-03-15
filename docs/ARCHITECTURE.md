# Architecture technique — Towerfall PhaserJS

## Structure du projet

```
src/
  main.ts            — Point d'entrée, config Phaser
  scenes/            — Scènes Phaser (GameScene, etc.)
  entities/          — Entités de jeu (Player, etc.)
  levels/            — Données de niveaux (grilles number[][])
```

## Physique

- Wall cling : en l'air, appuyer vers un mur immobilise le joueur (vélocité Y = 0)
- Wall jump : depuis un wall cling, le joueur est éjecté à l'opposé du mur (impulsion horizontale + verticale réduite). Un cooldown empêche le re-cling immédiat et bloque le contrôle horizontal pendant l'éjection.

## Flèches

- Entité `Arrow` (`src/entities/Arrow.ts`) : sprite avec physique arcade, gravité propre, rotation alignée sur la vélocité.
- Visée 8 directions via les touches fléchées au moment du tir (Espace). Sans direction, tir dans la direction du regard.
- Les flèches se plantent dans les plateformes (collision → vélocité 0, gravité désactivée).
- Les flèches plantées sont ramassables par le joueur (overlap détecté dans `GameScene.update`).
- Stock initial : 4 flèches, max : 8. Compteur affiché en HUD (texte en haut à gauche).
- Wrap-around identique au joueur sur les 4 bords.

## Niveaux

Les niveaux sont des grilles 2D (`number[][]`) : `0` = vide, `1` = plateforme solide.
Les plateformes aux bords doivent être cohérentes avec le wrap-around.

Les tuiles verticalement adjacentes sont fusionnées en un seul body physique lors du `buildLevel` pour éviter les collisions parasites aux coutures entre tuiles individuelles.
