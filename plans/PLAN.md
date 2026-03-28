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

## Itération 5 — Menu + Architecture réseau ✅
- [x] Écran titre et menu principal : Héberger / Rejoindre
- [x] Serveur Node.js + WebSocket (Socket.io)
- [x] Lobby : l'hôte crée une partie, les autres rejoignent via code 4 caractères
- [x] Affichage des joueurs connectés dans le lobby (max 6, couleurs distinctes)
- [x] Lancement de la partie par l'hôte
- [x] Choix du nom de joueur (max 12 caractères) avant de créer ou rejoindre une partie

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
