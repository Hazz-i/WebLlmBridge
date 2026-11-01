# Changelog

All notable changes to WebLlmBridge are documented here.

## [1.0.0] - 2026-11-01

### Added
- Initial release of WebLlmBridge for Hermes Agent.
- Reverse Web-to-API Bridge transforming free browser AI chats (Claude.ai, ChatGPT, Gemini, etc.) into an OpenAI-compatible API (`/v1/chat/completions` and `/v1/models` on port `17614`).
- Support for Cloudflare Quick Tunnel (`run_tunnel.sh` / `run_tunnel.bat`) for remote Hermes servers.
- Browser extension for automated tab DOM interaction.
