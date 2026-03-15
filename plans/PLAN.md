# Plan de développement — Towerfall PhaserJS

## Itération 1 — Setup + Personnage mobile sur un niveau ✅
- [x] Initialisation du projet (Phaser 3, bundler, structure)
- [x] Niveau simple avec plateformes (tilemap)
- [x] Un personnage (sprite placeholder) avec déplacement gauche/droite, gravité, saut
- [x] Collision avec les plateformes
- [x] Wrap-around sur tous les bords (gauche/droite, haut/bas)
- [x] Wall cling (s'accrocher aux murs)
- [x] Wall jump (saut depuis un mur avec éjection opposée)

## Itération 2 — Tir et physique des flèches ✅
- [x] Visée (8 directions ou libre) et tir de flèches
- [x] Trajectoire parabolique (gravité sur les flèches)
- [x] Les flèches se plantent dans les plateformes au contact
- [x] Stock de départ : 4 flèches, maximum : 8
- [x] Compteur de flèches affiché (HUD)
- [x] Wrap-around des flèches (même logique que le joueur)

## Itération 3 — Mobs cibles + Kill par flèche ✅
- [x] Ajout de mobs/mannequins (cibles mobiles basiques sur les plateformes)
- [x] Un mob touché par une flèche meurt
- [x] Animation de mort simple
- [x] Les flèches plantées dans le décor peuvent être ramassées (passer dessus)
- [x] Le joueur peut être tué par sa propre flèche

## Itération 4 — Kill par piétinement (stomp) ✅
- [x] Atterrir sur la tête d'un mob le tue
- [x] Feedback visuel du stomp
- [x] Le stomp fonctionne aussi sur le joueur (auto-test via rebond)

## Itération 5 — Optimisation des performances ⬅️ EN COURS

### Diagnostic
Le jeu démarre à 60 FPS mais chute rapidement à ~30 FPS, même sans tirer de flèche.
Les causes identifiées relèvent de pratiques non-standard pour un jeu vidéo.

### 5.1 — Profilage et identification de la cause racine
- [ ] Utiliser le serveur MCP `chrome-devtools-mcp` pour profiler directement depuis Claude Code (voir config MCP dans `docs/ARCHITECTURE.md`)
- [ ] Capturer un profil Performance pendant la chute de FPS (sans tirer de flèche)
- [ ] Identifier le hotpath exact (physics step ? render ? GC ?)
- [ ] Vérifier si le moteur physique Arcade accumule des données internes au fil du temps
- [ ] Ajouter un panneau de debug in-game (temps physics, temps render, nombre de bodies/colliders)

### 5.2 — Zéro allocation dans la game loop
- [ ] Remplacer tous les appels `getBounds()` dans `update()` par des calculs directs sur `body.position` / `body.width` / `body.height` (évite la création d'objets `Geom.Rectangle` à chaque frame)
- [ ] `tipHitsSprite()` : test point-dans-rectangle avec arithmétique simple
- [ ] `checkOverlap()` : intersection AABB manuelle sans allocation
- [ ] `isStomping()` : calculs directs sur les bodies

### 5.3 — HUD avec dirty flag
- [ ] Ne mettre à jour `arrowHud.setText()` que quand `arrowCount` change
- [ ] Ne mettre à jour `fpsText.setText()` qu'une fois toutes les ~500ms (pas 60×/sec)

### 5.4 — Gestion du cycle de vie des colliders
- [ ] Stocker la référence du `Phaser.Physics.Arcade.Collider` retourné par `physics.add.collider()` sur chaque flèche
- [ ] Appeler `collider.destroy()` quand une flèche est ramassée ou détruite
- [ ] Vérifier que le nombre de colliders actifs dans `physics.world` reste stable

### 5.5 — Fixed timestep pour la physique
- [ ] Activer `physics.arcade.fps` à 60 avec `useFixedStep: true` dans la config Phaser
- [ ] Vérifier que le gameplay reste identique avec le pas fixe

### 5.6 — Object pooling des flèches
- [ ] Créer un pool de flèches (pré-allouer N sprites désactivés)
- [ ] Au tir : activer une flèche du pool au lieu de `new Arrow()`
- [ ] Au ramassage/destruction : désactiver et remettre dans le pool au lieu de `destroy()`

### 5.7 — Particules de stomp optimisées
- [ ] Remplacer la création dynamique de 6 rectangles + 6 tweens par un `Phaser.GameObjects.Particles.ParticleEmitter` ou un pool de particules réutilisables

### 5.8 — Validation
- [ ] FPS stable à 60 pendant 5+ minutes de jeu actif
- [ ] Aucune croissance du nombre de game objects / colliders / bodies dans le temps
- [ ] Pas de GC pauses visibles dans le profiler Chrome

## Itération 6 — Menu + Architecture réseau
- [ ] Écran titre et menu principal : Héberger / Rejoindre
- [ ] Serveur Node.js + WebSocket (ou Socket.io)
- [ ] Lobby : l'hôte crée une partie, les autres rejoignent via code/IP
- [ ] Affichage des joueurs connectés dans le lobby
- [ ] Lancement de la partie par l'hôte

## Itération 7 — Multijoueur réseau (2-6 joueurs)
- [ ] Synchronisation des états joueurs via le serveur (positions, actions)
- [ ] Chaque joueur contrôle son archer sur son propre device
- [ ] Gestion autoritative ou semi-autoritative des collisions/kills
- [ ] Attribution de couleurs/sprites distincts par joueur
- [ ] Détection de victoire : dernier survivant gagne le round
- [ ] Kill par flèche entre joueurs (remplace les mobs cibles)
- [ ] Kill par piétinement entre joueurs

## Itération 8 — Niveaux multiples
- [ ] 3-4 niveaux avec designs de plateformes variés
- [ ] Cohérence du wrap-around aux bords (plateformes symétriques)
- [ ] Sélection ou rotation de niveau entre les rounds (choix hôte ou aléatoire)

## Itération 9 — Éléments de décor mortels
- [ ] Pièges dans les niveaux (piques, lave, etc.)
- [ ] Contact avec un piège = mort du joueur
- [ ] Intégration avec le système de kill existant

## Itération 10 — Polish & Game Feel
- [ ] Sprites et animations propres (idle, run, jump, shoot, death)
- [ ] Effets sonores et musique
- [ ] Système de score entre rounds
- [ ] Particules, screen shake, slow-mo sur le kill final
