<p align="center">
  <img src="https://img.shields.io/badge/Age_of_Blocks-War_Fronts-c9a227?style=for-the-badge&labelColor=1a1a2e" alt="Age of Blocks: War Fronts" />
</p>

<h1 align="center">⚔️ Age of Blocks — War Fronts</h1>

<p align="center">
  <em>A browser-based real-time strategy game inspired by the classics.</em><br/>
  <em>Train your army. Command every unit. Conquer the map. Destroy the enemy castle.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white" />
  <img src="https://img.shields.io/badge/Canvas_2D-E34F26?style=flat-square&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
</p>

---

## 🎮 What Is This?

**Age of Blocks: War Fronts** is a fully playable real-time strategy game that runs entirely in your browser. Think *Age of Empires* meets pixel art — you gather resources, build structures, train diverse units, and lead your army into battle against AI opponents or real players online.

No downloads. No installs. Just open a tab and start conquering.

---

## ✨ Features

### ⚔️ Deep Combat System
Every unit type has strengths and weaknesses in a rock-paper-scissors style counter cycle. Swordsmen beat Archers, Archers outrange Spearmen, Spearmen counter Cavalry, and Cavalry runs down Swordsmen. On top of that, Mages deal devastating area damage and Catapults tear through buildings.

### 🗺️ Interactive Battlefields
The environment isn't just scenery — it's a weapon. Hide units in **forests** for ambushes, position archers on **hilltops** for bonus range, break through **rock barriers** to open new paths, and raid **neutral camps** for powerful buffs.

### 🌫️ Fog of War
You can only see what your units can see. Scout the map, guard your flanks, and beware of what lurks in the darkness.

### 🧠 Smart AI Opponents
Three difficulty levels of RTS AI that builds bases, trains armies, and adapts to your strategy. From beginner-friendly to brutally challenging.

### 🔬 Research System
Spend your hard-earned gold on research upgrades — each time you're presented with 3 options and must choose 1, making every game feel different.

### 💰 Kill Rewards
Take down enemy units to earn bonus gold. Aggressive play is rewarded.

### 🌐 Real-Time Multiplayer
Create a room, share the code with a friend, and battle head-to-head. The server is fully authoritative — all game logic runs server-side, so no cheating is possible.

---

## 🕹️ Controls

| Action | Input |
|---|---|
| Select units | Left click / drag |
| Move / Attack / Rally | Right click |
| Attack-move command | `A` + click |
| Move camera | `W` `A` `S` `D` or middle mouse drag |
| Zoom in / out | Scroll wheel |
| Jump to location | Click on minimap |
| Build structures | `1` – `9`, `0` |

---

## 🚀 Getting Started

Make sure you have **Node.js 20+** installed, then:

```bash
# Clone the repository
git clone https://github.com/huseyineneserturk/age-of-blocks.git
cd age-of-blocks

# Install dependencies
npm install

# Start the game client
npm run dev
# → opens at http://localhost:5173

# Start the multiplayer server (in a separate terminal)
npm run server
# → runs on port 3001
```

### Multiplayer Quick Start
1. One player clicks **"Create Room"** in the menu
2. Share the room code with your opponent
3. Opponent clicks **"Join"** and enters the code
4. The battle begins!

> 💡 To connect to a different server, add `?server=https://your-server.com` to the URL.

---

## 🏗️ Project Structure

```
age-of-blocks/
├── src/
│   ├── engine/      # Camera, input handling, grid system, A* pathfinding
│   ├── data/        # Unit, building & map configuration tables
│   ├── game/        # Core simulation — world state, combat, economy,
│   │                #   AI logic, fog of war (runs at 20Hz fixed tick)
│   ├── render/      # Canvas 2D renderer, unit sprites, visual effects, minimap
│   └── ui/          # HUD and in-game interface
├── server/          # Authoritative multiplayer match server (Socket.IO)
├── public/audio/    # Sound effects and music
├── test/            # Headless simulation tests
├── legacy/          # Original v1 of the game
└── index.html       # Entry point
```

---

## 🧪 Running Tests

```bash
# Run all test suites
npx tsx test/astar.test.ts
npx tsx test/combat.test.ts
npx tsx test/environment.test.ts
npx tsx test/ai.test.ts
npx tsx test/polish.test.ts
npx tsx test/net.test.ts

# Type checking
npm run typecheck
```

---

## 🛡️ Anti-Cheat Architecture

In multiplayer mode, the game uses a **server-authoritative model**. Clients only send commands (move here, attack that, build this) — the server simulates the entire game world and broadcasts the results. This means players can't tamper with unit stats, resources, or fog of war.

---

## 🗺️ Roadmap Ideas

- [ ] More unit types and civilizations
- [ ] Ranked matchmaking
- [ ] Replay system
- [ ] Map editor
- [ ] Mobile touch controls

---

## 📄 License

This project is open source. Feel free to fork, contribute, or just play!

---

<p align="center">
  <strong>Built with ☕ and a love for classic RTS games.</strong>
</p>
