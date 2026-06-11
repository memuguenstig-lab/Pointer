# ShadowIDE CLI

A professional production-level command-line interface for interacting with an AI-powered local codebase assistant.

## Features

- **Global Command Access**: Accessible via `shadowide` command globally
- **Chat-Only Interface**: Natural language interaction through terminal chat
- **Tool Execution**: Support for file operations, search, shell commands, and more
- **Fine-Grained Code Editing**: Line-by-line editing with diff previews
- **Dual Modes**: Auto-Run and Dry-Run modes for safe experimentation
- **Output Control**: Configurable display of AI responses and tool outputs
- **Local-Only Setup**: Custom API base URL and model selection support

## Installation

```bash
pip install -e .
```

## Usage

```bash
shadowide
```

On first run, the CLI will prompt for initialization and configuration.

Run a quick environment check with:

```bash
shadowide doctor
shadowide doctor --json
shadowide doctor --fix
```

The doctor command verifies your Python runtime, config directory, config initialization status, workspace detection, and API reachability.

Inspect or update config values with:

```bash
shadowide config show
shadowide config show api.base_url
shadowide config set api.base_url http://localhost:1234
shadowide config unset ui.show_diffs
shadowide config edit
```

Show the current environment with:

```bash
shadowide status
shadowide status --json
```

Manage codebase context from top-level commands:

```bash
shadowide context show
shadowide context refresh
shadowide context search TODO
shadowide context files --ext .py
shadowide context inspect src/app.py
shadowide context inspect src/app.py --json
shadowide context rebuild
shadowide context stats --json
shadowide context config
```

Manage saved chats with:

```bash
shadowide chats export chat_20260327_010000 --format markdown
shadowide chats rename chat_20260327_010000 "Bug triage"
shadowide chats list --json
shadowide chats current --json
shadowide chats delete chat_20260327_010000
```

Inspect API connectivity and model setup with:

```bash
shadowide models
shadowide models --json
shadowide ping
shadowide ping --json
```

Initialize without prompts with:

```bash
shadowide init --non-interactive --api-base-url http://localhost:1234 --model gpt-oss-20b
```

Enable shell completion with Typer's built-in commands:

```bash
shadowide --install-completion
shadowide --show-completion
```

## Configuration

The CLI supports custom API base URLs and model selection for local AI services.

## Development

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black shadowide_cli/

# Lint code
flake8 shadowide_cli/
```

## License

MIT License
