# Immersive Translate - VSCode

Immersive translation for VSCode — displays inline translations alongside original text.

## Get Started

`Cmd+Shift+P` → `Immersive Translate: Toggle` — works out of the box (defaults to google-free, no config needed).

Other providers:

- **API key**: openai / deepseek / gemini, or custom for any OpenAI-compatible endpoint
- **AWS SSO**: bedrock — set region (required), profile, model ID

All settings: `Cmd+,` → search `immersive-translate`.

## Development

```bash
pnpm install
```

F5 to launch.

## Acknowledgements

Inspired by [Immersive Translate](https://github.com/immersive-translate/immersive-translate/) and [vscode-immersive-translate-plugin](https://github.com/chengjingtao/vscode-immersive-translate-plugin).
