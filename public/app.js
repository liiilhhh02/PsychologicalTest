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
const rankBars = document.getElementById('rank-bars');
const vizCaption = document.getElementById('viz-caption');

const btnChartRadar = document.getElementById('btn-chart-radar');
const btnChartBars = document.getElementById('btn-chart-bars');

const topList = document.getElementById('top-list');
const reportMeta = document.getElementById('report-meta');
const reportTableBody = document.getElementById('report-table-body');

const btnStart = document.getElementById('btn-start');
const btnPrev = document.getElementById('btn-prev');
const btnHome = document.getElementById('btn-home');
const btnRestart = document.getElementById('btn-restart');
const btnViewHome = document.getElementById('btn-view-home');
const btnExportPdf = document.getElementById('btn-export-pdf');

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

function barToneClass(percentage) {
  if (percentage >= 75) {
    return 'tone-high';
  }
  if (percentage >= 50) {
    return 'tone-mid-high';
  }
  if (percentage >= 25) {
    return 'tone-mid-low';
  }
  return 'tone-low';
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

function renderInsights(sortedDims) {
  const topThree = sortedDims.slice(0, 3);
  const lowThree = [...sortedDims].reverse().slice(0, 3).reverse();
  const highCount = sortedDims.filter((dim) => dim.percentage >= 75).length;

  const lines = [
    `最突出的维度是 ${topThree.map((dim) => `${dim.name}(${dim.percentage}%)`).join('、')}。`,
    `相对较低的维度是 ${lowThree.map((dim) => `${dim.name}(${dim.percentage}%)`).join('、')}。`,
    `达到高偏好（>=75%）的维度数量：${highCount}。`,
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

function renderRankBars(dimensions) {
  rankBars.innerHTML = '';

  dimensions.forEach((dim, index) => {
    const barItem = document.createElement('div');
    barItem.className = 'rank-item';

    const tone = barToneClass(dim.percentage);
    barItem.innerHTML = `
      <div class="rank-label-wrap">
        <span class="rank-index">#${index + 1}</span>
        <span class="rank-name">${safeText(dim.name)} (${safeText(dim.key)})</span>
        <span class="rank-value">${dim.percentage}%</span>
      </div>
      <div class="rank-track">
        <div class="rank-fill ${tone}" style="width:${dim.percentage}%"></div>
      </div>
    `;

    rankBars.appendChild(barItem);
  });
}

function getCanvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(300, Math.floor(rect.width));
  const height = Math.max(320, Math.floor(rect.height));
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  return { ctx, width, height };
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
    drawRadarChart(topTwelve);
    vizCaption.textContent = '雷达图展示得分最高的12个维度，便于快速看出偏好轮廓。';
    return;
  }

  renderRankBars(sortedDims);
  vizCaption.textContent = '柱状图按百分比从高到低展示全部23个维度。';
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
  renderInsights(sortedDims);
  renderTopDimensions(topFive);
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
      renderResult();
      showView('result');
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
  if (!state.result || state.chartMode !== 'radar' || resultView.classList.contains('hidden')) {
    return;
  }

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderVisualization();
  }, 120);
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
