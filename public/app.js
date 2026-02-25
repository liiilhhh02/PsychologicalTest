const state = {
  suites: [],
  suiteId: '',
  suiteName: '',
  questions: [],
  metadata: null,
  adConfig: null,
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

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`${url} 请求失败 (${resp.status})`);
  }
  return resp.json();
}

async function fetchSuites() {
  const payload = await fetchJson('/api/suites');
  state.suites = payload.data || [];

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
}

async function fetchAdConfig() {
  try {
    const payload = await fetchJson('/api/ad-config');
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
    option.textContent = `${suite.name} (${suite.totalQuestions}题)`;
    if (suite.id === state.suiteId) {
      option.selected = true;
    }
    suiteSelect.appendChild(option);
  });
}

async function loadSuiteData(suiteId) {
  const [questionsPayload, metadataPayload] = await Promise.all([
    fetchJson(`/api/suites/${encodeURIComponent(suiteId)}/questions`),
    fetchJson(`/api/suites/${encodeURIComponent(suiteId)}/metadata`),
  ]);

  state.suiteId = suiteId;
  state.questions = questionsPayload.data;
  state.metadata = metadataPayload;

  const suiteName = metadataPayload.suite?.name || suiteId;
  state.suiteName = suiteName;

  suiteNameLabel.textContent = suiteName;
  homeQuestionCount.textContent = String(metadataPayload.totalQuestions);
  homeDimensionCount.textContent = String(metadataPayload.dimensionCount);
  metaQuestionCount.textContent = String(metadataPayload.totalQuestions);
  metaDimensionCount.textContent = String(metadataPayload.dimensionCount);

  const query = new URL(window.location.href);
  query.searchParams.set('suite', suiteId);
  window.history.replaceState({}, '', `${query.pathname}${query.search}`);
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
  const answers = state.questions.map((question) => ({
    subject_id: question.id,
    select_score: state.answers.get(question.id),
  }));

  const submitResp = await fetch(`/api/suites/${encodeURIComponent(state.suiteId)}/submit`, {
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

  const resultResp = await fetch(`/api/suites/${encodeURIComponent(state.suiteId)}/result/${encodeURIComponent(resultId)}`);
  if (!resultResp.ok) {
    throw new Error('结果查询失败');
  }

  const resultPayload = await resultResp.json();
  state.result = resultPayload.data;
}

function renderSummary(result, sortedDims) {
  const top = sortedDims[0];
  const highCount = sortedDims.filter((dim) => dim.percentage >= 75).length;
  const max = sortedDims[0]?.percentage ?? 0;
  const min = sortedDims[sortedDims.length - 1]?.percentage ?? 0;
  const spread = max - min;

  summaryTotal.textContent = `${result.totalScore}`;
  summaryTop.textContent = top ? `${top.name} (${top.key}) · ${top.percentage}%` : '-';
  summaryHighCount.textContent = `${highCount}`;
  summarySpread.textContent = `${spread}`;
}

function renderInsights(result, sortedDims) {
  const topThree = sortedDims.slice(0, 3);
  const lowThree = [...sortedDims].reverse().slice(0, 3).reverse();
  const highCount = sortedDims.filter((dim) => dim.percentage >= 75).length;
  const topAssociation = (result.associationInsights || [])[0];

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

  topSix.forEach((dim) => {
    const analysis = dim.analysis || {};
    const card = document.createElement('article');
    card.className = 'deep-card';
    card.innerHTML = `
      <h4 class="deep-title">${safeText(dim.name)} (${safeText(dim.key)})</h4>
      <p class="deep-meta">${dim.percentage}% · ${safeText(dim.level)}</p>
      <p class="deep-text">${safeText(analysis.summary || dim.description)}</p>
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
    const topTwelve = sortedDims.slice(0, 12);
    drawRadarChartWhenReady(topTwelve);
    vizCaption.textContent = '雷达图展示得分最高的12个维度，便于快速看出偏好轮廓。';
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

    tr.innerHTML = `
      <td>${safeText(dim.name)} (${safeText(dim.key)})</td>
      <td>${dim.score}/${dim.maxScore}</td>
      <td>${dim.percentage}%</td>
      <td><span class="tag ${levelCls}">${safeText(dim.level)}</span></td>
      <td>${safeText(dim.description)}</td>
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

  renderSummary(result, sortedDims);
  renderInsights(result, sortedDims);
  renderTopDimensions(topFive);
  renderDeepAnalysis(sortedDims);
  renderAssociationInsights(result);
  renderTableRows(sortedDims);
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
    await Promise.all([fetchSuites(), fetchAdConfig()]);
    populateSuiteSelect();
    await loadSuiteData(state.suiteId);
    renderAds();
    showView('home');
  } catch (error) {
    console.error(error);
    alert('初始化失败，请检查服务是否正常运行。');
  }
})();
