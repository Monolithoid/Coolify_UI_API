# Coolify_UI_API

Ce dépôt propose une structure minimale pour contrôler plusieurs serveurs de jeux via Coolify avec trois briques complémentaires :

1. **Web app** : une page statique pour se connecter avec Google (à brancher), choisir un jeu et administrer la liste des jeux.
2. **API REST** : un service Express qui gère un catalogue de jeux et relaie les commandes start/stop vers l'API Coolify par jeu.
3. **Bot Discord** : un bot qui démarre le serveur lié à un salon quand un joueur rejoint et déclenche l'arrêt 10 minutes après le départ du dernier joueur.

## Arborescence

```
web-app/
  index.html           # Interface statique (contrôle + administration)
  js/app.js            # Logique front-end découpée (appel API REST)
  styles/main.css      # Styles de base
api/
  src/app.js           # Serveur Express et routage REST
  src/routes/          # Routes REST (start/stop + jeux)
  src/services/        # Client Coolify et stockage en mémoire des jeux
  .env.example         # Variables d'environnement attendues
  package.json         # Dépendances et scripts
discord-bot/
  bot.js               # Bot Discord (multi-salon, démarrage/arrêt + timer)
  .env.example         # Variables d'environnement attendues
  package.json         # Dépendances et scripts
.github/workflows/
  publish-api-docker.yml # Build et publication automatique de l'image Docker de l'API
```

## Prérequis

- Node.js 18+
- Un compte Coolify avec un token API, les identifiants projet/service par jeu et l'URL d'API correspondante.
- Pour le bot : un bot Discord, les intents Guilds et GuildVoiceStates activés, ainsi que les IDs des salons vocaux ciblés.
- Pour la web app : un client Google OAuth (pour brancher le bouton de connexion).

## Configuration

1. **API REST**
   - Copiez `api/.env.example` vers `api/.env`.
   - Renseignez `COOLIFY_BASE_URL`, `COOLIFY_TOKEN` (valeurs par défaut) ainsi que `GAME_PRESETS` si vous voulez précharger des jeux (format JSON d'un tableau d'objets `{id,name,projectId,serviceId,coolifyBaseUrl?,coolifyToken?}`).
   - Les endpoints disponibles :
     - `GET /api/games` pour lister les jeux.
     - `POST /api/games` pour ajouter un jeu.
     - `PUT /api/games/:id` pour modifier un jeu.
     - `DELETE /api/games/:id` pour supprimer un jeu.
     - `POST /api/server/:id/start` et `POST /api/server/:id/stop` pour piloter un jeu.

2. **Bot Discord**
   - Copiez `discord-bot/.env.example` vers `discord-bot/.env`.
   - Renseignez :
     - `DISCORD_TOKEN`
     - `API_BASE_URL` (par ex. `http://localhost:4000`)
     - `DISCORD_DEFAULT_GAME_ID` et `DISCORD_VOICE_CHANNEL_ID` pour le comportement par défaut.
     - `DISCORD_GAME_CHANNEL_MAPPINGS` (JSON d'objets `{channelId, gameId, apiBaseUrl?}`) pour mapper plusieurs salons à plusieurs jeux/services Coolify.

3. **Web app**
   - Ouvrez `web-app/index.html` dans un navigateur ou servez-le en statique.
   - Branchez le SDK Google Identity sur le bouton `#google-login` si besoin.
   - Vérifiez que l'API REST est accessible à l'URL configurée (par défaut `http://localhost:4000`).
   - Utilisez l'onglet "Administration des jeux" pour ajouter/modifier/supprimer des jeux, puis le sélecteur pour lancer/arrêter un serveur.

## Démarrage rapide

Installez les dépendances pour chaque module (API et bot) puis lancez-les séparément.

```bash
# API REST
cd api
npm install
npm run start

# Bot Discord
cd discord-bot
npm install
npm run start
```

Servez ensuite la web app (par exemple avec `npx serve web-app`) et utilisez les boutons pour tester les commandes.

## Points d'extension suggérés

- Remplacer l'alerte de connexion par l'intégration réelle de Google Identity Services.
- Ajouter une persistance d'état (statut du serveur) dans l'API et l'exposer à la web app.
- Sécuriser l'API (middleware d'authentification, validation d'entrée, limitation de flux).
- Ajouter des logs structurés et de la télémétrie pour suivre l'usage des commandes.
- Brancher une base de données pour persister les jeux administrés via la web app.

## Image Docker de l'API

L'API REST est packagée dans une image Docker publiée automatiquement sur Docker Hub lorsque vous poussez sur `main` (workflow `publish-api-docker.yml`). Configurez les secrets GitHub `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN` pour autoriser la publication.

### Construire et lancer localement

```bash
# Depuis la racine du dépôt
docker build -t coolify-api-local -f api/Dockerfile ./api
docker run --env-file api/.env -p 4000:4000 coolify-api-local
```

L'image expose le port `4000` et lit les variables d'environnement décrites dans `api/.env.example`.
