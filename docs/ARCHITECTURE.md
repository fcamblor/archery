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

- Wall slide : en l'air, appuyer vers un mur plafonne la vitesse de chute (`WALL_SLIDE_SPEED`)

## Niveaux

Les niveaux sont des grilles 2D (`number[][]`) : `0` = vide, `1` = plateforme solide.
Les plateformes aux bords doivent être cohérentes avec le wrap-around.

Les tuiles verticalement adjacentes sont fusionnées en un seul body physique lors du `buildLevel` pour éviter les collisions parasites aux coutures entre tuiles individuelles.
