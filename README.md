# Hardtech Investment Agent

硬科技投资 Mapping 看板，把以下工作串成一个本地工作流：

`二级市场热点 -> 一级市场 Mapping -> 联系方式 -> BD 跟进`

当前仓库为私有项目，适合本地研究和团队内部使用。

## 当前能力

- 二级市场热点：AKShare 行情、板块、成分股、财务、主营构成和新闻接口。
- 一级市场 Mapping：导入已有 `.xlsx`，保留原始项目行和主题标签。
- 一级市场与二级市场：在看板中分为两个独立页面。
- 联系方式：支持企名片数据、公开网页和招聘信息补充。
- 联系进度：支持行业、状态和关键词筛选，并记录信源时间、链接和证据。
- 异步导入：上传后返回 `job_id`，后台执行联系方式和 BD 汇总。
- GLM：用于文本、表格结构化和字段整理，密钥只从环境变量读取。
- 存储：默认使用本地 SQLite、JSON 和 Excel；多人协作可切换 PostgreSQL。

## 启动看板

在仓库目录执行：

```powershell
pip install -r requirements.txt
python -m web_server_v1
```

浏览器打开：<http://127.0.0.1:4173/>

不要直接双击 `web/index.html`，需要通过 HTTP 服务访问。

## 导入 Mapping

1. 打开看板左侧的“导入与配置”。
2. 选择一个或多个 `.xlsx` 文件。
3. 等待后台任务完成。
4. 在一级市场 Mapping、二级市场 Mapping 和联系总表中查看结果。

推荐使用两个 Sheet：`一级市场`、`二级市场`。系统会保留原始 Sheet、文件名、首列标签和项目字段。

## GLM 配置

```powershell
$env:GLM_API_KEY = "your-api-key"
python -m web_server_v1
```

配置文件：`config/default_config.json`

接口：`POST /api/llm/complete-json`

## 目录说明

```text
agent/                 四个 PRD 阶段和数据源适配器
config/                行业、列名、AKShare、GLM 配置
data/input/            输入 Excel
docs/                  PRD 映射、使用指南和数据存储说明
runs/                  每次执行的产出
web/                   看板页面、JSON 数据和下载文件
run_agent.py           命令行入口
web_server_v1.py        正式看板启动入口
web_server_*.py        v1 调用的后台依赖模块
```

## 命令行工作流

```powershell
# 离线演示
python run_agent.py run --date 20260711 --offline-demo

# 导入企名片 Excel
python run_agent.py run --date 20260711 --qmp-excel "C:\path\企名片导出.xlsx"

# 单独补联系方式
python run_agent.py contacts --date 20260711 --mapping-dir "runs\20260711_xxxxxx\mappings"
```

## 数据和限制

- 当前看板数据保存在 `web/data/`，运行产出保存在 `runs/`。
- AKShare、招聘网站和公开网页可能受网络、登录、验证码、频率限制或字段变化影响。
- 无法核验的联系方式会留空，不会自动编造。
- Vercel 适合托管静态看板；在线上传、登录和多人编辑需要后端服务或 PostgreSQL。

更多细节见：

- `docs/PRD_EXECUTION_MAP.md`
- `docs/USER_GUIDE.md`
- `docs/MARKET_DATA_REFRESH.md`
- `docs/DATABASE_WORKFLOW.md`
