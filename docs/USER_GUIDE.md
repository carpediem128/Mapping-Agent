# Hardtech Investment Mapping 使用指南

## 1. 启动与访问

在项目目录打开 PowerShell：

```powershell
cd "C:\Users\Carpe diem\Documents\New project\hardtech_investment_agent"
python -m web_server_v1
```

浏览器访问：<http://127.0.0.1:4173/>

这是本机地址，只能在启动服务的电脑上访问。页面侧边栏对应以下功能：

| 页面 | 用途 |
| --- | --- |
| 总览 | 查看热点、Mapping、联系方式和联系人进度概览 |
| 二级热点 | 查看概念级热点、行业归属和 3 个参考标的 |
| 行业统计 | 按行业查看项目数、热点数和联系覆盖率 |
| 联系进度 | 按行业、联系状态和关键词筛选 BD 记录 |
| 赛道 Mapping | 搜索并展开已导入的一级/二级市场 Mapping |
| 导入中心 | 上传已完成的 Mapping Excel，并查看后台任务进度 |

## 2. 两种工作流

### 工作流 A：从热点开始

1. 在“二级热点”中查看概念和参考标的。
2. 进入“赛道 Mapping”，用概念关键词搜索已有研究。
3. 对尚未完成的主题准备一级市场和二级市场 Excel。
4. 在“导入中心”上传，后台任务会依次执行联系方式补充、BD 汇总、看板导出和数据库登记。
5. 在“联系进度”中按行业和状态筛选，持续更新联系方式与约见状态。

### 工作流 B：已有 Mapping 直接进入

已经完成的 Excel 不需要从热点重新开始，直接上传即可。导入成功后会在 Mapping 页面中显示，并同步到联系方式和联系进度统计。

## 3. Excel 导入要求

- 文件格式：`.xlsx`；可以一次选择多个文件。
- 第一行应为字段名，建议使用“公司名称”作为企业名称列。
- 推荐按 `一级市场`、`二级市场` 分 Sheet；如果只有一个 Sheet，也会保留原始字段。
- 一级市场建议包括：公司名称、公司简介、团队信息、一句话业务、融资轮次、融资时间、融资规模、联系方式。
- 二级市场建议包括：公司名称/标的、股票代码、行业/概念、主营业务、收入、毛利、净利润、市值等。
- 导入会保留原始文件名、Sheet 名和字段内容；同名记录由数据库注册层负责去重。

导入接口是异步的：网页提交后立即得到 `job_id`，前端轮询 `/api/import-jobs/{job_id}` 显示 queued、running、completed 或 failed 状态。大文件不要重复点击提交。

## 4. GLM 文本/表格处理接口

当前已配置 GLM，网页状态页会显示 API 地址、模型、环境变量和配置状态。服务端通过 `GLM_API_KEY` 读取密钥，不把密钥写入网页或日志。

可用接口：

```http
POST http://127.0.0.1:4173/api/llm/complete-json
Content-Type: application/json
```

请求示例：

```json
{
  "system_prompt": "你是投资研究数据整理助手，只返回合法 JSON。",
  "user_prompt": "请把下面表格按行业统计，并返回 {\"rows\":[{\"industry\":\"\",\"count\":0}]}：..."
}
```

返回格式为 `{"ok":true,"model":"glm-4.5","result":{...}}`。接口限制单次请求体 256 KB；较大的表格应先在程序中按行分块，再合并模型结果。这个接口适合字段归一化、公司简介摘要、行业标签、融资信息抽取和表格统计，不替代行情接口或公开信源核验。

## 5. 数据存储与备份

默认无需购买数据库服务，使用本地 SQLite：

```text
web/data/mapping.db
web/data/site_data.json
web/data/mapping_sources.json
```

备份当前免费存储：

```powershell
python scripts/backup_free_storage.py
```

备份目录为 `data/free_storage_backups/`。多人同时访问时，再配置 `MAPPING_DATABASE_URL` 切换到 PostgreSQL；本地单机使用 SQLite 更简单。

## 6. 数据源说明

AKShare 用于公开行情、财务摘要等市场数据；财经新闻和招聘/公司公开信息属于外部网络数据，可能受到反爬、频率限制、字段变更或来源暂时不可用影响。页面应保留“待采集/来源错误”，不要把缺失值当成零值。

## 7. 故障排查

- 页面打不开：确认终端仍在运行 `python -m web_server_v1`，然后刷新 <http://127.0.0.1:4173/>。
- 端口占用：结束旧的 Python 服务，或设置 `$env:MAPPING_PORT=4174` 后用新端口启动。
- GLM 未配置：在当前启动服务的终端设置 `$env:GLM_API_KEY="你的密钥"`，再重启服务。
- GLM 返回 502：检查密钥额度、网络和模型权限；看板本身的 Excel/SQLite 功能不依赖 GLM。
- Windows 出现 `CreateProcessWithLogonW 1385`：不要通过受限的子进程启动方式运行，直接在本机 PowerShell 或 Anaconda Prompt 执行上面的启动命令。

## 8. 当前验收结论

本地验收已覆盖：网页首页、静态数据、Mapping 来源、数据库状态、前端脚本语法、异步导入代码路径，以及一次真实 GLM JSON 请求。当前运行服务地址为 <http://127.0.0.1:4173/>。
