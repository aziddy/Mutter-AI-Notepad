# Improving FluidAudio Speaker Diarization Accuracy

This document covers tuning parameters and strategies for improving speaker diarization accuracy with FluidAudio.

## Current Performance Baseline

| Metric | Value |
|--------|-------|
| DER (Diarization Error Rate) | 15-17% |
| Speed | ~95x real-time |
| Backend | CoreML / Apple Neural Engine |

## Key Parameters

All parameters are defined in `OfflineDiarizerConfig` ([OfflineDiarizerTypes.swift](../scripts/diarization/FluidAudio/Sources/FluidAudio/Diarizer/Offline/Core/OfflineDiarizerTypes.swift)).

### Clustering Threshold

Controls how aggressively speaker embeddings are merged.

| Value | Effect |
|-------|--------|
| Lower (e.g., 0.6) | More conservative - may over-split (same speaker → multiple IDs) |
| Higher (e.g., 0.8) | More aggressive - may over-merge (different speakers → same ID) |

**Current defaults:**
- Swift default: `0.6` (community-1 pipeline)
- CLI default: `0.7045655` (PyAnnote tuned)

**Recommendation:** For over-splitting issues, increase to `0.75-0.80`.

### Step Ratio (Segmentation)

Controls temporal resolution of frame processing.

| Value | Speed | Accuracy |
|-------|-------|----------|
| 0.1 | Slower (~50x RTF) | Best (~1.4% better DER) |
| 0.2 | Faster (~95x RTF) | Good (current default) |
| 0.5 | Fastest | Reduced accuracy |

**Current default:** `0.2`

**Recommendation:** Use `0.1` when accuracy is priority.

### Minimum Duration Parameters

Prevent rapid "flickering" between speakers.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minDurationOn` | 0.0 | Minimum speaker segment duration (seconds) |
| `minDurationOff` | 0.0 | Minimum silence between speakers (seconds) |
| `minGapDuration` | 0.1 | Minimum gap before merging adjacent segments |

**Recommendation:** Set `minDurationOn: 0.1` and `minDurationOff: 0.1` for cleaner boundaries.

### Speaker Count Constraints

When you know the expected number of speakers:

```swift
// Exact count (e.g., 2-person interview)
config.withSpeakers(exactly: 2)

// Range (e.g., panel discussion)
config.withSpeakers(min: 2, max: 5)
```

**Note:** `numSpeakers` takes precedence over `min`/`max` when set.

### Embedding Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minSegmentDurationSeconds` | 1.0 | Minimum segment length for embedding extraction |
| `excludeOverlap` | true | Exclude overlapping speech regions |
| `batchSize` | 32 | Max embeddings per batch (PLDA limit) |

**Recommendation:** Increase `minSegmentDurationSeconds` to `1.5` for better quality embeddings.

## Accuracy Mode Configuration

For maximum accuracy (trading speed):

```swift
let accuracyConfig = OfflineDiarizerConfig(
    clusteringThreshold: 0.75,           // Less over-splitting
    segmentationStepRatio: 0.1,          // Finer temporal resolution
    segmentationMinDurationOn: 0.1,      // 100ms minimum segments
    segmentationMinDurationOff: 0.1,     // 100ms minimum gaps
    minGapDuration: 0.2                  // Merge close segments
)
```

**Expected results:**
| Metric | Standard | Accuracy Mode |
|--------|----------|---------------|
| DER | 15-17% | ~12-14% |
| Speed | 95x RTF | ~40-50x RTF |
| Boundary precision | ~160ms | ~80ms |

## CLI Usage

Current CLI options:
```bash
fluidaudiocli process audio.wav --mode offline \
    --threshold 0.75 \
    --output results.json
```

## Common Issues and Solutions

### Over-Splitting (Same Speaker → Multiple IDs)

**Symptoms:** Single speaker labeled as SPEAKER_00, SPEAKER_01, SPEAKER_02

**Solutions:**
1. Increase `clusteringThreshold` (e.g., 0.75-0.80)
2. Set `minSpeakers`/`maxSpeakers` constraints
3. Increase `minSegmentDurationSeconds` for better embeddings

### Poor Boundary Detection

**Symptoms:** Speaker changes detected too early/late

**Solutions:**
1. Reduce `stepRatio` to 0.1 (finer frame resolution)
2. Set `minDurationOn` and `minDurationOff` to 0.1

### Over-Merging (Different Speakers → Same ID)

**Symptoms:** Two distinct speakers labeled as one

**Solutions:**
1. Decrease `clusteringThreshold` (e.g., 0.6)
2. Set `minSpeakers` constraint if known

## VBx Refinement Parameters

For fine-tuning the Variational Bayes clustering:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `warmStartFa` | 0.07 | Precision control |
| `warmStartFb` | 0.8 | Recall control |
| `maxIterations` | 20 | EM iterations |
| `convergenceTolerance` | 1e-4 | Convergence criterion |

These are tuned for PyAnnote community-1 and rarely need adjustment.

## Comparison with PyAnnote

| Aspect | FluidAudio | PyAnnote |
|--------|------------|----------|
| Speed | ~50-95x RTF | ~1x RTF |
| DER | 15-17% | 7-12% |
| Platform | macOS only | Cross-platform |
| Hardware | CoreML/ANE | CPU/GPU |
| Dependencies | None (native) | Python + torch |

FluidAudio prioritizes speed for local, real-time use cases. For maximum accuracy requirements, consider PyAnnote.

## References

- [OfflineDiarizerTypes.swift](../scripts/diarization/FluidAudio/Sources/FluidAudio/Diarizer/Offline/Core/OfflineDiarizerTypes.swift) - Configuration types
- [ProcessCommand.swift](../scripts/diarization/FluidAudio/Sources/FluidAudioCLI/Commands/ProcessCommand.swift) - CLI implementation
- [run_fluidaudio.js](../scripts/diarization/run_fluidaudio.js) - Node.js wrapper
