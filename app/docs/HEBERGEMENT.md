# Hébergement

Forge est un seul processus Node.js avec un fichier SQLite. Deux contraintes en découlent :

1. **Il faut un disque persistant.** Les offres « serverless » ou à disque éphémère (fonctions Vercel/Netlify, conteneurs sans volume) perdent la base à chaque redémarrage.
2. **Une seule instance.** SQLite n'est pas partagé entre plusieurs machines ; ne pas activer de mise à l'échelle horizontale.

Les tarifs et offres gratuites des hébergeurs changent souvent : vérifie-les sur leur site avant de choisir.

## Option A — VPS avec Docker (recommandée)

N'importe quel petit serveur Linux (1 vCPU, 1 Go de RAM suffisent) avec Docker installé.

```bash
git clone <url-de-ton-depot> forge
```

```bash
cd forge
```

```bash
docker compose up -d --build
```

L'application écoute sur `127.0.0.1:3000` ; les données sont dans le volume `forge-data`.

### HTTPS avec Caddy

HTTPS est indispensable hors de chez soi (le cookie de session n'est marqué `Secure` qu'en HTTPS). Avec un nom de
domaine pointant vers le serveur, installe Caddy puis écris dans `/etc/caddy/Caddyfile` :

```
forge.exemple.fr {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy obtient et renouvelle le certificat automatiquement.

### Après la mise en ligne

1. Crée ton compte.
2. Ferme les inscriptions : dans `docker-compose.yml`, passe `ALLOW_REGISTRATION` à `"false"`, puis relance.

```bash
docker compose up -d
```

### Mise à jour

```bash
git pull
```

```bash
docker compose up -d --build
```

Les migrations de base s'appliquent toutes seules au démarrage.

## Option B — VPS sans Docker

```bash
npm ci
```

```bash
npm run build
```

Puis un service systemd, dans `/etc/systemd/system/forge.service` :

```ini
[Unit]
Description=Forge
After=network.target

[Service]
WorkingDirectory=/opt/forge
ExecStart=/usr/bin/node server/dist/index.js
Environment=NODE_ENV=production PORT=3000 DATABASE_PATH=/var/lib/forge/forge.db ALLOW_REGISTRATION=false
User=forge
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now forge
```

Le reverse proxy HTTPS est le même qu'en option A.

## Option C — Plateforme gérée (Fly.io, Railway, Render…)

Le `Dockerfile` fourni convient à toute plateforme qui construit une image et propose un **volume persistant**.
Réglages à faire, quel que soit le fournisseur :

- monter le volume sur `/data` (la base est à `/data/forge.db`) ;
- port interne `3000` ;
- une seule instance, sans mise à l'échelle automatique ;
- contrôle de santé sur `/api/health`.

## Option D — À la maison

Sur un Raspberry Pi, un NAS ou un PC allumé en permanence : option A ou B, puis accès depuis le téléphone via le
réseau local. Pour y accéder hors de chez soi sans ouvrir de port, un réseau privé de type Tailscale ou un tunnel
Cloudflare évite d'exposer la machine. En HTTP simple sur le réseau local, l'application fonctionne, mais le mot de passe
circule en clair sur ce réseau.

## Sauvegardes

Toute la donnée tient dans le fichier SQLite. Deux niveaux complémentaires :

- **Dans l'application** : Réglages → Exporter (JSON). Réimportable sur n'importe quelle instance.
- **Côté serveur** : copie cohérente à chaud, à planifier chaque nuit (cron). Avec Docker, le fichier se trouve dans le volume ; sans Docker :

```bash
sqlite3 /var/lib/forge/forge.db ".backup '/var/backups/forge-$(date +%F).db'"
```

Ne copie pas le fichier `.db` avec `cp` pendant que l'application tourne : en mode WAL, la copie peut être incohérente.
Conserve les sauvegardes sur une autre machine que le serveur, et teste une restauration au moins une fois.

## Restauration

Arrête l'application, remplace le fichier de base par la sauvegarde (supprime les éventuels fichiers `-wal` et `-shm`
voisins), redémarre.

## Mot de passe oublié

Il n'y a pas d'envoi d'e-mail. Le plus simple : rouvrir temporairement les inscriptions, créer un nouveau compte,
puis y importer un export JSON si tu en as un. Sinon, le hachage peut être remplacé directement en base par un
administrateur.
