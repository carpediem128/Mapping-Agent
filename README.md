# Hardtech Investment Agent

本项目根据《一二级联动热点赛道挖掘Agent 执行PRD》搭建，用于把“二级市场热点识别 -> 一级项目 Mapping -> 联系方式获取 -> BD 跟进总表”拆成可替换的本地模块。

## 目录结构

```text
hardtech_investment_agent/
  agent/                  # 可执行 agent 源码
    stages/               # 四个 PRD 环节，每个环节可拆卸替换
    sources/              # 数据源适配器：行情、网页、联系方式等
    io/                   # Excel/Markdown 读写
    cli.py                # 命令行入口
    pipeline.py           # 串联四阶段工作流
  config/
    default_config.json   # 默认配置、行业过滤词、列名、外部爬虫路径
  data/input/             # 放企名片导出 Excel 等输入文件
  docs/
    PRD_EXECUTION_MAP.md  # PRD 要求与代码模块对应关系
  runs/                   # 每次执行生成的文件，按日期/run_id 分开
  run_agent.py            # Windows 下最简单的启动脚本
```

## 快速运行

先只跑一个结构化演示，不联网、不需要企名片文件：

```powershell
python hardtech_investment_agent\run_agent.py run --date 20260711 --offline-demo
```

接入企名片导出 Excel 后运行：

```powershell
python hardtech_investment_agent\run_agent.py run `
  --date 20260711 `
  --qmp-excel "C:\path\企名片导出.xlsx"
```

只补联系方式：

```powershell
python hardtech_investment_agent\run_agent.py contacts `
  --date 20260711 `
  --mapping-dir "hardtech_investment_agent\runs\20260711_xxxxxx\mappings"
```

只合并 BD 总表：

```powershell
python hardtech_investment_agent\run_agent.py merge `
  --date 20260711 `
  --mapping-dir "hardtech_investment_agent\runs\20260711_xxxxxx\mappings"
```

## 四个阶段

1. `agent/stages/hotspot.py`
   - 目标：生成 `YYYYMMDD-二级市场热点列表.md`
   - 负责二级市场热点赛道识别、硬科技过滤、Top20/Top10 输出。

2. `agent/stages/mapping.py`
   - 目标：为每个赛道生成 `YYMMDD_赛道名称_Mapping.xlsx`
   - 读取企名片 Excel，按赛道关键词做初筛，输出 PRD 要求的 12 列。

3. `agent/stages/contacts.py`
   - 目标：补齐每个 Mapping 表的 `联系方式` 列。
   - 默认优先加载 `config/default_config.json` 中的 `external_contact_crawler_path`，也就是你提供的 `contact_crawler_sources.py`。如果加载失败，会使用内置轻量联系方式抓取器。

4. `agent/stages/bd_followup.py`
   - 目标：生成 `YYYYMMDD-硬科技项目总表-BD跟进.xlsx`
   - 合并所有分赛道 Mapping 表，添加 `是否联系上`、`是否已约见` 两列，默认值为 `否`。

## 输入输出分离

- 输入文件放在：`data/input/`
- 执行代码放在：`agent/`
- 配置放在：`config/`
- 每次运行结果放在：`runs/YYYYMMDD_HHMMSS/`

这样后续你可以只替换某个环节，比如换掉联系方式爬虫，不影响前面热点和 Mapping 模块。

## 注意

当前版本是本地 agent 骨架，已经把 PRD 的流程、文件命名、列名、自检和模块边界落地。真实行情和平台数据会受 API token、登录态、验证码、网站 403 限制影响；找不到联系方式时会留空，不会编造。



## 网站看板

把某一次运行结果导出到静态网站：

```powershell
python hardtech_investment_agent\run_agent.py export-web `
  --run-dir "hardtech_investment_agent\runs\20260711_150439"
```

本地预览不要直接双击 `index.html`，请用 HTTP 服务打开：

```powershell
python -m http.server 4173 -d hardtech_investment_agent\web
```

浏览器访问：

```text
http://127.0.0.1:4173/
```

如果要给同事一起看，可以把 `hardtech_investment_agent/web` 作为 Vercel 项目根目录托管。Vercel 适合这个版本，因为当前看板是静态站：`index.html` 读取 `data/site_data.json`，并提供 `artifacts/` 下的 Excel 和报告下载。后续如果要加登录、在线上传、多人编辑或数据库，需要再升级成带后端/API 的版本。

## 本地上传已完成 Mapping

启动带上传接口的看板：

    python hardtech_investment_agent\web_server.py

然后访问 http://127.0.0.1:4173/，在左侧“导入与配置”中选择一个或多个 XLSX Mapping。系统会把文件保存到独立的 runs/import... 目录，自动执行联系方式补齐和 BD 总表汇总，并刷新网页数据。

GLM 配置位于 config/default_config.json。默认读取环境变量 GLM_API_KEY，未配置时不会调用 API：

    $env:GLM_API_KEY = "your-api-key"
    python hardtech_investment_agent\web_server.py




## 异步导入与数据源

网页上传现在采用后台任务模式：

1. 在“导入与配置”选择一个或多个 `.xlsx`。
2. 接口立即返回 `job_id`，网页每秒轮询 `/api/import-jobs/{job_id}`。
3. 联系方式阶段按公司更新进度，完成后自动生成 BD 总表和看板数据。
4. 每家公司的证据片段、信源时间、链接、来源计数和失败原因保存于本次运行的 `reports/contact_evidence.json`。

行情默认优先使用 AKShare，不需要 Tushare Token：

```powershell
pip install -r hardtech_investment_agent\requirements.txt
python hardtech_investment_agent\web_server.py
```

配置位于 `config/default_config.json` 的 `market_data` 区块。当前优先尝试 `stock_board_concept_name_em`；财经新闻尝试 AKShare 新闻接口，若公开接口不可用，会在运行状态中记录错误，并由公开财经媒体爬虫补充。正式投研使用前，应对新闻和行情的时间、口径及授权范围做二次核验。

### AKShare Mapping 字段覆盖

二级市场热点阶段按上限采集并写入 JSON：

- 板块：`stock_board_concept_name_em`
- 板块成分股：`stock_board_concept_cons_em`
- 实时行情与市值：`stock_zh_a_spot_em`
- 近 45 日历史行情：`stock_zh_a_hist`
- 公司资料：`stock_individual_info_em`
- 财务指标：`stock_financial_analysis_indicator`
- 主营构成：`stock_zygc_em`
- 个股新闻：`stock_news_em`
- 财经内容精选：`stock_news_main_cx`

每次默认最多采集 8 个重点上市公司，历史行情可通过 `include_history` 开关关闭。单个接口失败不会让整次运行失败，错误会写入 `market_source.detail.errors` 或 `news_source.errors`。这些接口和字段以 AKShare 官方股票数据文档为准。
