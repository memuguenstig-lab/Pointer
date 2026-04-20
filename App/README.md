# Pointer

A fast, AI-powered code editor built with Electron, React, and TypeScript.

![Electron](https://img.shields.io/badge/Electron-28-blue) ![Node.js](https://img.shields.io/badge/Node.js-Backend-green) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Monaco Editor** - syntax highlighting for 50+ languages, multi-cursor, code folding
- **AI Chat** - built-in assistant with web search, tool calling, and codebase context
- **Git Integration** - visual diff, staging, commits, branches, stash
- **Integrated Terminal** - xterm.js powered, full shell access
- **File Explorer** - create, rename, delete, drag and drop
- **Discord Rich Presence** - shows what you are editing
- **Cross-platform** - Windows and macOS

## Quick Start (Development)

**Requirements:** Node.js 18+, yarn, Git

```bash
git clone https://github.com/PointerIDE/Pointer.git
cd Pointer/App
yarn install
yarn dev
```

The Node.js backend starts automatically. No Python, no extra setup.

### Manual startup

```bash
node backend-node/server.js   # backend on :23816
yarn dev:server               # Vite on :3000
yarn dev:electron             # Electron
```

### Environment

Create `.env` in `App/` if needed:

```env
VITE_API_URL=http://localhost:23816
OPENAI_API_KEY=your_key_here
```

## Project Structure

```
App/
├── src/              # React + TypeScript frontend
├── electron/
│   ├── main.js       # App entry, auto-starts backend
│   ├── preload.js    # IPC bridge
│   └── setup.js      # First-run installer (Node.js + deps)
├── backend-node/     # Node.js backend (Express, port 23816)
│   ├── server.js     # All API endpoints
│   ├── git-routes.js # Git via simple-git
│   ├── tools.js      # AI tool handlers
│   └── indexer.js    # Codebase indexer
├── installer/        # NSIS + macOS installer scripts
└── start-pointer.js  # Dev launcher
```

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Start backend + Vite + Electron |
| `yarn build` | Build frontend |
| `yarn dist:win` | Build Windows `.exe` installer |
| `yarn dist:mac` | Build macOS `.dmg` installer |

See [README-BUILD.md](README-BUILD.md) for full installer build instructions.

## Troubleshooting

**Backend not responding**
```bash
curl http://localhost:23816/health
node backend-node/server.js
```

**Port conflict**
```bash
VITE_PORT=3001 yarn dev
```

**Clean reinstall**
```bash
rm -rf node_modules backend-node/node_modules
yarn install
```

## API (port 23816)

`GET /health` - `POST /execute-command` - `GET /read-file` - `POST /save-file` - `POST /git/*` - `POST /api/tools/call` - `WS /ws/terminal`

## Contributing

1. Fork, create a feature branch, open a PR
2. TypeScript strict mode, functional React components, kebab-case filenames

## License

MIT - part of the [Pointer](https://pointr.sh) project.

---

[Back to Main README](../README.md) - [Build Installer](README-BUILD.md) - [Discord Bots](../DiscordBot/README.md)