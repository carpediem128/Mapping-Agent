# PostgreSQL 多人访问配置

## 1. 创建数据库

在 Supabase、Neon 或公司 PostgreSQL 中创建一个空数据库，复制标准连接串：

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

连接串只放在本机环境变量或部署平台 Secret 中，不要写入网页、Excel、Git 或截图。

## 2. 安装 PostgreSQL 驱动

```powershell
python -m pip install -r hardtech_investment_agent\requirements-postgres.txt
```

## 3. 迁移现有 Mapping

在项目根目录执行：

```powershell
$env:MAPPING_DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
python hardtech_investment_agent\scripts\migrate_sqlite_to_postgres.py
```

迁移脚本会创建 `mapping_workbooks` 和 `mapping_records`，并把当前 SQLite 中的 Mapping 工作簿、一级/二级市场记录和原始字段写入 PostgreSQL。

## 4. 启动多人访问版

```powershell
$env:MAPPING_DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
python -m web_server_multi_db
```

如果没有设置连接串，服务自动使用本地 `web/data/mapping.db`；设置连接串后，服务优先使用 PostgreSQL。

## 5. 部署规则

Vercel 负责网页/API，`MAPPING_DATABASE_URL` 配置在 Vercel Project Settings → Environment Variables。数据库连接串不进入前端 JSON，也不会返回给浏览器；状态接口只返回数据库类型、记录数和错误摘要。

多人访问时，所有同事使用同一个部署 URL；上传 Mapping 后由后台任务写入 PostgreSQL，完成状态为 `mapping_completed`，可继续进入联系方式和 BD 跟进。
