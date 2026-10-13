// Модуль опросника: баллы Big Five, сегментация, рекомендация

export const TRAIT_NAMES = [
  'Открытость опыту',
  'Добросовестность',
  'Экстраверсия',
  'Доброжелательность',
  'Нейротизм',
] as const;

export type TraitName = typeof TRAIT_NAMES[number];

// 10 утверждений: по 2 на черту (прямое + обратное)
export interface Question {
  id: number;
  trait: number; // индекс черты 0-4
  direction: 'direct' | 'reverse';
  text: string;
}

export const QUESTIONS: Question[] = [
  // Открытость (0)
  { id: 1, trait: 0, direction: 'direct', text: 'Мне нравится пробовать новые способы делать привычные вещи.' },
  { id: 2, trait: 0, direction: 'reverse', text: 'Я предпочитаю проверенные решения новым и неизвестным.' },
  // Добросовестность (1)
  { id: 3, trait: 1, direction: 'direct', text: 'Я тщательно планирую свои финансовые решения.' },
  { id: 4, trait: 1, direction: 'reverse', text: 'Часто принимаю спонтанные решения, не взвесив все варианты.' },
  // Экстраверсия (2)
  { id: 5, trait: 2, direction: 'direct', text: 'Мне легко общаться с незнакомыми людьми и заводить новые знакомства.' },
  { id: 6, trait: 2, direction: 'reverse', text: 'Я предпочитаю проводить время в одиночестве или в узком кругу.' },
  // Доброжелательность (3)
  { id: 7, trait: 3, direction: 'direct', text: 'Я стараюсь учитывать интересы других людей при принятии решений.' },
  { id: 8, trait: 3, direction: 'reverse', text: 'В споре я скорее буду отстаивать свою позицию, чем идти на уступки.' },
  // Нейротизм (4)
  { id: 9, trait: 4, direction: 'direct', text: 'Я часто беспокоюсь о том, что может пойти не так.' },
  { id: 10, trait: 4, direction: 'reverse', text: 'Меня трудно вывести из равновесия, я редко переживаю из-за мелочей.' },
];

// Сокращённый опросник: по одному пункту на черту
export const SHORT_QUESTIONS: number[] = [1, 3, 5, 7, 9];

/**
 * Рассчитывает балл черты (0-100) по ответам (1-7).
 * Прямые пункты: x, обратные: 8-x.
 * Среднее двух пунктов m; score = (m-1)/6 * 100
 */
export function calculateTraitScore(
  directAnswer: number,
  reverseAnswer: number
): number {
  const directVal = directAnswer;
  const reverseVal = 8 - reverseAnswer;
  const m = (directVal + reverseVal) / 2;
  return ((m - 1) / 6) * 100;
}

/**
 * Рассчитывает все 5 баллов по ответам на вопросы.
 * answers: Record<questionId, answer (1-7)>
 */
export function calculateScores(answers: Record<number, number>): number[] {
  const scores: number[] = [];
  for (let trait = 0; trait < 5; trait++) {
    const directQ = QUESTIONS.find(q => q.trait === trait && q.direction === 'direct')!;
    const reverseQ = QUESTIONS.find(q => q.trait === trait && q.direction === 'reverse')!;
    const directAns = answers[directQ.id] || 4;
    const reverseAns = answers[reverseQ.id] || 4;
    scores.push(calculateTraitScore(directAns, reverseAns));
  }
  return scores;
}

/**
 * Рассчитывает баллы для сокращённого опросника (один пункт на черту).
 * Для сокращённого варианта: score = (x-1)/6 * 100 для прямых, (8-x-1)/6 * 100 для обратных
 */
export function calculateShortScores(answers: Record<number, number>): number[] {
  const scores: number[] = [];
  for (let trait = 0; trait < 5; trait++) {
    const q = QUESTIONS.find(q => q.trait === trait && SHORT_QUESTIONS.includes(q.id));
    if (!q) { scores.push(50); continue; }
    const ans = answers[q.id] || 4;
    const val = q.direction === 'direct' ? ans : 8 - ans;
    scores.push(((val - 1) / 6) * 100);
  }
  return scores;
}

// Центроиды сегментов (из вкладки 2, фиксированные после кластеризации)
export const SEGMENT_CENTROIDS: number[][] = [
  [72.5, 70.3, 45.2, 52.1, 38.7], // Аналитики: высокие открытость и добросовестность
  [42.3, 62.8, 38.5, 48.7, 71.2], // Осторожные: высокий нейротизм, добросовестность выше среднего
  [28.4, 45.6, 42.1, 68.3, 44.5], // Ищущие простоты: низкая открытость, высокая доброжелательность
  [55.7, 48.2, 74.6, 55.3, 40.1], // Общительные: высокая экстраверсия
];

export const SEGMENT_NAMES = ['Аналитики', 'Осторожные', 'Ищущие простоты', 'Общительные'];

export const SEGMENT_DESCRIPTIONS = [
  'Высокие открытость и добросовестность: ценят анализ и новизну',
  'Высокий нейротизм и добросовестность: осторожны, нуждаются в гарантиях',
  'Низкая открытость и высокая доброжелательность: предпочитают простоту и доверие',
  'Высокая экстраверсия: реагируют на социальное подтверждение и динамику',
];

// Средние и SD для стандартизации (из synthetic data)
export const SCALER_MEAN = [50.0, 50.0, 50.0, 50.0, 50.0];
export const SCALER_STD = [18.5, 17.2, 18.0, 16.8, 19.5];

/**
 * Определяет сегмент по баллам (ближайший центроид в стандартизированном пространстве)
 */
export function predictSegment(scores: number[]): number {
  const standardized = scores.map((s, i) => (s - SCALER_MEAN[i]) / SCALER_STD[i]);
  let minDist = Infinity;
  let bestSegment = 0;
  for (let k = 0; k < 4; k++) {
    const centroidStd = SEGMENT_CENTROIDS[k].map((c, i) => (c - SCALER_MEAN[i]) / SCALER_STD[i]);
    let dist = 0;
    for (let i = 0; i < 5; i++) {
      dist += (standardized[i] - centroidStd[i]) ** 2;
    }
    if (dist < minDist) {
      minDist = dist;
      bestSegment = k;
    }
  }
  return bestSegment;
}

// Матрица конверсии по умолчанию (сегмент × вариант) в %
export const DEFAULT_CONVERSION_MATRIX: number[][] = [
  [1.50, 1.05, 1.10], // Аналитики
  [0.95, 1.45, 1.05], // Осторожные
  [1.00, 1.10, 1.45], // Ищущие простоты
  [1.30, 1.15, 1.25], // Общительные
];

export const VARIANT_NAMES = ['выгода', 'надёжность', 'простота'];

/**
 * Заглушка под языковую модель.
 * В реальном проекте здесь вызов LLM для генерации текста.
 */
export function generateVariants(segment: number): string[] {
  // TODO: подключить языковую модель. Она меняет только подачу, не смысл.
  const baseTexts = [
    [
      `Увеличьте доход вашего портфеля: персональный подбор инструментов с аналитикой рынка.`,
      `Надёжное размещение средств: проверенные продукты с защитой вложений.`,
      `Простое решение для ваших сбережений: минимум действий, понятные условия.`,
    ],
  ];
  return baseTexts[0];
}

export const LEGAL_BLOCK = '\n\n[Условия предоставления: ставка, срок и полный перечень условий — на сайте банка. Не является офертой. Банк вправе изменить условия в одностороннем порядке.]';
