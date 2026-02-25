# 本地多套题测试系统（含麋鹿套题）

这是一个纯本地可运行的测试系统：

- 支持多套题目录化管理（便于未来新增套题）
- 支持手机/电脑双端展示
- 支持可配置接入 Google 广告（默认关闭，占位不影响观感）
- 支持导出 PDF 报告（浏览器打印为 PDF）

## 目录结构

```text
question-suites/
  milu-basic/
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
