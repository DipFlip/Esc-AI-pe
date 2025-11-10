# Esc-AI-pe

An AI-agent interactive game built with Three.js where an AI can control a player character through MCP (Model Context Protocol).

## Features

- 3D environment with Three.js
- Player character (blue capsule)
- Interactive cubes scattered around the scene
- Movement controls (WASD/Arrow keys)
- Interaction system (E key)
- Pickup system (Q key)
- Mouse look controls

## Controls

- **WASD / Arrow Keys**: Move the player
- **E**: Interact with nearby objects
- **Q**: Pickup nearby pickupable objects
- **Mouse**: Look around (click and drag)

## Game API (for AI/MCP integration)

The game exposes a `window.gameAPI` object with the following methods:

```javascript
window.gameAPI.moveLeft()       // Move player left
window.gameAPI.moveRight()      // Move player right
window.gameAPI.moveForward()    // Move player forward
window.gameAPI.moveBackward()   // Move player backward
window.gameAPI.pickup()         // Pickup nearby object
window.gameAPI.interact()       // Interact with nearby object
window.gameAPI.getState()       // Get current game state
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

This project is configured for Vercel deployment. Simply connect your repository to Vercel and it will automatically deploy.
