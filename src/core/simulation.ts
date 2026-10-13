// Модуль симуляции: Thompson sampling, политики показа

// Модуль не импортирует survey — работает с матрицей как с параметром

// Seeded RNG с поддержкой Beta-распределения
class SeededRNG {
  private state: number;
  constructor(seed: number) { this.state = seed; }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }
  beta(alpha: number, beta: number): number {
    const x = this.gamma(alpha);
    const y = this.gamma(beta);
    return x / (x + y + 1e-30);
  }
  gamma(shape: number): number {
    if (shape < 1) {
      return this.gamma(shape + 1) * Math.pow(this.next() + 1e-30, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x: number, v: number;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.next();
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u + 1e-30) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  normal(): number {
    const u1 = this.next() + 1e-30;
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

export interface SimulationParams {
  totalShows: number;
  repeats: number;
  batchSize: number;
  segmentSizes: number[]; // доли сегментов (сумма = 1)
  conversionMatrix: number[][]; // 4x3, в долях (не %)
  singleVariant: number; // индекс варианта для "единого текста"
}

export interface SimulationResult {
  growthVsSingle: { mean: number; p5: number; p95: number; winRate: number };
  growthVsUniform: { mean: number; p5: number; p95: number; winRate: number };
  accumulationSteps: number[];
  accumulationSingle: number[][]; // [step][repeat]
  accumulationUniform: number[][];
  accumulationThompson: number[][];
  accumulationOracle: number[][];
  chosenBySegment: number[][]; // [segment][variant] = доля показов
  matchedOracle: boolean[][]; // [segment] = [совпал ли с лучшим по матрице]
  suboptimalShareUniform: number;
  suboptimalShareThompson: number;
}

/**
 * Запуск симуляции.
 * Один Generator(seed=42), повторы независимы.
 */
export function runSimulation(params: SimulationParams): SimulationResult {
  const { totalShows, repeats, batchSize, segmentSizes, conversionMatrix, singleVariant } = params;
  const nSegments = 4;
  const nVariants = 3;
  const rng = new SeededRNG(42);

  const nSteps = Math.ceil(totalShows / batchSize);

  // Инициализация массивов для всех повторов
  // alpha[r][s][v], beta[r][s][v] — параметры Beta-распределения
  // shows[r][s][v], convs[r][s][v] — накопленные показы и конверсии
  const alphas: number[][][] = [];
  const betas: number[][][] = [];
  const shows: number[][][] = [];
  const convs: number[][][] = [];

  for (let r = 0; r < repeats; r++) {
    alphas[r] = Array.from({ length: nSegments }, () => new Array(nVariants).fill(1));
    betas[r] = Array.from({ length: nSegments }, () => new Array(nVariants).fill(1));
    shows[r] = Array.from({ length: nSegments }, () => new Array(nVariants).fill(0));
    convs[r] = Array.from({ length: nSegments }, () => new Array(nVariants).fill(0));
  }

  // Накопленная конверсия: [step][repeat]
  const accSingle: number[][] = Array.from({ length: nSteps }, () => new Array(repeats).fill(0));
  const accUniform: number[][] = Array.from({ length: nSteps }, () => new Array(repeats).fill(0));
  const accThompson: number[][] = Array.from({ length: nSteps }, () => new Array(repeats).fill(0));
  const accOracle: number[][] = Array.from({ length: nSteps }, () => new Array(repeats).fill(0));

  // Оракул: лучший вариант для каждого сегмента
  const oracleVariant: number[] = [];
  for (let s = 0; s < nSegments; s++) {
    let best = 0;
    for (let v = 1; v < nVariants; v++) {
      if (conversionMatrix[s][v] > conversionMatrix[s][best]) best = v;
    }
    oracleVariant[s] = best;
  }

  for (let r = 0; r < repeats; r++) {
    let totalConvSingle = 0;
    let totalConvUniform = 0;
    let totalConvThompson = 0;
    let totalConvOracle = 0;
    let totalShowsDone = 0;
    let showInBatch = 0;

    for (let step = 0; step < nSteps; step++) {
      const currentBatch = Math.min(batchSize, totalShows - totalShowsDone);
      if (currentBatch <= 0) break;

      // Распределяем пачку по сегментам пропорционально
      let remaining = currentBatch;
      const batchPerSeg: number[] = [];
      for (let s = 0; s < nSegments - 1; s++) {
        const alloc = Math.round(segmentSizes[s] * currentBatch);
        batchPerSeg[s] = alloc;
        remaining -= alloc;
      }
      batchPerSeg[nSegments - 1] = remaining;

      for (let s = 0; s < nSegments; s++) {
        const segShows = batchPerSeg[s];
        if (segShows <= 0) continue;

        for (let i = 0; i < segShows; i++) {
          // === Thompson sampling ===
          let bestV = 0;
          let bestSample = -1;
          for (let v = 0; v < nVariants; v++) {
            const sample = rng.beta(alphas[r][s][v], betas[r][s][v]);
            if (sample > bestSample) {
              bestSample = sample;
              bestV = v;
            }
          }
          const convT = rng.next() < conversionMatrix[s][bestV] ? 1 : 0;
          shows[r][s][bestV]++;
          convs[r][s][bestV] += convT;
          totalConvThompson += convT;

          // === Единый текст ===
          const convS = rng.next() < conversionMatrix[s][singleVariant] ? 1 : 0;
          totalConvSingle += convS;

          // === Равномерная рассылка ===
          const uniformV = i % nVariants;
          const convU = rng.next() < conversionMatrix[s][uniformV] ? 1 : 0;
          totalConvUniform += convU;

          // === Оракул ===
          const convO = rng.next() < conversionMatrix[s][oracleVariant[s]] ? 1 : 0;
          totalConvOracle += convO;
        }
      }

      totalShowsDone += currentBatch;
      showInBatch += currentBatch;

      // Обновление апостериора каждые batchSize показов
      for (let s = 0; s < nSegments; s++) {
        for (let v = 0; v < nVariants; v++) {
          alphas[r][s][v] = 1 + convs[r][s][v];
          betas[r][s][v] = 1 + shows[r][s][v] - convs[r][s][v];
        }
      }

      // Записываем накопленную конверсию
      const stepIdx = Math.min(step, nSteps - 1);
      accSingle[stepIdx][r] = totalShowsDone > 0 ? totalConvSingle / totalShowsDone : 0;
      accUniform[stepIdx][r] = totalShowsDone > 0 ? totalConvUniform / totalShowsDone : 0;
      accThompson[stepIdx][r] = totalShowsDone > 0 ? totalConvThompson / totalShowsDone : 0;
      accOracle[stepIdx][r] = totalShowsDone > 0 ? totalConvOracle / totalShowsDone : 0;
    }
  }

  // Финальная конверсия по повторам
  const finalSingle: number[] = [];
  const finalUniform: number[] = [];
  const finalThompson: number[] = [];
  const lastStep = nSteps - 1;

  for (let r = 0; r < repeats; r++) {
    finalSingle.push(accSingle[lastStep][r]);
    finalUniform.push(accUniform[lastStep][r]);
    finalThompson.push(accThompson[lastStep][r]);
  }

  // Рост конверсии
  const growthVsSingle = finalSingle.map((s, r) => s > 0 ? (finalThompson[r] - s) / s : 0);
  const growthVsUniform = finalUniform.map((u, r) => u > 0 ? (finalThompson[r] - u) / u : 0);

  const percentile = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(p / 100 * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  };

  // Выбор варианта по сегментам (доля показов)
  const chosenBySegment: number[][] = [];
  const matchedOracle: boolean[][] = [];
  for (let s = 0; s < nSegments; s++) {
    chosenBySegment[s] = new Array(nVariants).fill(0);
    let totalShowsSeg = 0;
    for (let r = 0; r < repeats; r++) {
      for (let v = 0; v < nVariants; v++) {
        chosenBySegment[s][v] += shows[r][s][v];
        totalShowsSeg += shows[r][s][v];
      }
    }
    for (let v = 0; v < nVariants; v++) {
      chosenBySegment[s][v] = totalShowsSeg > 0 ? chosenBySegment[s][v] / totalShowsSeg : 0;
    }
    // Совпадение с оракулом: вариант с наибольшим апостериорным средним
    let chosenV = 0;
    let bestPostMean = 0;
    for (let v = 0; v < nVariants; v++) {
      let sumA = 0, sumB = 0;
      for (let r = 0; r < repeats; r++) {
        sumA += alphas[r][s][v];
        sumB += betas[r][s][v];
      }
      const postMean = sumA / (sumA + sumB);
      if (postMean > bestPostMean) { bestPostMean = postMean; chosenV = v; }
    }
    matchedOracle[s] = [chosenV === oracleVariant[s]];
  }

  // Доля показов на менее эффективные варианты
  let suboptimalUniform = 0;
  let suboptimalThompson = 0;
  for (let s = 0; s < nSegments; s++) {
    suboptimalUniform += (nVariants - 1) / nVariants;
    let subShare = 0;
    for (let v = 0; v < nVariants; v++) {
      if (v !== oracleVariant[s]) subShare += chosenBySegment[s][v];
    }
    suboptimalThompson += subShare;
  }
  suboptimalUniform /= nSegments;
  suboptimalThompson /= nSegments;

  // Шаги для графика
  const accumulationSteps: number[] = [];
  for (let i = 0; i < nSteps; i++) {
    accumulationSteps.push((i + 1) * batchSize);
  }

  return {
    growthVsSingle: {
      mean: growthVsSingle.reduce((a, b) => a + b, 0) / repeats,
      p5: percentile(growthVsSingle, 5),
      p95: percentile(growthVsSingle, 95),
      winRate: growthVsSingle.filter(g => g > 0).length / repeats,
    },
    growthVsUniform: {
      mean: growthVsUniform.reduce((a, b) => a + b, 0) / repeats,
      p5: percentile(growthVsUniform, 5),
      p95: percentile(growthVsUniform, 95),
      winRate: growthVsUniform.filter(g => g > 0).length / repeats,
    },
    accumulationSteps,
    accumulationSingle: accSingle,
    accumulationUniform: accUniform,
    accumulationThompson: accThompson,
    accumulationOracle: accOracle,
    chosenBySegment,
    matchedOracle,
    suboptimalShareUniform: suboptimalUniform,
    suboptimalShareThompson: suboptimalThompson,
  };
}

/**
 * Среднее по повторам для графика
 */
export function meanAcrossRepeats(data: number[][]): number[] {
  if (data.length === 0) return [];
  const nSteps = data.length;
  const nRepeats = data[0].length;
  const result: number[] = [];
  for (let i = 0; i < nSteps; i++) {
    let sum = 0;
    for (let r = 0; r < nRepeats; r++) sum += data[i][r];
    result.push(sum / nRepeats);
  }
  return result;
}

/**
 * Перцентили по повторам для полосы на графике
 */
export function percentileAcrossRepeats(data: number[][], p: number): number[] {
  if (data.length === 0) return [];
  const nSteps = data.length;
  const result: number[] = [];
  for (let i = 0; i < nSteps; i++) {
    const values = data[i].slice().sort((a, b) => a - b);
    const idx = Math.floor(p / 100 * values.length);
    result.push(values[Math.min(idx, values.length - 1)]);
  }
  return result;
}
