// Модуль сегментов: генерация синтетических данных, K-means, метрики

import { SEGMENT_CENTROIDS, SEGMENT_NAMES, SEGMENT_DESCRIPTIONS } from './survey';

// Профили-генераторы (средние баллы 0-100 для 5 черт)
export const GENERATOR_PROFILES: number[][] = [
  [73, 70, 45, 52, 38], // Аналитики
  [42, 63, 38, 49, 72], // Осторожные
  [28, 46, 42, 68, 44], // Ищущие простоты
  [56, 48, 75, 55, 40], // Общительные
];

const STD = 12; // стандартное отклонение в пунктах

// Умеренные корреляции между чертами (ковариационная матрица)
function choleskyDecompose(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        L[i][j] = Math.sqrt(matrix[i][i] - sum);
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

// Простой генератор нормальных чисел (Box-Muller) с seed
class SeededRNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }
  normal(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}

/**
 * Генерирует 2000 синтетических респондентов из смеси 4 профилей.
 */
export function generateSyntheticData(n: number = 2000, seed: number = 42): number[][] {
  const rng = new SeededRNG(seed);
  const data: number[][] = [];
  const perCluster = Math.floor(n / 4);

  // Ковариационная матрица: диагональ STD^2, умеренные корреляции
  const covMatrix: number[][] = [];
  for (let i = 0; i < 5; i++) {
    covMatrix[i] = [];
    for (let j = 0; j < 5; j++) {
      if (i === j) covMatrix[i][j] = STD * STD;
      else covMatrix[i][j] = 0.15 * STD * STD; // умеренная корреляция
    }
  }
  const L = choleskyDecompose(covMatrix);

  for (let c = 0; c < 4; c++) {
    const profile = GENERATOR_PROFILES[c];
    const count = c < 3 ? perCluster : n - 3 * perCluster;
    for (let i = 0; i < count; i++) {
      const z: number[] = [];
      for (let j = 0; j < 5; j++) z.push(rng.normal());
      const point: number[] = [];
      for (let j = 0; j < 5; j++) {
        let val = profile[j];
        for (let k = 0; k <= j; k++) {
          val += L[j][k] * z[k];
        }
        point.push(Math.max(0, Math.min(100, Math.round(val))));
      }
      data.push(point);
    }
  }
  return data;
}

/**
 * K-means кластеризация (упрощённая реализация)
 */
export function kmeans(data: number[][], k: number, maxIter: number = 100, seed: number = 42): {
  labels: number[];
  centroids: number[][];
} {
  const rng = new SeededRNG(seed);
  const n = data.length;
  const dim = data[0].length;

  // Инициализация: k-means++
  const centroids: number[][] = [];
  const firstIdx = Math.floor(rng.next() * n);
  centroids.push([...data[firstIdx]]);

  for (let c = 1; c < k; c++) {
    const dists: number[] = data.map(point => {
      let minD = Infinity;
      for (const cent of centroids) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += (point[j] - cent[j]) ** 2;
        minD = Math.min(minD, d);
      }
      return minD;
    });
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let r = rng.next() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) {
        centroids.push([...data[i]]);
        break;
      }
    }
    if (centroids.length <= c) centroids.push([...data[Math.floor(rng.next() * n)]]);
  }

  const labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    // Назначение кластеров
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < k; c++) {
        let dist = 0;
        for (let j = 0; j < dim; j++) dist += (data[i][j] - centroids[c][j]) ** 2;
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      if (labels[i] !== bestCluster) {
        labels[i] = bestCluster;
        changed = true;
      }
    }
    if (!changed) break;

    // Обновление центроидов
    for (let c = 0; c < k; c++) {
      const members = data.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      for (let j = 0; j < dim; j++) {
        centroids[c][j] = members.reduce((sum, p) => sum + p[j], 0) / members.length;
      }
    }
  }

  return { labels, centroids };
}

/**
 * StandardScaler: fit + transform
 */
export function fitScaler(data: number[][]): { mean: number[]; std: number[] } {
  const dim = data[0].length;
  const n = data.length;
  const mean: number[] = new Array(dim).fill(0);
  const std: number[] = new Array(dim).fill(0);

  for (let j = 0; j < dim; j++) {
    for (let i = 0; i < n; i++) mean[j] += data[i][j];
    mean[j] /= n;
  }
  for (let j = 0; j < dim; j++) {
    for (let i = 0; i < n; i++) std[j] += (data[i][j] - mean[j]) ** 2;
    std[j] = Math.sqrt(std[j] / n);
    if (std[j] < 1e-10) std[j] = 1;
  }
  return { mean, std };
}

export function transformData(data: number[][], mean: number[], std: number[]): number[][] {
  return data.map(point => point.map((v, j) => (v - mean[j]) / std[j]));
}

/**
 * K-means на стандартизированных данных
 */
export function clusterData(data: number[][]): {
  labels: number[];
  centroids: number[][];
  scaledCentroids: number[][];
  scaler: { mean: number[]; std: number[] };
} {
  const scaler = fitScaler(data);
  const scaledData = transformData(data, scaler.mean, scaler.std);
  const { labels, centroids } = kmeans(scaledData, 4, 100, 42);

  // Обратное преобразование центроидов
  const centroidsOriginal = centroids.map(c =>
    c.map((v, j) => v * scaler.std[j] + scaler.mean[j])
  );

  return { labels, centroids, scaledCentroids: centroidsOriginal, scaler };
}

/**
 * Сопоставление кластеров с профилями-генераторами (linear_sum_assignment)
 */
export function matchClustersToProfiles(centroids: number[][]): number[] {
  const k = centroids.length;
  // Матрица расстояний
  const costMatrix: number[][] = [];
  for (let i = 0; i < k; i++) {
    costMatrix[i] = [];
    for (let j = 0; j < k; j++) {
      let dist = 0;
      for (let d = 0; d < 5; d++) {
        dist += (centroids[i][d] - GENERATOR_PROFILES[j][d]) ** 2;
      }
      costMatrix[i][j] = Math.sqrt(dist);
    }
  }
  // Жадное назначение (упрощённый hungarian)
  const assignment: number[] = new Array(k).fill(-1);
  const usedProfiles = new Set<number>();
  // Сортируем все пары по расстоянию
  const pairs: { i: number; j: number; dist: number }[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      pairs.push({ i, j, dist: costMatrix[i][j] });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);
  for (const p of pairs) {
    if (assignment[p.i] === -1 && !usedProfiles.has(p.j)) {
      assignment[p.i] = p.j;
      usedProfiles.add(p.j);
    }
  }
  return assignment;
}

/**
 * ARI (Adjusted Rand Index) между двумя разбиениями
 */
export function adjustedRandIndex(labels1: number[], labels2: number[]): number {
  const n = labels1.length;
  const contingency: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const key = `${labels1[i]},${labels2[i]}`;
    contingency[key] = (contingency[key] || 0) + 1;
  }

  const sumRows: Record<number, number> = {};
  const sumCols: Record<number, number> = {};
  for (const key in contingency) {
    const [r, c] = key.split(',').map(Number);
    sumRows[r] = (sumRows[r] || 0) + contingency[key];
    sumCols[c] = (sumCols[c] || 0) + contingency[key];
  }

  const comb2 = (x: number) => (x * (x - 1)) / 2;
  let sumCombNij = 0;
  for (const key in contingency) {
    sumCombNij += comb2(contingency[key]);
  }
  let sumCombAi = 0;
  for (const r in sumRows) sumCombAi += comb2(sumRows[r]);
  let sumCombBj = 0;
  for (const c in sumCols) sumCombBj += comb2(sumCols[c]);

  const totalComb = comb2(n);
  const expected = (sumCombAi * sumCombBj) / totalComb;
  const maxIndex = (sumCombAi + sumCombBj) / 2;

  if (maxIndex === expected) return 1;
  return (sumCombNij - expected) / (maxIndex - expected);
}

/**
 * Silhouette score (упрощённый, на подвыборке)
 */
export function silhouetteScore(data: number[][], labels: number[], sampleSize: number = 300): number {
  const rng = new SeededRNG(123);
  const n = data.length;
  const indices: number[] = [];
  const selected = new Set<number>();
  while (indices.length < Math.min(sampleSize, n)) {
    const idx = Math.floor(rng.next() * n);
    if (!selected.has(idx)) {
      selected.add(idx);
      indices.push(idx);
    }
  }

  let totalSil = 0;
  for (const i of indices) {
    const cluster = labels[i];
    const sameCluster = indices.filter(j => j !== i && labels[j] === cluster);
    const otherClusters = new Set<number>();
    for (const j of indices) {
      if (labels[j] !== cluster) otherClusters.add(labels[j]);
    }

    if (sameCluster.length === 0 || otherClusters.size === 0) continue;

    // a(i): среднее расстояние до точек своего кластера
    let a = 0;
    for (const j of sameCluster) {
      let d = 0;
      for (let k = 0; k < 5; k++) d += (data[i][k] - data[j][k]) ** 2;
      a += Math.sqrt(d);
    }
    a /= sameCluster.length;

    // b(i): минимальное среднее расстояние до точек другого кластера
    let b = Infinity;
    for (const c of otherClusters) {
      const members = indices.filter(j => labels[j] === c);
      let avgDist = 0;
      for (const j of members) {
        let d = 0;
        for (let k = 0; k < 5; k++) d += (data[i][k] - data[j][k]) ** 2;
        avgDist += Math.sqrt(d);
      }
      avgDist /= members.length;
      b = Math.min(b, avgDist);
    }

    const sil = (b - a) / Math.max(a, b);
    totalSil += sil;
  }
  return totalSil / indices.length;
}

/**
 * Описание сегмента по двум чертам с наибольшим отклонением от среднего
 */
export function getSegmentDescription(centroid: number[]): string {
  const globalMean = [50, 50, 50, 50, 50];
  const deviations = centroid.map((v, i) => ({ trait: i, dev: v - globalMean[i] }));
  deviations.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
  const top2 = deviations.slice(0, 2);
  const traitLabels = ['открытость', 'добросовестность', 'экстраверсия', 'доброжелательность', 'нейротизм'];
  return top2.map(d =>
    `${traitLabels[d.trait]} ${d.dev > 0 ? 'выше' : 'ниже'} среднего (${d.dev > 0 ? '+' : ''}${d.dev.toFixed(0)})`
  ).join(', ');
}

export { SEGMENT_CENTROIDS, SEGMENT_NAMES, SEGMENT_DESCRIPTIONS };
