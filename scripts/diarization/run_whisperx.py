#!/usr/bin/env python3
# Fix for PyTorch 2.6+ compatibility MUST come before any other imports
# PyTorch 2.6 changed weights_only default to True, breaking pyannote model loading
# lightning_fabric explicitly passes weights_only=True, so we force it to False
import torch
import torch.serialization
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs['weights_only'] = False  # Force False for pyannote compatibility
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load
torch.serialization.load = _patched_torch_load

"""
WhisperX Diarization Runner
Processes audio files and outputs JSON with speaker assignments.

Usage:
    python run_whisperx.py <audio_file> [--output <output_file>] [--hf-token <token>]

Environment Variables:
    HF_TOKEN: Hugging Face token for pyannote models (required for diarization)

Output Format (JSON):
{
    "success": true,
    "text": "full transcription text",
    "segments": [
        {
            "start": 0.0,
            "end": 2.5,
            "text": "Hello, how are you?",
            "speaker": "SPEAKER_00",
            "words": [...]
        }
    ],
    "speakers": ["SPEAKER_00", "SPEAKER_01"],
    "language": "en",
    "metadata": {
        "model": "large-v2",
        "diarization_enabled": true,
        "compute_type": "int8",
        "device": "cpu"
    }
}
"""

import argparse
import json
import logging
import os
import sys
import warnings
from pathlib import Path

# Suppress all warnings (they go to stderr anyway but clutter output)
warnings.filterwarnings("ignore")

# Redirect all library loggers to stderr (whisperx logs to stdout by default)
logging.basicConfig(
    level=logging.WARNING,  # Only warnings and errors
    format='%(message)s',
    stream=sys.stderr,
    force=True,
)

# Suppress verbose library loggers
for logger_name in ['speechbrain', 'pytorch_lightning', 'pyannote', 'whisperx', 'transformers']:
    logging.getLogger(logger_name).setLevel(logging.WARNING)


def run_diarization(
    audio_path: str,
    output_path: str = None,
    hf_token: str = None,
    model: str = "large-v2",
    device: str = "cpu",
    compute_type: str = "int8",
    batch_size: int = 16,
):
    """
    Run WhisperX transcription with speaker diarization.

    Args:
        audio_path: Path to audio file
        output_path: Optional path for JSON output (defaults to stdout)
        hf_token: Hugging Face token for pyannote models
        model: Whisper model to use (default: large-v2)
        device: Device to use (cpu or cuda)
        compute_type: Compute type for inference (int8, float16, float32)
        batch_size: Batch size for transcription
    """
    # Try to import whisperx
    try:
        import whisperx
    except ImportError:
        error_result = {
            "success": False,
            "error": "ImportError",
            "message": "WhisperX not installed. Please run: pip install whisperx",
        }
        _output_result(error_result, output_path)
        sys.exit(1)

    # Validate audio file exists
    audio_file = Path(audio_path)
    if not audio_file.exists():
        error_result = {
            "success": False,
            "error": "FileNotFoundError",
            "message": f"Audio file not found: {audio_path}",
        }
        _output_result(error_result, output_path)
        sys.exit(1)

    # Get HF token from arg or environment
    hf_token = hf_token or os.environ.get("HF_TOKEN")
    diarization_enabled = bool(hf_token)

    if not hf_token:
        print(
            "Warning: No HF_TOKEN provided. Diarization will be disabled.",
            file=sys.stderr,
        )

    try:
        # Load model
        print(f"Loading WhisperX model: {model} (device={device}, compute_type={compute_type})", file=sys.stderr)
        whisper_model = whisperx.load_model(
            model,
            device,
            compute_type=compute_type
        )

        # Load audio
        print(f"Loading audio: {audio_path}", file=sys.stderr)
        audio = whisperx.load_audio(audio_path)

        # Transcribe
        print("Transcribing...", file=sys.stderr)
        result = whisper_model.transcribe(audio, batch_size=batch_size)

        detected_language = result.get("language", "en")
        print(f"Detected language: {detected_language}", file=sys.stderr)

        # Align whisper output for word-level timestamps
        print("Aligning timestamps...", file=sys.stderr)
        model_a, metadata = whisperx.load_align_model(
            language_code=detected_language,
            device=device,
        )
        result = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )

        # Diarize if token available
        speakers = []
        if diarization_enabled:
            print("Running speaker diarization...", file=sys.stderr)
            try:
                from whisperx.diarize import DiarizationPipeline
                diarize_model = DiarizationPipeline(
                    use_auth_token=hf_token,
                    device=device,
                )
                diarize_segments = diarize_model(audio)
                result = whisperx.assign_word_speakers(diarize_segments, result)

                # Extract unique speakers
                speakers = list(
                    set(
                        seg.get("speaker", "UNKNOWN")
                        for seg in result.get("segments", [])
                        if seg.get("speaker")
                    )
                )
                speakers.sort()
                print(f"Found {len(speakers)} speakers: {speakers}", file=sys.stderr)
            except Exception as e:
                print(f"Warning: Diarization failed: {e}", file=sys.stderr)
                print("Continuing without speaker labels...", file=sys.stderr)
        else:
            print("Skipping diarization (no HF_TOKEN)", file=sys.stderr)

        # Build output
        segments = result.get("segments", [])
        full_text = " ".join(seg.get("text", "").strip() for seg in segments)

        output = {
            "success": True,
            "text": full_text,
            "segments": segments,
            "speakers": speakers,
            "language": detected_language,
            "metadata": {
                "model": model,
                "diarization_enabled": diarization_enabled,
                "compute_type": compute_type,
                "device": device,
                "audio_file": str(audio_path),
                "num_segments": len(segments),
                "num_speakers": len(speakers),
            },
        }

        _output_result(output, output_path)
        print("Diarization complete!", file=sys.stderr)

    except Exception as e:
        error_result = {
            "success": False,
            "error": type(e).__name__,
            "message": str(e),
        }
        _output_result(error_result, output_path)
        sys.exit(1)


def _output_result(result: dict, output_path: str = None):
    """Output result as JSON to file or stdout."""
    json_str = json.dumps(result, indent=2, ensure_ascii=False)
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json_str)
        print(f"Output written to: {output_path}", file=sys.stderr)
    else:
        print(json_str)


def main():
    parser = argparse.ArgumentParser(
        description="Run WhisperX transcription with speaker diarization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_whisperx.py audio.wav
  python run_whisperx.py audio.wav --output result.json
  python run_whisperx.py audio.wav --hf-token hf_xxxxx --model large-v3

Environment:
  HF_TOKEN - Hugging Face token for pyannote diarization models
        """,
    )
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument(
        "--output", "-o", help="Output JSON file path (default: stdout)"
    )
    parser.add_argument(
        "--hf-token", help="Hugging Face token (or set HF_TOKEN env var)"
    )
    parser.add_argument(
        "--model",
        default="large-v2",
        help="Whisper model: tiny, base, small, medium, large-v2, large-v3 (default: large-v2)",
    )
    parser.add_argument(
        "--device", default="cpu", help="Device: cpu or cuda (default: cpu)"
    )
    parser.add_argument(
        "--compute-type",
        default="int8",
        help="Compute type: int8, float16, float32 (default: int8)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Batch size for transcription (default: 16)",
    )

    args = parser.parse_args()

    run_diarization(
        audio_path=args.audio_file,
        output_path=args.output,
        hf_token=args.hf_token,
        model=args.model,
        device=args.device,
        compute_type=args.compute_type,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    main()
