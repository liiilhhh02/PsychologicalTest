const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SUITES_DIR = path.join(ROOT, 'question-suites');
const AD_CONFIG_PATH = path.join(ROOT, 'config', 'ad-config.json');

const RESULT_STORE = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function loadSuites() {
  if (!fs.existsSync(SUITES_DIR)) {
    throw new Error(`题库目录不存在: ${SUITES_DIR}`);
  }

  const suiteDirs = fs.readdirSync(SUITES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const suites = [];

  for (const suiteDirName of suiteDirs) {
    const suiteDir = path.join(SUITES_DIR, suiteDirName);
    const suiteMetaPath = path.join(suiteDir, 'suite.json');
    const questionsPath = path.join(suiteDir, 'questions.json');
    const dimensionsPath = path.join(suiteDir, 'dimension_descriptions.json');

    if (!fs.existsSync(suiteMetaPath) || !fs.existsSync(questionsPath) || !fs.existsSync(dimensionsPath)) {
      continue;
    }

    const suiteMeta = readJson(suiteMetaPath);
    const questions = readJson(questionsPath);
    const dimensionDetails = readJson(dimensionsPath);

    const dimensionMap = new Map(dimensionDetails.map((item) => [item.key, item]));
    const questionMap = new Map(questions.map((item) => [item.id, item]));
    const dimensionOrder = [...new Set(questions.map((item) => item.dimension))];

    const dimensionMeta = dimensionOrder.map((key) => {
      const count = questions.filter((item) => item.dimension === key).length;
      const detail = dimensionMap.get(key) || {};
      return {
        key,
        name: detail.name || key,
        questionCount: count,
        description: detail.description || '暂无维度说明。',
        minScore: count,
        maxScore: count * 5,
      };
    });

    suites.push({
      id: suiteMeta.id || suiteDirName,
      name: suiteMeta.name || suiteDirName,
      version: suiteMeta.version || '0.0.0',
      description: suiteMeta.description || '',
      source: suiteMeta.source || '',
      adultContent: Boolean(suiteMeta.adultContent),
      isDefault: Boolean(suiteMeta.default),
      questions,
      dimensionDetails,
      dimensionMap,
      questionMap,
      dimensionOrder,
      dimensionMeta,
      totalQuestions: questions.length,
      dimensionCount: dimensionMeta.length,
    });
  }

  if (suites.length === 0) {
    throw new Error(`未检测到可用套题，请检查 ${SUITES_DIR}`);
  }

  const defaultSuite = suites.find((suite) => suite.isDefault) || suites[0];
  const suiteMap = new Map(suites.map((suite) => [suite.id, suite]));

  return {
    suites,
    suiteMap,
    defaultSuite,
  };
}

function loadAdConfig() {
  if (!fs.existsSync(AD_CONFIG_PATH)) {
    return {
      provider: 'google-adsense',
      enabled: false,
      client: '',
      slots: {},
      showPlaceholderWhenDisabled: true,
    };
  }

  return readJson(AD_CONFIG_PATH);
}

let suiteContext = loadSuites();
let adConfig = loadAdConfig();

function reloadRuntimeConfig() {
  suiteContext = loadSuites();
  adConfig = loadAdConfig();
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('JSON解析失败'));
      }
    });

    req.on('error', (error) => reject(error));
  });
}

function contentTypeByExt(ext) {
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function serveStatic(reqPath, res) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentTypeByExt(path.extname(filePath)),
    });
    res.end(data);
  });
}

function getSuiteById(suiteId) {
  if (!suiteId) {
    return suiteContext.defaultSuite;
  }
  return suiteContext.suiteMap.get(suiteId) || null;
}

function getSuiteSummary(suite) {
  return {
    id: suite.id,
    name: suite.name,
    version: suite.version,
    description: suite.description,
    source: suite.source,
    adultContent: suite.adultContent,
    totalQuestions: suite.totalQuestions,
    dimensionCount: suite.dimensionCount,
  };
}

function getSuiteMetadata(suite) {
  return {
    success: true,
    suite: getSuiteSummary(suite),
    totalQuestions: suite.totalQuestions,
    dimensionCount: suite.dimensionCount,
    dimensions: suite.dimensionMeta,
  };
}

function calculateResult(suite, answers) {
  const answerMap = new Map();

  for (const item of answers) {
    if (!item || typeof item !== 'object') {
      throw new Error('存在非法答案项');
    }

    const subjectId = Number(item.subject_id);
    const score = Number(item.select_score);

    if (!suite.questionMap.has(subjectId)) {
      throw new Error(`题目ID不存在: ${subjectId}`);
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`题目 ${subjectId} 的分值必须为1-5整数`);
    }

    answerMap.set(subjectId, score);
  }

  if (answerMap.size !== suite.totalQuestions) {
    throw new Error(`答案数量不完整，要求 ${suite.totalQuestions} 题，收到 ${answerMap.size} 题`);
  }

  const grouped = new Map();

  for (const question of suite.questions) {
    const dim = question.dimension;
    const score = answerMap.get(question.id);

    if (!grouped.has(dim)) {
      grouped.set(dim, {
        key: dim,
        name: suite.dimensionMap.get(dim)?.name || dim,
        description: suite.dimensionMap.get(dim)?.description || '暂无维度说明。',
        score: 0,
        maxScore: 0,
        minScore: 0,
        questionCount: 0,
      });
    }

    const bucket = grouped.get(dim);
    bucket.score += score;
    bucket.maxScore += 5;
    bucket.minScore += 1;
    bucket.questionCount += 1;
  }

  const dimensions = suite.dimensionOrder.map((key) => {
    const item = grouped.get(key);
    const denominator = item.maxScore - item.minScore;
    const percentage = denominator === 0
      ? 100
      : Math.round(((item.score - item.minScore) / denominator) * 100);

    return {
      key: item.key,
      name: item.name,
      score: item.score,
      maxScore: item.maxScore,
      minScore: item.minScore,
      questionCount: item.questionCount,
      percentage,
      level: levelFromPercentage(percentage),
      description: item.description,
    };
  });

  const totalScore = Math.round(dimensions.reduce((acc, dim) => acc + dim.percentage, 0) / dimensions.length);
  const topDimensions = [...dimensions]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  return {
    totalScore,
    dimensions,
    topDimensions,
    scoringStandard: {
      scale: '每题1-5分',
      normalization: '百分比 = (维度总分 - 维度最小分) / (维度最大分 - 维度最小分) * 100',
      levelBands: [
        { label: '低偏好', min: 0, max: 24 },
        { label: '中低偏好', min: 25, max: 49 },
        { label: '中高偏好', min: 50, max: 74 },
        { label: '高偏好', min: 75, max: 100 },
      ],
    },
  };
}

function makeResultId(suiteId) {
  const compactSuite = suiteId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'SUITE';
  return `LOCAL_${compactSuite}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function persistResultRecord(suite, computed) {
  const resultId = makeResultId(suite.id);
  const timestamp = new Date().toISOString();

  const record = {
    id: resultId,
    timestamp,
    suite: getSuiteSummary(suite),
    isPremium: true,
    ...computed,
  };

  RESULT_STORE.set(resultId, record);
  return record;
}

function submitForSuite(suite, answers) {
  const computed = calculateResult(suite, answers);
  const record = persistResultRecord(suite, computed);

  const compact = Object.fromEntries(
    record.dimensions.map((dim) => [
      dim.key,
      {
        name: dim.name,
        score: dim.score,
        maxScore: dim.maxScore,
        percentage: dim.percentage,
      },
    ])
  );

  return {
    success: true,
    code: 200,
    msg: '计算成功',
    data: {
      ...compact,
      resultId: record.id,
      totalScore: record.totalScore,
      topDimensions: record.topDimensions,
      scoringStandard: record.scoringStandard,
      suite: record.suite,
    },
  };
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');
  const pathname = reqUrl.pathname;

  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    json(res, 200, {
      success: true,
      suites: suiteContext.suites.length,
      defaultSuiteId: suiteContext.defaultSuite.id,
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/reload') {
    try {
      reloadRuntimeConfig();
      json(res, 200, {
        success: true,
        suites: suiteContext.suites.length,
        defaultSuiteId: suiteContext.defaultSuite.id,
      });
    } catch (error) {
      json(res, 500, {
        success: false,
        error: error.message,
      });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/suites') {
    json(res, 200, {
      success: true,
      defaultSuiteId: suiteContext.defaultSuite.id,
      data: suiteContext.suites.map(getSuiteSummary),
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/ad-config') {
    json(res, 200, {
      success: true,
      data: adConfig,
    });
    return;
  }

  const suiteQuestionsMatch = pathname.match(/^\/api\/suites\/([^/]+)\/questions$/);
  if (req.method === 'GET' && suiteQuestionsMatch) {
    const suiteId = decodeURIComponent(suiteQuestionsMatch[1]);
    const suite = getSuiteById(suiteId);

    if (!suite) {
      json(res, 404, { success: false, error: `套题不存在: ${suiteId}` });
      return;
    }

    json(res, 200, {
      success: true,
      suite: getSuiteSummary(suite),
      total: suite.totalQuestions,
      data: suite.questions,
    });
    return;
  }

  const suiteMetaMatch = pathname.match(/^\/api\/suites\/([^/]+)\/metadata$/);
  if (req.method === 'GET' && suiteMetaMatch) {
    const suiteId = decodeURIComponent(suiteMetaMatch[1]);
    const suite = getSuiteById(suiteId);

    if (!suite) {
      json(res, 404, { success: false, error: `套题不存在: ${suiteId}` });
      return;
    }

    json(res, 200, getSuiteMetadata(suite));
    return;
  }

  const suiteSubmitMatch = pathname.match(/^\/api\/suites\/([^/]+)\/submit$/);
  if (req.method === 'POST' && suiteSubmitMatch) {
    const suiteId = decodeURIComponent(suiteSubmitMatch[1]);
    const suite = getSuiteById(suiteId);

    if (!suite) {
      json(res, 404, { success: false, error: `套题不存在: ${suiteId}` });
      return;
    }

    try {
      const payload = await parseBody(req);
      const answers = Array.isArray(payload.answers) ? payload.answers : null;

      if (!answers) {
        json(res, 400, { success: false, error: 'answers必须为数组' });
        return;
      }

      json(res, 200, submitForSuite(suite, answers));
    } catch (error) {
      json(res, 400, { success: false, code: 400, error: error.message });
    }
    return;
  }

  const suiteResultMatch = pathname.match(/^\/api\/suites\/([^/]+)\/result\/([^/]+)$/);
  if (req.method === 'GET' && suiteResultMatch) {
    const suiteId = decodeURIComponent(suiteResultMatch[1]);
    const resultId = decodeURIComponent(suiteResultMatch[2]);
    const suite = getSuiteById(suiteId);

    if (!suite) {
      json(res, 404, { success: false, error: `套题不存在: ${suiteId}` });
      return;
    }

    const record = RESULT_STORE.get(resultId);
    if (!record || record.suite.id !== suite.id) {
      json(res, 404, { success: false, code: 404, error: `结果不存在: ${resultId}` });
      return;
    }

    json(res, 200, { success: true, code: 200, data: record });
    return;
  }

  // Backward compatibility: old endpoints map to default suite.
  if (req.method === 'GET' && pathname === '/api/questions') {
    const suite = suiteContext.defaultSuite;
    json(res, 200, {
      success: true,
      suite: getSuiteSummary(suite),
      total: suite.totalQuestions,
      data: suite.questions,
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/metadata') {
    json(res, 200, getSuiteMetadata(suiteContext.defaultSuite));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/submit') {
    try {
      const payload = await parseBody(req);
      const answers = Array.isArray(payload.answers) ? payload.answers : null;

      if (!answers) {
        json(res, 400, { success: false, error: 'answers必须为数组' });
        return;
      }

      json(res, 200, submitForSuite(suiteContext.defaultSuite, answers));
    } catch (error) {
      json(res, 400, { success: false, code: 400, error: error.message });
    }
    return;
  }

  const resultMatch = pathname.match(/^\/api\/result\/([^/]+)$/);
  if (req.method === 'GET' && resultMatch) {
    const resultId = decodeURIComponent(resultMatch[1]);
    const record = RESULT_STORE.get(resultId);

    if (!record) {
      json(res, 404, {
        success: false,
        code: 404,
        error: `结果不存在: ${resultId}`,
      });
      return;
    }

    json(res, 200, {
      success: true,
      code: 200,
      data: record,
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  serveStatic(pathname, res);
});

const port = Number(process.env.PORT || process.argv[2] || 3000);
server.listen(port, () => {
  console.log(`麋鹿测试本地服务已启动: http://localhost:${port}`);
  console.log(`默认套题: ${suiteContext.defaultSuite.id} (${suiteContext.defaultSuite.name})`);
});
