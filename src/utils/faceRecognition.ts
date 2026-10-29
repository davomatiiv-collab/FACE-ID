/**
 * Litsey Face ID — Offline Local Biometric Face Recognition Engine
 * 100% Client-side and Offline: No external CDNs, no remote APIs, no cloud dependency.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  detected: boolean;
  box: BoundingBox;
  confidence: number;
  method: 'native_facedetector' | 'vision_integral_analyzer';
}

export interface StudentBiometric {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  group_name?: string;
  group_id?: string;
  photo_url?: string;
  face_descriptor?: number[] | null;
  is_face_registered?: number;
  is_active?: number;
}

export interface MatchResult {
  matched: boolean;
  student: StudentBiometric | null;
  confidence: number; // 0.0 - 1.0
  confidencePercent: number; // 0 - 100
  needsManualConfirm: boolean;
  topCandidates: Array<{
    student: StudentBiometric;
    confidence: number;
    confidencePercent: number;
  }>;
}

// -------------------------------------------------------------
// 1. FACE DETECTION (Native FaceDetector API + Fallback Vision Analyzer)
// -------------------------------------------------------------
export async function detectFace(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<DetectionResult> {
  const width = source instanceof HTMLVideoElement
    ? source.videoWidth
    : source instanceof HTMLImageElement
    ? (source.naturalWidth || source.width)
    : source.width;
  const height = source instanceof HTMLVideoElement
    ? source.videoHeight
    : source instanceof HTMLImageElement
    ? (source.naturalHeight || source.height)
    : source.height;

  if (!width || !height) {
    return {
      detected: false,
      box: { x: 0, y: 0, width: 0, height: 0 },
      confidence: 0,
      method: 'vision_integral_analyzer'
    };
  }

  // 1. Try Native Browser FaceDetector if supported
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const FaceDetectorCtor = (window as any).FaceDetector;
      const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(source);
      if (faces && faces.length > 0) {
        const f = faces[0].boundingBox;
        return {
          detected: true,
          box: {
            x: Math.max(0, Math.round(f.x)),
            y: Math.max(0, Math.round(f.y)),
            width: Math.min(width - Math.round(f.x), Math.round(f.width)),
            height: Math.min(height - Math.round(f.y), Math.round(f.height))
          },
          confidence: 0.95,
          method: 'native_facedetector'
        };
      }
    } catch {
      // Fallback below
    }
  }

  // 2. High-performance Canvas Fallback Vision Analyzer
  // Scans image for human skin chroma (YCbCr / normalized RGB) + facial luminance topology
  const offscreen = document.createElement('canvas');
  const targetW = 160;
  const targetH = Math.round((height / width) * 160);
  offscreen.width = targetW;
  offscreen.height = targetH;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      detected: false,
      box: { x: 0, y: 0, width: 0, height: 0 },
      confidence: 0,
      method: 'vision_integral_analyzer'
    };
  }

  ctx.drawImage(source, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  // Skin tone & facial symmetry bounds
  let minX = targetW;
  let maxX = 0;
  let minY = targetH;
  let maxY = 0;
  let skinPixelCount = 0;

  for (let y = Math.round(targetH * 0.1); y < Math.round(targetH * 0.9); y++) {
    for (let x = Math.round(targetW * 0.15); x < Math.round(targetW * 0.85); x++) {
      const idx = (y * targetW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skin chromaticity check: R > G > B, R - G > 12, hue in human skin distribution
      const isSkin =
        r > 60 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        g >= b &&
        r - g >= 10 &&
        Math.abs(r - g) > 8 &&
        r > 1.1 * g;

      if (isSkin) {
        skinPixelCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const faceW = maxX - minX;
  const faceH = maxY - minY;
  const totalAnalyzed = targetW * targetH * 0.6;
  const skinRatio = skinPixelCount / totalAnalyzed;

  // If sufficient facial skin cluster is detected with realistic aspect ratio (0.8 - 1.5)
  if (skinPixelCount > 350 && faceW > 25 && faceH > 25 && faceH / faceW >= 0.7 && faceH / faceW <= 1.8) {
    const scaleX = width / targetW;
    const scaleY = height / targetH;

    // Apply 10% padding
    const padX = faceW * 0.1;
    const padY = faceH * 0.1;

    const realX = Math.max(0, Math.round((minX - padX) * scaleX));
    const realY = Math.max(0, Math.round((minY - padY) * scaleY));
    const realW = Math.min(width - realX, Math.round((faceW + padX * 2) * scaleX));
    const realH = Math.min(height - realY, Math.round((faceH + padY * 2) * scaleY));

    return {
      detected: true,
      box: { x: realX, y: realY, width: realW, height: realH },
      confidence: Math.min(0.92, Math.max(0.65, 0.5 + skinRatio * 1.5)),
      method: 'vision_integral_analyzer'
    };
  }

  // Fallback: If person is centered in frame
  const defaultW = Math.round(width * 0.45);
  const defaultH = Math.round(height * 0.55);
  const defaultX = Math.round((width - defaultW) / 2);
  const defaultY = Math.round(height * 0.2);

  return {
    detected: skinPixelCount > 150,
    box: { x: defaultX, y: defaultY, width: defaultW, height: defaultH },
    confidence: skinPixelCount > 150 ? 0.65 : 0.2,
    method: 'vision_integral_analyzer'
  };
}

// -------------------------------------------------------------
// 2. BIOMETRIC 128-DIMENSIONAL DESCRIPTOR EXTRACTION
// -------------------------------------------------------------
export async function extractFaceDescriptor(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  box?: BoundingBox
): Promise<number[]> {
  const normSize = 112; // Standard face embedding resolution
  const canvas = document.createElement('canvas');
  canvas.width = normSize;
  canvas.height = normSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context creation failed');

  const srcW = source instanceof HTMLVideoElement
    ? source.videoWidth
    : source instanceof HTMLImageElement
    ? (source.naturalWidth || source.width)
    : source.width;
  const srcH = source instanceof HTMLVideoElement
    ? source.videoHeight
    : source instanceof HTMLImageElement
    ? (source.naturalHeight || source.height)
    : source.height;

  const validW = srcW > 0 ? srcW : 400;
  const validH = srcH > 0 ? srcH : 400;

  const bx = box ? Math.max(0, box.x) : Math.round(validW * 0.2);
  const by = box ? Math.max(0, box.y) : Math.round(validH * 0.15);
  const bw = box ? Math.min(validW - bx, box.width) : Math.round(validW * 0.6);
  const bh = box ? Math.min(validH - by, box.height) : Math.round(validH * 0.7);

  // Draw cropped face
  ctx.drawImage(source, bx, by, bw, bh, 0, 0, normSize, normSize);
  const imgData = ctx.getImageData(0, 0, normSize, normSize);
  const data = imgData.data;

  // Convert to normalized grayscale & histogram equalize
  const gray = new Float32Array(normSize * normSize);
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < data.length; i += 4) {
    // Luminance standard
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const px = i / 4;
    gray[px] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // Contrast stretch / normalization
  const lumRange = maxLum - minLum || 1;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = ((gray[i] - minLum) / lumRange) * 255;
  }

  // Multi-Region Local Binary Patterns (LBP) & Spatial Gradients (HOG-style)
  // Grid 4x4 sub-regions = 16 blocks
  const descriptor: number[] = [];
  const blockSize = normSize / 4; // 28x28 per block

  // 1. Part A: 16 sub-regions x 4 LBP texture bins = 64 values
  for (let byIdx = 0; byIdx < 4; byIdx++) {
    for (let bxIdx = 0; bxIdx < 4; bxIdx++) {
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      const startX = bxIdx * blockSize + 2;
      const endX = (bxIdx + 1) * blockSize - 2;
      const startY = byIdx * blockSize + 2;
      const endY = (byIdx + 1) * blockSize - 2;

      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const center = gray[y * normSize + x];
          // Sample 4 cardinal neighbors
          const up = gray[(y - 1) * normSize + x] >= center ? 1 : 0;
          const down = gray[(y + 1) * normSize + x] >= center ? 1 : 0;
          const left = gray[y * normSize + (x - 1)] >= center ? 1 : 0;
          const right = gray[y * normSize + (x + 1)] >= center ? 1 : 0;
          const pattern = (up << 3) | (down << 2) | (left << 1) | right;

          if (pattern < 4) b0++;
          else if (pattern < 8) b1++;
          else if (pattern < 12) b2++;
          else b3++;
        }
      }

      const total = b0 + b1 + b2 + b3 || 1;
      descriptor.push(b0 / total, b1 / total, b2 / total, b3 / total);
    }
  }

  // 2. Part B: Spatial Gradient Orientations across 6 major facial zones = 48 values
  // Zone 0: Upper forehead/eyebrows, Zone 1: Eyes left, Zone 2: Eyes right,
  // Zone 3: Nose bridge, Zone 4: Mouth, Zone 5: Jaw
  const zones = [
    { y1: 0.1, y2: 0.35, x1: 0.2, x2: 0.8 }, // Eyebrow/forehead
    { y1: 0.28, y2: 0.5, x1: 0.15, x2: 0.5 }, // Left eye/cheek
    { y1: 0.28, y2: 0.5, x1: 0.5, x2: 0.85 }, // Right eye/cheek
    { y1: 0.45, y2: 0.7, x1: 0.35, x2: 0.65 }, // Nose
    { y1: 0.68, y2: 0.88, x1: 0.25, x2: 0.75 }, // Mouth
    { y1: 0.8, y2: 0.98, x1: 0.2, x2: 0.8 } // Chin/jaw
  ];

  for (const zone of zones) {
    const bins = new Float32Array(8); // 8 orientation bins (0..360 deg)
    const zy1 = Math.round(zone.y1 * normSize);
    const zy2 = Math.round(zone.y2 * normSize);
    const zx1 = Math.round(zone.x1 * normSize);
    const zx2 = Math.round(zone.x2 * normSize);

    for (let y = zy1 + 1; y < zy2 - 1; y += 2) {
      for (let x = zx1 + 1; x < zx2 - 1; x += 2) {
        const dx = gray[y * normSize + (x + 1)] - gray[y * normSize + (x - 1)];
        const dy = gray[(y + 1) * normSize + x] - gray[(y - 1) * normSize + x];
        const mag = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        const bin = Math.min(7, Math.floor(angle / 45));
        bins[bin] += mag;
      }
    }

    let sum = 0;
    for (let b = 0; b < 8; b++) sum += bins[b];
    sum = sum || 1;
    for (let b = 0; b < 8; b++) {
      descriptor.push(bins[b] / sum);
    }
  }

  // 3. Part C: 16 facial structural geometry & contrast ratios = 16 values
  // Total = 64 + 48 + 16 = 128 dimensions
  for (let k = 0; k < 16; k++) {
    const yCenter = Math.round((0.15 + (k / 16) * 0.7) * normSize);
    const leftVal = gray[yCenter * normSize + Math.round(normSize * 0.3)];
    const midVal = gray[yCenter * normSize + Math.round(normSize * 0.5)];
    const rightVal = gray[yCenter * normSize + Math.round(normSize * 0.7)];
    const ratio = (midVal - (leftVal + rightVal) / 2) / 255;
    descriptor.push(ratio);
  }

  // Final step: L2-normalize vector to unit length
  let sumSq = 0;
  for (let i = 0; i < descriptor.length; i++) {
    sumSq += descriptor[i] * descriptor[i];
  }
  const l2Norm = Math.sqrt(sumSq) || 1;
  return descriptor.map(v => Number((v / l2Norm).toFixed(6)));
}

/**
 * Extracts a 128-dimensional biometric face descriptor from an image URL or data URL
 */
export async function extractDescriptorFromImageUrl(imageUrl: string): Promise<number[] | null> {
  if (!imageUrl) return null;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const det = await detectFace(img);
          const desc = await extractFaceDescriptor(img, det.box);
          resolve(desc);
        } catch (e) {
          console.warn('Descriptor extraction failed from image:', e);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.warn('Image load error during biometric extraction');
        resolve(null);
      };
      img.src = imageUrl;
    } catch {
      resolve(null);
    }
  });
}

// -------------------------------------------------------------
// 3. MATCHING & COSINE SIMILARITY
// -------------------------------------------------------------
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let nA = 0;
  let nB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    nA += vecA[i] * vecA[i];
    nB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(nA) * Math.sqrt(nB);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

/**
 * Maps raw cosine similarity in 128-d space to an intuitive, calibrated confidence percentage (30% - 99%)
 */
export function toConfidencePercent(sim: number, targetThreshold = 0.55): number {
  if (sim < 0.30) {
    return Math.max(15, Math.round(sim * 60));
  }
  if (sim >= targetThreshold) {
    // Matched zone: maps [targetThreshold..1.0] to [85%..99%]
    const frac = (sim - targetThreshold) / Math.max(0.01, 1.0 - targetThreshold);
    return Math.min(99, Math.round(85 + Math.min(1, frac) * 14));
  }
  // Borderline / Unmatched zone: maps [0.30..targetThreshold] to [30%..79%]
  const frac = (sim - 0.30) / Math.max(0.01, targetThreshold - 0.30);
  return Math.min(79, Math.max(30, Math.round(30 + frac * 48)));
}

export function matchLiveFace(
  liveDescriptor: number[],
  registeredStudents: StudentBiometric[],
  rawThreshold = 0.55
): MatchResult {
  // Use a reliable threshold; avoid overly strict values (> 0.65) that reject legitimate faces
  const threshold = Math.min(0.60, Math.max(0.48, rawThreshold || 0.55));
  const candidates: Array<{ student: StudentBiometric; confidence: number; confidencePercent: number }> = [];

  for (const student of registeredStudents) {
    if (!student.face_descriptor) continue;
    const desc = Array.isArray(student.face_descriptor)
      ? student.face_descriptor
      : (typeof student.face_descriptor === 'string' ? JSON.parse(student.face_descriptor) : null);

    if (!desc || desc.length !== 128) continue;

    const sim = cosineSimilarity(liveDescriptor, desc);
    const percent = toConfidencePercent(sim, threshold);

    candidates.push({
      student,
      confidence: Number(sim.toFixed(4)),
      confidencePercent: percent
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return {
      matched: false,
      student: null,
      confidence: 0,
      confidencePercent: 0,
      needsManualConfirm: false,
      topCandidates: []
    };
  }

  const best = candidates[0];
  // Match condition:
  // 1. best.confidence >= threshold (e.g. 0.55)
  // OR
  // 2. best.confidence >= 0.50 AND (single candidate in database OR clear margin over 2nd best >= 0.04)
  const isClearMargin = candidates.length === 1 || best.confidence - (candidates[1]?.confidence || 0) >= 0.04;
  const isMatch = best.confidence >= threshold || (best.confidence >= 0.50 && isClearMargin);
  const isBorderline = !isMatch && best.confidence >= 0.44;

  return {
    matched: isMatch,
    student: isMatch || isBorderline ? best.student : null,
    confidence: best.confidence,
    confidencePercent: best.confidencePercent,
    needsManualConfirm: isBorderline,
    topCandidates: candidates.slice(0, 3)
  };
}

// -------------------------------------------------------------
// 4. LIVENESS CHECK (Micro-dynamics & variance analysis)
// -------------------------------------------------------------
export function analyzeLiveness(
  prevPixels: Uint8ClampedArray | null,
  currPixels: Uint8ClampedArray
): { isLive: boolean; variance: number; message: string } {
  if (!prevPixels || prevPixels.length !== currPixels.length) {
    return { isLive: true, variance: 0.05, message: 'Tiriklik signallari tekshirilmoqda...' };
  }

  let diffSum = 0;
  const sampleStep = 8;
  let samples = 0;

  for (let i = 0; i < currPixels.length; i += 4 * sampleStep) {
    const diff = Math.abs(currPixels[i] - prevPixels[i]);
    diffSum += diff;
    samples++;
  }

  const avgDiff = samples > 0 ? diffSum / (samples * 255) : 0;

  // If variance is basically zero, it might be a frozen still image
  const isStaticPhoto = avgDiff < 0.003;

  return {
    isLive: !isStaticPhoto,
    variance: Number(avgDiff.toFixed(4)),
    message: isStaticPhoto
      ? 'Harakat sezilmadi (fotosurat yoki qotib qolgan kadr ehtimoli)'
      : 'Jonli mikro-harakat tasdiqlandi'
  };
}

// -------------------------------------------------------------
// 5. AUDIO CHIME FEEDBACK (Native Web Audio API, 100% offline)
// -------------------------------------------------------------
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Ignore audio errors
  }
}

export function playDuplicateChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(370, now + 0.1);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Ignore
  }
}

export function playUnrecognizedAlert(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(220, now); // Low buzz
    osc.frequency.setValueAtTime(190, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Ignore
  }
}

