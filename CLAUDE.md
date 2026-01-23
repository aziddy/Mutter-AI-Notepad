# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mutter AI Notepad is an Electron desktop app for local audio/video transcription using OpenAI Whisper, with AI analysis features powered by either local Qwen3 models or OpenAI-compatible APIs.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server + Electron with hot reload

# Build
npm run build        # TypeScript compile + Vite build
npm run electron:build  # Full build for distribution (includes npm run build)
npm run dist         # Alias for electron:build

# Run production
npm run start        # Run built Electron app

# Model downloads
npm run download-qwen3-1.7b-8Bit  # Download Qwen3 1.7B model (Q8_0 quantization)
npm run download-qwen3-0.6b-8Bit  # Download Qwen3 0.6B model (Q8_0 quantization)
```

## Architecture

### Electron Process Model
- **Main Process** ([src/main.js](src/main.js)): Handles file dialogs, IPC handlers, and orchestrates transcription/LLM operations
- **Preload Script** ([src/preload.js](src/preload.js)): Exposes secure `electronAPI` to renderer via contextBridge
- **Renderer Process**: React app with TypeScript

### Key Backend Services (Main Process)
- **[src/transcription.js](src/transcription.js)**: Whisper integration via `nodejs-whisper`, converts audio/video to text with SRT timestamps
- **[src/llm.js](src/llm.js)**: Unified LLM service supporting both local Qwen3 models (via `node-llama-cpp`) and OpenAI-compatible APIs. Handles streaming responses.

### Frontend Architecture (React)
- **State Management**: React Context with useReducer ([src/contexts/AppContext.tsx](src/contexts/AppContext.tsx))
- **Types**: Centralized TypeScript interfaces in [src/types/index.ts](src/types/index.ts)
- **IPC Hook**: [src/hooks/useElectron.ts](src/hooks/useElectron.ts) wraps `window.electronAPI` calls

### Component Organization
```
src/components/
├── AI/           # AI analysis panel, LLM controls
├── Audio/        # Audio player with SRT sync
├── FileUpload/   # File selection UI
├── Layout/       # Header, Sidebar, MainContent
├── Settings/     # LLM configuration modal
├── Transcription/ # Text and SRT views
└── UI/           # Toast notifications, shared components
```

### Data Flow
1. User selects file → IPC `select-file` → main process dialog
2. Transcription → IPC `transcribe-file` → Whisper processing → saves to `transcriptions/` folder
3. AI analysis → IPC streaming handlers (`generate-summary-stream`, etc.) → chunks sent via dynamic IPC channels

### File Storage
- **Transcriptions**: Saved to `transcriptions/transcription-{timestamp}/` with `.txt`, `.json`, and `.srt` files
- **LLM Config**: Stored in `llm-config.json` at project root
- **User Preferences**: Stored in `user-preferences.json`
- **Models**: Local LLM models go in `models/` directory

## TypeScript Configuration

- Main process files (`main.js`, `preload.js`, `llm.js`, `transcription.js`) are excluded from TypeScript compilation - they remain as CommonJS
- Renderer code uses TypeScript with strict mode
- Path aliases: `@/*` maps to `src/*`

## IPC Communication Pattern

All renderer-to-main communication uses `ipcRenderer.invoke()` / `ipcMain.handle()` pattern. For streaming LLM responses, dynamic channel names with stream IDs are used for chunk delivery:
- `llm-stream-chunk-{streamId}` for incremental content
- `llm-stream-complete-{streamId}` for completion
- `llm-stream-error-{streamId}` for errors
