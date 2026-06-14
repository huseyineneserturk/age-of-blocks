# 🤝 Age of Blocks — Contributing Guide

Thank you for your interest in contributing to Age of Blocks! This guide will help you set up your local development environment, understand the project structure, and submit code that aligns with our standards.

---

## 💻 Local Development Setup

To run the project locally, you must have **Node.js (>= v20)** installed on your machine.

### 1. Clone the Repository
```bash
git clone https://github.com/huseyineneserturk/age-of-blocks.git
cd age-of-blocks
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Client Dev Server
This command starts the Vite development server for the client. You can access the client in your browser at `http://localhost:5173`:
```bash
npm run dev
```

### 4. Start the Multiplayer Match Server
Open a separate terminal and start the local multiplayer game server:
```bash
npm run server
```

### 5. Run Tests
To run the unit tests (e.g., A* pathfinding tests):
```bash
npm run test
```

---

## 📁 Project Structure

The codebase consists of two main components:

* **`/src`**: Frontend (Client) code. Contains the user interface, canvas drawings, user input handlers, and client-side socket communication.
* **`/server`**: Backend (Server) code. Manages multiplayer room/lobby management, matchmaking, map simulation, and server-side game state validation.
* **`/public`**: Static assets including audio, images, and fonts.
* **`/test`**: Unit tests used to verify algorithms and logic.

---

## 🛡️ Core Development Rules

Please adhere to the following technical principles when making changes:

### 1. Authoritative Server Architecture
The game uses a strictly **Server-Authoritative** model to prevent client-side cheating.
* **Rule**: The client must never mutate critical game state (health, position, gold, etc.) independently.
* **Implementation**: Clients should only send user intent/commands (e.g., *"build building on block X"*). The server validates the request, simulates the result, and broadcasts the updated state to all connected clients.

### 2. Type Safety with TypeScript
The entire project is written in TypeScript.
* Define appropriate interfaces and types for any new functions, variables, or socket messages.
* Avoid using `any` type definitions.

### 3. Localization (i18n)
The game supports English and Turkish.
* When adding UI text, ensure to add translations to the dictionary in `src/i18n.ts` for both `TR` and `EN`.

---

## 🚀 Contribution Workflow (Git)

1. **Fork** the repository to your own GitHub account.
2. Create a new branch for your feature or bug fix locally:
   ```bash
   git checkout -b feature/your-feature-name  # For new features
   # OR
   git checkout -b bugfix/your-bugfix-name    # For bug fixes
   ```
3. Implement your changes and verify that the unit tests pass (`npm run test`).
4. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat: add support for new unit types"
   ```
5. Push your branch to your forked repository:
   ```bash
   git push origin feature/your-feature-name
   ```
6. Open a **Pull Request (PR)** from your fork back to the main repository.

---

## 📄 Licensing & Legal Agreement

By contributing to **Age of Blocks**, you agree to the following terms:
* The source code and assets of **Age of Blocks** are proprietary. However, you are granted a limited license to fork, clone, and modify the repository for the sole purpose of submitting contributions (Pull Requests) back to this project.
* By submitting a Pull Request, you grant the project owners a non-exclusive, perpetual, royalty-free, worldwide license to use, modify, distribute, and commercialize your contributions as part of the project.
