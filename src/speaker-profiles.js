const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class SpeakerProfileService {
  constructor() {
    this.data = {
      version: 1,
      config: {
        similarityThreshold: 0.75
      },
      profiles: []
    };
    this.loadProfiles();
  }

  loadProfiles() {
    try {
      const filePath = path.join(process.cwd(), 'speaker-profiles.json');
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.data = { ...this.data, ...raw };
      }
    } catch (error) {
      console.warn('Failed to load speaker profiles:', error);
    }
  }

  saveProfiles() {
    try {
      const filePath = path.join(process.cwd(), 'speaker-profiles.json');
      fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save speaker profiles:', error);
    }
  }

  getConfig() {
    return this.data.config;
  }

  updateConfig(partialConfig) {
    this.data.config = { ...this.data.config, ...partialConfig };
    this.saveProfiles();
    return { success: true, message: 'Speaker profiles config updated' };
  }

  getProfiles() {
    return this.data.profiles;
  }

  getProfile(id) {
    return this.data.profiles.find(p => p.id === id) || null;
  }

  /**
   * Create a new speaker profile from embedding data.
   * @param {string} displayName
   * @param {Array} embeddings - Array of embedding chunks for this speaker
   * @param {string} transcriptionFolder
   * @param {string} speakerId - e.g. "SPEAKER_00"
   * @returns {Object} The created profile
   */
  createProfile(displayName, embeddings, transcriptionFolder, speakerId) {
    const centroid = this._computeCentroid(embeddings.map(e => e.embedding256));
    const now = new Date().toISOString();
    const profile = {
      id: `sp_${crypto.randomBytes(6).toString('hex')}`,
      displayName,
      centroid,
      sampleCount: embeddings.length,
      appearances: [{
        transcriptionFolder,
        speakerId,
        matchConfidence: 1.0,
        confirmedByUser: true
      }],
      createdAt: now,
      updatedAt: now
    };

    this.data.profiles.push(profile);
    this.saveProfiles();
    return profile;
  }

  /**
   * Update a profile's display name or other fields.
   */
  updateProfile(id, updates) {
    const profile = this.getProfile(id);
    if (!profile) {
      return { success: false, message: 'Profile not found' };
    }
    if (updates.displayName !== undefined) {
      profile.displayName = updates.displayName;
    }
    profile.updatedAt = new Date().toISOString();
    this.saveProfiles();
    return { success: true, message: 'Profile updated' };
  }

  deleteProfile(id) {
    const idx = this.data.profiles.findIndex(p => p.id === id);
    if (idx === -1) {
      return { success: false, message: 'Profile not found' };
    }
    this.data.profiles.splice(idx, 1);
    this.saveProfiles();
    return { success: true, message: 'Profile deleted' };
  }

  /**
   * Merge two profiles. Combines centroids weighted by sample count.
   * Profile B is merged into Profile A. Profile B is deleted.
   */
  mergeProfiles(idA, idB) {
    const a = this.getProfile(idA);
    const b = this.getProfile(idB);
    if (!a || !b) {
      return { success: false, message: 'One or both profiles not found' };
    }

    // Weighted centroid merge
    const totalSamples = a.sampleCount + b.sampleCount;
    const merged = new Float64Array(256);
    for (let i = 0; i < 256; i++) {
      merged[i] = (a.centroid[i] * a.sampleCount + b.centroid[i] * b.sampleCount) / totalSamples;
    }
    a.centroid = Array.from(this._l2Normalize(merged));
    a.sampleCount = totalSamples;
    a.appearances = [...a.appearances, ...b.appearances];
    a.updatedAt = new Date().toISOString();

    // Remove profile B
    this.data.profiles = this.data.profiles.filter(p => p.id !== idB);
    this.saveProfiles();
    return { success: true, profile: a };
  }

  /**
   * Update a profile's centroid with new embedding data (running weighted average).
   */
  updateCentroid(profileId, newEmbeddings) {
    const profile = this.getProfile(profileId);
    if (!profile) return;

    const newCentroid = this._computeCentroid(newEmbeddings.map(e => e.embedding256));
    const newCount = newEmbeddings.length;
    const totalSamples = profile.sampleCount + newCount;

    const merged = new Float64Array(256);
    for (let i = 0; i < 256; i++) {
      merged[i] = (profile.centroid[i] * profile.sampleCount + newCentroid[i] * newCount) / totalSamples;
    }

    profile.centroid = Array.from(this._l2Normalize(merged));
    profile.sampleCount = totalSamples;
    profile.updatedAt = new Date().toISOString();
    this.saveProfiles();
  }

  /**
   * Confirm a speaker match: update centroid, add appearance, return updated profile.
   */
  confirmMatch(profileId, transcriptionFolder, speakerId, embeddings) {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return { success: false, message: 'Profile not found' };
    }

    // Update centroid with new embeddings
    if (embeddings && embeddings.length > 0) {
      this.updateCentroid(profileId, embeddings);
    }

    // Add appearance
    const newCentroid = embeddings && embeddings.length > 0
      ? this._computeCentroid(embeddings.map(e => e.embedding256))
      : null;
    const similarity = newCentroid
      ? this._dotProduct(newCentroid, profile.centroid)
      : 0;

    profile.appearances.push({
      transcriptionFolder,
      speakerId,
      matchConfidence: similarity,
      confirmedByUser: true
    });

    profile.updatedAt = new Date().toISOString();
    this.saveProfiles();
    return { success: true, profile };
  }

  /**
   * Match new speaker embeddings against stored profiles.
   * @param {Object} clusterEmbeddings - { clusterId: embeddings[] }
   * @returns {Array} Match suggestions sorted by similarity
   */
  matchSpeakers(clusterEmbeddings) {
    const profiles = this.data.profiles;
    if (profiles.length === 0) return [];

    const threshold = this.data.config.similarityThreshold;

    // Compute centroid for each cluster
    const clusterCentroids = {};
    for (const [clusterId, embeddings] of Object.entries(clusterEmbeddings)) {
      clusterCentroids[clusterId] = this._computeCentroid(
        embeddings.map(e => e.embedding256)
      );
    }

    // Find all above-threshold matches
    const candidates = [];
    for (const [clusterId, centroid] of Object.entries(clusterCentroids)) {
      for (const profile of profiles) {
        const similarity = this._dotProduct(centroid, profile.centroid);
        if (similarity >= threshold) {
          candidates.push({
            transcriptionSpeakerId: clusterId,
            profileId: profile.id,
            profileName: profile.displayName,
            similarity
          });
        }
      }
    }

    // Greedy assignment: highest similarity first, each cluster and profile matched at most once
    candidates.sort((a, b) => b.similarity - a.similarity);
    const usedClusters = new Set();
    const usedProfiles = new Set();
    const matches = [];

    for (const c of candidates) {
      if (!usedClusters.has(c.transcriptionSpeakerId) && !usedProfiles.has(c.profileId)) {
        matches.push(c);
        usedClusters.add(c.transcriptionSpeakerId);
        usedProfiles.add(c.profileId);
      }
    }

    return matches;
  }

  /**
   * Group raw embedding chunks by their cluster (speaker) assignment.
   * @param {Array} embeddings - Raw embedding chunks from FluidAudio
   * @param {Object} speakerIdMap - Maps cluster index to SPEAKER_XX IDs
   * @returns {Object} { "SPEAKER_00": [embeddings...], "SPEAKER_01": [embeddings...] }
   */
  groupEmbeddingsByCluster(embeddings, speakers) {
    if (!embeddings || embeddings.length === 0) return {};

    const groups = {};
    for (const emb of embeddings) {
      // Map cluster index to SPEAKER_XX format
      const speakerId = `SPEAKER_${String(emb.cluster).padStart(2, '0')}`;
      if (!groups[speakerId]) groups[speakerId] = [];
      groups[speakerId].push(emb);
    }
    return groups;
  }

  // --- Internal helpers ---

  _computeCentroid(vectors) {
    if (!vectors || vectors.length === 0) return new Array(256).fill(0);

    const dim = vectors[0].length;
    const mean = new Float64Array(dim);
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        mean[i] += vec[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      mean[i] /= vectors.length;
    }
    return Array.from(this._l2Normalize(mean));
  }

  _l2Normalize(vec) {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }
    return vec;
  }

  _dotProduct(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }
}

module.exports = { SpeakerProfileService };
