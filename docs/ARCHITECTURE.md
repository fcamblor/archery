# Architecture technique — Towerfall PhaserJS

## Structure du projet

```
src/
  main.ts            — Point d'entrée, config Phaser
  scenes/            — Scènes Phaser (GameScene, etc.)
  entities/          — Entités de jeu (Player, etc.)
  levels/            — Données de niveaux (grilles number[][])
```

## Constantes de gameplay

- Gravité : 800
- Vitesse joueur : 160
- Vélocité saut : -300
- Taille joueur : 12×12 px
- Taille tile : 16×16 px
- Résolution : 480×360 pixels (30×22.5 tiles)

## Niveaux

Les niveaux sont des grilles 2D (`number[][]`) : `0` = vide, `1` = plateforme solide.
Les plateformes aux bords doivent être cohérentes avec le wrap-around.
