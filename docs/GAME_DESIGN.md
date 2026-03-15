# Game Design — Towerfall PhaserJS

## Concept

Jeu d'arène 2D multijoueur inspiré de Towerfall (Nintendo Switch). Chaque joueur incarne un archer qui doit éliminer les autres pour être le dernier survivant.

## Joueurs

- 2 à 6 joueurs simultanés
- Multijoueur en réseau : chaque joueur joue depuis son propre appareil (ordinateur ou tablette)
- Un joueur héberge la partie (serveur hôte), les autres le rejoignent

## Contrôles

- **A / D** : déplacement gauche/droite
- **W / S** : visée haut/bas (8 directions avec combinaisons)
- **K** : saut / wall jump
- **O** : tir

## Déplacements

- Déplacement gauche/droite sur des plateformes 2D
- Saut avec la touche K (avec gravité)
- **Wrap-around** : franchir un bord du niveau (haut, bas, gauche, droite) fait réapparaître le joueur du côté opposé
- **Wall cling** : en l'air, appuyer vers un mur permet de s'y accrocher (le joueur reste immobile)
- **Wall jump** : depuis un wall cling, sauter éjecte le joueur à l'opposé du mur avec une hauteur réduite (~2/3 du saut normal). Le joueur peut revenir s'accrocher au mur pour escalader progressivement.

## Flèches

- Chaque joueur démarre avec **4 flèches**
- Maximum de **8 flèches** par joueur (en ramassant celles des autres)
- Tirer une flèche la retire du stock du joueur
- Les flèches partent **horizontalement** puis suivent une **trajectoire parabolique** (gravité différée)
- Les flèches se plantent dans les plateformes au contact
- Les flèches **traversent** les mobs et les joueurs tués (elles ne se plantent que dans le décor)
- Le nombre de flèches est **conservé** après la mort (pas de réinitialisation au respawn)
- Les flèches plantées peuvent être **ramassées** par n'importe quel joueur en passant dessus
- Les flèches bénéficient du même wrap-around que les joueurs

## Mobs

- Des **mannequins/cibles** patrouillent sur les plateformes
- Ils avancent horizontalement et font demi-tour aux murs et bords de plateforme
- Un mob touché par une flèche **meurt** (animation d'expansion + disparition)
- Les mobs bénéficient du wrap-around

## Conditions de mort

Un joueur peut être tué par :
1. **Une flèche** — y compris la sienne
2. **Un mob** — un contact direct avec un mob tue le joueur
3. **Un piétinement (stomp)** — atterrir sur la tête d'un mob ou d'un autre joueur le tue. Le stomper rebondit vers le haut après l'impact.
4. **Un élément de décor** — pièges (piques, lave, etc.)

## Niveaux

- Niveaux 2D de type plateformes
- Les niveaux ne sont **pas fermés** : le wrap-around s'applique sur tous les bords
- Les plateformes aux bords doivent être **cohérentes** avec le wrap-around (un trou à droite = même trou à gauche, idem haut/bas)
- Plusieurs niveaux disponibles avec des designs variés

## Condition de victoire

- Dernier joueur survivant remporte le round
