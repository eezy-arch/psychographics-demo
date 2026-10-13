import { useState, useMemo, useCallback } from 'react';
import {
  QUESTIONS, SHORT_QUESTIONS, TRAIT_NAMES,
  calculateScores, calculateShortScores, predictSegment,
  SEGMENT_NAMES, SEGMENT_DESCRIPTIONS, VARIANT_NAMES,
  generateVariants, LEGAL_BLOCK, DEFAULT_CONVERSION_MATRIX,
} from './core/survey';
import {
  generateSyntheticData, clusterData, matchClustersToProfiles,
  adjustedRandIndex, silhouetteScore, getSegmentDescription,
} from './core/segments';
import { runSimulation, meanAcrossRepeats, percentileAcrossRepeats, SimulationResult } from './core/simulation';
import {
  annualMargin, additionalMargin, sampleSizePerGroup, minDetectableEffect,
} from './core/finance';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ===== Вкладка 1: Опрос =====
function Tab1Survey() {
  const [consent, setConsent] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [shortMode, setShortMode] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const activeQuestions = shortMode
    ? QUESTIONS.filter(q => SHORT_QUESTIONS.includes(q.id))
    : QUESTIONS;

  const allAnswered = activeQuestions.every(q => answers[q.id] !== undefined);

  const handleSubmit = () => {
    if (!allAnswered) return;
    setSubmitted(true);
  };

  const scores = useMemo(() => {
    if (!submitted) return null;
    return shortMode ? calculateShortScores(answers) : calculateScores(answers);
  }, [submitted, answers, shortMode]);

  const segment = useMemo(() => {
    if (!scores) return null;
    return predictSegment(scores);
  }, [scores]);

  const variants = useMemo(() => {
    if (segment === null) return null;
    return generateVariants(segment);
  }, [segment]);

  const radarData = scores ? TRAIT_NAMES.map((name, i) => ({
    trait: name,
    value: Math.round(scores[i]),
    fullMark: 100,
  })) : [];

  if (skipped) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ Демо на синтетических данных. Показывает работу конвейера, а не реальный эффект. Отклик сегментов задан допущениями.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">ℹ️ Опросник не валидирован; это не диагностика личности.</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-3">Единый текст предложения (без персонализации)</h3>
          <p className="text-gray-700 mb-4">
            Специальное предложение для вас: увеличьте доход вашего портфеля с персональным подбором инструментов.
          </p>
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-600 border-l-4 border-gray-300">
            {LEGAL_BLOCK}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Условия продукта не зависят от опроса. Персонализация позволяет показать формулировку, 
            которая лучше работает для вашего психологического профиля.
          </p>
          <button onClick={() => setSkipped(false)} className="mt-4 text-blue-600 hover:underline text-sm">
            ← Вернуться к опросу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Демо на синтетических данных. Показывает работу конвейера, а не реальный эффект. Отклик сегментов задан допущениями.
        </p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">ℹ️ Опросник не валидирован; это не диагностика личности.</p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Согласен пройти опрос. Сохраняется только метка сегмента, ответы не сохраняются.</span>
        </label>

        {!consent && (
          <button
            onClick={() => setSkipped(true)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >
            Пропустить опрос
          </button>
        )}

        {consent && (
          <>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Режим:</label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" checked={!shortMode} onChange={() => setShortMode(false)} />
                Полный (10 вопросов)
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" checked={shortMode} onChange={() => setShortMode(true)} />
                Сокращённый (5 вопросов)
              </label>
              {shortMode && <span className="text-xs text-orange-600">(менее точный)</span>}
            </div>

            {!submitted ? (
              <div className="space-y-4">
                {activeQuestions.map(q => (
                  <div key={q.id} className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">{q.id}. {q.text}</p>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7].map(val => (
                        <label key={val} className="flex flex-col items-center">
                          <input
                            type="radio"
                            name={`q${q.id}`}
                            checked={answers[q.id] === val}
                            onChange={() => setAnswers({ ...answers, [q.id]: val })}
                            className="w-4 h-4"
                          />
                          <span className="text-xs mt-1">{val}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Совсем не согласен</span>
                      <span>Полностью согласен</span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Показать результат
                </button>
                {!allAnswered && <p className="text-sm text-red-500">Ответьте на все вопросы</p>}
              </div>
            ) : scores && segment !== null && variants ? (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Ваш профиль</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Баллы черт (0–100)</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        {TRAIT_NAMES.map((name, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-1">{name}</td>
                            <td className="py-1 text-right font-mono">{Math.round(scores[i])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <ResponsiveContainer width="100%" height={250}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="trait" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800">Ваш сегмент: {SEGMENT_NAMES[segment]}</h4>
                  <p className="text-sm text-green-700 mt-1">{SEGMENT_DESCRIPTIONS[segment]}</p>
                </div>

                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Рекомендуемая формулировка (вариант «{VARIANT_NAMES[DEFAULT_CONVERSION_MATRIX[segment].indexOf(Math.max(...DEFAULT_CONVERSION_MATRIX[segment]))]}»)</h4>
                  <p className="text-gray-700">{variants[DEFAULT_CONVERSION_MATRIX[segment].indexOf(Math.max(...DEFAULT_CONVERSION_MATRIX[segment]))]}</p>
                  <div className="bg-gray-50 rounded p-3 text-sm text-gray-600 border-l-4 border-gray-300 mt-3">
                    {LEGAL_BLOCK}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Юридический блок не изменяется при персонализации.</p>
                </div>

                <button onClick={() => { setSubmitted(false); setAnswers({}); }} className="text-blue-600 hover:underline text-sm">
                  ← Пройти заново
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ===== Вкладка 2: Сегменты =====
function Tab2Segments() {
  const data = useMemo(() => generateSyntheticData(2000, 42), []);
  const { labels, scaledCentroids, scaler } = useMemo(() => clusterData(data), [data]);
  const assignment = useMemo(() => matchClustersToProfiles(scaledCentroids), [scaledCentroids]);

  const segmentSizes = useMemo(() => {
    const sizes = [0, 0, 0, 0];
    for (const l of labels) sizes[l]++;
    return sizes;
  }, [labels]);

  // Устойчивость: ARI на двух половинах
  const stabilityARI = useMemo(() => {
    const half = Math.floor(data.length / 2);
    const rng1 = data.slice(0, half);
    const rng2 = data.slice(half);
    const { labels: l1 } = clusterData(rng1);
    const { labels: l2 } = clusterData(rng2);
    // Сравниваем на пересечении (первые half точек)
    return adjustedRandIndex(l1, labels.slice(0, half));
  }, [data, labels]);

  // ARI с шумом
  const noiseARI = useMemo(() => {
    const noisyData = data.map(point =>
      point.map(v => Math.max(0, Math.min(100, v + (Math.random() - 0.5) * 14)))
    );
    const { labels: noisyLabels } = clusterData(noisyData);
    return adjustedRandIndex(labels, noisyLabels);
  }, [data, labels]);

  // Silhouette
  const silScore = useMemo(() => silhouetteScore(data, labels, 200), [data, labels]);

  const radarData = TRAIT_NAMES.map((name, i) => {
    const obj: Record<string, number | string> = { trait: name };
    for (let k = 0; k < 4; k++) {
      const mappedIdx = assignment[k];
      obj[SEGMENT_NAMES[mappedIdx]] = Math.round(scaledCentroids[k][i]);
    }
    return obj;
  });

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Демо на синтетических данных. Показывает работу конвейера, а не реальный эффект. Отклик сегментов задан допущениями.
        </p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-lg font-semibold">Кластеризация (K=4, K-means)</h3>
        <p className="text-sm text-gray-600">2000 синтетических респондентов из смеси 4 скрытых профилей</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {segmentSizes.map((size, i) => {
            const mappedName = SEGMENT_NAMES[assignment[i]];
            return (
              <div key={i} className="border rounded p-3" style={{ borderColor: colors[i] }}>
                <p className="font-semibold text-sm" style={{ color: colors[i] }}>{mappedName}</p>
                <p className="text-2xl font-bold">{size}</p>
                <p className="text-xs text-gray-500">{(size / 2000 * 100).toFixed(1)}%</p>
              </div>
            );
          })}
        </div>

        <div>
          <h4 className="font-medium mb-2">Профили сегментов (радар центроидов)</h4>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="trait" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} />
              {Array.from({ length: 4 }, (_, k) => (
                <Radar
                  key={k}
                  name={SEGMENT_NAMES[assignment[k]]}
                  dataKey={SEGMENT_NAMES[assignment[k]]}
                  stroke={colors[k]}
                  fill={colors[k]}
                  fillOpacity={0.1}
                />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h4 className="font-medium mb-2">Центроиды (баллы 0–100)</h4>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Сегмент</th>
                {TRAIT_NAMES.map(n => <th key={n} className="text-center py-2 text-xs">{n}</th>)}
                <th className="text-left py-2 text-xs">Описание</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }, (_, k) => {
                const mappedIdx = assignment[k];
                return (
                  <tr key={k} className="border-b">
                    <td className="py-2 font-medium" style={{ color: colors[k] }}>{SEGMENT_NAMES[mappedIdx]}</td>
                    {scaledCentroids[k].map((v, i) => (
                      <td key={i} className="text-center py-2 font-mono">{Math.round(v)}</td>
                    ))}
                    <td className="py-2 text-xs text-gray-600">{getSegmentDescription(scaledCentroids[k])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Проверка устойчивости</h4>
          <table className="text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-1 pr-4">ARI (две половины выборки)</td>
                <td className="font-mono">{stabilityARI.toFixed(3)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-4">ARI (с шумом σ=7)</td>
                <td className="font-mono">{noiseARI.toFixed(3)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-4">Silhouette score</td>
                <td className="font-mono">{silScore.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2">
            На синтетике показывает работу метода, не устойчивость на реальных людях.
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== Вкладка 3: Пре-тест макета =====
function Tab3Attention() {
  const [threshold, setThreshold] = useState(1.0);
  const [buttonRect, setButtonRect] = useState({ x: 60, y: 70, w: 30, h: 20 });
  const [conditionsRect, setConditionsRect] = useState({ x: 5, y: 85, w: 40, h: 12 });

  // Проверяем пересечение
  const rectsOverlap = (
    buttonRect.x < conditionsRect.x + conditionsRect.w &&
    buttonRect.x + buttonRect.w > conditionsRect.x &&
    buttonRect.y < conditionsRect.y + conditionsRect.h &&
    buttonRect.y + buttonRect.h > conditionsRect.y
  );

  // Симуляция карты заметности (numpy fallback)
  const attentionMap = useMemo(() => {
    const w = 100, h = 100;
    const map: number[][] = [];
    for (let y = 0; y < h; y++) {
      map[y] = [];
      for (let x = 0; x < w; x++) {
        // Центр внимания (кнопка)
        const dButton = Math.sqrt((x - 75) ** 2 + (y - 80) ** 2);
        const buttonAttn = Math.exp(-(dButton ** 2) / 200) * 0.8;
        // Заголовок
        const dTitle = Math.sqrt((x - 50) ** 2 + (y - 20) ** 2);
        const titleAttn = Math.exp(-(dTitle ** 2) / 500) * 0.5;
        // Контрастные края
        const edgeAttn = (Math.abs(Math.sin(x * 0.3)) + Math.abs(Math.cos(y * 0.2))) * 0.1;
        map[y][x] = buttonAttn + titleAttn + edgeAttn;
      }
    }
    return map;
  }, []);

  const calcAttention = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    let regionSum = 0;
    let totalSum = 0;
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        totalSum += attentionMap[y][x];
        if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) {
          regionSum += attentionMap[y][x];
        }
      }
    }
    const attentionShare = regionSum / totalSum;
    const areaShare = (rect.w * rect.h) / 10000;
    const density = attentionShare / areaShare;
    return { attentionShare, areaShare, density };
  }, [attentionMap]);

  const buttonMetrics = calcAttention(buttonRect);
  const conditionsMetrics = calcAttention(conditionsRect);

  const verdict = (density: number) => density >= threshold ? '✅ Заметна' : '⚠️ Слабо заметна';

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Демо на синтетических данных. Показывает работу конвейера, а не реальный эффект. Отклик сегментов задан допущениями.
        </p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          ℹ️ Метод оценивает универсальную заметность (bottom-up), а не поведение клиентов банка. 
          Используется для сравнения макетов, не как абсолютная оценка.
        </p>
        <p className="text-xs text-blue-600 mt-1">Метод: numpy fallback (контраст + градиенты + размытие). cv2 не подключён.</p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-lg font-semibold">Пре-тест макета (демо-баннер)</h3>

        {/* Визуализация баннера */}
        <div className="relative w-full max-w-lg mx-auto border rounded overflow-hidden bg-gradient-to-b from-blue-50 to-white" style={{ aspectRatio: '2/1' }}>
          {/* Заголовок */}
          <div className="absolute top-[15%] left-[20%] text-lg font-bold text-gray-800">Специальное предложение</div>
          <div className="absolute top-[25%] left-[20%] text-sm text-gray-600">Увеличьте доход вашего портфеля</div>
          {/* Кнопка */}
          <div
            className="absolute bg-blue-600 text-white text-xs font-bold flex items-center justify-center rounded"
            style={{
              left: `${buttonRect.x}%`, top: `${buttonRect.y}%`,
              width: `${buttonRect.w}%`, height: `${buttonRect.h}%`,
            }}
          >
            Подробнее
          </div>
          {/* Блок условий */}
          <div
            className="absolute bg-gray-100 border border-gray-300 text-[8px] text-gray-500 flex items-center justify-center"
            style={{
              left: `${conditionsRect.x}%`, top: `${conditionsRect.y}%`,
              width: `${conditionsRect.w}%`, height: `${conditionsRect.h}%`,
            }}
          >
            Условия: ставка от 5%, срок 12 мес.
          </div>
          {/* Рамки областей */}
          <div className="absolute border-2 border-red-500 pointer-events-none" style={{
            left: `${buttonRect.x}%`, top: `${buttonRect.y}%`,
            width: `${buttonRect.w}%`, height: `${buttonRect.h}%`,
          }} />
          <div className="absolute border-2 border-orange-500 pointer-events-none" style={{
            left: `${conditionsRect.x}%`, top: `${conditionsRect.y}%`,
            width: `${conditionsRect.w}%`, height: `${conditionsRect.h}%`,
          }} />
        </div>

        {rectsOverlap && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
            ⚠️ Прямоугольники пересекаются! Проверьте координаты.
          </div>
        )}

        {/* Настройки областей */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <h4 className="font-medium text-sm text-red-600 mb-2">🔲 Кнопка</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label>X (%): <input type="number" value={buttonRect.x} onChange={e => setButtonRect({ ...buttonRect, x: +e.target.value })} className="w-16 border rounded px-1" min={0} max={100} /></label>
              <label>Y (%): <input type="number" value={buttonRect.y} onChange={e => setButtonRect({ ...buttonRect, y: +e.target.value })} className="w-16 border rounded px-1" min={0} max={100} /></label>
              <label>Ширина (%): <input type="number" value={buttonRect.w} onChange={e => setButtonRect({ ...buttonRect, w: +e.target.value })} className="w-16 border rounded px-1" min={1} max={100} /></label>
              <label>Высота (%): <input type="number" value={buttonRect.h} onChange={e => setButtonRect({ ...buttonRect, h: +e.target.value })} className="w-16 border rounded px-1" min={1} max={100} /></label>
            </div>
          </div>
          <div className="border rounded p-3">
            <h4 className="font-medium text-sm text-orange-600 mb-2">🔲 Блок условий</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label>X (%): <input type="number" value={conditionsRect.x} onChange={e => setConditionsRect({ ...conditionsRect, x: +e.target.value })} className="w-16 border rounded px-1" min={0} max={100} /></label>
              <label>Y (%): <input type="number" value={conditionsRect.y} onChange={e => setConditionsRect({ ...conditionsRect, y: +e.target.value })} className="w-16 border rounded px-1" min={0} max={100} /></label>
              <label>Ширина (%): <input type="number" value={conditionsRect.w} onChange={e => setConditionsRect({ ...conditionsRect, w: +e.target.value })} className="w-16 border rounded px-1" min={1} max={100} /></label>
              <label>Высота (%): <input type="number" value={conditionsRect.h} onChange={e => setConditionsRect({ ...conditionsRect, h: +e.target.value })} className="w-16 border rounded px-1" min={1} max={100} /></label>
            </div>
          </div>
        </div>

        {/* Порог */}
        <div>
          <label className="text-sm font-medium">Порог плотности внимания: {threshold.toFixed(1)}</label>
          <input
            type="range" min={0.2} max={3.0} step={0.1}
            value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="w-full"
          />
        </div>

        {/* Результаты */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <h4 className="font-medium text-sm text-red-600 mb-2">Кнопка</h4>
            <table className="text-sm w-full">
              <tbody>
                <tr><td>Доля внимания</td><td className="text-right font-mono">{(buttonMetrics.attentionShare * 100).toFixed(1)}%</td></tr>
                <tr><td>Доля площади</td><td className="text-right font-mono">{(buttonMetrics.areaShare * 100).toFixed(1)}%</td></tr>
                <tr><td>Плотность внимания</td><td className="text-right font-mono">{buttonMetrics.density.toFixed(2)}</td></tr>
                <tr><td className="font-medium">Вердикт</td><td className="text-right">{verdict(buttonMetrics.density)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="border rounded p-3">
            <h4 className="font-medium text-sm text-orange-600 mb-2">Блок условий</h4>
            <table className="text-sm w-full">
              <tbody>
                <tr><td>Доля внимания</td><td className="text-right font-mono">{(conditionsMetrics.attentionShare * 100).toFixed(1)}%</td></tr>
                <tr><td>Доля площади</td><td className="text-right font-mono">{(conditionsMetrics.areaShare * 100).toFixed(1)}%</td></tr>
                <tr><td>Плотность внимания</td><td className="text-right font-mono">{conditionsMetrics.density.toFixed(2)}</td></tr>
                <tr><td className="font-medium">Вердикт</td><td className="text-right">{verdict(conditionsMetrics.density)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Слабо заметный блок условий — риск и для клиента, и для соответствия закону о рекламе.
        </p>
      </div>
    </div>
  );
}

// ===== Вкладка 4: Подбор варианта =====
function Tab4Selection({ segmentSizes, simResult, setSimResult }: {
  segmentSizes: number[];
  simResult: SimulationResult | null;
  setSimResult: (r: SimulationResult | null) => void;
}) {
  const [totalShows, setTotalShows] = useState(20000);
  const [repeats] = useState(200);
  const [batchSize, setBatchSize] = useState(10);
  const [singleVariant, setSingleVariant] = useState(0);
  const [conversionMatrix, setConversionMatrix] = useState(DEFAULT_CONVERSION_MATRIX.map(r => [...r]));
  const [variantTexts, setVariantTexts] = useState(() => generateVariants(0));
  const [running, setRunning] = useState(false);
  const [forbiddenWarning, setForbiddenWarning] = useState<string | null>(null);

  const FORBIDDEN_PHRASES = ['гарантированный доход', 'без риска', 'только сегодня'];

  const checkForbidden = useCallback((texts: string[]) => {
    const warnings: string[] = [];
    for (let v = 0; v < texts.length; v++) {
      const normalized = texts[v].toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').replace(/[.,!?;:]/g, '');
      for (const phrase of FORBIDDEN_PHRASES) {
        const phraseNorm = phrase.replace(/ё/g, 'е');
        if (normalized.includes(phraseNorm)) {
          warnings.push(`Вариант «${VARIANT_NAMES[v]}»: обнаружена запрещённая формулировка «${phrase}»`);
        }
      }
    }
    return warnings;
  }, []);

  const handleTextChange = (idx: number, text: string) => {
    const newTexts = [...variantTexts];
    newTexts[idx] = text;
    setVariantTexts(newTexts);
    const warnings = checkForbidden(newTexts);
    setForbiddenWarning(warnings.length > 0 ? warnings.join('; ') : null);
  };

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      // Проверяем, есть ли запрещённые варианты
      const excludedVariants = new Set<number>();
      for (let v = 0; v < 3; v++) {
        const normalized = variantTexts[v].toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').replace(/[.,!?;:]/g, '');
        for (const phrase of FORBIDDEN_PHRASES) {
          if (normalized.includes(phrase.replace(/ё/g, 'е'))) {
            excludedVariants.add(v);
          }
        }
      }

      if (excludedVariants.size === 3) {
        setForbiddenWarning('Все варианты исключены из-за запрещённых формулировок!');
        setRunning(false);
        return;
      }

      // Матрица в долях (не %)
      const matrix = conversionMatrix.map(row => row.map(v => v / 100));

      const result = runSimulation({
        totalShows,
        repeats,
        batchSize,
        segmentSizes: segmentSizes.map(s => s / 2000),
        conversionMatrix: matrix,
        singleVariant,
      });
      setSimResult(result);
      setRunning(false);
    }, 100);
  };

  // Данные для графика накопленной конверсии
  const chartData = useMemo(() => {
    if (!simResult) return [];
    const steps = simResult.accumulationSteps;
    const meanSingle = meanAcrossRepeats(simResult.accumulationSingle);
    const meanUniform = meanAcrossRepeats(simResult.accumulationUniform);
    const meanThompson = meanAcrossRepeats(simResult.accumulationThompson);
    const meanOracle = meanAcrossRepeats(simResult.accumulationOracle);

    // Прореживаем для графика
    const stride = Math.max(1, Math.floor(steps.length / 50));
    const indices: number[] = [];
    for (let i = 0; i < steps.length; i += stride) indices.push(i);
    if (indices[indices.length - 1] !== steps.length - 1) indices.push(steps.length - 1);

    return indices.map(i => ({
      step: steps[i],
      'Единый текст': +(meanSingle[i] * 100).toFixed(4),
      'Равномерная': +(meanUniform[i] * 100).toFixed(4),
      'Thompson': +(meanThompson[i] * 100).toFixed(4),
      'Оракул': +(meanOracle[i] * 100).toFixed(4),
    }));
  }, [simResult]);

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Демо на синтетических данных. Показывает работу конвейера, а не реальный эффект. Отклик сегментов задан допущениями.
        </p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          ℹ️ Симуляция берёт истину из заданной матрицы. Показывает, как быстро алгоритм находит лучший вариант 
          при заданных допущениях, а не реальный эффект.
        </p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-lg font-semibold">Подбор варианта (Thompson Sampling)</h3>

        {/* Тексты вариантов */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Тексты вариантов:</h4>
          {variantTexts.map((text, i) => (
            <div key={i} className="border rounded p-3">
              <label className="text-xs font-medium text-gray-500">Вариант «{VARIANT_NAMES[i]}»:</label>
              <textarea
                value={text}
                onChange={e => handleTextChange(i, e.target.value)}
                className="w-full border rounded p-2 text-sm mt-1"
                rows={2}
              />
              <div className="text-xs text-gray-400 mt-1">
                + юридический блок: {text.endsWith(LEGAL_BLOCK.trim()) || text.includes('[Условия предоставления') ? '✅ не изменён' : '⚠️ проверьте'}
              </div>
            </div>
          ))}
        </div>

        {forbiddenWarning && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            🚫 {forbiddenWarning}
          </div>
        )}

        {/* Матрица конверсии */}
        <div>
          <h4 className="font-medium text-sm mb-2">Матрица конверсии (%) — редактируется:</h4>
          <table className="text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 pr-3">Сегмент</th>
                {VARIANT_NAMES.map(v => <th key={v} className="text-center py-1 px-3">{v}</th>)}
              </tr>
            </thead>
            <tbody>
              {SEGMENT_NAMES.map((name, s) => (
                <tr key={s} className="border-b">
                  <td className="py-1 pr-3">{name}</td>
                  {conversionMatrix[s].map((val, v) => (
                    <td key={v} className="text-center py-1 px-3">
                      <input
                        type="number"
                        value={val}
                        onChange={e => {
                          const newMatrix = conversionMatrix.map(r => [...r]);
                          newMatrix[s][v] = Math.max(0.1, Math.min(10, +e.target.value));
                          setConversionMatrix(newMatrix);
                        }}
                        className="w-16 border rounded px-1 text-center text-sm"
                        step={0.05}
                        min={0.1}
                        max={10}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-1">Допустимо 0.1–10%. Клик и покупку не различаем (допущение).</p>
        </div>

        {/* Параметры */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium">Показов: {totalShows.toLocaleString()}</label>
            <input type="range" min={5000} max={200000} step={5000} value={totalShows}
              onChange={e => setTotalShows(+e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-medium">Пачка обновления: {batchSize}</label>
            <input type="range" min={5} max={50} step={5} value={batchSize}
              onChange={e => setBatchSize(+e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-medium">Единый текст:</label>
            <select value={singleVariant} onChange={e => setSingleVariant(+e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
              {VARIANT_NAMES.map((v, i) => <option key={i} value={i}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Повторов: {repeats}</label>
            <p className="text-xs text-gray-500">(фиксировано)</p>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
        >
          {running ? '⏳ Симуляция...' : '▶ Запустить симуляцию'}
        </button>

        {/* Результаты */}
        {simResult && (
          <div className="space-y-6 border-t pt-4">
            <h4 className="font-semibold">Результаты</h4>

            {/* 1. Относительный рост */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded p-3">
                <h5 className="text-sm font-medium">vs Единый текст</h5>
                <p className="text-lg font-bold text-green-700">
                  +{(simResult.growthVsSingle.mean * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600">
                  90% интервал: [{(simResult.growthVsSingle.p5 * 100).toFixed(1)}%, {(simResult.growthVsSingle.p95 * 100).toFixed(1)}%]
                </p>
                <p className="text-xs text-gray-600">
                  Доля выигрышей: {(simResult.growthVsSingle.winRate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="border rounded p-3">
                <h5 className="text-sm font-medium">vs Равномерная рассылка</h5>
                <p className="text-lg font-bold text-blue-700">
                  +{(simResult.growthVsUniform.mean * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600">
                  90% интервал: [{(simResult.growthVsUniform.p5 * 100).toFixed(1)}%, {(simResult.growthVsUniform.p95 * 100).toFixed(1)}%]
                </p>
                <p className="text-xs text-gray-600">
                  Доля выигрышей: {(simResult.growthVsUniform.winRate * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* 2. График накопленной конверсии */}
            <div>
              <h5 className="text-sm font-medium mb-2">Накопленная конверсия (среднее по {repeats} прогонам)</h5>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" tick={{ fontSize: 10 }} label={{ value: 'Показов', position: 'bottom', fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} label={{ value: 'Конверсия, %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Единый текст" stroke="#9ca3af" dot={false} />
                  <Line type="monotone" dataKey="Равномерная" stroke="#f59e0b" dot={false} />
                  <Line type="monotone" dataKey="Thompson" stroke="#3b82f6" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Оракул" stroke="#10b981" dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Выбор варианта по сегментам */}
            <div>
              <h5 className="text-sm font-medium mb-2">Выбор варианта по сегментам</h5>
              <table className="text-sm border-collapse w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">Сегмент</th>
                    {VARIANT_NAMES.map(v => <th key={v} className="text-center py-1">{v} (доля)</th>)}
                    <th className="text-center py-1">Совпал с оракулом</th>
                  </tr>
                </thead>
                <tbody>
                  {SEGMENT_NAMES.map((name, s) => (
                    <tr key={s} className="border-b">
                      <td className="py-1">{name}</td>
                      {simResult.chosenBySegment[s].map((share, v) => (
                        <td key={v} className="text-center py-1 font-mono">{(share * 100).toFixed(1)}%</td>
                      ))}
                      <td className="text-center py-1">{simResult.matchedOracle[s][0] ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 4. Доля показов на менее эффективные */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded p-3">
                <p className="text-xs text-gray-500">Равномерная рассылка</p>
                <p className="text-lg font-bold">{(simResult.suboptimalShareUniform * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-500">доля на не-лучшие варианты</p>
              </div>
              <div className="border rounded p-3">
                <p className="text-xs text-gray-500">Thompson Sampling</p>
                <p className="text-lg font-bold">{(simResult.suboptimalShareThompson * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-500">доля на не-лучшие варианты (цена обучения)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Вкладка 5: Эффект в деньгах =====
function Tab5Finance({ simResult }: { simResult: SimulationResult | null }) {
  const [clients, setClients] = useState(1000000);
  const [mailingsPerYear, setMailingsPerYear] = useState(12);
  const [baseConversion, setBaseConversion] = useState(0.01);
  const [marginPerProduct, setMarginPerProduct] = useState(3000);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.80);
  const [availableSample, setAvailableSample] = useState(500000);

  const baseMargin = annualMargin(clients, mailingsPerYear, baseConversion, marginPerProduct);
  const growthRates = [0.03, 0.07, 0.12];
  const scenarios = growthRates.map(g => ({
    growth: g,
    additional: additionalMargin(baseMargin, g),
  }));

  // Результат симуляции
  const simGrowth = simResult ? simResult.growthVsSingle.mean : null;
  const simGrowthP5 = simResult ? simResult.growthVsSingle.p5 : null;
  const simGrowthP95 = simResult ? simResult.growthVsSingle.p95 : null;

  // Размеры групп
  const effects = [0.03, 0.07, 0.12, 0.20];
  const sampleSizes = effects.map(e => sampleSizePerGroup(baseConversion, e, alpha, power));
  const minEffect = minDetectableEffect(Math.floor(availableSample / 2), baseConversion, alpha, power);

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Демо на синтетических данных. Показывает работу конвейера, а не реальный эффект. Отклик сегментов задан допущениями.
        </p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-lg font-semibold">Эффект в деньгах и мощность теста</h3>

        {/* Параметры */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium">Клиентов</label>
            <input type="number" value={clients} onChange={e => setClients(+e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium">Рассылок/год</label>
            <input type="number" value={mailingsPerYear} onChange={e => setMailingsPerYear(+e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium">Базовая конверсия</label>
            <input type="number" value={baseConversion * 100} step={0.1}
              onChange={e => setBaseConversion(+e.target.value / 100)}
              className="w-full border rounded px-2 py-1 text-sm" />
            <span className="text-xs text-gray-500">%</span>
          </div>
          <div>
            <label className="text-xs font-medium">Маржа с продукта (₽)</label>
            <input type="number" value={marginPerProduct} onChange={e => setMarginPerProduct(+e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>

        {/* Таблица сценариев */}
        <div>
          <h4 className="font-medium text-sm mb-2">Сценарии (условные расчёты, не прогноз)</h4>
          <table className="text-sm border-collapse w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Сценарий</th>
                <th className="text-right py-2">Рост</th>
                <th className="text-right py-2">Доп. маржа/год</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">Рост +{(s.growth * 100).toFixed(0)}%</td>
                  <td className="text-right py-2 font-mono">+{(s.growth * 100).toFixed(0)}%</td>
                  <td className="text-right py-2 font-mono">{(s.additional / 1e6).toFixed(1)} млн ₽</td>
                </tr>
              ))}
              <tr className="border-b bg-blue-50">
                <td className="py-2 font-medium">Результат симуляции</td>
                <td className="text-right py-2 font-mono">
                  {simGrowth !== null ? `+${(simGrowth * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="text-right py-2 font-mono">
                  {simGrowth !== null
                    ? `${(additionalMargin(baseMargin, simGrowth) / 1e6).toFixed(1)} млн ₽`
                    : 'Запустите симуляцию на вкладке 4'}
                </td>
              </tr>
              {simGrowth !== null && simGrowthP5 !== null && simGrowthP95 !== null && (
                <tr className="bg-blue-50">
                  <td className="py-1 text-xs text-gray-500">90% интервал</td>
                  <td className="text-right py-1 text-xs font-mono text-gray-500">
                    [{(simGrowthP5 * 100).toFixed(1)}%, {(simGrowthP95 * 100).toFixed(1)}%]
                  </td>
                  <td className="text-right py-1 text-xs font-mono text-gray-500">
                    [{(additionalMargin(baseMargin, simGrowthP5) / 1e6).toFixed(1)}, {(additionalMargin(baseMargin, simGrowthP95) / 1e6).toFixed(1)}] млн ₽
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2">
            Маржа в год = клиентов × рассылок × конверсия × маржа = {(baseMargin / 1e6).toFixed(1)} млн ₽
          </p>
        </div>

        {/* Мощность теста */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-2">Калькулятор мощности A/B-теста</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium">α (значимость)</label>
              <input type="number" value={alpha * 100} step={1}
                onChange={e => setAlpha(+e.target.value / 100)}
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Мощность</label>
              <input type="number" value={power * 100} step={5}
                onChange={e => setPower(+e.target.value / 100)}
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Доступная выборка</label>
              <input type="number" value={availableSample} step={10000}
                onChange={e => setAvailableSample(+e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
          </div>

          <table className="text-sm border-collapse w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Относительный рост</th>
                <th className="text-right py-2">Размер группы</th>
                <th className="text-right py-2">Всего нужно</th>
              </tr>
            </thead>
            <tbody>
              {effects.map((e, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">+{(e * 100).toFixed(0)}%</td>
                  <td className="text-right py-2 font-mono">{sampleSizes[i].toLocaleString()}</td>
                  <td className="text-right py-2 font-mono">{(sampleSizes[i] * 2).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 bg-gray-50 rounded p-3">
            <p className="text-sm">
              <strong>Минимальный обнаружимый рост</strong> при выборке {availableSample.toLocaleString()} (группа {Math.floor(availableSample / 2).toLocaleString()}):
            </p>
            <p className="text-lg font-bold text-blue-700">+{(minEffect * 100).toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">
              Малые эффекты одной рассылкой не измерить. Порог успеха пилота считается от размера выборки.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Основное приложение =====
export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  // Сегменты из вкладки 2
  const segmentSizes = useMemo(() => {
    const data = generateSyntheticData(2000, 42);
    const { labels } = clusterData(data);
    const sizes = [0, 0, 0, 0];
    for (const l of labels) sizes[l]++;
    return sizes;
  }, []);

  const tabs = ['Опрос', 'Сегменты', 'Пре-тест макета', 'Подбор варианта', 'Эффект в деньгах'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800">
            Психографическая персонализация банковских предложений
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Акселератор «Газпромбанк.Тех» • Трек «Финтех.Наука» • Демо-платформа
          </p>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === i
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {i + 1}. {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 0 && <Tab1Survey />}
        {activeTab === 1 && <Tab2Segments />}
        {activeTab === 2 && <Tab3Attention />}
        {activeTab === 3 && <Tab4Selection segmentSizes={segmentSizes} simResult={simResult} setSimResult={setSimResult} />}
        {activeTab === 4 && <Tab5Finance simResult={simResult} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <p className="text-xs text-gray-500">
            В реальном применении психографический таргетинг в финансах требует согласия клиента, 
            проверки по 152-ФЗ и закону о рекламе, комплаенса и аудита справедливости.
          </p>
          <details className="mt-3">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              Допущения, зашитые в код
            </summary>
            <ul className="text-xs text-gray-500 mt-2 space-y-1 list-disc list-inside">
              <li>Профили сегментов: фиксированные средние в генераторе синтетических данных</li>
              <li>Матрица конверсии 4×3: задана допущением, значения по умолчанию</li>
              <li>Пачка обновления апостериора: batchSize=10 (по умолчанию)</li>
              <li>Пропорциональное деление показов между сегментами по размерам кластеров</li>
              <li>Порог плотности внимания: 1.0 (по умолчанию, настраивается)</li>
              <li>Шум для имитации повторного опроса: σ=7 пунктов</li>
              <li>Клик = конверсия (не различаем)</li>
              <li>Конверсия целевого действия по предложению, не покупка</li>
              <li>2000 респондентов, смесь 4 профилей с равными долями</li>
              <li>Стандартное отклонение генератора: 12 пунктов</li>
              <li>Корреляция между чертами: 0.15 (умеренная)</li>
              <li>Thompson sampling: Beta(1,1) prior, отдельно по сегментам</li>
              <li>Юридический блок: условный текст, не юридическая формулировка</li>
            </ul>
          </details>
        </div>
      </footer>
    </div>
  );
}
