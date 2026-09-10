# Investment Mapping Agent PRD v1.2

更新日期：2026-09-11。本文同时描述产品要求、当前源码实现与技术边界；“计划”不表示已经上线。

## 产品目标

为硬科技投资研究提供二级热点到一级项目 Mapping 的工作流，同时支持导入已经完成的研究；公司证据、研究文件与 BD 跟进保持可追溯。

## 页面结构

保留七个导航入口：概览、二级热点、行业统计、联系总表、一级市场 Mapping、二级市场 Mapping、导入与配置。

顶部主题研究区跨页面保留并随滚动吸顶，支持热点拖入和主题输入；开始研究按钮使用明显的主色，辅助文字提高字号与对比度，适配桌面和手机。

## 两条工作流

1. 新研究：选择二级主题 → GLM 拆解关键词 → 智谱公开检索 → 企业信息抽取 → 来源及主体核验 → 别名去重 → 双 Sheet Excel → 用户选择加入 Mapping 看板。
2. 已有研究：上传原始 Mapping → 解析字段与市场层级 → 展示项目 → 联系信息补充与 BD 跟进。

## 新研究要求

- 只需输入主题即可启动；不依赖已导入的 Excel。
- 后台任务显示阶段和进度，浏览器刷新或导航不取消任务；服务重启会将未完成任务标为中断。
- 检索覆盖中英文关键词、创投媒体、公开官网及公众号索引等；默认至多补查30个候选主体。
- 来源保留查询词、链接、公开时间、抓取时间与抽取依据；模型输出必须引用已返回来源。
- 过旧融资、主体身份不明、缺乏独立报道等情况进入待核验；已确认上市主体排除在一级候选文件之外。
- 中英文名合并须有证据，母子公司不因名称相似而自动合并。

## Excel 交付

文件名：`YYMMDD_主题_Mapping.xlsx`。

仅包含“确定性高”和“待核验”两个 Sheet，均采用以下12列：

公司类型、公司名称、地区、成立时间、业务描述、核心产品/技术、融资轮次、最新融资金额、主要投资方、公司团队、公司简介、联系方式。

无单元格批注；每张表在最后一条数据的下一行添加一句备注。备注不参与筛选、项目计数或再次导入。来源及核验依据保存在任务记录中，网页预览展示来源链接。阶段二的联系方式默认留空。

## 入库和安全

- 用户点击加入看板后，仅确定性高项目计入一级市场覆盖统计；待核验记录保留在研究结果中。
- SQLite、JSON 和 Excel 本地存储，运行产出与执行代码分开。
- GLM 密钥仅由环境变量提供，模型可通过 `GLM_MODEL` 配置；不提交密钥或运行日志。
- 当前使用直接 API 调用，未把 MCP 作为运行依赖。

## 验收标准

- 七个导航可切换，研究区状态保留，滚动后仍可拖入热点。
- 桌面与手机输入框、按钮、辅助文字不重叠。
- 下载文件两张表均为12列，无批注，最后一行仅为备注。
- 备注和待核验条目不误计入已覆盖一级项目。
- API 失败显示实际失败或缺失状态，不能用历史文件冒充新研究。

## 当前边界

已验证玻璃基板 TGV 和人形机器人从零检索、导出，以及本地下载与入库。确定性高表示通过现有证据规则，不等同于完成尽调。有限轮公开搜索不能保证覆盖全部企业；15–30家是研究覆盖目标，不通过虚构条目补足。热点接口失败时保留历史快照。行情已增加服务存活期间的周期刷新；独立任务调度平台、生产级多人权限和外网部署仍未完成。

## 技术架构与设计选择

```text
浏览器：HTML + CSS + 原生 JavaScript
  七个 hash 页面 / 主题拖放 / 表格筛选 / 任务轮询
                  |
Python ThreadingHTTPServer（web_server_v1.py）
  |-- 行情子进程 -> AKShare -> 概念/个股/财务/新闻 -> 看板快照
  |-- 研究后台线程 -> GLM 计划 -> web_search -> 抽取 -> 核验/合并
  |                                            -> Excel / 证据 JSON
  |-- multipart 上传 -> openpyxl -> 标准记录 -> SQLite + JSON
  |-- 下载/发布 API -> 文件响应 / 用户确认后入库
  |-- 联系阶段 -> 可配置外部爬虫 -> 联系证据 -> Excel 更新
```

采用本地、模块化、可追溯设计，先服务小团队研究流程，降低数据库订阅和部署成本。运行入口唯一为 `web_server_v1.py`；历史服务模块仍有继承依赖，不应只按文件名删除。源码与运行数据分别在 `agent/`、`server/`、`web/` 和 `runs/`、`web/artifacts/`。

当前不是 React/Next.js 应用，也没有使用 LangChain、LangGraph、向量数据库、模型微调或 MCP 运行时。这里的 Agent 指“模型参与规划与抽取、由 Python 显式控制状态的有界研究工作流”，不是可以无限自由执行代码的自主系统。

## API 如何接入

| 能力 | 实现位置 | 调用方式与数据约束 |
| --- | --- | --- |
| 大模型 | `agent/sources/glm.py`、`research_glm.py` | 服务端 `urllib.request` 发送 HTTPS JSON POST，`Authorization: Bearer` 从环境变量读取；不把密钥发到浏览器 |
| 结构化生成 | `/chat/completions` | `response_format=json_object`，temperature 0.1，max_tokens 6000；解析 JSON 后仍要校验对象、字段及来源编号 |
| 联网搜索 | `agent/topic_research.py` 的 `/web_search` | 智谱 `search_std`，每查询 count=10，保留原始响应与来源；这是搜索 API，不是让模型凭记忆生成企业名单 |
| 行情 | `agent/sources/akshare.py` | Python 导入 AKShare 并调用函数，返回 pandas DataFrame，再转为 JSON 记录；GLM 不负责生成价格、财报数字 |
| 任务交互 | `server/research_routes.py` | HTTP 202 返回任务编号；前端轮询状态和进度，不用一次 HTTP 请求等待整个研究完成 |

模型配置在 `config/default_config.json` 的 GLM 配置项，默认兼容地址为 `https://open.bigmodel.cn/api/paas/v4`。模型名由 `GLM_MODEL` 优先覆盖配置中的 model；密钥使用 `GLM_API_KEY`。配置改变后需重启服务以确保新进程继承环境。

```powershell
# 在自己的终端设置；不要把真实值写进 README 或 Git。
$env:GLM_API_KEY = '<your-own-key>'
$env:GLM_MODEL = '<model-enabled-in-your-account>'
python -m web_server_v1
```

GLM 抽取请求超时 180 秒，至多两次尝试；401/402/403 直接提示权限或余额问题；截断输出不能作为完整结果使用。搜索请求超时 90 秒，个别查询失败保留错误并继续；所有查询都失败时任务失败，不用测试 Excel 兜底。搜索服务与模型接口的权限、计费分别取决于供应商账户。

## Agent 工作流和状态

1. 输入：用户输入主题或拖入二级热点，提交 `POST /api/research`；主题限制 1–60 字，相同活跃主题不重复启动，同时最多两个研究任务。
2. 规划：GLM 返回 scope、细分和中英文查询词；该阶段禁止直接生成公司名单。
3. 搜索：追加产业链、融资、创业公司、官网、招聘、36氪、IT桔子、创业邦、集微网与公众号域名查询；每个查询保存 raw 响应、查询词、检索时间。
4. 候选发现：来源按批送入 GLM；默认每批18条来源，最多3个并发抽取工作线程；最多补查30个候选主体。
5. 信息抽取：每家公司最多取12条相关来源，返回 `fields` 和逐字段 `citations`。未经返回来源支持的非空字段丢弃；没有公司名或来源的条目拒收。
6. 实体与质量处理：`research_entities.py` 合并有证据的别名，`research_quality.py` 划分确定性高/待核验并排除确认上市主体。
7. 导出：`research_export.py` 用 openpyxl 写模板双 Sheet，保存核验、合并和搜索审计数据。
8. 发布：用户点击加入看板才执行 `/api/research/{id}/publish`；只发布确定性高项目。下载 Excel 不等于自动发布。

任务目录为 `runs/topic_research/{uuid}/`，包含 status、plan、queries、evidence、raw、entity_merges 与结果文件。状态用锁保护并以临时文件替换写入；刷新浏览器不会取消后台线程。服务重启后，未完成研究标为 interrupted，而不是声称支持断点续跑。进度百分比是阶段进度，不是预计完成时间或研究可信度。

## 哪些步骤使用语义处理

| 场景 | 方法 | 防止误合并的约束 |
| --- | --- | --- |
| 主题到搜索词 | GLM 产业链拆解、中英文扩词 | 后续仍须有公开来源，扩词不是企业事实 |
| 网页摘要到公司字段 | GLM JSON 抽取 | 每个非空字段必须引用已检索的 source ID |
| 中英文名、简称和全称 | GLM 提议别名组，Python 检查索引和来源 | canonical 必须是现有行，不创造全称；不同组不能重叠；母子公司不按相似名称自动合并 |
| 字段合并 | 代码填充缺失字段并合并证据 | 上市状态冲突降为待核验，保留合并记录；其他冲突字段目前并非完整人工裁决系统 |
| Excel 导入 | openpyxl、表头匹配、字符串清洗 | 正常导入不调用模型改写公司名称；保留 sheet、原始行号和字段 |
| 看板搜索、行业分类 | 字符串匹配及配置关键词 | 不是 embedding 相似度搜索；当前没有向量检索 |

来源编号存在只能证明“来源被引用”，不能自动证明“来源确实支持所有陈述”。质量规则降低幻觉风险但不替代人工尽调；独立报道、官方材料及融资时效是核验线索，不能承诺全网企业覆盖或100%准确。

## 二级市场数据与刷新

主链路：`stock_board_concept_name_em` 概念行情；失败时尝试 `stock_fund_flow_concept` 的概念记录。按配置关键词筛选硬科技概念并计算解释性热度分数，分数不是投资收益预测。资金流来自独立接口，不应将缺失值解释为0流入；成分股数量也不能当作上涨家数。

个股行情通过 `stock_zh_a_spot_em`，失败时尝试新浪 `stock_zh_a_spot`；板块前三标的按 `stock_board_concept_cons_em` 返回的涨跌幅降序选取。公司资料、主营构成和财务分别调用 `stock_individual_info_em`、`stock_zygc_em`、财务分析/三张财务报表接口，并用 `stock_financial_abstract_ths` 补充。详情公司总量受 max_companies 配置限制；不能宣称每个概念的所有成分股都已完成财务采集。

新闻依次尝试财经精选、东方财富全球资讯、个股新闻。新闻条目保留接口、发布时间和链接；公众号/IT桔子目前主要通过搜索索引发现公开内容，不是付费数据库全量授权，也不绕过登录、验证码或访问限制。

本次修复：补齐缺失的 pytz、requests 等依赖，将 AKShare 版本约束提升至1.18.94；增加 `agent/market_runtime.py`，服务存活时每30分钟检查并刷新，单轮子进程最多900秒，requests 未指定超时时补充10秒连接/30秒读取超时。失败保留上次快照及真实原因，成功清除旧失败标记。服务关闭或电脑休眠期间不会刷新。

`collected_at` 表示实际请求的采集时间，`date` 使用板块日线返回的末条日期核验；拿不到日期时留空并显示“行情日期待核验”，绝不直接用系统当天替代信源日期。日线与盘中快照可能不同步。财务报告期与行情时间独立；部分详情接口失败不能显示为全量成功。前端每30秒检查更新，不再每3秒不断请求大 JSON。

安装及接口定义参考：[AKShare 安装文档](https://akshare.akfamily.xyz/installation.html)、[股票接口文档](https://akshare.akfamily.xyz/data/stock/stock.html)。免费公开接口可用性不等同于商业行情 SLA，也不保证对外再分发许可。

## 上传、解析和下载

浏览器使用 `FormData` 将多个 XLSX 上传到 `POST /api/import-mappings`；`server/web_server_product_fast.py` 读取 multipart，请求先落到独立运行目录，再启动后台线程，返回 job_id。当前解析依赖 Python 3.12 的 cgi，不能未经适配直接升级到移除 cgi 的 Python 3.13。

实际快速导入使用 `scripts/merge_mapping_files.py`：`load_workbook(read_only=True, data_only=True)`，第一行当表头，识别公司名称/企业名称等列，保留原始字段与行号；末行“备注：”且没有公司名的行不计入项目。它不是任意复杂 Excel 的通用语义识别器：标题占多行、合并表头、未缓存公式仍需预处理。股票层级目前主要按“二级市场”sheet 名区分，其余 sheet 需规范命名。

同名文件再次上传会替换前端来源记录；SQLite 用稳定标识 upsert。文件名不是内容哈希，改名再上传可能形成重复来源；同文件删行后的数据库清理和跨文件精确去重是待加固项。用户完成的 Mapping 不需要重新跑 GLM 才能浏览。

研究下载 `GET /api/research/{id}/download` 校验任务编号和完成状态，以 XLSX MIME 及 UTF-8 `Content-Disposition` 返回二进制；原始导入文件复制到 `web/artifacts/{run}/mappings/` 供下载。导出为两张12列工作表，数据区域有筛选和冻结窗格，末行一句备注，不逐格加批注；不可信文本以 `= + - @` 开头时防止被执行为公式。

## 数据库存储与页面展示

当前主上传/发布路径使用 SQLite 文件 `web/data/mapping.db`，无需付费订阅；开启 WAL。`mapping_workbooks` 存来源文件和状态，`mapping_records` 存来源 sheet、行号、market_level、company_name、topic、fields_json、search_text、quality_flags_json；公司名、主题、市场层级建索引。

`fields_json` 保留不同主题的原始列，避免为每个行业改数据库 schema；标准列用于筛选和关联。原始 XLSX 用于审计与下载，`runs/` 中的 JSON 保存模型证据，`mapping_sources.json` 和 `site_data.json/site_data.js` 是前端读模型。浏览器不直接连接数据库：后端更新存储和快照，JS 读 JSON，按当前主题、市场层级和行业渲染表格与图表。

这不是单一数据库的实时查询产品。SQLite 与 JSON 多份读模型仍有跨文件原子性和并发写入风险；正式多人环境需统一事务和发布快照机制。虽然 `mapping_db_pg.py` 存在 PostgreSQL 适配器，快速导入仍直接调用 SQLite，不能声称设置 DATABASE_URL 就已完成全链路 PostgreSQL 迁移。

## 看板如何构建

`web/index.html` 提供页面骨架，CSS 负责侧边栏、字体、间距、响应式布局和标签颜色；原生 JavaScript 通过 hash 路由切换七个页面，依照所选主题渲染记录。一级与二级 Mapping 分开显示，但保留共同的来源工作簿。主题不是把每种公司类型拆成一个页面，类型以表格列和颜色呈现。

顶部研究区由 `research_desk.js/.css` 管理，使用 HTML 拖放事件、输入控件和任务轮询；状态区跨分类保留，CSS sticky 固定研究入口。概览按主题汇总项目及联系覆盖，深色部分表示有对应跟进记录的项目；缺数据不能默认视为已联系。

采用轻量静态前端是为了快速交付、易读易改，不需要构建链。代价是当前历史 JS 扩展较多，未来应逐步模块化为统一状态管理和路由，而不是无限叠加修补脚本。Vercel 静态部署本身不能承载目前的常驻 Python 线程及本地 SQLite，外网部署需要另外安排后端、持久磁盘和访问权限。

## 联系方式获取与可信度

`agent/stages/contacts.py` 优先使用配置 `external_contact_crawler_path` 指向的爬虫，动态加载其 `crawl_company(company, max_pages, delay)`。爬虫返回 evidence、issues、searched_urls 和 source_counts；代码按 contact_type 分开提取电话、手机、邮箱，校验邮箱格式、过滤明显占位号码并去重，证据保存在 contact_evidence.json。

目标渠道包括用户上传的招聘联系表、公司官网、公开招聘页、新闻及公众号索引；应同时保留来源时间与链接。招聘联系人的职位不能仅根据“发布日期早”推断为创始人。没有配置外部爬虫时当前模块不会自动完成全网爬取；它返回空结果。现有粗粒度 confidence 也不能等同于已确认电话归属，老板使用前仍需核验。研究阶段默认不让 GLM 编造联系方式。

## 验证与交付边界

2026-09-11 本机实测：备用概念数据返回387条、筛选20个硬科技热点；8家公司的个股行情及财务摘要、12条新闻已返回，8家公司日线日期均为2026-09-10。东方财富概念主接口仍有网络断连，备用概念接口没有可核验的时间字段，因此显示“部分更新 / 行情日期待核验”，不能声称全部字段实时成功。采集时间记录为2026-09-11 00:55:31（Asia/Shanghai）；上述数字是本次结果，不是固定的产品展示数据。

单元测试：`scripts/test_market_runtime.py` 检查旧快照、刷新间隔和未知日期不伪造；`scripts/test_topic_research.py` 与 `test_research_export.py` 检查研究及 Excel 规则。浏览器脚本检查七个路由、拖放、下载/发布及桌面手机布局。测试夹具只用于测试，正式研究必须保存真实搜索响应。

演示是本地单用户/小团队原型，不是生产级金融终端。外网开放前需要补充身份认证、文件大小与压缩包限额、权限隔离、上传防护、速率限制和备份；当前 `web/data` 内数据库可能被静态文件服务读取，不能直接向公网暴露。密钥一旦曾提交或分享，删除文件不等于撤销密钥，应在供应商处轮换。

面试概括："I built an evidence-constrained investment research workflow with a lightweight HTML/JavaScript dashboard and a Python backend. GLM plans searches and extracts structured facts; deterministic code validates citations, merges supported aliases, exports Excel, and publishes records to a SQLite-backed dashboard. Market data is fetched separately through AKShare, with explicit timestamps and failure states."
