# Plan de développement — Towerfall PhaserJS

## Itération 1 — Setup + Personnage mobile sur un niveau ✅
- [x] Initialisation du projet (Phaser 3, bundler, structure)
- [x] Niveau simple avec plateformes (tilemap)
- [x] Un personnage (sprite placeholder) avec déplacement gauche/droite, gravité, saut
- [x] Collision avec les plateformes
- [x] Wrap-around sur tous les bords (gauche/droite, haut/bas)
- [x] Wall cling (s'accrocher aux murs)
- [x] Wall jump (saut depuis un mur avec éjection opposée)

## Itération 2 — Tir et physique des flèches
- [ ] Visée (8 directions ou libre) et tir de flèches
- [ ] Trajectoire parabolique (gravité sur les flèches)
- [ ] Les flèches se plantent dans les plateformes au contact
- [ ] Stock de départ : 4 flèches, maximum : 8
- [ ] Compteur de flèches affiché (HUD)
- [ ] Wrap-around des flèches (même logique que le joueur)

## Itération 3 — Mobs cibles + Kill par flèche
- [ ] Ajout de mobs/mannequins (cibles mobiles basiques sur les plateformes)
- [ ] Un mob touché par une flèche meurt
- [ ] Animation de mort simple
- [ ] Les flèches plantées dans le décor peuvent être ramassées (passer dessus)
- [ ] Le joueur peut être tué par sa propre flèche

## Itération 4 — Kill par piétinement (stomp)
- [ ] Atterrir sur la tête d'un mob le tue
- [ ] Feedback visuel du stomp
- [ ] Le stomp fonctionne aussi sur le joueur (auto-test via rebond)

## Itération 5 — Menu + Architecture réseau
- [ ] Écran titre et menu principal : Héberger / Rejoindre
- [ ] Serveur Node.js + WebSocket (ou Socket.io)
- [ ] Lobby : l'hôte crée une partie, les autres rejoignent via code/IP
- [ ] Affichage des joueurs connectés dans le lobby
- [ ] Lancement de la partie par l'hôte

## Itération 6 — Multijoueur réseau (2-6 joueurs)
- [ ] Synchronisation des états joueurs via le serveur (positions, actions)
- [ ] Chaque joueur contrôle son archer sur son propre device
- [ ] Gestion autoritative ou semi-autoritative des collisions/kills
- [ ] Attribution de couleurs/sprites distincts par joueur
- [ ] Détection de victoire : dernier survivant gagne le round
- [ ] Kill par flèche entre joueurs (remplace les mobs cibles)
- [ ] Kill par piétinement entre joueurs

## Itération 7 — Niveaux multiples
- [ ] 3-4 niveaux avec designs de plateformes variés
- [ ] Cohérence du wrap-around aux bords (plateformes symétriques)
- [ ] Sélection ou rotation de niveau entre les rounds (choix hôte ou aléatoire)

## Itération 8 — Éléments de décor mortels
- [ ] Pièges dans les niveaux (piques, lave, etc.)
- [ ] Contact avec un piège = mort du joueur
- [ ] Intégration avec le système de kill existant

## Itération 9 — Polish & Game Feel
- [ ] Sprites et animations propres (idle, run, jump, shoot, death)
- [ ] Effets sonores et musique
- [ ] Système de score entre rounds
- [ ] Particules, screen shake, slow-mo sur le kill final
