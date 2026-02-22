# Connect Four

A strategic Connect Four game built with React, TypeScript, and a custom Minimax algorithm. This project demonstrates deterministic game search and spatial analysis in a modern web environment.

## Features

* **Custom Game Engine:** Uses a Minimax algorithm with Alpha-Beta pruning to calculate optimal moves.
* **Deterministic Logic:** Operates entirely on the client side without any external APIs.
* **Responsive UI:** Clean and interactive interface built with Tailwind CSS and Framer Motion.
* **Performance:** Heuristic-based evaluation for real-time decision making.

## Technical Overview

The project is structured into modular layers to separate game rules from the search algorithm:
* **Algorithm:** The `ai.ts` file contains the recursive Minimax search and heuristic scoring logic.
* **Game Rules:** `gameLogic.ts` handles the 6x7 matrix operations, move validation, and win-condition checking.
* **State Management:** React hooks manage the turn-based flow and board transitions.

## Getting Started

### Prerequisites
* **Node.js** (latest stable version recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/aylinbrtc/connect-four-ai.git](https://github.com/aylinbrtc/connect-four-ai.git)
   cd connect-four-ai

2. Install dependencies:
   ```bash
   npm install

2. Start the development server:
   ```bash
   npm run dev

### Development

npm run build: Bundles the application for production.

npm run lint: Checks for TypeScript errors.

Developed by Aylin BARUTÇU

