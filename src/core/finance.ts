// Модуль финансов: расчёт маржи, мощность A/B-теста

/**
 * Маржа в год = клиентов × рассылок_на_клиента_в_год × конверсия × маржа_с_продукта
 */
export function annualMargin(
  clients: number,
  mailingsPerYear: number,
  conversion: number,
  marginPerProduct: number
): number {
  return clients * mailingsPerYear * conversion * marginPerProduct;
}

/**
 * Дополнительная маржа = маржа × относительный рост
 */
export function additionalMargin(baseMargin: number, relativeGrowth: number): number {
  return baseMargin * relativeGrowth;
}

/**
 * Нормальное распределение: квантиль (обратная функция CDF)
 * Используем рациональную аппроксимацию (Abramowitz & Stegun)
 */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Для p > 0.5 используем симметрию
  const sign = p < 0.5 ? -1 : 1;
  const pp = p < 0.5 ? p : 1 - p;

  // Rational approximation for the lower region
  const t = Math.sqrt(-2 * Math.log(pp));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const x = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  return sign * x;
}

/**
 * Размер группы A/B-теста:
 * n = (z(1-α/2) + z(мощность))² × (p1(1-p1) + p2(1-p2)) / (p2-p1)²
 * где p2 = p1 × (1 + d)
 */
export function sampleSizePerGroup(
  p1: number,
  relativeEffect: number,
  alpha: number = 0.05,
  power: number = 0.80
): number {
  const p2 = p1 * (1 + relativeEffect);
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);

  const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p2 - p1, 2);

  return Math.ceil(numerator / denominator);
}

/**
 * Минимальный обнаружимый относительный рост при заданном n (бисекция)
 */
export function minDetectableEffect(
  n: number,
  p1: number,
  alpha: number = 0.05,
  power: number = 0.80,
  tol: number = 1e-6
): number {
  let lo = 0.001;
  let hi = 2.0; // до 200% роста

  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    const requiredN = sampleSizePerGroup(p1, mid, alpha, power);
    if (requiredN > n) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < tol) break;
  }
  return (lo + hi) / 2;
}

/**
 * Сценарии для таблицы
 */
export interface ScenarioResult {
  growth: number;
  additionalMargin: number;
}

export function calculateScenarios(
  clients: number,
  mailingsPerYear: number,
  baseConversion: number,
  marginPerProduct: number,
  growthRates: number[]
): ScenarioResult[] {
  const baseMargin = annualMargin(clients, mailingsPerYear, baseConversion, marginPerProduct);
  return growthRates.map(growth => ({
    growth,
    additionalMargin: additionalMargin(baseMargin, growth),
  }));
}

/**
 * Размеры групп для разных эффектов
 */
export function calculateSampleSizes(
  baseConversion: number,
  effects: number[],
  alpha: number = 0.05,
  power: number = 0.80
): number[] {
  return effects.map(e => sampleSizePerGroup(baseConversion, e, alpha, power));
}
