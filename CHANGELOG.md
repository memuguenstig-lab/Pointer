# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2026-06-12

### Added
- **Dynamic Image & Video Scaling/Pan (.workspace)**: Added support for zooming (1x - 5x) and panning (panning X/Y for visual cropping/cutting) of images and video cards.
- **Show/Hide Filenames**: Toggle visibility for card labels on media cards. Labels are now hidden by default.
- **Base64 Video Card Integration**: Connect, loop, mute, and run custom-cropped video files in the visual workspace.
- **Interactive Context Menu (Right-Click UI)**:
  - Custom right-click menu styled dynamically according to the active theme's background, border, and hover highlight colors.
  - Right-click canvas to quickly create text, statistics, checklist, bookmarks, and code cards, or upload media files at cursor coordinates.
  - Right-click cards to connect nodes, edit parameters, change source files, or delete items instantly.
- **RAG Setting Relocation**: Removed the "Local RAG" checkbox from the chat panel and added it to the settings panel (AI Behavior) as an auto-discovered option (enabled by default).
- **AI Planning Blueprint Guideline**: The AI agent will now construct interactive visual project roadmaps (in `.workspace` format) when initiating new workspaces to help users lay out tasks.

### Fixed
- Fixed typescript definition types for media nodes in `WorkspaceCanvasViewer.tsx`.
