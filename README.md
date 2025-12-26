# Coolify_UI_API

Ce dépôt propose une structure minimale pour contrôler plusieurs serveurs de jeux via Coolify avec trois briques complémentaires :

1. **Web app** : une page statique pour se connecter avec Google (à brancher), choisir un jeu et administrer la liste des jeux.
2. **API REST** : un service Express qui gère un catalogue de jeux et relaie les commandes start/stop vers l'API Coolify par jeu.
3. **Bot Discord intégré** : un bot embarqué dans l'API qui démarre le serveur lié à un salon quand un joueur rejoint et déclenche l'arrêt 10 minutes après le départ du dernier joueur.

## Arborescence

```
app/
  web-app/             # Interface statique servie par Express
    index.html         # Contrôle + administration
    js/app.js          # Appels REST vers l'API
    styles/main.css    # Styles de base
  src/app.js           # Serveur Express et routage REST
  src/routes/          # Routes REST (start/stop + jeux + statut Discord)
  src/services/        # Client Coolify, stockage en mémoire des jeux et bot Discord intégré
  src/services/discordBotService.js # Logique du bot Discord intégré
  .env.example         # Variables d'environnement attendues
  package.json         # Dépendances et scripts
discord-bot/           # Exemple historique de bot autonome (optionnel)
  bot.js
  .env.example
  package.json
.github/workflows/
  publish-api-docker.yml # Build et publication automatique de l'image Docker de l'API
```

## Prérequis

- Node.js 18+
- Un compte Coolify avec un token API, l'identifiant de service par jeu et l'URL d'API correspondante.
- Pour le bot : un bot Discord, les intents Guilds et GuildVoiceStates activés, ainsi que les IDs des salons vocaux ciblés.
- Pour la web app : un client Google OAuth (pour brancher le bouton de connexion).

## Configuration

1. **API REST + bot Discord intégré + web app**
   - Copiez `app/.env.example` vers `app/.env`.
   - Renseignez les variables Coolify (`COOLIFY_BASE_URL`, `COOLIFY_TOKEN`, `GAME_PRESETS`).
   - Activez le bot Discord en ajoutant `DISCORD_TOKEN` et en plaçant les IDs de salons vocaux directement dans `GAME_PRESETS` via `discordVoiceChannelIds` (recommandé). Ajoutez les consignes Discord au même endroit avec un champ `instructions` par jeu pour afficher les instructions lors du démarrage. Vous pouvez sinon utiliser le couple `DISCORD_DEFAULT_GAME_ID` + `DISCORD_VOICE_CHANNEL_ID` ou `DISCORD_GAME_CHANNEL_MAPPINGS` (`[{"channelId":"...","gameId":"...","instructions":"..."}]`). Ajoutez des instructions propres à chaque jeu via `instructions` dans les mappings ou avec `DISCORD_GAME_INSTRUCTION_MAPPINGS` (JSON `{ "game-id": "instructions" }` ou tableau d'objets `{ gameId, instructions }`).
   - Les endpoints disponibles :
     - `GET /api/games` pour lister les jeux.
     - `POST /api/games` pour ajouter un jeu.
     - `PUT /api/games/:id` pour modifier un jeu.
     - `DELETE /api/games/:id` pour supprimer un jeu.
     - `POST /api/server/:id/start` et `POST /api/server/:id/stop` pour piloter un jeu.
     - `GET /api/discord/status` pour vérifier l'état du bot Discord intégré.

2. **Web app**
   - Servez `app/web-app` via l'API (racine `/` par défaut) ou ouvrez directement `app/web-app/index.html` dans un navigateur.
   - Branchez le SDK Google Identity sur le bouton `#google-login` si besoin.
   - Vérifiez que l'API REST est accessible à l'URL configurée (par défaut `http://localhost`).
   - Utilisez l'onglet "Administration des jeux" pour ajouter/modifier/supprimer des jeux, puis le sélecteur pour lancer/arrêter un serveur.

## Démarrage rapide

Installez les dépendances de l'API (le bot Discord est inclus) puis lancez-la.

```bash
# API REST + web app + bot Discord intégré
cd app
npm install
npm run start
```

La web app est servie par l'API sur la racine `/`. Si `DISCORD_TOKEN` est présent, le bot s'initialise au démarrage pour écoute
r les salons vocaux configurés. Vous pouvez aussi tester la web app directement avec `npx serve app/web-app` si besoin.

## Conteneur unique Web + API

Un `Dockerfile` à la racine permet désormais de packager la web app statique et l'API Express dans une seule image. La web app est servie par Express sur la racine `/` et toutes les variables sensibles (tokens, identifiants Coolify) se passent par des variables d'environnement.

### Exemple avec Docker Compose

Un fichier `docker-compose.example.yml` est fourni pour lancer l'ensemble en local :

```bash
docker compose -f docker-compose.example.yml up -d
```

Points clés de l'exemple :

- Le conteneur expose le port HTTP par défaut (`80`) pour l'API et la web app.
- L'exemple télécharge l'image publiée sur Docker Hub (`monolithoid/coolify-api:latest`) au lieu de builder en local.
- Les tokens et identifiants Coolify sont fournis via `COOLIFY_TOKEN`, `COOLIFY_PROJECT_ID`, `COOLIFY_SERVICE_ID` et, si besoin, `GAME_PRESETS` pour précharger des jeux.
- Les variables Discord (`DISCORD_TOKEN` et les salons définis dans `GAME_PRESETS` via `discordVoiceChannelIds`, ou à défaut `DISCORD_DEFAULT_GAME_ID`, `DISCORD_VOICE_CHANNEL_ID` ou `DISCORD_GAME_CHANNEL_MAPPINGS`) sont déclarées sur le même conteneur pour activer le bot intégré. Renseignez `instructions` dans chaque jeu de `GAME_PRESETS`, dans les mappings ou `DISCORD_GAME_INSTRUCTION_MAPPINGS` pour envoyer des consignes spécifiques par jeu lors du démarrage.
- Modifiez les valeurs directement dans le fichier Compose ou utilisez un fichier `.env` chargé par Docker Compose pour les surcharger.

Une fois démarré, accédez à `http://localhost` pour utiliser l'interface web et tester les appels API sur le même conteneur.

## Points d'extension suggérés

- Remplacer l'alerte de connexion par l'intégration réelle de Google Identity Services.
- Ajouter une persistance d'état (statut du serveur) dans l'API et l'exposer à la web app.
- Sécuriser l'API (middleware d'authentification, validation d'entrée, limitation de flux).
- Ajouter des logs structurés et de la télémétrie pour suivre l'usage des commandes.
- Brancher une base de données pour persister les jeux administrés via la web app.

## Image Docker web + API

L'image monolithique (API Express + web app statique) est publiée automatiquement sur Docker Hub lorsque vous poussez sur `main` (workflow `publish-api-docker.yml`). Configurez les secrets GitHub `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN` pour autoriser la publication.

### Construire et lancer localement

```bash
# Depuis la racine du dépôt
docker build -t coolify-api-local .
docker run --env-file app/.env -p 80:80 coolify-api-local
```

L'image expose le port HTTP par défaut (`80`) et lit les variables d'environnement décrites dans `app/.env.example` pour l'API et la web app.
