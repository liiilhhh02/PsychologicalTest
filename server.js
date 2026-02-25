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

// Non-linear score calibration:
// linear percentage (0-100) -> sigmoid -> re-scaled back to 0-100.
// Re-scaling keeps exact boundaries: f(0)=0, f(100)=100.
const SIGMOID_SLOPE = 0.08;

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function nonlinearPercentageFromLinear(linearPercentage) {
  const x = clamp(linearPercentage, 0, 100);
  const z = (x - 50) * SIGMOID_SLOPE;
  const s = sigmoid(z);
  const s0 = sigmoid((0 - 50) * SIGMOID_SLOPE);
  const s100 = sigmoid((100 - 50) * SIGMOID_SLOPE);
  const normalized = (s - s0) / (s100 - s0);
  return clamp(Math.round(normalized * 100), 0, 100);
}

const PSY_DIMENSION_PROFILE = {
  A: {
    focus: '情境与角色想象',
    low: '你更偏向自然、真实的互动，而非强设定的角色脚本。',
    mid: '你对角色元素有一定兴趣，但通常需要情境安全感与明确边界。',
    high: '角色设定和剧情推进能显著提升你的投入感与兴奋度。',
    communication: '可提前沟通角色边界、触发词和结束信号。',
    suggestion: '建议在熟悉关系中从轻量场景逐步尝试，避免一步到位。',
  },
  B: {
    focus: '被贬抑语境下的情绪唤起',
    low: '你更容易在被尊重和被肯定的交流中保持放松。',
    mid: '你对特定语境下的强烈语言刺激有探索兴趣，但并非稳定需求。',
    high: '你可能对权力落差与语言刺激较敏感，需要更严格的安全框架。',
    communication: '建议明确“可接受词汇/不可接受词汇”清单。',
    suggestion: '可设置会后复盘，区分角色语境与现实关系，减少误伤。',
  },
  C: {
    focus: '主导性表达与攻击性语言驱动',
    low: '你更偏好温和表达，不依赖攻击性语言来建立兴奋感。',
    mid: '你在特定氛围下可接受一定主导性表达，但通常可控。',
    high: '你在主导表达上动机较强，需格外关注对方体验和同意持续性。',
    communication: '每次互动前后都建议进行同意确认和情绪回收。',
    suggestion: '优先练习非伤害性主导话术，减少关系中的羞耻残留。',
  },
  D: {
    focus: '同性别亲密吸引线索',
    low: '你的主要吸引线索可能不集中在同性别对象上。',
    mid: '你对同性别吸引线索呈现情境性或阶段性开放。',
    high: '你可能对同性别亲密有明确兴趣，身份探索值得被尊重地展开。',
    communication: '建议用“我感受到什么”而非标签先行的方式表达。',
    suggestion: '可以通过书写或咨询探索吸引、认同与关系需求的差异。',
  },
  E: {
    focus: '多人互动与关系新颖度',
    low: '你更偏好稳定、可预测的一对一关系结构。',
    mid: '你对多方互动有好奇，但通常伴随较高风险评估。',
    high: '你对关系新颖性需求较高，需要更细致的规则与界限。',
    communication: '在任何多人场景前，建议先书面化规则和退出机制。',
    suggestion: '把“安全、平等、可撤回”设为底线，可显著降低后悔概率。',
  },
  F: {
    focus: '被看见与公开可见性刺激',
    low: '你倾向私密、安全的互动环境，不强调外部观看。',
    mid: '你对“被看见”有一定兴趣，但通常希望可控且低风险。',
    high: '你可能对公开可见性刺激更敏感，需严格评估法律和隐私风险。',
    communication: '建议明确场景边界并约定任何时刻可立即停止。',
    suggestion: '将“可追溯风险”纳入决策，优先选择低暴露成本方案。',
  },
  G: {
    focus: '主动交出控制感',
    low: '你更倾向保有自主决策，不依赖交出控制获得满足。',
    mid: '你在安全关系中可尝试阶段性交出主导权。',
    high: '你对臣服感较敏感，稳定的信任关系是关键前提。',
    communication: '建议预设边界词与暂停流程，保证可逆性。',
    suggestion: '通过“轻-中-重”分级尝试，可降低失控焦虑。',
  },
  H: {
    focus: '掌控与引导需求',
    low: '你通常偏好平等协作式互动，不追求明显主导位置。',
    mid: '你具备一定引导意愿，但通常能在平衡中切换。',
    high: '你的主导动机较强，越需要把“照顾对方体验”作为核心能力。',
    communication: '建议把同意确认做成流程，而非一次性口头确认。',
    suggestion: '主导并不等于控制他人生活，场景外保持平等尤为重要。',
  },
  I: {
    focus: '规则执行与服从感',
    low: '你对规则服从刺激不敏感，更偏好灵活自主。',
    mid: '你可在明确规则下体验到一定秩序带来的安全感。',
    high: '你可能较依赖外部规则框架，需避免失去自我需求表达。',
    communication: '建议区分“场景规则”与“现实关系权利”。',
    suggestion: '练习在服从结构中同步表达个人感受与边界。',
  },
  J: {
    focus: '过程控制与秩序需求',
    low: '你对过程控制需求较低，更易接受自然流动。',
    mid: '你在关键节点需要一定可预测性与结构。',
    high: '你对不确定性容忍较低，清晰流程可显著提升安全感。',
    communication: '可使用“步骤清单”提前对齐节奏和预期。',
    suggestion: '当控制欲升高时，先识别是焦虑还是偏好本身。',
  },
  K: {
    focus: '痛感接受与受虐倾向',
    low: '你通常不依赖痛感刺激来获得满意体验。',
    mid: '你对轻度痛感可能有探索意愿，但需要强安全保障。',
    high: '你对痛感刺激较敏感，必须以身体与心理安全为先。',
    communication: '建议建立强度量表和事后照护约定。',
    suggestion: '任何尝试都应遵循“可撤回、可复盘、不过度”的原则。',
  },
  L: {
    focus: '施加痛感与施虐倾向',
    low: '你通常不以施加痛感作为核心刺激来源。',
    mid: '你对主导强度有一定兴趣，但可在边界内保持克制。',
    high: '你在施加强刺激上动力较高，更需要伦理与同意纪律。',
    communication: '建议全程监测对方反馈，避免只关注自身兴奋。',
    suggestion: '优先学习低风险技术和急停流程，避免越界伤害。',
  },
  M: {
    focus: '占有与排他需求',
    low: '你对排他控制需求较低，关系中更看重空间感。',
    mid: '你在亲密关系中存在一定排他期待，但仍可协商。',
    high: '你可能对关系安全感高度依赖排他确认。',
    communication: '建议将“占有感需求”转化为可协商的行为请求。',
    suggestion: '识别嫉妒背后的不安来源，比压抑更有效。',
  },
  N: {
    focus: '情感连结与亲密整合',
    low: '你可能更重视体验本身，不一定依赖深情感绑定。',
    mid: '你在情感连结与体验探索之间保持一定平衡。',
    high: '你更倾向把亲密体验与稳定情感关系绑定。',
    communication: '建议清晰表达你对“关系承诺”的具体期待。',
    suggestion: '建立可持续的情感反馈机制能显著提高关系质量。',
  },
  O: {
    focus: '嫉妒线索与竞争性唤起',
    low: '你对第三方竞争线索的刺激性较低。',
    mid: '你在想象层面对竞争线索有一定复杂反应。',
    high: '你可能对嫉妒/竞争情境较敏感，情绪管理尤为关键。',
    communication: '任何涉及第三方的讨论都应以现实边界先行。',
    suggestion: '将“想象刺激”与“现实关系行为”严格分层可降低冲突。',
  },
  P: {
    focus: '观察欲与信息好奇',
    low: '你对旁观或窥探式刺激兴趣较低。',
    mid: '你对观察性线索有探索意愿，但通常止于好奇层面。',
    high: '你对观察情境驱动较强，更需要强化合规与同意意识。',
    communication: '建议把“对方知情同意”设为不可妥协底线。',
    suggestion: '以公开、透明、合法的方式满足好奇，避免隐私侵害。',
  },
  Q: {
    focus: '照顾者角色与保护动机',
    low: '你在关系中不一定以照顾者角色作为核心满足来源。',
    mid: '你具备一定保护倾向，可在平等关系中发挥支持作用。',
    high: '你较强的照顾驱动是优势，但要避免“替对方做决定”。',
    communication: '建议用询问式支持替代单向拯救。',
    suggestion: '把保护欲与尊重自主并行，关系会更稳固。',
  },
  R: {
    focus: '规则突破与反常规驱动',
    low: '你对反常规刺激兴趣较低，更偏好稳定秩序。',
    mid: '你对新鲜体验有好奇，但会保留风险评估。',
    high: '你对打破常规的动力较强，需要更清晰地管理后果。',
    communication: '在探索前先约定“可接受范围”和恢复机制。',
    suggestion: '把冒险冲动转为可控实验，比冲动尝试更可持续。',
  },
  S: {
    focus: '性观念开放度',
    low: '你的观念更偏传统，边界感和秩序感较强。',
    mid: '你在观念上相对开放，但仍有明确价值底线。',
    high: '你对多元表达接受度较高，兼容性通常更好。',
    communication: '建议在关系早期就讨论价值观差异。',
    suggestion: '开放并不等于无边界，清晰底线反而更自由。',
  },
  T: {
    focus: '被动受压情境想象',
    low: '你对被动失控类想象兴趣较低，更偏好自主可控。',
    mid: '你对被动感有一定想象空间，但通常停留在可控范围。',
    high: '你对“交出主动权”的情境较敏感，安全协商是核心。',
    communication: '务必明确这是角色想象，现实中同意可随时撤回。',
    suggestion: '强化边界词、暂停机制和事后安抚，能显著降低压力残留。',
  },
  U: {
    focus: '强制主导情境想象',
    low: '你通常不依赖高压主导想象来获得刺激。',
    mid: '你对高压主导元素有情境性兴趣，但可在边界内调节。',
    high: '你对强制主导想象较敏感，必须以明确同意框架为前提。',
    communication: '建议将“可演绎内容”和“绝对禁区”写明。',
    suggestion: '任何不含同意的现实行为都不可接受，应严格区分想象与现实。',
  },
  V: {
    focus: '性别表达流动性线索',
    low: '你对性别角色转换线索兴趣相对有限。',
    mid: '你对性别表达多样性有一定好奇与包容。',
    high: '你可能更关注性别流动体验与表达自由。',
    communication: '建议在关系中使用对方认同的称谓和表达方式。',
    suggestion: '尊重身份与表达差异，有助于建立更安全的亲密空间。',
  },
  W: {
    focus: '感官锚点与恋物线索',
    low: '你对物品或特定材质刺激依赖较低。',
    mid: '你在特定感官线索上有偏好，但通常可灵活切换。',
    high: '你对某些感官锚点敏感度较高，可能显著影响唤起质量。',
    communication: '建议明确可接受物件和卫生安全要求。',
    suggestion: '在双方同意下探索感官偏好，比压抑或强推更有效。',
  },
};

const SUMMARY_TEMPLATES = {
  low: [
    ({ focus, detail }) => `当前画像显示，“${focus}”并不是主要驱动轴。${detail}`,
    ({ focus, detail }) => `在“${focus}”上更接近低激活状态。${detail}`,
    ({ focus, detail }) => `该维度目前处于背景位，核心满足并不依赖“${focus}”。${detail}`,
    ({ focus, detail }) => `从偏好结构看，“${focus}”属于非核心诉求。${detail}`,
  ],
  midLow: [
    ({ focus, detail }) => `“${focus}”呈温和激活，通常会在特定情境中被触发。${detail}`,
    ({ focus, detail }) => `这项偏好属于可选项而非刚性需求。${detail}`,
    ({ focus, detail }) => `该维度已有一定反应阈值，但仍保留较强可调性。${detail}`,
    ({ focus, detail }) => `你对“${focus}”保持探索窗口，但依旧会受边界感约束。${detail}`,
  ],
  midHigh: [
    ({ focus, detail }) => `“${focus}”已进入稳定影响区，能够实际改变关系体验。${detail}`,
    ({ focus, detail }) => `这项偏好在体验设计中有存在感，适合纳入双方协商议程。${detail}`,
    ({ focus, detail }) => `该维度活跃度较高，常在亲密互动中承担调节作用。${detail}`,
    ({ focus, detail }) => `从测评结果看，“${focus}”属于中高驱动因素。${detail}`,
  ],
  high: [
    ({ focus, detail }) => `“${focus}”是高激活核心维度，对满意度和安全感影响都较明显。${detail}`,
    ({ focus, detail }) => `该维度处于前列驱动位，通常需要明确结构和规则支持。${detail}`,
    ({ focus, detail }) => `这项偏好强度较高，若缺乏沟通设计，关系摩擦概率会增加。${detail}`,
    ({ focus, detail }) => `高激活结果提示“${focus}”是你亲密脚本中的关键变量。${detail}`,
  ],
};

const RISK_NOTE_TEMPLATES = {
  low: [
    (focus) => `当“${focus}”被强行推进时，常见风险是兴趣不匹配导致回避或疲惫。`,
    (focus) => `该维度低激活时，主要风险来自外部期待过高而产生压力。`,
    (focus) => `若对方高频要求“${focus}”，可能触发边界被忽视的感受。`,
  ],
  midLow: [
    (focus) => `该维度处在可协商区，风险点通常是双方误把“可尝试”当成“必须做”。`,
    (focus) => `中低偏好常见挑战是节奏不一致，建议避免一次性强刺激。`,
    (focus) => `“${focus}”虽可探索，但若缺乏反馈机制，容易积累隐性不适。`,
  ],
  midHigh: [
    (focus) => `中高激活阶段要重点防止“默认同意”，每次互动都需要重新确认。`,
    (focus) => `该维度已影响关系质量，忽视复盘会增加误解和情绪残留。`,
    (focus) => `“${focus}”进入常用区后，风险主要来自边界更新不及时。`,
  ],
  high: [
    (focus) => `高激活下最需防范的是把“偏好强”误读为“可越界”。`,
    (focus) => `此维度强度较高时，需特别注意同意可撤回与事后照护流程。`,
    (focus) => `当“${focus}”处于高位，若缺少双向反馈，冲突通常会放大。`,
  ],
};

const DEVELOPMENT_NOTE_TEMPLATES = {
  low: [
    () => '可优先巩固你更看重的互动方式，不必为了“补课”而勉强扩展偏好。',
    () => '把重点放在舒适度和稳定连接上，比追求维度均衡更有价值。',
    () => '若未来想尝试新元素，建议从最轻量版本开始，逐步观察感受。',
  ],
  midLow: [
    () => '适合以“小步试验 + 即时反馈”的方式探索，避免一次性拉高强度。',
    () => '建议提前约定终止词和替代方案，让尝试始终可逆。',
    () => '把体验目标说具体（想增加什么、避免什么），会显著提高匹配效率。',
  ],
  midHigh: [
    () => '建议将这项偏好写入双方共识清单，并设置定期复盘节点。',
    () => '可把该维度与情绪安抚、节奏控制配套使用，体验会更稳定。',
    () => '当偏好成为常规选项后，持续更新边界和禁区尤其重要。',
  ],
  high: [
    () => '高偏好建议配置“前置协商-过程确认-事后回收”三段式流程。',
    () => '在维持强度的同时，保留对方反馈优先级，能明显减少关系损耗。',
    () => '把这项需求转化为可操作清单，有助于长期关系中的稳定执行。',
  ],
};

const DIMENSION_ASSOCIATION_RULES = [
  {
    a: 'H',
    b: 'J',
    weight: 0.23,
    sign: 1,
    relation: '主导-结构协同',
    insight: '主导需求与过程控制通常同向变化，常形成“有脚本的掌控感”。',
    suggestion: '把流程化能力优先用于安全协商，不延伸到关系外控制。',
  },
  {
    a: 'H',
    b: 'L',
    weight: 0.2,
    sign: 1,
    relation: '主导-强度协同',
    insight: '主导驱动增强时，强度表达维度也更容易被激活。',
    suggestion: '任何强度提升都应以即时反馈和急停机制为前提。',
  },
  {
    a: 'G',
    b: 'I',
    weight: 0.22,
    sign: 1,
    relation: '臣服-规则协同',
    insight: '臣服体验与规则服从往往互为支点，共同提升秩序感。',
    suggestion: '建议明确“场景规则”与“现实权利”的边界，避免角色外溢。',
  },
  {
    a: 'G',
    b: 'K',
    weight: 0.18,
    sign: 1,
    relation: '臣服-痛感联动',
    insight: '交出控制感可能同步提升对强刺激耐受的主观预期。',
    suggestion: '通过分级强度和照护复盘，降低超阈值风险。',
  },
  {
    a: 'B',
    b: 'G',
    weight: 0.17,
    sign: 1,
    relation: '受辱-臣服联动',
    insight: '自我评价受外部影响时，臣服脚本更容易被点亮。',
    suggestion: '建议把语言边界写成清单并保留即时叫停权。',
  },
  {
    a: 'C',
    b: 'H',
    weight: 0.16,
    sign: 1,
    relation: '羞辱-主导耦合',
    insight: '强势语言表达与主导位置需求常发生耦合。',
    suggestion: '优先使用非人身贬损表达，降低关系损伤。',
  },
  {
    a: 'K',
    b: 'T',
    weight: 0.19,
    sign: 1,
    relation: '受虐-被动想象联动',
    insight: '痛感接受与被动情境想象可能共同上升。',
    suggestion: '务必强化可撤回同意与事后情绪回收。',
  },
  {
    a: 'L',
    b: 'U',
    weight: 0.19,
    sign: 1,
    relation: '施虐-强制想象联动',
    insight: '强刺激输出倾向和高压主导想象常同步增强。',
    suggestion: '严格区分幻想脚本与现实行为，保持合法与同意底线。',
  },
  {
    a: 'M',
    b: 'O',
    weight: 0.18,
    sign: 1,
    relation: '占有-竞争线索放大',
    insight: '占有需求升高时，竞争与嫉妒线索更易触发情绪反应。',
    suggestion: '将不安转化为可讨论需求，减少试探和拉扯。',
  },
  {
    a: 'N',
    b: 'Q',
    weight: 0.17,
    sign: 1,
    relation: '连结-照护协同',
    insight: '情感绑定和照护动机同向时，关系稳定性通常提升。',
    suggestion: '用询问式支持替代单向决策，兼顾亲密与自主。',
  },
  {
    a: 'N',
    b: 'O',
    weight: 0.15,
    sign: -1,
    relation: '连结-竞争拉扯',
    insight: '高连结需求与竞争性线索往往存在拉扯关系。',
    suggestion: '提前约定涉及第三方话题的沟通边界，避免情绪透支。',
  },
  {
    a: 'E',
    b: 'S',
    weight: 0.2,
    sign: 1,
    relation: '新颖-开放协同',
    insight: '关系新颖度需求与观念开放度常形成正向支撑。',
    suggestion: '在探索前先确定底线和恢复机制，避免盲目求新。',
  },
  {
    a: 'E',
    b: 'F',
    weight: 0.17,
    sign: 1,
    relation: '群体-可见性联动',
    insight: '多人情境兴趣上升时，被看见刺激也更容易增强。',
    suggestion: '优先评估隐私和法律风险，保持低暴露路径。',
  },
  {
    a: 'F',
    b: 'P',
    weight: 0.18,
    sign: 1,
    relation: '可见性-观察欲联动',
    insight: '展示与观察倾向可能彼此强化，形成外部关注回路。',
    suggestion: '把知情同意和隐私保护写入不可妥协条款。',
  },
  {
    a: 'V',
    b: 'S',
    weight: 0.14,
    sign: 1,
    relation: '表达多样性协同',
    insight: '对性别表达流动的包容常与整体开放度同步提升。',
    suggestion: '在互动中优先使用对方认可的称谓与表达方式。',
  },
  {
    a: 'A',
    b: 'S',
    weight: 0.16,
    sign: 1,
    relation: '角色-开放协同',
    insight: '角色化想象越活跃，通常越依赖观念上的开放包容。',
    suggestion: '将剧情探索建立在双方价值观可接受区间内。',
  },
  {
    a: 'R',
    b: 'S',
    weight: 0.14,
    sign: 1,
    relation: '叛逆-开放协同',
    insight: '反常规驱动常与开放价值观相互促进。',
    suggestion: '先做风险评估，再决定是否进入高新颖尝试。',
  },
  {
    a: 'J',
    b: 'Q',
    weight: 0.13,
    sign: 1,
    relation: '控制-照护平衡',
    insight: '流程掌控与照护动机结合时，可形成更稳定的协作体验。',
    suggestion: '把控制感转化为结构支持，而非替对方决定。',
  },
  {
    a: 'W',
    b: 'A',
    weight: 0.12,
    sign: 1,
    relation: '感官-情境协同',
    insight: '感官锚点偏好与角色化场景组合时，沉浸感通常增强。',
    suggestion: '提前确认可接受物件和卫生规范，降低体验中断。',
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function bandFromPercentage(percentage) {
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

function pickTemplate(seed, templates) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return null;
  }
  const code = String(seed)
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return templates[code % templates.length];
}

function buildAssociationGraph(rules) {
  const graph = new Map();

  const addEdge = (from, to, rule) => {
    if (!graph.has(to)) {
      graph.set(to, []);
    }
    graph.get(to).push({
      from,
      to,
      weight: rule.weight,
      sign: rule.sign,
      relation: rule.relation,
      insight: rule.insight,
      suggestion: rule.suggestion,
    });
  };

  rules.forEach((rule) => {
    addEdge(rule.a, rule.b, rule);
    addEdge(rule.b, rule.a, rule);
  });

  return graph;
}

const ASSOCIATION_GRAPH = buildAssociationGraph(DIMENSION_ASSOCIATION_RULES);

function applyAssociationModel(basePercentages, dimensionKeys) {
  const adjustedPercentages = {};
  const contributions = [];

  dimensionKeys.forEach((key) => {
    const base = basePercentages[key] ?? 50;
    const edges = ASSOCIATION_GRAPH.get(key) || [];
    let delta = 0;

    edges.forEach((edge) => {
      const sourceScore = basePercentages[edge.from] ?? 50;
      const centered = sourceScore - 50;
      const contribution = centered * edge.weight * edge.sign;
      delta += contribution;

      if (Math.abs(contribution) >= 1) {
        contributions.push({
          ...edge,
          contribution,
        });
      }
    });

    adjustedPercentages[key] = clamp(Math.round(base + delta), 0, 100);
  });

  return {
    adjustedPercentages,
    contributions,
  };
}

function associationBand(percentage) {
  if (percentage >= 75) {
    return '高激活';
  }
  if (percentage >= 50) {
    return '中高激活';
  }
  if (percentage >= 25) {
    return '中低激活';
  }
  return '低激活';
}

function buildAssociationInsights(contributions, adjustedPercentages, nameByKey) {
  const sorted = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const dedup = new Map();

  for (const item of sorted) {
    const pair = [item.from, item.to].sort().join('-');
    if (dedup.has(pair)) {
      continue;
    }
    dedup.set(pair, item);
    if (dedup.size >= 4) {
      break;
    }
  }

  return [...dedup.values()].map((item) => {
    const fromName = nameByKey[item.from] || item.from;
    const toName = nameByKey[item.to] || item.to;
    const effect = item.contribution >= 0 ? '增强' : '抑制';
    const intensity = Math.abs(item.contribution).toFixed(1);
    const fromBand = associationBand(adjustedPercentages[item.from] ?? 50);
    const toBand = associationBand(adjustedPercentages[item.to] ?? 50);

    return {
      pair: `${item.from}-${item.to}`,
      relation: item.relation,
      impact: `${fromName}（${fromBand}）对${toName}（${toBand}）呈${effect}效应，估计影响约 ${intensity} 分。`,
      interpretation: item.insight,
      suggestion: item.suggestion,
    };
  });
}

function composeDimensionAnalysis(key, percentage, basePercentage = percentage) {
  const profile = PSY_DIMENSION_PROFILE[key] || {
    focus: '亲密互动偏好',
    low: '该维度偏好较低。',
    mid: '该维度呈中等偏好。',
    high: '该维度偏好较高。',
    communication: '建议提前沟通边界与期待。',
    suggestion: '建议在安全、同意、可撤回前提下探索。',
  };

  const band = bandFromPercentage(percentage);
  const detail = band === 'low'
    ? profile.low
    : band === 'high'
      ? profile.high
      : profile.mid;

  const summaryBuilder = pickTemplate(`${key}-${percentage}`, SUMMARY_TEMPLATES[band]) || SUMMARY_TEMPLATES[band][0];
  const riskBuilder = pickTemplate(`${key}-${percentage + 13}`, RISK_NOTE_TEMPLATES[band]) || RISK_NOTE_TEMPLATES[band][0];
  const growthBuilder = pickTemplate(`${key}-${percentage + 29}`, DEVELOPMENT_NOTE_TEMPLATES[band]) || DEVELOPMENT_NOTE_TEMPLATES[band][0];

  const delta = percentage - basePercentage;
  let associationHint = '关联维度对该项影响较平稳，当前分值主要由本维度题目驱动。';
  if (delta >= 4) {
    associationHint = '关联维度带来上调效应，说明你的偏好结构存在协同增强。';
  } else if (delta <= -4) {
    associationHint = '关联维度带来回落效应，提示该偏好受到其他需求的牵制。';
  }

  return {
    summary: summaryBuilder({
      focus: profile.focus,
      detail,
    }),
    communication: profile.communication,
    risk: riskBuilder(profile.focus),
    development: `${growthBuilder()} ${profile.suggestion}`,
    associationHint,
  };
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

  const linearPercentages = {};
  const basePercentages = {};
  const nameByKey = {};

  suite.dimensionOrder.forEach((key) => {
    const item = grouped.get(key);
    const denominator = item.maxScore - item.minScore;
    const linearPercentage = denominator === 0
      ? 100
      : Math.round(((item.score - item.minScore) / denominator) * 100);
    const basePercentage = nonlinearPercentageFromLinear(linearPercentage);

    linearPercentages[key] = linearPercentage;
    basePercentages[key] = basePercentage;
    nameByKey[key] = item.name;
  });

  const associationModelResult = applyAssociationModel(basePercentages, suite.dimensionOrder);
  const adjustedPercentages = associationModelResult.adjustedPercentages;
  const associationInsights = buildAssociationInsights(
    associationModelResult.contributions,
    adjustedPercentages,
    nameByKey
  );

  const dimensions = suite.dimensionOrder.map((key) => {
    const item = grouped.get(key);
    const linearPercentage = linearPercentages[key];
    const basePercentage = basePercentages[key];
    const percentage = adjustedPercentages[key] ?? basePercentage;
    const associationDelta = percentage - basePercentage;
    const analysis = composeDimensionAnalysis(item.key, percentage, basePercentage);

    return {
      key: item.key,
      name: item.name,
      score: item.score,
      maxScore: item.maxScore,
      minScore: item.minScore,
      questionCount: item.questionCount,
      linearPercentage,
      basePercentage,
      associationDelta,
      percentage,
      level: levelFromPercentage(percentage),
      description: analysis.summary,
      baselineDescription: item.description,
      analysis,
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
    associationInsights,
    scoringStandard: {
      scale: '每题1-5分',
      normalization: '百分比 = (维度总分 - 维度最小分) / (维度最大分 - 维度最小分) * 100',
      nonlinearScoring: {
        model: 'sigmoid',
        slope: SIGMOID_SLOPE,
        formula: '最终分 = round(100 * (sigmoid(k*(x-50)) - sigmoid(-50k)) / (sigmoid(50k) - sigmoid(-50k)))',
        note: 'x 为线性归一化分，k 为斜率参数；该变换用于提升中段分辨率并保留 0-100 边界。',
      },
      associationModel: '百分比会根据关联维度进行协同修正，模拟单题对多维的间接影响。',
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
