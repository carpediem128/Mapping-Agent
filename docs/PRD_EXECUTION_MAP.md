# PRD 到代码模块映射

## 环节一：当日二级市场热点板块识别

- 代码：`agent/stages/hotspot.py`
- 输出：`YYYYMMDD-二级市场热点列表.md`
- 关键约束：
  - 只保留硬科技赛道。
  - 输出 Top20，其中 Top10 详细展开。
  - 自检结果写入 `run_manifest.json`。

## 环节二：分赛道一级市场项目 Mapping

- 代码：`agent/stages/mapping.py`
- 输入：
  - 环节一热点赛道列表。
  - 用户提供的企名片 Excel。
  - 后续可接入公开搜索/IT桔子/创业邦等数据源。
- 输出：`YYMMDD_赛道名称_Mapping.xlsx`
- 列名严格来自 `config/default_config.json` 的 `mapping_columns`。

## 环节三：联系方式获取

- 代码：`agent/stages/contacts.py`
- 默认外部参考爬虫：`C:/Users/Carpe diem/AIcode/0709mapping/contact_crawler_sources.py`
- 目标格式：`电话：xxx；官网：xxx；邮箱：xxx`
- 原则：
  - 官网、邮箱、电话保留。
  - 地址、私人微信、QQ 不写入 PRD 的联系方式列。
  - 找不到就留空。

## 环节四：总表汇总与 BD 跟进表

- 代码：`agent/stages/bd_followup.py`
- 输出：`YYYYMMDD-硬科技项目总表-BD跟进.xlsx`
- 去重字段：公司名称。
- 初始跟进状态：`是否联系上=否`，`是否已约见=否`。

