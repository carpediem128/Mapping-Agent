# 市场数据刷新

项目内的 AKShare 刷新脚本需要从项目根目录加载 `agent` 包。推荐这样执行：

```powershell
cd "C:\Users\Carpe diem\Documents\New project\hardtech_investment_agent"
$env:PYTHONPATH=(Get-Location).Path
python scripts\refresh_market_data_enhanced.py
```

脚本会尝试更新：

- 概念板块行情和热点排名；
- 每个概念最多 3 个领涨标的；
- A 股报价、历史行情和估算市值；
- 公司简介、财务指标、资产负债表、利润表、现金流量表和主营构成；
- 财经新闻及降级信源。

刷新结果写入 `web/data/site_data.json` 和 `web/data/site_data.js`，网页刷新后生效。当前验收结果为 AKShare 成功返回热点数据，匹配 13 个概念，8 家二级公司完成财务摘要补充；部分概念成分股接口因远端断开而保留已有标的或错误信息，这是公开数据源的可见降级状态，不会阻断看板。

刷新后检查：

```powershell
Invoke-WebRequest http://127.0.0.1:4173/api/status
```

其中 `market_data.installed`、`market_data.enabled` 只表示依赖和配置状态；实际运行结果以页面二级热点中的更新时间、来源状态和错误信息为准。
