# 本地多套题测试系统（含麋鹿套题）

这是一个纯本地可运行的测试系统：

- 支持多套题目录化管理（便于未来新增套题）
- 支持手机/电脑双端展示
- 支持可配置接入 Google 广告（默认关闭，占位不影响观感）
- 支持导出 PDF 报告（浏览器打印为 PDF）
- 已内置 3 套题：
  - `milu-basic`（麋鹿 50 题简短版）
  - `milu-pro-100`（麋鹿 100 题详细版）
  - `bdsm-60`（BDSM 60 题专项版，含 SP/K9/滴蜡/捆绑等）

## 目录结构

```text
question-suites/
  milu-basic/
    suite.json
    questions.json
    dimension_descriptions.json
  milu-pro-100/
    suite.json
    questions.json
    dimension_descriptions.json
  bdsm-60/
    suite.json
    questions.json
    dimension_descriptions.json
config/
  ad-config.json
public/
  index.html
  app.js
  styles.css
server.js
```

## 本地运行（无需额外服务器）

```bash
cd /Users/liiilhhh/Documents/codex
npm start
```

访问：[http://localhost:3000](http://localhost:3000)

## GitHub Pages

- 仓库已内置工作流：`.github/workflows/deploy-pages.yml`
- 推送到 `main` 后会自动发布到 GitHub Pages
- Pages 环境会自动启用前端静态模式（直接读取 `question-suites/*.json` 并在浏览器内计算结果）

## 套题管理（以后新增套题）

1. 在 `question-suites/` 下新建文件夹，例如 `question-suites/new-pack/`。
2. 放入三个文件：
   - `suite.json`
   - `questions.json`
   - `dimension_descriptions.json`
3. 调用 `POST /api/reload` 或重启服务，套题会自动出现在前端下拉选择器。

`suite.json` 最小示例：

```json
{
  "id": "new-pack",
  "name": "新套题",
  "version": "1.0.0",
  "description": "测试说明",
  "default": false
}
```

## 当前套题说明

- `milu-basic`：
  - 题量：50
  - 定位：快速版，适合首次测评
  - 特点：23维度全覆盖，题目去重

- `milu-pro-100`：
  - 题量：100
  - 定位：详细版，适合深度自评
  - 特点：强化边界协商、情境差异、复盘能力题项，题目去重

- `bdsm-60`：
  - 题量：60
  - 定位：BDSM 专项版
  - 特点：覆盖捆绑、SP、K9、滴蜡、感官剥夺、边缘控制、aftercare、安全协议等具体主题，题目去重

参考来源（用于维度框架，不直接构成临床诊断量表）：

- `https://bdsmtest.org`
- `https://github.com/angelod1as/bdsmtest/blob/main/i18n/en.json`
- `https://en.wikipedia.org/wiki/Safe,_sane_and_consensual`

## Git 管理

首次初始化（本地执行一次）：

```bash
cd /Users/liiilhhh/Documents/codex
git init
git add .
```

建议每次改套题后：

```bash
git add question-suites/
git commit -m "update question suite"
```

## Google 广告接入接口（可选）

配置文件：`config/ad-config.json`

- `enabled=false`：只显示轻量占位，不影响阅读
- `enabled=true` 且填写 `client/slots`：启用 Google AdSense

示例：

```json
{
  "provider": "google-adsense",
  "enabled": true,
  "client": "ca-pub-xxxxxxxxxxxxxxxx",
  "slots": {
    "home_inline": "1234567890",
    "result_inline": "0987654321"
  }
}
```

后端接口：

- `GET /api/ad-config`

## PDF 导出

在结果页点击 `导出 PDF`，浏览器会打开打印面板：

- 电脑端：选择“另存为 PDF”
- 手机端（支持打印的浏览器）：选择分享/打印为 PDF

系统已内置打印样式（A4、隐藏无关控件、保留报告核心内容）。

## 主要接口

- `GET /api/suites`：列出所有套题
- `GET /api/suites/{suiteId}/questions`
- `GET /api/suites/{suiteId}/metadata`
- `POST /api/suites/{suiteId}/submit`
- `GET /api/suites/{suiteId}/result/{resultId}`
- `POST /api/reload`：重载套题与广告配置

## 备注

- 题目涉及成人敏感话题，请在合规场景使用。
- 本系统仅用于学习、产品原型与自我了解，不构成医学或临床心理诊断。
