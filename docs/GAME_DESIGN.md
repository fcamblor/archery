# Game Design — Towerfall PhaserJS

## Concept

Jeu d'arène 2D multijoueur inspiré de Towerfall (Nintendo Switch). Chaque joueur incarne un archer qui doit éliminer les autres pour être le dernier survivant.

## Joueurs

- 2 à 6 joueurs simultanés
- Multijoueur en réseau : chaque joueur joue depuis son propre appareil (ordinateur ou tablette)
- Un joueur héberge la partie (serveur hôte), les autres le rejoignent

## Déplacements

- Déplacement gauche/droite sur des plateformes 2D
- Saut (avec gravité)
- **Wrap-around** : franchir un bord du niveau (haut, bas, gauche, droite) fait réapparaître le joueur du côté opposé

## Flèches

- Chaque joueur démarre avec **4 flèches**
- Maximum de **8 flèches** par joueur (en ramassant celles des autres)
- Tirer une flèche la retire du stock du joueur
- Les flèches suivent une **trajectoire parabolique** (gravité) et chutent au bout d'une certaine distance
- Les flèches se plantent dans les plateformes au contact
- Les flèches plantées peuvent être **ramassées** par n'importe quel joueur en passant dessus
- Les flèches bénéficient du même wrap-around que les joueurs

## Conditions de mort

Un joueur peut être tué par :
1. **Une flèche** — y compris la sienne
2. **Un piétinement (stomp)** — un autre joueur lui atterrit sur la tête
3. **Un élément de décor** — pièges (piques, lave, etc.)

## Niveaux

- Niveaux 2D de type plateformes
- Les niveaux ne sont **pas fermés** : le wrap-around s'applique sur tous les bords
- Les plateformes aux bords doivent être **cohérentes** avec le wrap-around (un trou à droite = même trou à gauche, idem haut/bas)
- Plusieurs niveaux disponibles avec des designs variés

## Condition de victoire

- Dernier joueur survivant remporte le round
