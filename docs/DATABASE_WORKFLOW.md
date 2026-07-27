# Mapping 看板数据库与工作流

## 当前设计

本地版本使用 SQLite，数据库文件为 `web/data/mapping.db`。它保存三类信息：

- `mapping_workbooks`：上传的 Mapping 文件、来源、更新时间和工作流状态。
- `mapping_records`：每个工作表的每家公司、市场层级、主题、原始字段和搜索文本。
- `workflow_status`：已完成 Mapping 使用 `mapping_completed`，之后可进入联系方式阶段。

当前已登记：2 个工作簿、4 个工作表、111 条记录，其中一级市场 45 条、二级市场 66 条。

## 两条工作流

### 新建研究

二级热点 → 选择热点/细分主题 → 生成或补充一级市场 Mapping → 联系方式采集 → BD 联系进度。

### 已有研究

上传已完成 Mapping Excel → 识别一级市场与二级市场工作表 → 写入数据库 → 在 Mapping 看板展示 → 直接进入联系方式和 BD 跟进。

上传的 Mapping 不会被覆盖；每个工作簿按来源文件和工作表保留原始字段。联系方式、融资轮次、团队、官网等字段只做索引，不改写原始值。

## 初始化/刷新本地数据库

先用 Excel 导入脚本生成 `web/data/mapping_sources.json`，再执行：

```powershell
python hardtech_investment_agent/scripts/register_mapping_database_fixed.py
```

随后重新生成网站数据并刷新浏览器：

```powershell
python hardtech_investment_agent/scripts/refresh_market_data_enhanced.py
```

如果行情接口返回 `NaN`，先执行：

```powershell
node hardtech_investment_agent/scripts/repair_site_data_nan.mjs
```

## 团队协作部署建议

SQLite 适合本机或单机内网使用。若同事需要同时访问，Vercel 只负责网页和 API 托管，数据库应使用云端 PostgreSQL；迁移时保留上述表结构即可。上传的原始 Excel 建议放在对象存储，数据库只保存文件地址、版本和结构化索引。

## 数据状态约定

- `mapping_completed`：Mapping 已完成，可进入联系方式阶段。
- `contact_pending`：Mapping 已入库，等待联系方式补充。
- `contact_in_progress`：已有联系方式或联系状态，进入 BD 跟进。
- `archived`：历史版本，不参与默认看板统计。
