# Hardtech Investment Agent

面向硬科技投资研究的 Mapping 看板，覆盖：

`二级市场热点 -> 行业统计 -> 一级市场 Mapping -> 二级市场 Mapping -> 联系方式与 BD 跟进`

项目默认使用本地 SQLite、JSON 和 Excel，可直接在 Windows 本地运行。浏览已经导入的看板数据不需要大模型 API Key；只有调用大模型整理文本或表格时才需要配置 GLM。

## 功能入口

看板左侧包含七个固定入口：

1. 概览
2. 二级热点
3. 行业统计
4. 联系总表
5. 一级市场 Mapping
6. 二级市场 Mapping
7. 导入与配置

支持上传已经完成的 Mapping Excel，并按原始一级市场、二级市场 Sheet 展示项目；也支持行情刷新、联系方式汇总和 GLM 结构化处理。

## 从二级主题生成新 Mapping

页面顶部的“主题研究”在七个页面之间保持可见。将二级热点排名拖入研究区，或输入主题，点击“开始研究”。任务在后台运行，切换页面或刷新浏览器不会取消任务。

1. GLM 拆解产业链及中英文关键词。
2. 智谱 Web Search 实时检索创投媒体、公司官网、微信公众号索引、高校转化与专精特新信息。
3. 逐公司补查业务、团队、融资和上市状态，再用 GLM 按来源抽取字段。
4. Excel 包含“确定性高”和“待核验”两个 Sheet，均保留 PRD 的12列及顺序；无单元格批注，仅在每张表最后一条记录的下一行保留一句备注。来源链接、信源时间与核验依据仍保存在研究任务记录中，网页预览展示链接。
5. 点击“加入 Mapping 看板”，只把确定性高的一级项目写入看板；待核验记录不会被误计为已覆盖项目。已确认上市公司排除在这两个 Sheet 外，原始研究记录保留于任务目录。

需要服务端的 `GLM_API_KEY` 同时具备 GLM 对话与智谱 Web Search 权限，调用按供应商规则计费。检索不读取已有 Mapping Excel，不会把缓存文件伪装成新产出。默认每主题最多30个候选补查，有限轮搜索不能保证穷尽公司；来源不足的字段留空，上市状态不明确的记录进入待核验页。搜索快照时间不等于网页发布时间。

任务证据和响应保存在 `runs/topic_research/<任务ID>/`，不包含 API Key。服务重启后，未完成任务标记为中断，可以再次发起；已经完成的任务和下载文件保留。网页关闭不会停止任务，但需要保持本地 Python 服务运行。

接口：`POST /api/research` 接收 `{"topic":"玻璃基板 TGV"}`；`GET /api/research` 查询任务；`GET /api/research/<ID>/download` 下载；`POST /api/research/<ID>/publish` 加入看板。

## 启动命令

在仓库根目录执行：

```powershell
python -m pip install -r requirements.txt
python -m web_server_v1
```

浏览器打开：

```text
http://127.0.0.1:4173/
```

不要直接双击 `web/index.html`。上传、数据库和接口功能需要通过 Python HTTP 服务运行。

## API Key 安全原则

仓库不包含任何真实 API Key。代码只从操作系统环境变量读取密钥，不会从 `config/default_config.json`、网页、JSON 数据或 Excel 中读取明文 Key。

请遵守以下规则：

- 不要把真实 Key 写入 README、配置文件、代码或 Excel。
- 不要把 Key 放进 `web/` 目录或任何前端 JavaScript。
- 不要提交 `.env`、`config/local_config.json`、`secrets/`、`.pem` 或 `.key` 文件。
- 每位使用者应配置自己的 Key；交付给同事或老板时只交付代码。
- 如果 Key 曾出现在聊天、邮件、截图或提交历史中，应立即在供应商控制台撤销并重新生成。

## 配置 GLM Key

### 方式一：仅当前 PowerShell 窗口生效

```powershell
$env:GLM_API_KEY = "在这里填入使用者自己的 Key"
python -m web_server_v1
```

关闭该 PowerShell 窗口后，环境变量会失效。

### 方式二：保存到当前 Windows 用户

```powershell
[Environment]::SetEnvironmentVariable(
  "GLM_API_KEY",
  "在这里填入使用者自己的 Key",
  "User"
)
```

设置后重新打开 PowerShell，再运行：

```powershell
python -m web_server_v1
```

### Linux 或 macOS

```bash
export GLM_API_KEY="在这里填入使用者自己的 Key"
python -m web_server_v1
```

部署到服务器时，请在服务器或托管平台的 Secret / Environment Variables 页面添加 `GLM_API_KEY`。不要把 Key 写入 GitHub 仓库，也不要使用会暴露到浏览器端的公开环境变量名称。

## 修改 GLM 模型

默认模型位于 [`config/default_config.json`](config/default_config.json)：

```json
{
  "glm": {
    "enabled": true,
    "api_key_env": "GLM_API_KEY",
    "model_env": "GLM_MODEL",
    "base_url": "https://open.bigmodel.cn/api/paas/v4",
    "model": "glm-4.5",
    "timeout_seconds": 60
  }
}
```

有两种修改方式：

1. 临时切换模型，不修改仓库文件：

```powershell
$env:GLM_MODEL = "需要使用的模型名称"
python -m web_server_v1
```

2. 修改默认模型：编辑 `config/default_config.json` 中的 `glm.model`。

`GLM_MODEL` 环境变量的优先级高于配置文件。若更换兼容服务地址，修改 `glm.base_url`；密钥仍通过 `glm.api_key_env` 指定的环境变量读取。

## 检查配置状态

以下命令只显示是否已配置、模型名和接口地址，不会打印 Key：

```powershell
python -c "from agent.settings import load_config; from agent.sources.glm import GLMClient; print(GLMClient.status(load_config()))"
```

也可以打开看板的“导入与配置”页面查看 GLM 状态。

## 导入 Mapping Excel

1. 打开“导入与配置”。
2. 选择一个或多个 `.xlsx` 文件。
3. 等待后台任务完成。
4. 在“一级市场 Mapping”“二级市场 Mapping”和“联系总表”查看结果。

推荐工作簿包含 `一级市场` 和 `二级市场` 两个 Sheet。系统会保留原始文件名、Sheet、首列标签和项目字段。

## 命令行工作流

```powershell
# 离线演示
python run_agent.py run --date 20260711 --offline-demo

# 导入企名片 Excel
python run_agent.py run --date 20260711 --qmp-excel "C:/path/企名片导出.xlsx"

# 单独补充联系方式
python run_agent.py contacts --date 20260711 --mapping-dir "runs/20260711_xxxxxx/mappings"
```

## 目录结构

```text
agent/                 Agent 流程、模型客户端和数据源适配器
config/                行业、AKShare 与模型配置，不存放真实 Key
data/input/            待处理 Excel
docs/                  PRD、用户指南和数据库说明
runs/                  每次执行产生的临时结果，默认不提交
scripts/               Mapping 导入、行情刷新和数据维护脚本
server/                后端接口与任务处理模块
web/                   看板页面和已导出的展示数据
run_agent.py           命令行入口
web_server_v1.py       正式看板启动入口
```

## 数据与限制

- 当前看板数据保存在 `web/data/`，运行产出保存在 `runs/`。
- AKShare、招聘网站和公开网页可能受网络、登录、验证码、频率限制或字段变化影响。
- 无法核验的联系方式应留空，不自动编造。
- Vercel 适合托管静态页面；在线上传、数据库写入、定时任务和私密 API 调用需要单独的后端服务。
- 多人协作可继续使用 SQLite 文件，也可以按 `docs/POSTGRES_SETUP.md` 切换 PostgreSQL。

更多说明：

- `docs/USER_GUIDE.md`
- `docs/PRD_EXECUTION_MAP.md`
- `docs/PRD_V1_1.md`：已更新至 v1.2，包含产品流程、API、Agent 编排、上传下载、SQLite/JSON、语义处理、行情刷新和技术边界。

### 行情刷新排查

使用 Python 3.12（当前 multipart 上传依赖 cgi），建议为项目建立独立虚拟环境。必须使用启动网站的同一个 Python 安装依赖，不要混用系统 pip。

```powershell
python -m pip install --upgrade -r requirements.txt
python -c "import akshare; print(akshare.__version__)"
python -m scripts.refresh_market_data_enhanced
```

服务存活时每30分钟检查刷新；关闭电脑不会继续运行。周期采集日志在 `runs/market_refresh/`。采集时间与日线核验日期分开；未知日期不以当天替代。备用数据和缺失字段按实际返回展示，不保证免费源持续可用。
- `docs/MARKET_DATA_REFRESH.md`
- `docs/DATABASE_WORKFLOW.md`
