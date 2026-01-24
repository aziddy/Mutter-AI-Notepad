#!/usr/bin/env python3
# Thread optimization - MUST come before any other imports
import os
os.environ['OMP_NUM_THREADS'] = '8'
os.environ['MKL_NUM_THREADS'] = '8'
os.environ['KMP_BLOCKTIME'] = '1'

# Fix for PyTorch 2.6+ compatibility MUST come before any other imports
import torch
torch.set_num_threads(8)
import torch.serialization
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load
torch.serialization.load = _patched_torch_load

"""
Pyannote Speaker Diarization Runner (No Transcription)
Processes audio files and outputs JSON with speaker segments only.

This is designed to work with whisper.cpp for a hybrid pipeline:
- whisper.cpp handles transcription (with Metal GPU on Mac)
- pyannote handles speaker diarization (CPU - MPS not reliably supported)

Usage:
    python run_pyannote.py <audio_file> [--hf-token <token>]

Output Format (JSON):
{
    "success": true,
    "segments": [
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 2.5},
        {"speaker": "SPEAKER_01", "start": 2.5, "end": 5.0}
    ],
    "speakers": ["SPEAKER_00", "SPEAKER_01"],
    "metadata": {...}
}
"""

import argparse
import json
import logging
import os
import sys
import warnings
from pathlib import Path

# Suppress warnings
warnings.filterwarnings("ignore")

# Configure logging to stderr only
logging.basicConfig(
    level=logging.WARNING,
    format='%(message)s',
    stream=sys.stderr,
    force=True,
)

for logger_name in ['speechbrain', 'pytorch_lightning', 'pyannote', 'transformers']:
    logging.getLogger(logger_name).setLevel(logging.WARNING)


def run_diarization(
    audio_path: str,
    output_path: str = None,
    hf_token: str = None,
    min_speakers: int = None,
    max_speakers: int = None,
):
    """
    Run speaker diarization using pyannote.audio.

    Args:
        audio_path: Path to audio file
        output_path: Optional path for JSON output (defaults to stdout)
        hf_token: Hugging Face token for pyannote models (required)
        min_speakers: Minimum number of speakers (optional hint)
        max_speakers: Maximum number of speakers (optional hint)
    """
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

    # Get HF token
    hf_token = hf_token or os.environ.get("HF_TOKEN")
    if not hf_token:
        error_result = {
            "success": False,
            "error": "AuthenticationError",
            "message": "HF_TOKEN is required for pyannote models. Set via --hf-token or HF_TOKEN env var.",
        }
        _output_result(error_result, output_path)
        sys.exit(1)

    try:
        from pyannote.audio import Pipeline

        print("Loading pyannote speaker-diarization-3.1 pipeline...", file=sys.stderr)
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=hf_token,
        )

        # Force CPU - MPS is not reliably supported
        device = torch.device("cpu")
        pipeline.to(device)
        print(f"Using device: {device}", file=sys.stderr)

        print(f"Processing audio: {audio_path}", file=sys.stderr)

        # Run diarization with optional speaker hints
        diarization_params = {}
        if min_speakers is not None:
            diarization_params["min_speakers"] = min_speakers
        if max_speakers is not None:
            diarization_params["max_speakers"] = max_speakers

        if diarization_params:
            print(f"Speaker hints: {diarization_params}", file=sys.stderr)

        result = pipeline(audio_path, **diarization_params)

        # Convert to segments list
        segments = []
        speakers_set = set()

        # Handle pyannote.audio 4.x output format (DiarizeOutput object)
        if hasattr(result, 'speaker_diarization'):
            # pyannote.audio 4.x - access the Annotation via .speaker_diarization
            diarization = result.speaker_diarization
        else:
            # pyannote.audio 3.x - result is already an Annotation
            diarization = result

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "speaker": speaker,
                "start": turn.start,
                "end": turn.end,
            })
            speakers_set.add(speaker)

        speakers = sorted(list(speakers_set))
        print(f"Found {len(speakers)} speakers: {speakers}", file=sys.stderr)
        print(f"Generated {len(segments)} segments", file=sys.stderr)

        output = {
            "success": True,
            "segments": segments,
            "speakers": speakers,
            "metadata": {
                "audio_file": str(audio_path),
                "device": str(device),
                "num_segments": len(segments),
                "num_speakers": len(speakers),
                "min_speakers_hint": min_speakers,
                "max_speakers_hint": max_speakers,
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
        description="Run pyannote speaker diarization (no transcription)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_pyannote.py audio.wav
  python run_pyannote.py audio.wav --hf-token hf_xxxxx
  python run_pyannote.py audio.wav --min-speakers 2 --max-speakers 4

Environment:
  HF_TOKEN - Hugging Face token for pyannote models (required)
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
        "--min-speakers", type=int, help="Minimum number of speakers (optional)"
    )
    parser.add_argument(
        "--max-speakers", type=int, help="Maximum number of speakers (optional)"
    )

    args = parser.parse_args()

    run_diarization(
        audio_path=args.audio_file,
        output_path=args.output,
        hf_token=args.hf_token,
        min_speakers=args.min_speakers,
        max_speakers=args.max_speakers,
    )


if __name__ == "__main__":
    main()
