<div align="center">

# Where Petals Decay

A turn based tactical multiplayer game set in a fading, sakura covered world. Build a character, explore isometric maps, claim sanctuaries, and outduel your opponents in dice driven combat.

### [Play now at where-petals-decay.vercel.app](https://where-petals-decay.vercel.app/)

<img src="docs/screenshots/home.png" alt="Where Petals Decay title screen" width="780">

</div>

## Overview

Where Petals Decay is a real time multiplayer browser game where players gather in a lobby, customize a fighter, and battle across hand built isometric maps. Every turn you spend movement points to position yourself and a single action point to attack, open doors, or activate a sanctuary. The first player to reach the required number of combat victories wins.

The project is split into two applications:

- `client`: an Angular single page application that renders the menus, the isometric board, combat, and the live game log.
- `server`: a NestJS backend that manages lobbies, game state, persistence, and real time events over Socket.IO.

## Features

- Real time multiplayer lobbies with in game chat, powered by Socket.IO.
- Isometric maps with floors, walls, water, ice, doors, and spawn points.
- Turn based play with movement points and a single action point per turn.
- Dice driven combat with offensive and defensive postures.
- Sanctuaries that heal or boost your fighter, with a risk based "double or nothing" option.
- Two game modes: Classic last player standing and Capture the Flag.
- Virtual players (bots) with aggressive and defensive profiles to fill out a match.
- A built in map editor for creating, editing, and deleting maps.
- A live journal that records turns, combats, damage, door and sanctuary events, and more.
- End of game statistics covering scores, combat records, tile coverage, and match duration.

## Gameplay

### Game flow

1. From the title screen, join a game, create a game, or open the admin tools to manage maps.
2. Pick or build a map and open a lobby. Invite other players or add virtual players to fill empty slots.
3. Select your character: choose an avatar, a name, a stat bonus, and your dice configuration.
4. Wait in the lobby until the host starts the match.
5. Play out your turns on the isometric board. Each player gets a fixed amount of time per turn.
6. Reach the required number of combat victories to win, then review the end of game statistics.

### Combat

When two players meet on the board, combat begins. Each fighter rolls dice for attack and defense, with the die size (four or six sided) determined by the character build. During a clash you choose an offensive posture for extra attack or a defensive posture for extra defense. Damage is the difference between the attacker's roll and the defender's roll, and a round ends when a fighter is defeated.

### Sanctuaries

Sanctuaries are special tiles that grant a temporary edge:

- Healing sanctuary: restores health.
- Combat sanctuary: boosts attack and defense.

Each sanctuary can be triggered safely for a guaranteed effect, or with a "double or nothing" gamble that either doubles the effect or wastes it. Sanctuaries enter a cooldown after use.

### Game modes

- Classic: the last fighter standing wins the match.
- Capture the Flag: two teams compete over flag objectives shown on the map.

## Characters

Players choose from twelve avatars, then tune their fighter with a stat bonus (extra life or extra speed) and a dice configuration (favoring attack or defense).

| | | | | | |
|:-:|:-:|:-:|:-:|:-:|:-:|
| <img src="client/src/assets/avatars/archer.png" width="80"><br>Archer | <img src="client/src/assets/avatars/assassin.png" width="80"><br>Assassin | <img src="client/src/assets/avatars/axe_warrior.png" width="80"><br>Axe Warrior | <img src="client/src/assets/avatars/centaur.png" width="80"><br>Centaur | <img src="client/src/assets/avatars/dark_elf.png" width="80"><br>Dark Elf | <img src="client/src/assets/avatars/druid.png" width="80"><br>Druid |
| <img src="client/src/assets/avatars/elf.png" width="80"><br>Elf | <img src="client/src/assets/avatars/farmer.png" width="80"><br>Farmer | <img src="client/src/assets/avatars/mage.png" width="80"><br>Mage | <img src="client/src/assets/avatars/magic_lancer.png" width="80"><br>Magic Lancer | <img src="client/src/assets/avatars/marksman.png" width="80"><br>Marksman | <img src="client/src/assets/avatars/unknown_being.png" width="80"><br>Unknown Being |

## Tech stack

**Client**

- Angular 21 with TypeScript
- RxJS for reactive state
- Socket.IO client for real time communication
- Angular Material and Angular CDK
- SweetAlert2 for modals, html2canvas for capture

**Server**

- NestJS 11 on top of Express
- Socket.IO gateways for lobby, game, join, and combat namespaces
- MongoDB with Mongoose
- Swagger for API documentation, served at `/api/docs`

## Getting started

The game is live, no install required. Just open it in your browser:

### [where-petals-decay.vercel.app](https://where-petals-decay.vercel.app/)

## Running locally

If you want to run the project yourself, you will need Node.js, npm, and a MongoDB connection string (local or hosted).

### Server

```bash
cd server
npm ci
```

Create a `server/.env` file using `server/.env.example` as a template:

```
DATABASE_CONNECTION_STRING=mongodb+srv://username:password@your-cluster.mongodb.net/?appName=yourApp
PORT=3000
```

Then start the server:

```bash
npm start
```

The server runs on `http://localhost:3000` and exposes API documentation at `http://localhost:3000/api/docs`.

### Client

```bash
cd client
npm ci
npm start
```

The client runs on `http://localhost:4200` and opens automatically.

## Project structure

```
.
├── client/    Angular single page application
├── server/    NestJS backend and Socket.IO gateways
├── common/    Shared interfaces and enums
└── docs/      Screenshots and documentation assets
```

## Testing

Both projects ship with unit tests and code coverage.

```bash
# in client/ or server/
npm run test
npm run coverage
```

The client uses Jasmine and Karma. The server uses Jest.

## Team

Built by Team 310:

Aymene Adaouri, Aly Abdoulaye-Idriss, Rayen Bouriel, Saad El Bounjimi, Walid Benakmoum, Franck Fongang.
