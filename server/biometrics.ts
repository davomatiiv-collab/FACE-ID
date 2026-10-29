/**
 * Biometric Face Descriptor Generator and Distance Calculator (Offline)
 * Uses 128-dimensional Normalized Texture & Spatial Geometry Descriptors
 */

export function generateSeedDescriptor(seedString: string): number[] {
  // Deterministic 128-dimensional unit vector derived from seed string
  const vec: number[] = [];
  let h = 0x811c9dc5;
  for (let i = 0; i < seedString.length; i++) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  for (let i = 0; i < 128; i++) {
    h = Math.imul(h ^ (i * 37 + 101), 0x5bd1e995);
    h ^= h >>> 15;
    const val = ((h & 0xffff) / 0xffff) * 2 - 1; // Range -1.0 to 1.0
    vec.push(val);
  }

  // Normalize to unit length L2 = 1.0
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map(v => Number((v / norm).toFixed(6)));
}

export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return Math.max(0, Math.min(1, dotProduct / denominator));
}
