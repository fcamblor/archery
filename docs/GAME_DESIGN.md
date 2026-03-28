# Game Design — Towerfall PhaserJS

## Concept

Jeu d'arène 2D multijoueur inspiré de Towerfall (Nintendo Switch). Chaque joueur incarne un archer qui doit éliminer les autres pour être le dernier survivant.

## Joueurs

- 2 à 6 joueurs simultanés
- Multijoueur en réseau : chaque joueur joue depuis son propre appareil (ordinateur ou tablette)
- Un joueur héberge la partie (serveur hôte), les autres le rejoignent
- Chaque joueur choisit son nom (max 12 caractères) avant de créer ou rejoindre une partie

## Contrôles

- **A / D** (position physique QWERTY) : déplacement gauche/droite
- **W / S** (position physique QWERTY) : visée haut/bas (8 directions avec combinaisons)
- **K** : saut / wall jump
- **O** : tir

Les contrôles sont basés sur la position physique des touches (`event.code`), donc identiques sur clavier AZERTY et QWERTY.

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
- Le nombre de flèches est **réinitialisé à 4** à chaque nouveau round (respawn)
- Les flèches plantées peuvent être **ramassées** par n'importe quel joueur en passant dessus
- Les flèches bénéficient du même wrap-around que les joueurs

## Conditions de mort

Un joueur peut être tué par :
1. **Une flèche** — seule la pointe de la flèche est létale. Une flèche peut tuer son propre tireur si elle retombe sur lui (auto-kill). Pendant les premières millisecondes, la flèche ne peut pas toucher le tireur (elle doit d'abord quitter sa hitbox).
2. **Un piétinement (stomp)** — atterrir sur la tête d'un autre joueur le tue. Le stomper rebondit vers le haut après l'impact.
3. **Un élément de décor** — pièges (piques, lave, etc.) *(itération future)*

## Niveaux

- Niveaux 2D de type plateformes
- Les niveaux ne sont **pas fermés** : le wrap-around s'applique sur tous les bords
- Les plateformes aux bords doivent être **cohérentes** avec le wrap-around (un trou à droite = même trou à gauche, idem haut/bas)
- Plusieurs niveaux disponibles avec des designs variés

## Condition de victoire

- Dernier joueur survivant remporte le round et gagne **1 point**
- En cas d'égalité (tous morts simultanément), aucun point n'est attribué
- **Auto-kill** (tué par sa propre flèche) : le joueur perd **1 point** (minimum 0)
- La partie se termine quand un joueur atteint **5 points**
- Entre chaque round, le tableau des scores est affiché pendant 3 secondes, puis un nouveau round démarre automatiquement (respawn de tous les joueurs)
- À la fin de la partie (5 points), retour automatique au lobby après 5 secondes
- Un joueur déconnecté en cours de partie est considéré comme éliminé

## Flèches — indicateur visuel

- Les flèches plantées dans le décor sont **teintées avec la couleur du joueur** qui les a tirées, permettant de savoir à qui elles appartiennent
