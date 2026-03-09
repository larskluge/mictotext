# mictotext

Record audio from your Mac microphone and transcribe it locally using [whisperkit-cli](https://github.com/argmaxinc/WhisperKit).

## Prerequisites

- **ffmpeg** — for recording audio from the microphone
  ```bash
  brew install ffmpeg
  ```
- **whisperkit-cli** — for local transcription
  ```bash
  brew install whisperkit-cli
  ```
  For other installation methods see [WhisperKit Installation](https://github.com/argmaxinc/WhisperKit?tab=readme-ov-file#installation).

## Usage

```bash
mictotext                  # record and transcribe
mictotext serve            # start the whisperkit-cli server
mictotext version          # show version
mictotext help             # show help
```

Press Ctrl-C once to stop recording and transcribe. Press Ctrl-C again to abort.

## Versioning

Version is derived from git tags and commit count:

```
MAJOR.MINOR.PATCH[-dirty]
```

- **MAJOR.MINOR** comes from the latest `v*` tag (e.g. `v0.1` → 0.1)
- **PATCH** is the number of commits since that tag
- **-dirty** is appended when the working tree has uncommitted changes

To bump the version:

```bash
git tag v0.2              # patch resets to 0
npm run version:sync      # update package.json to match
```
