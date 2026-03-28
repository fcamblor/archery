# Deploiement sur Synology NAS (ARM)

Guide pour deployer Towerfall sur un NAS Synology ARM sans Docker.

## Prerequis

- DSM 7.x
- Node.js installe sur le NAS (voir section ci-dessous)
- Acces SSH active (Panneau de configuration > Terminal & SNMP > Activer SSH)

## 1. Installer Node.js sur le NAS

### Option A : via SynoCommunity (recommande)

1. Panneau de configuration > Centre de paquets > Parametres
2. Ajouter la source : `https://packages.synocommunity.com`
3. Installer le paquet **Node.js v20** (ou la version la plus recente disponible)

### Option B : via Entware

Si SynoCommunity n'a pas de paquet Node.js pour ton architecture ARM :

```bash
# Installer Entware d'abord (voir https://github.com/Entware/Entware/wiki/Install-on-Synology-NAS)
opkg update
opkg install node node-npm
```

### Verifier l'installation

```bash
node --version   # v20.x ou superieur
npm --version
```

## 2. Deployer le code

### Sur ta machine de dev

```bash
# Builder le frontend
npm run build

# Creer une archive de deploiement
tar czf towerfall-deploy.tar.gz dist/ server/ src/shared/ package.json package-lock.json
```

### Sur le NAS (via SSH)

```bash
# Creer le repertoire de l'app
mkdir -p /volume1/apps/towerfall
cd /volume1/apps/towerfall

# Copier l'archive (depuis ta machine de dev)
# scp towerfall-deploy.tar.gz user@nas:/volume1/apps/towerfall/

# Extraire
tar xzf towerfall-deploy.tar.gz
rm towerfall-deploy.tar.gz

# Installer les dependances
npm install --omit=dev
```

## 3. Lancer le serveur

### Test manuel

```bash
cd /volume1/apps/towerfall
PORT=8080 NODE_ENV=production node --import tsx server/index.ts
```

Verifier dans un navigateur : `http://<ip-du-nas>:8080`

### Demarrage automatique (script init)

Creer le fichier `/volume1/apps/towerfall/start.sh` :

```bash
#!/bin/bash
cd /volume1/apps/towerfall
PORT=8080 NODE_ENV=production node --import tsx server/index.ts >> /var/log/towerfall.log 2>&1
```

```bash
chmod +x /volume1/apps/towerfall/start.sh
```

Pour un demarrage automatique au boot, creer une tache planifiee dans DSM :
1. Panneau de configuration > Planificateur de taches
2. Creer > Tache declenchee > Evenement de demarrage
3. Utilisateur : **root**
4. Script : `/volume1/apps/towerfall/start.sh`

## 4. Configurer le reverse proxy DSM

Pour exposer le jeu sur `archery.camblor.fr` :

1. **Panneau de configuration > Portail de connexion > Avance > Proxy inverse**
2. Creer une nouvelle regle :
   - **Nom** : Towerfall
   - **Source** :
     - Protocole : HTTPS
     - Nom d'hote : `archery.camblor.fr`
     - Port : 443
   - **Destination** :
     - Protocole : HTTP
     - Nom d'hote : `localhost`
     - Port : 8080
3. **Onglet "En-tete personnalise"** > cliquer sur **Creer > WebSocket**
   (indispensable pour que Socket.io fonctionne)

## 5. Certificat SSL

Pour HTTPS sur `archery.camblor.fr` :

1. **Panneau de configuration > Securite > Certificat**
2. Ajouter > Let's Encrypt
3. Nom de domaine : `archery.camblor.fr`
4. Affecter ce certificat au reverse proxy Towerfall dans l'onglet **Configurer**

## 6. DNS

Pointer `archery.camblor.fr` vers l'IP publique de ta box :
- Chez ton registrar DNS (OVH, Cloudflare, etc.)
- Type A vers ton IP publique
- Configurer une redirection de port sur ta box : port 443 externe > port 443 du NAS

## Commandes utiles

```bash
# Voir les logs
tail -f /var/log/towerfall.log

# Redemarrer le serveur
pkill -f "server/index.ts"
/volume1/apps/towerfall/start.sh &

# Mettre a jour le deploiement
cd /volume1/apps/towerfall
tar xzf towerfall-deploy.tar.gz
npm install --omit=dev
pkill -f "server/index.ts"
./start.sh &
```
