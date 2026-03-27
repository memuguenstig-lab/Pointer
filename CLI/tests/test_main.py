"""
Tests for Pointer CLI command entry points.
"""

import json
from types import SimpleNamespace

from typer.testing import CliRunner

from pointer_cli.main import (
    app,
    EXIT_CONFIG_ERROR,
    EXIT_DEPENDENCY_ERROR,
    EXIT_USER_CANCELLED,
    _complete_config_keys,
    _complete_config_values,
    _complete_context_query,
)


runner = CliRunner()


class TestMainCommands:
    """Test top-level CLI commands."""

    def test_config_show_outputs_json(self, tmp_path):
        """`pointer config show` should print the config file contents."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "test-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {
                        "auto_run_mode": True,
                    },
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["config", "show", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "test-model" in result.stdout
        assert '"initialized": true' in result.stdout.lower()

    def test_config_set_updates_nested_value(self, tmp_path):
        """`pointer config set` should persist nested config changes."""
        config_path = tmp_path / "config.json"

        result = runner.invoke(
            app,
            ["config", "set", "api.base_url", "http://localhost:9000", "--config", str(config_path)],
        )

        assert result.exit_code == 0
        saved = json.loads(config_path.read_text(encoding="utf-8"))
        assert saved["api"]["base_url"] == "http://localhost:9000"

    def test_config_unset_restores_default_value(self, tmp_path):
        """`pointer config unset` should reset fields to their defaults."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "test-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": False,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["config", "unset", "ui.show_diffs", "--config", str(config_path)])

        assert result.exit_code == 0
        saved = json.loads(config_path.read_text(encoding="utf-8"))
        assert saved["ui"]["show_diffs"] is True

    def test_config_edit_falls_back_to_printing_path(self, tmp_path, monkeypatch):
        """`pointer config edit` should print the config path if opening fails."""
        config_path = tmp_path / "config.json"
        monkeypatch.setattr("pointer_cli.main.os.startfile", lambda path: (_ for _ in ()).throw(OSError("nope")), raising=False)

        result = runner.invoke(app, ["config", "edit", "--config", str(config_path)])

        assert result.exit_code == 0
        assert str(config_path) in result.stdout

    def test_init_non_interactive_writes_config(self, tmp_path):
        """`pointer init --non-interactive` should create an initialized config."""
        config_path = tmp_path / "config.json"

        result = runner.invoke(
            app,
            [
                "init",
                "--non-interactive",
                "--config",
                str(config_path),
                "--api-base-url",
                "http://localhost:1234",
                "--model",
                "demo-model",
                "--manual",
                "--hide-ai-responses",
            ],
        )

        assert result.exit_code == 0
        saved = json.loads(config_path.read_text(encoding="utf-8"))
        assert saved["initialized"] is True
        assert saved["api"]["base_url"] == "http://localhost:1234"
        assert saved["api"]["model_name"] == "demo-model"
        assert saved["mode"]["auto_run_mode"] is False
        assert saved["ui"]["show_ai_responses"] is False

    def test_config_set_invalid_key_returns_config_exit_code(self, tmp_path):
        """Invalid config keys should return the config-specific exit code."""
        config_path = tmp_path / "config.json"

        result = runner.invoke(
            app,
            ["config", "set", "api.missing", "value", "--config", str(config_path)],
        )

        assert result.exit_code == EXIT_CONFIG_ERROR

    def test_init_cancel_returns_user_cancelled_exit_code(self, tmp_path):
        """Interactive init cancellation should use the user-cancelled exit code."""
        config_path = tmp_path / "config.json"

        result = runner.invoke(
            app,
            ["init", "--config", str(config_path)],
            input="n\n",
        )

        assert result.exit_code == EXIT_USER_CANCELLED

    def test_status_command_outputs_environment_summary(self, tmp_path):
        """`pointer status` should print a concise environment summary."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:7777",
                        "model_name": "status-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": False,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {
                        "auto_run_mode": False,
                    },
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["status", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "Pointer CLI Status" in result.stdout
        assert "status-model" in result.stdout
        assert "http://localhost:7777" in result.stdout

    def test_status_json_outputs_machine_readable_status(self, tmp_path):
        """`pointer status --json` should emit structured JSON."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:7777",
                        "model_name": "status-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": False,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": False},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["status", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["model"] == "status-model"
        assert payload["api_base_url"] == "http://localhost:7777"

    def test_doctor_json_outputs_machine_readable_result(self, tmp_path):
        """`pointer doctor --json` should emit structured JSON."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "json-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["doctor", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["summary"]["passing"] >= 1
        assert any(check["name"] == "Config validity" for check in payload["checks"])

    def test_doctor_invalid_config_returns_dependency_exit_code(self, tmp_path):
        """Invalid config should surface as a doctor failure in JSON mode."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "localhost:8000",
                        "model_name": "",
                        "api_key": None,
                        "timeout": 0,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["doctor", "--json", "--config", str(config_path)])

        assert result.exit_code == EXIT_DEPENDENCY_ERROR
        payload = json.loads(result.stdout)
        assert payload["summary"]["failures"] >= 1

    def test_doctor_fix_repairs_invalid_config(self, tmp_path):
        """`pointer doctor --fix --json` should repair safe config issues."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "localhost:8000",
                        "model_name": "",
                        "api_key": None,
                        "timeout": 0,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": False,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["doctor", "--fix", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["fixes"]
        saved = json.loads(config_path.read_text(encoding="utf-8"))
        assert saved["api"]["base_url"] == "http://localhost:8000"
        assert saved["api"]["model_name"] == "gpt-oss-20b"

    def test_context_show_outputs_summary(self, tmp_path, monkeypatch):
        """`pointer context show` should summarize indexed project files."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "app.py").write_text("print('hello')\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "context-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 0,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["context", "show", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "Pointer CLI Context" in result.stdout
        assert "Total files" in result.stdout

    def test_context_search_finds_file(self, tmp_path, monkeypatch):
        """`pointer context search` should find matches in file content previews."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "module.py").write_text("special_keyword = True\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "context-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 0,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["context", "search", "special_keyword", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "module.py" in result.stdout

    def test_context_files_lists_indexed_files(self, tmp_path, monkeypatch):
        """`pointer context files` should list indexed files and respect extension filters."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "module.py").write_text("print('x')\n", encoding="utf-8")
        (tmp_path / "notes.md").write_text("# hi\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "context-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py", ".md"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 0,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["context", "files", "--ext", ".py", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "module.py" in result.stdout
        assert "notes.md" not in result.stdout

    def test_context_rebuild_reindexes_files(self, tmp_path, monkeypatch):
        """`pointer context rebuild` should succeed and report indexed file count."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "module.py").write_text("print('x')\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "context-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["context", "rebuild", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "Context rebuilt" in result.stdout

    def test_context_stats_json_outputs_summary(self, tmp_path, monkeypatch):
        """`pointer context stats --json` should emit summary statistics."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "module.py").write_text("print('x')\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "context-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 0,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["context", "stats", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["total_files"] >= 1
        assert ".py" in payload["extensions"]

    def test_context_inspect_shows_preview(self, tmp_path, monkeypatch):
        """`pointer context inspect` should show a detailed preview for one file."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "module.py").write_text("special_keyword = True\nprint('hello')\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "context-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 0,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["context", "inspect", "module.py", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "Context File" in result.stdout
        assert "special_keyword = True" in result.stdout

    def test_context_inspect_json_outputs_structured_data(self, tmp_path, monkeypatch):
        """`pointer context inspect --json` should emit machine-readable file details."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "module.py").write_text("print('hello')\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "context-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 0,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["context", "inspect", "module.py", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["path"] == "module.py"
        assert payload["extension"] == ".py"

    def test_invalid_config_returns_config_exit_code_for_status(self, tmp_path):
        """Validated commands should stop with the config exit code."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "localhost:8000",
                        "model_name": "bad",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["status", "--config", str(config_path)])

        assert result.exit_code == EXIT_CONFIG_ERROR

    def test_chats_export_writes_markdown_file(self, tmp_path):
        """`pointer chats export` should write a markdown export."""
        config_path = tmp_path / "config.json"
        chats_dir = tmp_path / "chats"
        chats_dir.mkdir()
        chat_id = "chat_20260327_010000"
        (chats_dir / f"{chat_id}.json").write_text(
            json.dumps(
                {
                    "id": chat_id,
                    "title": "Demo Chat",
                    "created_at": "2026-03-27T01:00:00",
                    "last_modified": "2026-03-27T01:05:00",
                    "total_tokens": 42,
                    "messages": [
                        {
                            "role": "user",
                            "content": "Hello",
                            "timestamp": "2026-03-27T01:00:00",
                            "tokens_used": 10,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        output_path = tmp_path / "export.md"

        result = runner.invoke(
            app,
            ["chats", "export", chat_id, "--output", str(output_path), "--config", str(config_path)],
        )

        assert result.exit_code == 0
        assert output_path.exists()
        assert "Demo Chat" in output_path.read_text(encoding="utf-8")

    def test_chats_rename_updates_saved_chat(self, tmp_path):
        """`pointer chats rename` should update the saved chat title."""
        config_path = tmp_path / "config.json"
        chats_dir = tmp_path / "chats"
        chats_dir.mkdir()
        chat_id = "chat_20260327_010000"
        chat_path = chats_dir / f"{chat_id}.json"
        chat_path.write_text(
            json.dumps(
                {
                    "id": chat_id,
                    "title": "Old Title",
                    "created_at": "2026-03-27T01:00:00",
                    "last_modified": "2026-03-27T01:05:00",
                    "total_tokens": 42,
                    "messages": [],
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(
            app,
            ["chats", "rename", chat_id, "New Title", "--config", str(config_path)],
        )

        assert result.exit_code == 0
        saved = json.loads(chat_path.read_text(encoding="utf-8"))
        assert saved["title"] == "New Title"

    def test_chats_list_json_outputs_saved_chats(self, tmp_path):
        """`pointer chats list --json` should emit stored chat metadata."""
        config_path = tmp_path / "config.json"
        chats_dir = tmp_path / "chats"
        chats_dir.mkdir()
        chat_id = "chat_20260327_010000"
        (chats_dir / f"{chat_id}.json").write_text(
            json.dumps(
                {
                    "id": chat_id,
                    "title": "Demo Chat",
                    "created_at": "2026-03-27T01:00:00",
                    "last_modified": "2026-03-27T01:05:00",
                    "total_tokens": 42,
                    "messages": [],
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["chats", "list", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload[0]["id"] == chat_id

    def test_chats_delete_removes_saved_chat(self, tmp_path):
        """`pointer chats delete` should remove the chat file."""
        config_path = tmp_path / "config.json"
        chats_dir = tmp_path / "chats"
        chats_dir.mkdir()
        chat_id = "chat_20260327_010000"
        chat_path = chats_dir / f"{chat_id}.json"
        chat_path.write_text(
            json.dumps(
                {
                    "id": chat_id,
                    "title": "Demo Chat",
                    "created_at": "2026-03-27T01:00:00",
                    "last_modified": "2026-03-27T01:05:00",
                    "total_tokens": 42,
                    "messages": [],
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["chats", "delete", chat_id, "--config", str(config_path)])

        assert result.exit_code == 0
        assert not chat_path.exists()

    def test_chats_current_json_outputs_latest_chat(self, tmp_path):
        """`pointer chats current --json` should return the most recently modified chat."""
        config_path = tmp_path / "config.json"
        chats_dir = tmp_path / "chats"
        chats_dir.mkdir()
        older_id = "chat_older"
        newer_id = "chat_newer"
        (chats_dir / f"{older_id}.json").write_text(
            json.dumps(
                {
                    "id": older_id,
                    "title": "Older Chat",
                    "created_at": "2026-03-27T01:00:00",
                    "last_modified": "2026-03-27T01:05:00",
                    "total_tokens": 1,
                    "messages": [],
                }
            ),
            encoding="utf-8",
        )
        (chats_dir / f"{newer_id}.json").write_text(
            json.dumps(
                {
                    "id": newer_id,
                    "title": "Newer Chat",
                    "created_at": "2026-03-27T02:00:00",
                    "last_modified": "2026-03-27T02:05:00",
                    "total_tokens": 2,
                    "messages": [],
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["chats", "current", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["id"] == newer_id

    def test_models_command_lists_configured_model(self, tmp_path):
        """`pointer models` should always show the configured model."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "demo-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["models", "--config", str(config_path)])

        assert result.exit_code == 0
        assert "demo-model" in result.stdout

    def test_models_json_outputs_configured_model(self, tmp_path):
        """`pointer models --json` should emit machine-readable model data."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "demo-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["models", "--json", "--config", str(config_path)])

        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["configured_model"] == "demo-model"

    def test_ping_command_returns_dependency_error_when_unreachable(self, tmp_path):
        """`pointer ping` should use the dependency exit code on failure."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:65530",
                        "model_name": "demo-model",
                        "api_key": None,
                        "timeout": 1,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["ping", "--config", str(config_path)])

        assert result.exit_code == EXIT_DEPENDENCY_ERROR

    def test_ping_json_outputs_error_payload_when_unreachable(self, tmp_path):
        """`pointer ping --json` should emit structured failure details."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:65530",
                        "model_name": "demo-model",
                        "api_key": None,
                        "timeout": 1,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        result = runner.invoke(app, ["ping", "--json", "--config", str(config_path)])

        assert result.exit_code == EXIT_DEPENDENCY_ERROR
        payload = json.loads(result.stdout)
        assert payload["ok"] is False

    def test_complete_config_keys_suggests_matching_dotted_keys(self):
        """Config key completion should return matching dotted keys."""
        ctx = SimpleNamespace(params={"config_path": None})

        completions = _complete_config_keys(ctx, "api.")

        assert "api.base_url" in completions
        assert "api.model_name" in completions

    def test_complete_config_values_uses_current_field_type(self, tmp_path):
        """Value completion should offer boolean and current-value suggestions."""
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8080",
                        "model_name": "demo-model",
                        "api_key": None,
                        "timeout": 15,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": [".git"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )

        bool_ctx = SimpleNamespace(params={"config_path": str(config_path), "key_path": "ui.show_diffs"})
        text_ctx = SimpleNamespace(params={"config_path": str(config_path), "key_path": "api.base_url"})

        assert _complete_config_values(bool_ctx, "t") == ["true"]
        assert _complete_config_values(text_ctx, "http://loc") == ["http://localhost:8080"]

    def test_complete_context_query_uses_indexed_files(self, tmp_path, monkeypatch):
        """Context query completion should suggest filenames and relative paths."""
        (tmp_path / ".git").mkdir()
        (tmp_path / "services").mkdir()
        (tmp_path / "services" / "api.py").write_text("print('api')\n", encoding="utf-8")
        config_path = tmp_path / "config.json"
        config_path.write_text(
            json.dumps(
                {
                    "api": {
                        "base_url": "http://localhost:8000",
                        "model_name": "demo-model",
                        "api_key": None,
                        "timeout": 30,
                        "max_retries": 3,
                    },
                    "ui": {
                        "show_ai_responses": True,
                        "show_thinking": True,
                        "show_tool_outputs": True,
                        "show_diffs": True,
                        "render_markdown": True,
                        "theme": "default",
                        "max_output_lines": 100,
                    },
                    "mode": {"auto_run_mode": True},
                    "codebase": {
                        "include_context": True,
                        "max_context_files": 20,
                        "context_file_types": [".py"],
                        "exclude_patterns": ["node_modules"],
                        "context_depth": 3,
                        "auto_refresh_context": False,
                        "context_cache_duration": 3600,
                    },
                    "initialized": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.chdir(tmp_path)
        ctx = SimpleNamespace(params={"config_path": str(config_path)})

        completions = _complete_context_query(ctx, "ser")

        assert "services/api.py" in completions
