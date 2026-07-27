# 不订阅的存储方案

## 推荐顺序

### 方案 A：本机 SQLite + JSON 快照

适合当前项目，完全免费，不需要任何账户或订阅。SQLite 保存可查询数据，JSON 保存可移植快照；看板服务运行在办公室一台电脑上，同事通过内网地址访问。

```powershell
python hardtech_investment_agent\scripts\backup_free_storage.py
```

备份位置：`data/free_storage_backups/`。备份文件需要按公司权限保存，不建议直接放到公开 GitHub 仓库。

### 方案 B：Supabase Free

适合需要公网多人访问、并且希望继续使用 PostgreSQL 的情况。当前 Free 计划是 $0，提供 500 MB 数据库空间和 2 个活跃项目，但项目闲置后会暂停，且没有自动备份承诺。

### 方案 C：Cloudflare D1 Free

适合把网站部署到 Cloudflare Workers/Pages 的情况。D1 使用 SQLite 语义，Free 额度包含每天 500 万行读取、每天 10 万行写入和 5 GB 存储；超过日额度时请求会失败，数据不会自动产生付费账单。

## 选择结论

- 只需要同事查看：静态 JSON + Vercel/GitHub Pages 即可，但不要放联系方式等敏感数据到公开仓库。
- 需要办公室多人使用并上传：本机 SQLite + 看板服务，零订阅；必须让主机持续运行。
- 需要公网多人上传：Supabase Free 更容易接入当前 PostgreSQL 适配层；D1 免费额度更宽，但需要改成 Cloudflare Worker API。

当前代码默认使用 SQLite；只有设置 `MAPPING_DATABASE_URL` 后才切换 PostgreSQL。没有连接串时不会产生任何云端费用。
