# Whisper CLI Flags for Better Transcriptions

## Problem

Whisper.cpp can produce repeated/hallucinated words, especially on audio with pauses, background noise, or unclear speech. The decoder enters repetition loops where it generates the same tokens over and over.

## Flags We Use (in `src/transcription.js`)

| Flag | Value | Default | Purpose |
|------|-------|---------|---------|
| `-sns` (`--suppress-nst`) | enabled | off | Suppresses non-speech tokens. Primary fix for hallucinated/repeated text. |
| `-et` (`--entropy-thold`) | `2.0` | `2.40` | Entropy threshold for decoder fail. Lower value triggers temperature fallback sooner when the model is uncertain, breaking repetition loops earlier. |
| `-lpt` (`--logprob-thold`) | `-0.5` | `-1.00` | Log probability threshold for decoder fail. Higher value rejects low-confidence segments that correlate with garbage output. |
| `-bs` (`--beam-size`) | `8` | `5` | Number of candidates explored during beam search. More candidates = better accuracy at slight speed cost. |

## Other Flags Worth Knowing

| Flag | Default | Notes |
|------|---------|-------|
| `--prompt PROMPT` | empty | Initial prompt to anchor the model's vocabulary and style. Useful for domain-specific audio (e.g., medical, legal terms). Max `n_text_ctx/2` tokens. |
| `--no-fallback` (`-nf`) | off | Disables temperature fallback on decoder fail. Generally keep this OFF — fallback helps recover from bad segments. |
| `--temperature` (`-tp`) | `0.00` | Sampling temperature. 0.0 = deterministic (greedy). Already optimal for accuracy. |
| `--temperature-inc` (`-tpi`) | `0.20` | How much to increase temperature on each fallback retry. Default is fine. |
| `--best-of` (`-bo`) | `5` | Number of best candidates to keep. Increasing adds compute cost with diminishing returns. |
| `--max-len` (`-ml`) | `0` (unlimited) | Maximum segment length in characters. Setting this (e.g., `50`) can prevent runaway segments. |
| `--word-thold` (`-wt`) | `0.01` | Word timestamp probability threshold. Affects timestamp precision, not transcription content. |
| `--no-speech-thold` (`-nth`) | `0.60` | Threshold for detecting non-speech segments. Raise to be more aggressive at skipping silence. |
| `--suppress-regex REGEX` | empty | Suppress tokens matching a regex pattern. Could target specific repetition patterns. |

## Audio Conversion Settings

The audio is converted to WAV before transcription with these settings (in `convertToWav()`):
- **Sample rate**: 16000 Hz (required by Whisper)
- **Channels**: 1 (mono)
- **Codec**: pcm_s16le (16-bit signed little-endian PCM)

These are already optimal for Whisper and should not be changed.

## Full Flag Reference

See `docs/available-whisper-cli-commands.txt` for the complete list of whisper-cli options.
