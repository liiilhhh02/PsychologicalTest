const state = {
  suites: [],
  suiteId: '',
  suiteName: '',
  runtimeMode: 'server',
  questions: [],
  dimensionDetails: [],
  metadata: null,
  adConfig: null,
  archetypeLibrary: null,
  answers: new Map(),
  currentIndex: 0,
  result: null,
  chartMode: 'radar',
};

const homeView = document.getElementById('home-view');
const testView = document.getElementById('test-view');
const resultView = document.getElementById('result-view');

const suiteNameLabel = document.getElementById('suite-name');
const suiteSelect = document.getElementById('suite-select');

const homeQuestionCount = document.getElementById('home-total-questions');
const homeDimensionCount = document.getElementById('home-total-dimensions');
const metaQuestionCount = document.getElementById('meta-question-count');
const metaDimensionCount = document.getElementById('meta-dimension-count');

const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const questionText = document.getElementById('question-text');
const optionList = document.getElementById('option-list');

const summaryTotal = document.getElementById('summary-total');
const summaryTop = document.getElementById('summary-top');
const summaryHighCount = document.getElementById('summary-high-count');
const summarySpread = document.getElementById('summary-spread');
const insightList = document.getElementById('insight-list');

const radarWrap = document.getElementById('radar-wrap');
const barsWrap = document.getElementById('bars-wrap');
const radarCanvas = document.getElementById('radar-chart');
const barsCanvas = document.getElementById('bars-chart');
const vizCaption = document.getElementById('viz-caption');

const btnChartRadar = document.getElementById('btn-chart-radar');
const btnChartBars = document.getElementById('btn-chart-bars');

const topList = document.getElementById('top-list');
const deepAnalysis = document.getElementById('deep-analysis');
const associationList = document.getElementById('association-list');
const personaSection = document.getElementById('persona-section');
const personaImage = document.getElementById('persona-image');
const personaTitle = document.getElementById('persona-title');
const personaSummary = document.getElementById('persona-summary');
const personaTags = document.getElementById('persona-tags');
const personaStrengths = document.getElementById('persona-strengths');
const personaGrowth = document.getElementById('persona-growth');
const personaPlan = document.getElementById('persona-plan');
const archetypeSection = document.getElementById('archetype-section');
const archetypeTitle = document.getElementById('archetype-title');
const archetypeLead = document.getElementById('archetype-lead');
const archetypeHighlight = document.getElementById('archetype-highlight');
const archetypeRankings = document.getElementById('archetype-rankings');
const reportMeta = document.getElementById('report-meta');
const reportTableBody = document.getElementById('report-table-body');

const btnStart = document.getElementById('btn-start');
const btnShareSite = document.getElementById('btn-share-site');
const btnPrev = document.getElementById('btn-prev');
const btnHome = document.getElementById('btn-home');
const btnRestart = document.getElementById('btn-restart');
const btnViewHome = document.getElementById('btn-view-home');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnShareResult = document.getElementById('btn-share-result');

const adHome = document.getElementById('ad-home');
const adResult = document.getElementById('ad-result');

let resizeTimer = null;
let adScriptLoadPromise = null;
const STATIC_SUITE_IDS = [
  'fruit-personality',
  'animal-personality',
  'mental-age',
  'ayp-age-gap-love-self',
  'adhd-assessment-adult',
  'adhd-assessment-child',
  'ayp-age-gap-love-partner',
  'dark-personality',
  'milu-basic',
  'milu-pro-100',
  'bdsm-60',
];
const ARCHETYPE_SUITE_IDS = new Set(['animal-personality', 'fruit-personality']);
const ANIMAL_EMOJI_MAP = {
  狗: '🐶',
  猫: '🐱',
  狼: '🐺',
  狐: '🦊',
  狮: '🦁',
  熊: '🐻',
  兔: '🐰',
  仓鼠: '🐹',
  天鹅: '🦢',
  鹿: '🦌',
  鹰: '🦅',
  鸟鸮: '🦉',
  水豚: '🦫',
  鲸: '🐋',
  鹦鹉: '🦜',
  章鱼: '🐙',
  鲨鱼: '🦈',
  海豚: '🐬',
  浣熊: '🦝',
  猫鼬: '🐾',
};
const FRUIT_EMOJI_MAP = {
  草莓: '🍓',
  橙子: '🍊',
  西瓜: '🍉',
  葡萄: '🍇',
  蓝莓: '🫐',
  香蕉: '🍌',
  苹果: '🍎',
  桃子: '🍑',
  芒果: '🥭',
  柠檬: '🍋',
  樱桃: '🍒',
  榴莲: '🟡',
  梨: '🍐',
  荔枝: '🟠',
  龙眼: '🟤',
  山竹: '🟣',
  椰子: '🥥',
  猕猴桃: '🥝',
  石榴: '❤️',
  哈密瓜: '🍈',
};

function suiteCategoryLabel(category) {
  if (category === 'personality') {
    return '性格理解';
  }
  if (category === 'relationship') {
    return '关系沟通';
  }
  if (category === 'screening') {
    return '筛查工具';
  }
  if (category === 'sensitive') {
    return '扩展主题';
  }
  if (category === 'adult') {
    return '成人主题';
  }
  return '综合测评';
}

function normalizePriority(priority, fallback = 999) {
  const value = Number(priority);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(value);
}

function sortSuitesByPriority(suites) {
  return [...suites].sort((a, b) => {
    const pa = normalizePriority(a.priority, 999);
    const pb = normalizePriority(b.priority, 999);
    if (pa !== pb) {
      return pa - pb;
    }
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function showView(target) {
  homeView.classList.add('hidden');
  testView.classList.add('hidden');
  resultView.classList.add('hidden');

  if (target === 'home') {
    homeView.classList.remove('hidden');
  }
  if (target === 'test') {
    testView.classList.remove('hidden');
  }
  if (target === 'result') {
    resultView.classList.remove('hidden');
  }
}

function sortedDimensions(dimensions) {
  return [...dimensions].sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    return a.key.localeCompare(b.key);
  });
}

function levelClass(level) {
  if (level === '低偏好') {
    return 'level-low';
  }
  if (level === '中低偏好' || level === '中高偏好') {
    return 'level-mid';
  }
  return 'level-high';
}

function barColor(percentage) {
  if (percentage >= 75) {
    return '#c5533c';
  }
  if (percentage >= 50) {
    return '#d08d2f';
  }
  if (percentage >= 25) {
    return '#2f8e7d';
  }
  return '#547f6a';
}

function safeText(raw) {
  return String(raw)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function appUrl(path) {
  const cleaned = String(path || '').replace(/^\/+/, '');
  return new URL(cleaned, window.location.href).toString();
}

function levelFromPercentage(percentage) {
  if (percentage <= 24) {
    return '低偏好';
  }
  if (percentage <= 49) {
    return '中低偏好';
  }
  if (percentage <= 74) {
    return '中高偏好';
  }
  return '高偏好';
}

async function fetchJson(url) {
  const resp = await fetch(appUrl(url));
  if (!resp.ok) {
    throw new Error(`${url} 请求失败 (${resp.status})`);
  }
  return resp.json();
}

function archetypeTypeBySuiteId(suiteId) {
  if (suiteId === 'animal-personality') {
    return 'animal';
  }
  if (suiteId === 'fruit-personality') {
    return 'fruit';
  }
  return null;
}

function archetypeEmoji(type, name) {
  if (type === 'animal') {
    return ANIMAL_EMOJI_MAP[name] || '🧭';
  }
  if (type === 'fruit') {
    return FRUIT_EMOJI_MAP[name] || '🍀';
  }
  return '🧩';
}

async function fetchArchetypeLibrary() {
  try {
    const payload = await fetchJson('archetypes.json');
    state.archetypeLibrary = payload;
  } catch (error) {
    console.warn('原型库加载失败，动物/水果图鉴将使用降级模式。', error);
    state.archetypeLibrary = null;
  }
}

async function loadStaticSuites() {
  const suites = await Promise.all(
    STATIC_SUITE_IDS.map(async (id) => {
      const [suiteMeta, questions, dimensionDetails] = await Promise.all([
        fetchJson(`question-suites/${id}/suite.json`),
        fetchJson(`question-suites/${id}/questions.json`),
        fetchJson(`question-suites/${id}/dimension_descriptions.json`),
      ]);

      const dimensionMap = new Map(dimensionDetails.map((item) => [item.key, item]));
      const dimensionOrder = [...new Set(questions.map((item) => item.dimension))];
      const dimensionMeta = dimensionOrder.map((key) => ({
        key,
        name: dimensionMap.get(key)?.name || key,
        questionCount: questions.filter((item) => item.dimension === key).length,
        description: dimensionMap.get(key)?.description || '暂无维度说明。',
      }));

      return {
        id: suiteMeta.id || id,
        name: suiteMeta.name || id,
        version: suiteMeta.version || '0.0.0',
        description: suiteMeta.description || '',
        source: suiteMeta.source || 'static local mode',
        category: suiteMeta.category || 'other',
        priority: normalizePriority(suiteMeta.priority, 999),
        tags: Array.isArray(suiteMeta.tags) ? suiteMeta.tags : [],
        adultContent: Boolean(suiteMeta.adultContent),
        totalQuestions: questions.length,
        dimensionCount: dimensionMeta.length,
        _questions: questions,
        _dimensionDetails: dimensionDetails,
        _dimensionMeta: dimensionMeta,
      };
    })
  );

  return suites;
}

function hashString(input) {
  let hash = 0;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickBySeed(items, seed, fallback = '') {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }
  return items[hashString(seed) % items.length];
}

function bandKeyFromPercentage(percentage) {
  if (percentage <= 24) {
    return 'low';
  }
  if (percentage <= 49) {
    return 'midLow';
  }
  if (percentage <= 74) {
    return 'midHigh';
  }
  return 'high';
}

function makeStaticAnalysis(dim, percentage) {
  const band = bandKeyFromPercentage(percentage);
  const summaryByBand = {
    low: [
      '当前处于低激活位，你更重视边界完整与节奏稳定。',
      '这个维度暂不承担核心驱动，你以可控体验为主。',
    ],
    midLow: [
      '当前进入中低激活区，你保持兴趣并保留审慎判断。',
      '该维度已有探索意愿，适合小步试验。',
    ],
    midHigh: [
      '当前处于中高激活区，已经成为常用体验模块。',
      '该维度具备稳定影响力，建议纳入固定协商流程。',
    ],
    high: [
      '当前位于高激活核心区，会直接影响体验满意度。',
      '该维度是高权重主轴，建议保持闭环协作。',
    ],
  };

  const styleByBand = {
    low: ['边界先行', '稳态执行'],
    midLow: ['谨慎探索', '节奏控制'],
    midHigh: ['稳定驱动', '结构协作'],
    high: ['核心驱动', '高权重偏好'],
  };

  const summary = pickBySeed(summaryByBand[band], `${dim.key}-summary`);
  const style = pickBySeed(styleByBand[band], `${dim.key}-style`);

  return {
    summary: `${dim.name}当前得分 ${percentage}%（${levelFromPercentage(percentage)}）。${summary} ${dim.description || ''}`.trim(),
    personality: `人格侧写：你在“${dim.name}”议题呈现${style}特征。`,
    communication: `沟通建议：先确认目标、边界、退出条件，再推进互动细节。`,
    risk: '风险提示：忽略中途确认会扩大预期偏差，影响体验质量。',
    development: '发展建议：采用小步迭代策略，每次只增加一个变量并复盘。',
    associationHint: '关联解读：静态模式下未启用联动模型，当前结果以维度直接得分为主。',
  };
}

function questionScoreBounds(question) {
  const scores = (question.options || [])
    .map((item) => Number(item.score))
    .filter((value) => Number.isFinite(value));

  if (!scores.length) {
    return { minScore: 1, maxScore: 5 };
  }

  return {
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
  };
}

function buildStaticPersona(sortedDims) {
  const top = sortedDims.slice(0, 3);
  const low = [...sortedDims].reverse().slice(0, 2).reverse();
  return {
    title: `${top[0]?.name || '综合'}主导的平衡探索画像`,
    summary: `你的核心驱动集中在 ${top.map((item) => item.name).join('、')}，同时对 ${low.map((item) => item.name).join('、')} 保持稳态边界。你呈现“规则协作 + 渐进探索”的行为风格。`,
    tags: ['结构协作型', '边界清晰', '可持续探索'],
    strengths: [
      `你在 ${top[0]?.name || '高分维度'} 上进入状态快，执行稳定。`,
      `你能把 ${top[1]?.name || '次高维度'} 与关系节奏协同起来。`,
      `你愿意通过复盘优化 ${top[2]?.name || '关键维度'} 的体验质量。`,
    ],
    growth: [
      `把 ${low.map((item) => item.name).join('、')} 作为低压训练区，采用短时试验。`,
      '高强度场景后固定恢复窗口，并做次日状态回访。',
      '持续更新边界清单，减少沟通成本。',
    ],
    explorationPlan: [
      '第1步：先固化当前高分维度的流程模板。',
      '第2步：每次仅增加一个新变量并记录反馈。',
      '第3步：每三次体验做一次规则复盘并更新条款。',
    ],
  };
}

function computeStaticResult() {
  const detailMap = new Map((state.dimensionDetails || []).map((item) => [item.key, item]));
  const grouped = new Map();

  state.questions.forEach((question) => {
    const score = Number(state.answers.get(question.id));
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`题目 ${question.id} 评分缺失或无效`);
    }

    if (!grouped.has(question.dimension)) {
      grouped.set(question.dimension, {
        key: question.dimension,
        name: detailMap.get(question.dimension)?.name || question.dimension,
        description: detailMap.get(question.dimension)?.description || '暂无维度说明。',
        score: 0,
        maxScore: 0,
        minScore: 0,
        questionCount: 0,
      });
    }

    const bucket = grouped.get(question.dimension);
    const bounds = questionScoreBounds(question);
    bucket.score += score;
    bucket.maxScore += bounds.maxScore;
    bucket.minScore += bounds.minScore;
    bucket.questionCount += 1;
  });

  const dimensions = [...grouped.values()].map((item) => {
    const denominator = item.maxScore - item.minScore;
    const percentage = denominator === 0 ? 100 : Math.round(((item.score - item.minScore) / denominator) * 100);
    const analysis = makeStaticAnalysis(item, percentage);
    return {
      key: item.key,
      name: item.name,
      score: item.score,
      maxScore: item.maxScore,
      minScore: item.minScore,
      questionCount: item.questionCount,
      linearPercentage: percentage,
      basePercentage: percentage,
      associationDelta: 0,
      percentage,
      level: levelFromPercentage(percentage),
      description: analysis.summary,
      baselineDescription: item.description,
      analysis,
    };
  }).sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    return a.key.localeCompare(b.key);
  });

  const totalScore = Math.round(dimensions.reduce((acc, item) => acc + item.percentage, 0) / dimensions.length);
  const topDimensions = dimensions.slice(0, 5);
  const resultId = `STATIC_${state.suiteId}_${Date.now().toString(36)}`;

  return {
    id: resultId,
    timestamp: new Date().toISOString(),
    suite: state.metadata?.suite || {
      id: state.suiteId,
      name: state.suiteName,
      totalQuestions: state.questions.length,
      dimensionCount: dimensions.length,
    },
    totalScore,
    dimensions,
    topDimensions,
    associationInsights: [],
    scoringStandard: {
      scale: '每题1-5分',
      normalization: '静态模式采用线性归一化百分比',
    },
    typicalPersona: buildStaticPersona(dimensions),
  };
}

async function fetchSuites() {
  try {
    const payload = await fetchJson('api/suites');
    state.runtimeMode = 'server';
    state.suites = sortSuitesByPriority(payload.data || []);

    if (!state.suites.length) {
      throw new Error('未发现可用套题');
    }

    const qs = new URLSearchParams(window.location.search);
    const preferred = qs.get('suite');
    const fallback = payload.defaultSuiteId;
    const chosen = state.suites.find((item) => item.id === preferred)
      || state.suites.find((item) => item.id === fallback)
      || state.suites[0];

    state.suiteId = chosen.id;
    return;
  } catch (error) {
    console.warn('API 不可用，已切换静态模式。', error);
    state.runtimeMode = 'static';
    state.suites = sortSuitesByPriority(await loadStaticSuites());
  }

  const qs = new URLSearchParams(window.location.search);
  const preferred = qs.get('suite');
  const fallback = state.suites.find((item) => item.isDefault)?.id || state.suites[0]?.id;
  const chosen = state.suites.find((item) => item.id === preferred)
    || state.suites.find((item) => item.id === fallback)
    || state.suites[0];

  state.suiteId = chosen.id;
}

async function fetchAdConfig() {
  try {
    const payload = await fetchJson('api/ad-config');
    state.adConfig = payload.data || {};
  } catch (error) {
    console.warn('广告配置读取失败，将使用默认占位。', error);
    state.adConfig = {
      provider: 'google-adsense',
      enabled: false,
      showPlaceholderWhenDisabled: true,
      slots: {},
    };
  }
}

function populateSuiteSelect() {
  suiteSelect.innerHTML = '';

  state.suites.forEach((suite) => {
    const option = document.createElement('option');
    option.value = suite.id;
    option.textContent = `${suiteCategoryLabel(suite.category)} · ${suite.name} (${suite.totalQuestions}题)`;
    if (suite.id === state.suiteId) {
      option.selected = true;
    }
    suiteSelect.appendChild(option);
  });
}

async function loadSuiteData(suiteId) {
  state.suiteId = suiteId;

  if (state.runtimeMode === 'server') {
    const [questionsPayload, metadataPayload] = await Promise.all([
      fetchJson(`api/suites/${encodeURIComponent(suiteId)}/questions`),
      fetchJson(`api/suites/${encodeURIComponent(suiteId)}/metadata`),
    ]);
    state.questions = questionsPayload.data;
    state.metadata = metadataPayload;
    state.dimensionDetails = metadataPayload.dimensions || [];
  } else {
    const suite = state.suites.find((item) => item.id === suiteId);
    if (!suite) {
      throw new Error(`套题不存在: ${suiteId}`);
    }
    state.questions = suite._questions || [];
    state.dimensionDetails = suite._dimensionDetails || [];
    state.metadata = {
      success: true,
      suite: {
        id: suite.id,
        name: suite.name,
        version: suite.version,
        description: suite.description,
        source: suite.source,
        category: suite.category,
        priority: suite.priority,
        tags: suite.tags,
        adultContent: suite.adultContent,
        totalQuestions: suite.totalQuestions,
        dimensionCount: suite.dimensionCount,
      },
      totalQuestions: suite.totalQuestions,
      dimensionCount: suite.dimensionCount,
      dimensions: suite._dimensionMeta || [],
    };
  }

  const suiteName = state.metadata.suite?.name || suiteId;
  state.suiteName = suiteName;

  suiteNameLabel.textContent = suiteName;
  homeQuestionCount.textContent = String(state.metadata.totalQuestions);
  homeDimensionCount.textContent = String(state.metadata.dimensionCount);
  metaQuestionCount.textContent = String(state.metadata.totalQuestions);
  metaDimensionCount.textContent = String(state.metadata.dimensionCount);

  const query = new URL(window.location.href);
  query.searchParams.set('suite', suiteId);
  window.history.replaceState({}, '', `${query.pathname}${query.search}${query.hash}`);
}

function resetAnswers() {
  state.answers = new Map();
  state.currentIndex = 0;
  state.result = null;
  state.chartMode = 'radar';
}

function renderQuestion() {
  const total = state.questions.length;
  const index = state.currentIndex;
  const current = state.questions[index];

  const progress = Math.round(((index + 1) / total) * 100);
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `第 ${index + 1}/${total} 题 · 维度 ${current.dimension}`;
  questionText.textContent = `${index + 1}. ${current.text}`;

  optionList.innerHTML = '';
  current.options.forEach((option) => {
    const button = document.createElement('button');
    button.className = 'option';
    button.type = 'button';
    button.textContent = `${option.text}（${option.score}分）`;

    button.addEventListener('click', async () => {
      state.answers.set(current.id, option.score);
      await nextStep();
    });

    optionList.appendChild(button);
  });

  btnPrev.disabled = index === 0;
}

async function submitAnswers() {
  if (state.runtimeMode === 'static') {
    state.result = computeStaticResult();
    return;
  }

  const answers = state.questions.map((question) => ({
    subject_id: question.id,
    select_score: state.answers.get(question.id),
  }));

  const submitResp = await fetch(appUrl(`api/suites/${encodeURIComponent(state.suiteId)}/submit`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answers }),
  });

  if (!submitResp.ok) {
    const errorPayload = await submitResp.json().catch(() => ({}));
    throw new Error(errorPayload.error || '提交失败');
  }

  const submitPayload = await submitResp.json();
  const resultId = submitPayload.data.resultId;

  const resultResp = await fetch(appUrl(`api/suites/${encodeURIComponent(state.suiteId)}/result/${encodeURIComponent(resultId)}`));
  if (!resultResp.ok) {
    throw new Error('结果查询失败');
  }

  const resultPayload = await resultResp.json();
  state.result = resultPayload.data;
}

function dimensionRatioMap(result) {
  const map = Object.create(null);
  (result.dimensions || []).forEach((dim) => {
    map[dim.key] = Math.max(0, Math.min(1, Number(dim.percentage || 0) / 100));
  });
  return map;
}

function scoreArchetypes(archetypes, ratioMap, dimensionKeys) {
  return (archetypes || [])
    .map((archetype, index) => {
      const score = (dimensionKeys || []).reduce((acc, key) => {
        const weight = Number(archetype.weights?.[key]) || 0;
        return acc + (Number(ratioMap[key]) || 0) * weight;
      }, 0);
      return {
        archetype,
        score,
        index,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.index - b.index;
    });
}

function resolveArchetypeMatch(result) {
  const suiteId = result.suite?.id || state.suiteId;
  const type = archetypeTypeBySuiteId(suiteId);
  if (!type || !state.archetypeLibrary) {
    return null;
  }

  const archetypes = type === 'animal'
    ? state.archetypeLibrary.animal
    : state.archetypeLibrary.fruit;
  const dimensionKeys = state.archetypeLibrary.dimensionKeys || ['influence', 'innovation', 'execution', 'empathy', 'values'];
  const rankings = scoreArchetypes(archetypes, dimensionRatioMap(result), dimensionKeys);
  if (!rankings.length) {
    return null;
  }

  return {
    type,
    best: rankings[0].archetype,
    rankings: rankings.map((item) => ({
      archetype: item.archetype,
      score: item.score,
      scorePercent: Math.round(item.score * 1000) / 10,
    })),
  };
}

function buildArchetypePersona(result, match) {
  if (!match) {
    return result.typicalPersona;
  }

  const topDims = sortedDimensions(result.dimensions || []).slice(0, 3);
  if (match.type === 'animal') {
    const animal = match.best;
    return {
      title: `${animal.title}型人格画像`,
      summary: animal.description,
      tags: [
        animal.summary,
        `主轴维度：${topDims.map((item) => item.name).join('、')}`,
      ],
      strengths: [
        `你在 ${topDims[0]?.name || '核心维度'} 的表现最突出，行为风格与「${animal.title}」原型高度一致。`,
        '你在关系与任务中倾向形成稳定节奏，能快速识别场景主线并持续推进。',
      ],
      growth: [
        `当 ${topDims[0]?.name || '主轴维度'} 过强时，容易压缩其他维度空间，建议保留弹性协商窗口。`,
        '将高压场景拆分为短回合，既能保留表现力，也能降低沟通磨损。',
      ],
      explorationPlan: [
        '先巩固当前高分优势场景，再补齐一个低分维度。',
        '每次互动后复盘“哪一刻最顺畅/最卡顿”，持续校准节奏。',
      ],
    };
  }

  const fruit = match.best;
  return {
    title: `${fruit.name}型人格画像`,
    summary: fruit.description,
    tags: [
      fruit.tagline || '水果塑原型',
      `主轴维度：${topDims.map((item) => item.name).join('、')}`,
    ],
    strengths: Array.isArray(fruit.strengths) ? fruit.strengths : [],
    growth: Array.isArray(fruit.growth) ? fruit.growth : [],
    explorationPlan: [
      ...(Array.isArray(fruit.career) ? fruit.career.map((item) => `职业场景：${item}`) : []),
      ...(Array.isArray(fruit.advice) ? fruit.advice : []),
    ],
  };
}

function customDeepAnalysis(dim) {
  const ratio = Number(dim.percentage || 0);
  const tone = ratio >= 75
    ? '高活跃'
    : ratio >= 50
      ? '稳定活跃'
      : ratio >= 25
        ? '保守活跃'
        : '低活跃';
  const guideByKey = {
    influence: {
      personality: '你在社交与表达中重视场域掌控，擅长把话题推向目标。',
      communication: '先说结论再补充细节，能让你的影响力更高效落地。',
      risk: '若长期只输出不倾听，关系信任会被慢慢稀释。',
      development: '保留 20% 的提问时间，能显著提升协作质量。',
    },
    innovation: {
      personality: '你在新问题面前反应快，愿意从旧框架中跳出来找新路径。',
      communication: '提出新想法时同步给出最小可行版本，团队更容易跟进。',
      risk: '创意过密会导致执行分散，优先级容易失焦。',
      development: '固定“一周一复盘”机制，把灵感沉淀成稳定方法。',
    },
    execution: {
      personality: '你对行动闭环敏感，偏好计划清晰、节奏可控的推进方式。',
      communication: '把“目标、截止时间、责任人”一次说清，减少反复确认。',
      risk: '推进速度过快时，身边人可能跟不上你的节奏。',
      development: '关键节点加入状态检查，能兼顾效率与团队感受。',
    },
    empathy: {
      personality: '你对他人情绪线索敏锐，擅长在复杂关系中维护氛围稳定。',
      communication: '在回应观点前先回应感受，会显著提升对方配合度。',
      risk: '过度承接他人情绪会带来自我消耗。',
      development: '为自己设置情绪边界时段，让共情能力可持续输出。',
    },
    values: {
      personality: '你对原则与承诺的敏感度高，做判断时更看重长期一致性。',
      communication: '先对齐底线与规则，再讨论执行细节，能降低后续冲突。',
      risk: '标准过硬时，可能降低对变化情境的容纳度。',
      development: '在坚持原则的前提下保留试错空间，能提升适应力。',
    },
  };

  const guide = guideByKey[dim.key] || {
    personality: '该维度体现出你的稳定行为风格。',
    communication: '建议先确认目标、边界与节奏。',
    risk: '忽略中途确认会放大预期偏差。',
    development: '采用小步迭代并复盘，可持续提升体验质量。',
  };

  return {
    summary: `${dim.name}处于${tone}区间（${ratio}%），该特征会直接影响你的互动节奏与决策方式。`,
    ...guide,
    associationHint: '该套题采用原型权重匹配，维度分布直接映射到原型结果。',
  };
}

function renderSummary(result, sortedDims) {
  const top = sortedDims[0];
  const archetypeMatch = resolveArchetypeMatch(result);
  const highCount = sortedDims.filter((dim) => dim.percentage >= 75).length;
  const max = sortedDims[0]?.percentage ?? 0;
  const min = sortedDims[sortedDims.length - 1]?.percentage ?? 0;
  const spread = max - min;

  summaryTotal.textContent = `${result.totalScore}`;
  if (archetypeMatch) {
    const name = archetypeMatch.type === 'animal'
      ? archetypeMatch.best.title
      : archetypeMatch.best.name;
    summaryTop.textContent = `${name}原型 · ${archetypeMatch.rankings[0].scorePercent}%`;
  } else {
    summaryTop.textContent = top ? `${top.name} (${top.key}) · ${top.percentage}%` : '-';
  }
  summaryHighCount.textContent = `${highCount}`;
  summarySpread.textContent = `${spread}`;
}

function renderInsights(result, sortedDims) {
  const topThree = sortedDims.slice(0, 3);
  const lowThree = [...sortedDims].reverse().slice(0, 3).reverse();
  const highCount = sortedDims.filter((dim) => dim.percentage >= 75).length;
  const topAssociation = (result.associationInsights || [])[0];
  const archetypeMatch = resolveArchetypeMatch(result);

  if (archetypeMatch) {
    const subjectName = archetypeMatch.type === 'animal'
      ? archetypeMatch.best.title
      : archetypeMatch.best.name;
    const topDimText = topThree.map((dim) => `${dim.name}（${dim.percentage}%）`).join('、');
    const lowDimText = lowThree.map((dim) => `${dim.name}（${dim.percentage}%）`).join('、');

    const lines = [
      `你的原型匹配结果为「${subjectName}」，其权重与你在 ${topDimText} 上的表现最贴合。`,
      `当前高活跃维度数量为 ${highCount} 个，说明你的行为风格已经具备较稳定的主轴。`,
      `低活跃端集中在 ${lowDimText}，补足这部分会让整体人格表达更立体。`,
      archetypeMatch.type === 'animal'
        ? '动物塑结果强调“行为风格 + 关系姿态”，可用于团队协作与亲密沟通场景。'
        : '水果塑结果强调“优势气质 + 成长建议”，适合用于职业定位与自我发展复盘。',
      '本报告用于自我理解与沟通参考，不替代心理或医学临床诊断。',
    ];

    insightList.innerHTML = lines.map((line) => `<li>${safeText(line)}</li>`).join('');
    return;
  }

  const lines = [
    `高激活重心集中在 ${topThree.map((dim) => `${dim.name}（${dim.percentage}%）`).join('、')}。`,
    `低激活端主要是 ${lowThree.map((dim) => `${dim.name}（${dim.percentage}%）`).join('、')}，可作为边界优先讨论区。`,
    `当前共有 ${highCount} 个维度达到高偏好区间，建议在高分项上先做规则和照护设计。`,
    topAssociation
      ? `最显著的联动为“${topAssociation.relation}”：${topAssociation.impact}`
      : '关联模型未识别到显著联动，说明你的维度分布相对独立。',
    '建议将本报告用于自我了解与沟通参考，不应替代医学或临床心理诊断。',
  ];

  insightList.innerHTML = lines.map((line) => `<li>${safeText(line)}</li>`).join('');
}

function renderTopDimensions(dimensions) {
  topList.innerHTML = '';

  dimensions.forEach((dim) => {
    const row = document.createElement('div');
    row.className = 'top-row';

    row.innerHTML = `
      <div class="top-row-head">
        <strong>${safeText(dim.name)} (${safeText(dim.key)})</strong>
        <span>${dim.percentage}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${dim.percentage}%"></div>
      </div>
    `;

    topList.appendChild(row);
  });
}

function renderDeepAnalysis(dimensions) {
  deepAnalysis.innerHTML = '';
  const topSix = dimensions.slice(0, 6);
  const useCustomNarrative = ARCHETYPE_SUITE_IDS.has(state.suiteId);

  topSix.forEach((dim) => {
    const analysis = useCustomNarrative
      ? customDeepAnalysis(dim)
      : (dim.analysis || {});
    const card = document.createElement('article');
    card.className = 'deep-card';
    card.innerHTML = `
      <h4 class="deep-title">${safeText(dim.name)} (${safeText(dim.key)})</h4>
      <p class="deep-meta">${dim.percentage}% · ${safeText(dim.level)}</p>
      <p class="deep-text">${safeText(analysis.summary || dim.description)}</p>
      <p class="deep-line"><strong>性格画像</strong>${safeText(analysis.personality || '该维度体现出你的稳定行为风格。')}</p>
      <p class="deep-line"><strong>沟通建议</strong>${safeText(analysis.communication || '建议提前沟通边界和期待。')}</p>
      <p class="deep-line"><strong>风险提示</strong>${safeText(analysis.risk || '请保持同意可撤回，并持续确认彼此状态。')}</p>
      <p class="deep-line"><strong>发展建议</strong>${safeText(analysis.development || '建议在安全和尊重前提下逐步探索。')}</p>
      <p class="deep-line"><strong>关联解读</strong>${safeText(analysis.associationHint || '该维度当前受关联项影响有限。')}</p>
    `;
    deepAnalysis.appendChild(card);
  });
}

function renderAssociationInsights(result) {
  associationList.innerHTML = '';
  const insights = result.associationInsights || [];

  if (!insights.length) {
    if (ARCHETYPE_SUITE_IDS.has(state.suiteId)) {
      associationList.innerHTML = '<p class="assoc-empty">该套题按原题库规则采用直接维度映射，不启用联动修正。</p>';
      return;
    }
    associationList.innerHTML = '<p class="assoc-empty">未识别到显著联动，当前画像主要由各维度独立驱动。</p>';
    return;
  }

  insights.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'assoc-item';
    card.innerHTML = `
      <h4 class="assoc-title">${safeText(item.relation || '维度联动')}</h4>
      <p class="assoc-line">${safeText(item.impact || '')}</p>
      <p class="assoc-line">${safeText(item.interpretation || '')}</p>
      <p class="assoc-line"><strong>建议</strong>${safeText(item.suggestion || '')}</p>
    `;
    associationList.appendChild(card);
  });
}

function renderArchetypeSection(result) {
  const match = resolveArchetypeMatch(result);
  if (!match) {
    archetypeSection.classList.add('hidden');
    archetypeTitle.textContent = '原型匹配榜单';
    archetypeLead.textContent = '';
    archetypeHighlight.innerHTML = '';
    archetypeRankings.innerHTML = '';
    return null;
  }

  const topName = match.type === 'animal' ? match.best.title : match.best.name;
  const topEmoji = archetypeEmoji(match.type, topName);
  archetypeSection.classList.remove('hidden');
  archetypeTitle.textContent = match.type === 'animal' ? '动物塑图鉴匹配' : '水果塑图鉴匹配';
  archetypeLead.textContent = match.type === 'animal'
    ? '结果按原站动物塑权重库实时匹配，排名越靠前表示与你的维度结构越接近。'
    : '结果按原站水果塑权重库实时匹配，展示你的核心气质、成长空间与职业建议线索。';

  if (match.type === 'animal') {
    archetypeHighlight.innerHTML = `
      <h4 class="deep-title">${safeText(topEmoji)} ${safeText(match.best.title)} · ${safeText(match.best.summary)}</h4>
      <p class="deep-text">${safeText(match.best.description)}</p>
    `;
  } else {
    const strengths = Array.isArray(match.best.strengths) ? match.best.strengths.slice(0, 2).join('、') : '';
    const growth = Array.isArray(match.best.growth) ? match.best.growth.slice(0, 2).join('、') : '';
    archetypeHighlight.innerHTML = `
      <h4 class="deep-title">${safeText(topEmoji)} ${safeText(match.best.name)} · ${safeText(match.best.tagline || '')}</h4>
      <p class="deep-text">${safeText(match.best.description)}</p>
      <p class="deep-line"><strong>核心优势</strong>${safeText(strengths)}</p>
      <p class="deep-line"><strong>成长空间</strong>${safeText(growth)}</p>
    `;
  }

  archetypeRankings.innerHTML = match.rankings.map((item, index) => {
    const name = match.type === 'animal' ? item.archetype.title : item.archetype.name;
    const desc = match.type === 'animal'
      ? item.archetype.summary
      : (item.archetype.tagline || item.archetype.description || '');
    return `
      <article class="archetype-item">
        <div class="archetype-row">
          <div class="archetype-name">
            <span class="archetype-rank">${index + 1}</span>
            ${safeText(archetypeEmoji(match.type, name))} ${safeText(name)}
          </div>
          <span class="archetype-score">${item.scorePercent}%</span>
        </div>
        <p class="archetype-desc">${safeText(desc)}</p>
      </article>
    `;
  }).join('');

  return match;
}

function buildPersonaImageDataUrl(result, persona, archetypeMatch = null) {
  if (archetypeMatch) {
    const label = archetypeMatch.type === 'animal' ? archetypeMatch.best.title : archetypeMatch.best.name;
    const emoji = archetypeEmoji(archetypeMatch.type, label);
    const primary = archetypeMatch.type === 'fruit'
      ? (archetypeMatch.best.theme?.primary || '#f97316')
      : '#3b82f6';
    const secondary = archetypeMatch.type === 'fruit'
      ? (archetypeMatch.best.theme?.secondary || '#fff7ed')
      : '#e0edff';
    const badge = safeText(label);
    const icon = safeText(emoji);
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${secondary}" />
          <stop offset="100%" stop-color="${primary}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="420" height="260" rx="20" fill="url(#bg)"/>
      <rect x="30" y="24" width="360" height="212" rx="18" fill="rgba(255,255,255,0.78)"/>
      <text x="210" y="128" text-anchor="middle" font-size="84">${icon}</text>
      <rect x="88" y="176" width="244" height="44" rx="22" fill="${primary}"/>
      <text x="210" y="204" text-anchor="middle" font-size="20" fill="#fff" font-family="PingFang SC, Noto Sans SC, sans-serif">${badge}</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  const seed = `${persona.title || ''}-${result.topDimensions?.[0]?.key || ''}-${result.totalScore || 0}`;
  const hash = hashString(seed);
  const hue = hash % 360;
  const hue2 = (hue + 46) % 360;
  const accent = (hue + 130) % 360;
  const badge = safeText((result.topDimensions?.[0]?.name || '画像').slice(0, 4));
  const score = Number(result.totalScore || 0);
  const radius = 26 + Math.round((score / 100) * 18);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue} 72% 90%)"/>
        <stop offset="100%" stop-color="hsl(${hue2} 72% 82%)"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue} 35% 98%)"/>
        <stop offset="100%" stop-color="hsl(${hue2} 26% 95%)"/>
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="420" height="260" rx="20" fill="url(#bg)"/>
    <circle cx="72" cy="58" r="${radius}" fill="hsl(${accent} 70% 56% / 0.28)"/>
    <circle cx="354" cy="66" r="${Math.max(12, radius - 10)}" fill="hsl(${hue} 70% 48% / 0.22)"/>
    <circle cx="330" cy="210" r="${Math.max(16, radius - 4)}" fill="hsl(${hue2} 65% 46% / 0.18)"/>

    <rect x="34" y="32" width="352" height="196" rx="18" fill="url(#card)" stroke="hsl(${hue} 28% 76% / 0.9)" />
    <circle cx="126" cy="116" r="42" fill="hsl(${hue} 55% 52% / 0.22)"/>
    <circle cx="126" cy="104" r="20" fill="hsl(${hue} 44% 40% / 0.72)"/>
    <rect x="94" y="130" width="64" height="36" rx="18" fill="hsl(${hue} 44% 40% / 0.72)"/>

    <rect x="190" y="78" width="160" height="22" rx="11" fill="hsl(${hue2} 38% 88%)"/>
    <rect x="190" y="112" width="140" height="16" rx="8" fill="hsl(${hue2} 26% 90%)"/>
    <rect x="190" y="136" width="116" height="16" rx="8" fill="hsl(${hue2} 26% 90%)"/>
    <rect x="190" y="160" width="96" height="16" rx="8" fill="hsl(${hue2} 26% 90%)"/>

    <rect x="48" y="188" width="122" height="28" rx="14" fill="hsl(${accent} 68% 45%)"/>
    <text x="109" y="206" text-anchor="middle" font-size="14" fill="white" font-family="PingFang SC, Noto Sans SC, sans-serif">${badge}</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderPersona(result) {
  const archetypeMatch = resolveArchetypeMatch(result);
  const persona = buildArchetypePersona(result, archetypeMatch);
  if (!persona) {
    personaSection.classList.add('hidden');
    return;
  }

  personaSection.classList.remove('hidden');
  personaImage.src = buildPersonaImageDataUrl(result, persona, archetypeMatch);
  personaImage.alt = `${persona.title || '典型画像'}配图`;
  personaTitle.textContent = persona.title || '-';
  personaSummary.textContent = persona.summary || '-';

  const tags = Array.isArray(persona.tags) ? persona.tags : [];
  personaTags.innerHTML = tags.map((tag) => `<span class="persona-tag">${safeText(tag)}</span>`).join('');

  const writeList = (container, items) => {
    const list = Array.isArray(items) ? items : [];
    container.innerHTML = list.map((item) => `<li>${safeText(item)}</li>`).join('');
  };

  writeList(personaStrengths, persona.strengths);
  writeList(personaGrowth, persona.growth);
  writeList(personaPlan, persona.explorationPlan);
}

function getCanvasContext(canvas, options = {}) {
  const minWidth = options.minWidth || 300;
  const minHeight = options.minHeight || 320;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(minWidth, Math.floor(rect.width));
  const height = Math.max(minHeight, Math.floor(rect.height));
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  return { ctx, width, height };
}

function drawBarsChart(dimensions) {
  if (!dimensions.length) {
    return;
  }

  const { ctx, width, height } = getCanvasContext(barsCanvas, { minHeight: 380 });
  const margin = {
    top: 24,
    right: 16,
    bottom: 74,
    left: 44,
  };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const baseY = margin.top + chartHeight;
  const ticks = [0, 20, 40, 60, 80, 100];

  ctx.strokeStyle = '#e4dbcf';
  ctx.lineWidth = 1;
  ctx.font = '11px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = '#7a7166';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ticks.forEach((value) => {
    const y = baseY - (value / 100) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartWidth, y);
    ctx.stroke();
    ctx.fillText(`${value}`, margin.left - 8, y);
  });

  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, baseY);
  ctx.lineTo(margin.left + chartWidth, baseY);
  ctx.strokeStyle = '#d2c8ba';
  ctx.stroke();

  const count = dimensions.length;
  const gap = Math.max(4, Math.floor(chartWidth / (count * 5)));
  const estimatedBarWidth = (chartWidth - gap * (count + 1)) / count;
  const barWidth = Math.max(8, Math.min(30, estimatedBarWidth));
  const occupied = count * barWidth + (count - 1) * gap;
  const startX = margin.left + Math.max(0, (chartWidth - occupied) / 2);

  dimensions.forEach((dim, index) => {
    const value = dim.percentage;
    const barHeight = (value / 100) * chartHeight;
    const x = startX + index * (barWidth + gap);
    const y = baseY - barHeight;

    ctx.fillStyle = barColor(value);
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.font = barWidth >= 12
      ? '11px "Noto Sans SC", "PingFang SC", sans-serif'
      : '10px "Noto Sans SC", "PingFang SC", sans-serif';
    ctx.fillStyle = '#4f483f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${value}`, x + barWidth / 2, y - 4);

    ctx.font = '11px "Noto Sans SC", "PingFang SC", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#5f574d';
    ctx.fillText(dim.key, x + barWidth / 2, baseY + 8);
  });

  ctx.save();
  ctx.fillStyle = '#786f64';
  ctx.font = '11px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('百分比（%）', 10, margin.top - 6);
  ctx.restore();
}

function drawRadarChart(dimensions) {
  if (!dimensions.length) {
    return;
  }

  const { ctx, width, height } = getCanvasContext(radarCanvas);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.33;
  const labels = dimensions.map((dim) => `${dim.name}(${dim.key})`);
  const count = dimensions.length;

  const pointAt = (ratio, idx) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * idx / count);
    return {
      x: centerX + Math.cos(angle) * radius * ratio,
      y: centerY + Math.sin(angle) * radius * ratio,
      angle,
    };
  };

  const levels = [0.25, 0.5, 0.75, 1];
  levels.forEach((level) => {
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      const p = pointAt(level, i);
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.closePath();
    ctx.strokeStyle = '#dcd4c8';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  for (let i = 0; i < count; i += 1) {
    const p = pointAt(1, i);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#e8e1d6';
    ctx.stroke();
  }

  ctx.beginPath();
  dimensions.forEach((dim, idx) => {
    const p = pointAt(dim.percentage / 100, idx);
    if (idx === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(29, 111, 95, 0.22)';
  ctx.strokeStyle = '#1d6f5f';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  dimensions.forEach((dim, idx) => {
    const p = pointAt(dim.percentage / 100, idx);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1d6f5f';
    ctx.fill();
  });

  ctx.font = '12px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = '#4d4942';

  labels.forEach((label, idx) => {
    const p = pointAt(1.14, idx);
    if (Math.abs(Math.cos(p.angle)) < 0.2) {
      ctx.textAlign = 'center';
    } else if (Math.cos(p.angle) > 0) {
      ctx.textAlign = 'left';
    } else {
      ctx.textAlign = 'right';
    }
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y);
  });

  ctx.font = '11px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = '#7f786f';
  ctx.textAlign = 'center';
  ctx.fillText('25', centerX, centerY - radius * 0.25 - 6);
  ctx.fillText('50', centerX, centerY - radius * 0.5 - 6);
  ctx.fillText('75', centerX, centerY - radius * 0.75 - 6);
  ctx.fillText('100', centerX, centerY - radius - 6);
}

function drawRadarChartWhenReady(dimensions, retry = 0) {
  const rect = radarCanvas.getBoundingClientRect();
  if ((rect.width < 120 || rect.height < 120) && retry < 12) {
    window.setTimeout(() => {
      drawRadarChartWhenReady(dimensions, retry + 1);
    }, 30);
    return;
  }
  drawRadarChart(dimensions);
}

function drawBarsChartWhenReady(dimensions, retry = 0) {
  const rect = barsCanvas.getBoundingClientRect();
  if ((rect.width < 120 || rect.height < 120) && retry < 12) {
    window.setTimeout(() => {
      drawBarsChartWhenReady(dimensions, retry + 1);
    }, 30);
    return;
  }
  drawBarsChart(dimensions);
}

function setChartMode(mode) {
  state.chartMode = mode;
  const isRadar = mode === 'radar';

  radarWrap.classList.toggle('hidden', !isRadar);
  barsWrap.classList.toggle('hidden', isRadar);

  btnChartRadar.classList.toggle('active', isRadar);
  btnChartBars.classList.toggle('active', !isRadar);

  btnChartRadar.setAttribute('aria-pressed', isRadar ? 'true' : 'false');
  btnChartBars.setAttribute('aria-pressed', !isRadar ? 'true' : 'false');

  renderVisualization();
}

function renderVisualization() {
  if (!state.result) {
    return;
  }

  const sortedDims = sortedDimensions(state.result.dimensions);

  if (state.chartMode === 'radar') {
    drawRadarChartWhenReady(sortedDims);
    vizCaption.textContent = '雷达图展示全部维度，便于观察完整偏好结构。';
    return;
  }

  drawBarsChartWhenReady(sortedDims);
  vizCaption.textContent = '柱形统计图展示全部维度的百分比分布，纵轴为 0-100。';
}

function renderTableRows(dimensions) {
  reportTableBody.innerHTML = '';

  dimensions.forEach((dim) => {
    const tr = document.createElement('tr');
    const levelCls = levelClass(dim.level);
    const summaryText = ARCHETYPE_SUITE_IDS.has(state.suiteId)
      ? customDeepAnalysis(dim).summary
      : dim.description;

    tr.innerHTML = `
      <td>${safeText(dim.name)} (${safeText(dim.key)})</td>
      <td>${dim.score}/${dim.maxScore}</td>
      <td>${dim.percentage}%</td>
      <td><span class="tag ${levelCls}">${safeText(dim.level)}</span></td>
      <td>${safeText(summaryText)}</td>
    `;

    reportTableBody.appendChild(tr);
  });
}

function renderResult() {
  const result = state.result;
  const sortedDims = sortedDimensions(result.dimensions);
  const topFive = sortedDims.slice(0, 5);

  const localTime = new Date(result.timestamp).toLocaleString();
  reportMeta.textContent = `套题: ${result.suite?.name || state.suiteName} ｜ 结果ID: ${result.id} ｜ 综合分: ${result.totalScore} ｜ 时间: ${localTime}`;

  renderArchetypeSection(result);
  renderSummary(result, sortedDims);
  renderInsights(result, sortedDims);
  renderTopDimensions(topFive);
  renderDeepAnalysis(sortedDims);
  renderAssociationInsights(result);
  renderTableRows(sortedDims);
  renderPersona(result);
  setChartMode('radar');
}

function renderPlaceholderAd(container, label) {
  container.innerHTML = `
    <div class="ad-card ad-placeholder">
      <span class="ad-mark">AD</span>
      <p>${safeText(label)}</p>
    </div>
  `;
}

function ensureAdsenseScript(client) {
  if (adScriptLoadPromise) {
    return adScriptLoadPromise;
  }

  adScriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('adsense-script');
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'adsense-script';
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Ads 脚本加载失败'));
    document.head.appendChild(script);
  });

  return adScriptLoadPromise;
}

function renderAdsenseSlot(container, slotKey) {
  const config = state.adConfig || {};
  const client = config.client || '';
  const slot = config.slots?.[slotKey] || '';

  if (!client || !slot) {
    renderPlaceholderAd(container, '广告位已预留：填写 client/slot 后可接入 Google 广告。');
    return;
  }

  container.innerHTML = `
    <div class="ad-card">
      <span class="ad-mark">AD</span>
      <ins
        class="adsbygoogle"
        style="display:block"
        data-ad-client="${safeText(client)}"
        data-ad-slot="${safeText(slot)}"
        data-ad-layout="${safeText(config.style?.layout || 'in-article')}"
        data-ad-format="${safeText(config.style?.format || 'fluid')}"
        data-full-width-responsive="${config.style?.responsive ? 'true' : 'false'}"></ins>
    </div>
  `;

  ensureAdsenseScript(client)
    .then(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.warn('Google Ads slot push failed:', error);
      }
    })
    .catch((error) => {
      console.warn(error.message);
      renderPlaceholderAd(container, '广告脚本加载失败，当前显示占位。');
    });
}

function renderAds() {
  if (!state.adConfig) {
    return;
  }

  const enabled = Boolean(state.adConfig.enabled);
  const usePlaceholder = state.adConfig.showPlaceholderWhenDisabled !== false;

  adHome.innerHTML = '';
  adResult.innerHTML = '';

  if (!enabled) {
    if (usePlaceholder) {
      renderPlaceholderAd(adHome, '广告位预留（首页）');
      renderPlaceholderAd(adResult, '广告位预留（结果页）');
    }
    return;
  }

  renderAdsenseSlot(adHome, 'home_inline');
  renderAdsenseSlot(adResult, 'result_inline');
}

async function nextStep() {
  if (state.currentIndex >= state.questions.length - 1) {
    questionText.textContent = '正在计算报告，请稍候...';
    optionList.innerHTML = '';

    try {
      await submitAnswers();
      showView('result');
      requestAnimationFrame(() => {
        renderResult();
      });
    } catch (error) {
      console.error(error);
      alert(`报告生成失败：${error.message}`);
      showView('home');
    }
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
}

function previousStep() {
  if (state.currentIndex === 0) {
    return;
  }

  const currentQuestion = state.questions[state.currentIndex];
  state.answers.delete(currentQuestion.id);
  state.currentIndex -= 1;
  renderQuestion();
}

function onResize() {
  if (!state.result || resultView.classList.contains('hidden')) {
    return;
  }

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderVisualization();
  }, 120);
}

function buildShareUrl(includeResult = false) {
  const url = new URL(window.location.href);
  url.searchParams.set('suite', state.suiteId);
  if (includeResult && state.result?.id) {
    url.searchParams.set('resultId', state.result.id);
  } else {
    url.searchParams.delete('resultId');
  }
  return `${url.origin}${url.pathname}${url.search}`;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!success) {
    throw new Error('复制失败');
  }
}

async function shareSite(includeResult = false) {
  const url = buildShareUrl(includeResult);
  const title = includeResult
    ? `${state.suiteName} · 测评结果`
    : `${state.suiteName} · 免费本地测评`;
  const text = includeResult
    ? `我刚完成了 ${state.suiteName}，这是我的结果链接。`
    : `这是一个可本地运行的 ${state.suiteName}，支持手机和电脑测评。`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return;
      }
    }
  }

  try {
    await copyText(url);
    alert('分享链接已复制，可直接粘贴到微信、微博或 X。');
  } catch (error) {
    window.prompt('浏览器未授予剪贴板权限，请手动复制该链接：', url);
  }
}

function exportPdf() {
  if (!state.result) {
    alert('请先完成测试，再导出PDF。');
    return;
  }

  const backupTitle = document.title;
  const fileSafeSuite = (state.suiteName || 'report').replace(/[\\/:*?"<>|]/g, '_');
  document.title = `${fileSafeSuite}-报告-${state.result.id}`;
  window.print();
  setTimeout(() => {
    document.title = backupTitle;
  }, 500);
}

btnStart.addEventListener('click', () => {
  resetAnswers();
  renderQuestion();
  showView('test');
});

btnShareSite.addEventListener('click', async () => {
  await shareSite(false);
});

btnPrev.addEventListener('click', () => {
  previousStep();
});

btnHome.addEventListener('click', () => {
  showView('home');
});

btnRestart.addEventListener('click', () => {
  resetAnswers();
  renderQuestion();
  showView('test');
});

btnViewHome.addEventListener('click', () => {
  showView('home');
});

btnExportPdf.addEventListener('click', () => {
  exportPdf();
});

btnShareResult.addEventListener('click', async () => {
  if (!state.result) {
    alert('请先完成测试，再分享报告。');
    return;
  }
  await shareSite(true);
});

btnChartRadar.addEventListener('click', () => {
  setChartMode('radar');
});

btnChartBars.addEventListener('click', () => {
  setChartMode('bars');
});

suiteSelect.addEventListener('change', async () => {
  const nextSuiteId = suiteSelect.value;
  if (!nextSuiteId || nextSuiteId === state.suiteId) {
    return;
  }

  try {
    await loadSuiteData(nextSuiteId);
    resetAnswers();
    showView('home');
  } catch (error) {
    console.error(error);
    alert(`切换套题失败：${error.message}`);
  }
});

window.addEventListener('resize', onResize);

(async () => {
  try {
    await Promise.all([fetchSuites(), fetchAdConfig(), fetchArchetypeLibrary()]);
    populateSuiteSelect();
    await loadSuiteData(state.suiteId);
    renderAds();
    showView('home');
  } catch (error) {
    console.error(error);
    alert('初始化失败，请检查服务是否正常运行。');
  }
})();
