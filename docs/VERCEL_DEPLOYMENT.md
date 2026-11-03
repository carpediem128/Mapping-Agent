# Vercel 团队版部署

## 当前状态

本次准备了配置和隔离入口，尚未在云端部署。Vercel CLI 65.10.0 的账号检查结果为 Logged out；用户当前尚无后端服务器。没有创建收费资源，没有上传联系人、Excel、API Key 或本地数据库。完成代码测试不等于完成云端验收。

## 架构

```text
同事浏览器 → HTTPS *.vercel.app → Vercel 登录网关
                                      ↓ 服务端令牌 + HTTPS
                              Python 后端（单实例常驻）
                                      ↓
                         持久磁盘：SQLite / JSON / XLSX / 研究任务
                                      ↓
                              GLM / 搜索 / AKShare
```

Vercel 项目 Root Directory 设置为 `deploy/vercel`，仅上传网关代码，不部署 `web/data` 为公共静态文件。网关保护所有页面、JSON、文件下载及写接口；同事使用各自账号密码通过浏览器登录提示进入。当前所有同事具有相同读写权限，没有管理员/只读角色或完整用户审计，后续可接入公司 SSO。撤销账号需从 Vercel 环境变量移除该账号并重新部署。

后端源站只接受网关令牌。单独访问源站会被拒绝，`/healthz` 只返回健康标志；数据库文件和目录索引禁止下载。API Key 仅放在后端环境变量，Vercel 仅保存网关令牌及同事账号，不向浏览器传递这些配置。

Vercel 的容器运行时和 Daemons 已有官方支持，但不能因此把本地 SQLite、JSON 和后台线程直接视为持久存储或可靠队列。本版保留现有 Python 服务，使用独立带持久磁盘的后端以减小迁移范围；Vercel 作为统一访问入口。没有用临时隧道替代长期托管。

## 1. 后端资源与数据

准备一台可运行 Docker Compose 的 Linux 云服务器，以及可用的 HTTPS 后端地址。服务器费用由供应商决定，开通前确认预算。Compose 默认只绑定服务器的 `127.0.0.1:4173`，由 HTTPS 反向代理转发到该端口；不要直接向公网开放4173。可以使用已有域名的子域名，或托管商提供的 HTTPS 域名。

将仓库拉到服务器。创建下列目录并在维护窗口迁移本地数据，迁移前备份；SQLite 必须使用备份 API 或停止写入后复制，不能在写入时只复制主 `.db` 文件。使用 SSH/SFTP 等受控渠道传输，不上传到 GitHub。

| 服务器目录 | 迁移来源 | 内容 |
| --- | --- | --- |
| `deploy/state/data/` | 本地 `web/data/` | Mapping 数据库、联系确认库、前端 JSON/JS 快照 |
| `deploy/state/artifacts/` | 本地 `web/artifacts/` | 原始导入文件及发布文件 |
| `deploy/state/runs/` | 本地 `runs/` | 研究状态、证据及生成的 Excel |

空目录不会自动获得本机数据。必须确认 `site_data.json`、`site_data.js`、`mapping_sources.json` 等已迁移，才能认为看板已恢复。上传数据不会打入容器镜像，镜像也不包含本机配置和密钥。

在服务器上将 `deploy/backend.env.example` 复制为 `deploy/.env.production`，填写：

- `MAPPING_BACKEND_TOKEN`：至少32字符的随机秘密，与 Vercel 配置一致。
- `GLM_API_KEY`：有效的服务端 GLM Key，建议新建项目专用 Key，设置额度告警。
- `PORT=4173`：容器内部端口。

模型名称与模型服务地址沿用 `config/default_config.json` 的 `llm` 配置，部署前核对实际模型支持情况。配置中本机 Windows 路径不能在 Linux 上使用，外部联系爬虫需部署对应模块或使用项目内来源适配器。

在仓库根目录运行：

```sh
docker compose -f deploy/compose.yaml up -d --build
docker compose -f deploy/compose.yaml logs --tail=100 backend
curl http://127.0.0.1:4173/healthz
```

确认 HTTPS 反向代理工作，并检查没有令牌的源站请求返回401。持久化目录需定期备份；不要使用 `docker compose down -v` 清理业务数据。

## 2. Vercel 账号与项目

同事用于公司业务需按 Vercel 商业使用条款选择计划，不能假定 Hobby 免费版覆盖此场景。当前配置没有自动开通或购买任何套餐。

1. 登录 Vercel，连接 `carpediem128/Mapping-Agent` 仓库，选择正确团队。
2. 新建项目，Root Directory 设为 `deploy/vercel`，Framework 选 Other，不设置静态 Output Directory，不把 `web/` 设置为部署根目录。
3. 在 Project → Settings → Environment Variables 添加 `deploy/vercel/env.example` 中的三个变量，填真实值，不使用示例占位符。
4. `MAPPING_BACKEND_ORIGIN` 必须是 HTTPS 源站根地址，不包含用户名、密码、路径或查询参数。
5. `MAPPING_USERS_JSON` 是账号到密码的 JSON 对象，每位同事使用独立长密码，不与个人密码复用。用安全渠道分发，不提交仓库。
6. Production 环境指向正式后端；不要让 Preview 环境自动复用正式数据和 Key。要测试预览部署，使用独立测试后端和账号。
7. 部署后使用 Vercel 显示的 Production 域名，不能根据项目名猜测网址。Git commit/branch 的预览 URL 不等于稳定的正式入口。

也可以在授权后从仓库根目录执行：

```sh
npx vercel login
npx vercel link --cwd deploy/vercel
npx vercel env add MAPPING_BACKEND_ORIGIN production --cwd deploy/vercel
npx vercel env add MAPPING_BACKEND_TOKEN production --cwd deploy/vercel
npx vercel env add MAPPING_USERS_JSON production --cwd deploy/vercel
npx vercel --prod --cwd deploy/vercel
```

密钥通过 CLI 的交互输入或 Vercel 控制台填写，不放在命令参数、聊天记录或源码中。`.vercel/` 和真实环境文件已忽略。

## 3. 限制与上线验收

网关采用 Vercel Node Function，每次上传整个 multipart 请求限4 MiB，每次响应也限4 MiB，超限明确返回错误，不会静默截断；大文件需要后续改成对象存储直传和签名下载。单个请求代理超时50秒；研究请求应快速返回任务编号，长研究在独立后端继续执行，浏览器轮询状态。

当前后台线程不是可靠任务队列：重启期间的任务可能中断，导入队列仍有内存状态；上线操作安排维护窗口，不在有研究任务时重启。SQLite WAL 可支持小团队的联系写入，但现有跨 JSON 发布和多导入并发并非统一事务。暂时单实例运行，同一时间只安排一个导入/发布流程；不能启动多个后端副本共享这些文件。正式大规模使用需持久队列、统一数据库与对象存储，不应声称本配置已完成这些迁移。

上线后逐项验收，任一失败都不算部署完成：

- 未登录不可读取页面、联系人 JSON、Excel 或研究接口；错误密码被拒绝。
- 账号登录后能访问所有模块，两个不同浏览器看到同一业务数据。
- 上传小于4 MiB的真实测试 Excel，等待后台完成，查看对应主题和下载文件。
- 使用新主题发起真实 GLM 研究，检查来源证据、核验分组和导出结果。此测试消耗 API 额度。
- A账号勾选联系，B账号刷新后看到同步结果；重启后端后仍保留。
- 导出文件可下载、打开，原始数据不被测试覆盖。
- 原始后端无令牌无法访问，API Key、网关令牌不出现在前端响应和日志。
- 备份恢复测试通过，并配置费用告警和请求/研究任务限额。

## 配置验证

```sh
node --test deploy/vercel/gateway.test.cjs
python -m unittest scripts.test_production_server
```

这些是本地隔离和转发测试，不替代云端上传、真实模型调用、重启持久性和多用户验收。

参考：[Vercel Functions 限制](https://vercel.com/docs/functions/limitations)、[Git 生成的网址](https://vercel.com/docs/deployments/generated-urls)、[Container Runtime](https://vercel.com/kb/guide/docker)、[Daemons](https://vercel.com/docs/daemons)。
