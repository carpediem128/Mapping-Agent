const state = {
  data: null,
  query: "",
  selectedSector: "",
  selectedTopic: "",
};

const el = (id) => document.getElementById(id);

async function boot() {
  try {
    const response = await fetch("./data/site_data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    state.data = await response.json();
  } catch (error) {
    try {
      state.data = await loadScriptData();
    } catch (fallbackError) {
      renderError(fallbackError.message ? fallbackError : error);
      return;
    }
  }
  render();
}

function loadScriptData() {
  return new Promise((resolve, reject) => {
    if (window.__MAPPING_SITE_DATA__) {
      resolve(window.__MAPPING_SITE_DATA__);
      return;
    }
    const script = document.createElement("script");
    script.src = "./data/site_data.js";
    script.onload = () => {
      if (window.__MAPPING_SITE_DATA__) resolve(window.__MAPPING_SITE_DATA__);
      else reject(new Error("site_data.js did not define dashboard data"));
    };
    script.onerror = () => reject(new Error("site_data.json and site_data.js both failed to load"));
    document.head.appendChild(script);
  });
}

function render() {
  const data = state.data;
  const stats = data.stats || {};
  el("run-id").textContent = "Run: " + (data.run_id || "-");
  el("generated-at").textContent = "Exported: " + (data.generated_at || "-");
  el("metric-hotspots").textContent = stats.hotspot_count ?? 0;
  el("metric-mappings").textContent = stats.mapping_count ?? 0;
  el("metric-topics").textContent = stats.topic_count ?? 0;
  el("metric-rows").textContent = stats.mapping_rows ?? 0;
  el("metric-contact-rate").textContent = (stats.contact_rate ?? 0) + "%";

  renderStages(data.manifest || {});
  renderOverview(data);
  renderHotspots(data.hotspots || {});
  renderIndustryStats(data.industry_stats || []);
  renderContacts(data.contacts || {});
  renderContactProgress(data.contact_progress || {});
  renderReports(data.reports || []);
  renderSidebarTopics(data.mappings || []);
  renderMappings(data.mappings || []);
  setupNavigation();
  setupImportForm();
  loadGlmStatus();

  const search = el("mapping-search");
  search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderMappings(data.mappings || []);
  });
}

function setupNavigation() {
  document.querySelectorAll(".side-nav a[data-view]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showView(link.dataset.view || "overview");
    });
  });
  const requested = window.location.hash.replace("#", "");
  showView(document.querySelector('.view-panel[data-view="' + requested + '"]') ? requested : "overview");
}

function showView(view) {
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.view === view);
  });
  document.querySelectorAll(".side-nav a[data-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  if (window.location.hash !== "#" + view) {
    history.replaceState(null, "", "#" + view);
  }
}

function renderOverview(data) {
  const top20 = data.hotspots?.top20 || [];
  const topics = (data.mappings || []).flatMap((mapping) => (mapping.topics || []).map((topic) => ({
    sector: mapping.sector,
    ...topic,
  })));
  el("overview-run-id").textContent = data.run_id || "-";
  el("overview-run-time").textContent = data.generated_at || "-";
  el("overview-status").textContent = data.hotspots?.data_status === "demo_pending_market_api" ? "演示数据" : "已产出";
  el("overview-hotspots").innerHTML = top20.slice(0, 3).map((item) =>
    '<button class="overview-link" type="button" data-sector="' + escapeHtml(item.name) + '">' +
    '<strong>' + escapeHtml(item.name) + '</strong><small>热度 ' + (item.score ?? "-") + '</small></button>'
  ).join("") || '<span class="muted">暂无热点</span>';
  el("overview-topics").innerHTML = topics.slice(0, 6).map((topic) =>
    '<button class="overview-link" type="button" data-sector="' + escapeHtml(topic.sector) + '" data-topic="' + escapeHtml(topic.name) + '">' +
    '<strong>' + escapeHtml(topic.name) + '</strong><small>' + escapeHtml(topic.sector) + '</small></button>'
  ).join("") || '<span class="muted">暂无主题</span>';

  document.querySelectorAll(".overview-link").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSector = button.dataset.sector || "";
      state.selectedTopic = button.dataset.topic || "";
      renderMappings(state.data.mappings || []);
      showView("mappings");
    });
  });
}

function setupImportForm() {
  const form = el("import-form");
  if (!form || form.dataset.ready === "1") return;
  form.dataset.ready = "1";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = el("mapping-files");
    const status = el("import-status");
    const resultBox = el("import-result");
    const progressBar = el("import-progress-bar");
    const button = form.querySelector("button[type='submit']");
    if (!input.files.length) {
      status.textContent = "请先选择至少一个 XLSX 文件。";
      return;
    }
    const body = new FormData();
    Array.from(input.files).forEach((file) => body.append("files", file, file.name));
    button.disabled = true;
    progressBar.style.width = "0%";
    status.textContent = "文件已上传，后台任务准备中。";
    try {
      const response = await fetch("./api/import-mappings", { method: "POST", body });
      const accepted = await response.json();
      if (!response.ok || !accepted.ok) throw new Error(accepted.error || "导入失败");
      resultBox.textContent = "任务编号：" + accepted.job_id;
      pollImportJob(accepted.job_id, button, status, resultBox, progressBar);
    } catch (error) {
      status.textContent = "导入失败：" + error.message;
      button.disabled = false;
    }
  });
}

async function pollImportJob(jobId, button, status, resultBox, progressBar) {
  try {
    const response = await fetch("./api/import-jobs/" + encodeURIComponent(jobId), { cache: "no-store" });
    const job = await response.json();
    if (!response.ok || !job.ok) throw new Error(job.error || "任务状态读取失败");
    const progress = job.progress || {};
    const total = Number(progress.total || 0);
    const current = Number(progress.current || 0);
    const percent = total ? Math.min(100, Math.round(current / total * 100)) : (job.status === "completed" ? 100 : 3);
    progressBar.style.width = percent + "%";
    if (job.status === "completed") {
      status.textContent = "导入完成，正在刷新看板。";
      resultBox.textContent = "Run: " + (job.result?.run_id || "-");
      window.setTimeout(() => window.location.reload(), 700);
      return;
    }
    if (job.status === "failed") {
      status.textContent = "后台任务失败：" + (job.error || job.message || "未知错误");
      button.disabled = false;
      return;
    }
    status.textContent = (job.message || "后台处理中") + (total ? `（${current}/${total}，${percent}%）` : "");
    window.setTimeout(() => pollImportJob(jobId, button, status, resultBox, progressBar), 1000);
  } catch (error) {
    status.textContent = "进度读取失败：" + error.message;
    button.disabled = false;
  }
}

async function loadGlmStatus() {
  try {
    const response = await fetch("./api/status", { cache: "no-store" });
    const result = await response.json();
    const glm = result.glm || {};
    el("glm-status").textContent = glm.configured ? "GLM：已配置" : "GLM：未配置";
    el("glm-base-url").textContent = glm.base_url || "-";
    el("glm-model").textContent = glm.model || "-";
    el("glm-api-env").textContent = glm.api_key_env || "GLM_API_KEY";
    el("glm-configured").textContent = glm.configured ? "已配置" : "未配置";
  } catch (error) {
    el("glm-status").textContent = "GLM：本地 API 未启动";
    el("glm-configured").textContent = "无法检查";
  }
}
function renderStages(manifest) {
  const stages = [
    ["hotspot", "二级热点识别"],
    ["mapping", "一级 Mapping"],
    ["contacts", "联系方式补齐"],
    ["bd_followup", "BD 总表"],
  ];
  el("stage-grid").innerHTML = stages.map(([key, title]) => {
    const item = manifest[key] || {};
    const status = item.status || "已产出";
    return `
      <article class="stage-card">
        <span>${escapeHtml(status)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(summarizeStage(key, item))}</p>
      </article>
    `;
  }).join("");
}

function summarizeStage(key, item) {
  if (!item || !Object.keys(item).length) return "本次运行未记录该环节。";
  if (key === "hotspot") return `结构化热点：${item.count ?? 0} 个；Top20/Top10 已自检`;
  if (key === "mapping") return `赛道文件：${item.sector_count ?? 0} 个`;
  if (key === "contacts") return `已更新文件：${Object.keys(item.updated_files || {}).length} 个`;
  if (key === "bd_followup") return `总表行数：${item.rows ?? 0}`;
  return "已完成";
}

function renderHotspots(hotspots) {
  const top20 = hotspots.top20 || [];
  const top10 = hotspots.top10 || top20.slice(0, 10);
  const statusText = hotspots.data_status === "demo_pending_market_api"
    ? "演示数据：行情字段待接入 API"
    : hotspots.data_status === "missing" ? "热点产出缺失" : "已接入行情数据";
  el("hotspot-status").textContent = statusText;
  el("market-summary").textContent = hotspots.market_summary || "暂无大盘概况。";
  const news = hotspots.news || [];
  el("market-news").innerHTML = news.map((item) => `<a class="news-item" href="${escapeHtml(item.url || "#")}" target="_blank" rel="noreferrer"><strong>${escapeHtml(item.title || "未命名新闻")}</strong><small>${escapeHtml(item.published_at || "")}${item.source ? " · " + escapeHtml(item.source) : ""}</small></a>`).join("") || `<div class="empty">当前新闻接口未返回可用内容，查看运行信源状态或使用公开媒体爬虫补充。</div>`;
  renderSecondaryMarket(hotspots.secondary_data || []);



  const maxScore = Math.max(...top20.map((item) => Number(item.score) || 0), 1);
  el("hotspot-bars").innerHTML = top20.slice(0, 8).map((item) => {
    const score = Number(item.score) || 0;
    return `
      <button class="rank-row rank-link" data-sector="${escapeHtml(item.name)}" type="button">
        <div class="rank-number">${item.rank}</div>
        <div class="rank-main">
          <div class="rank-label"><strong>${escapeHtml(item.name)}</strong><span>${score} 分</span></div>
          <div class="bar-track"><i style="width:${Math.round(score / maxScore * 100)}%"></i></div>
          <small>${escapeHtml(item.primary_industry || "硬科技")}</small>
        </div>
      </button>
    `;
  }).join("") || '<div class="empty">没有结构化热点结果，请先运行 Agent。</div>';

  document.querySelectorAll(".rank-link").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSector = button.dataset.sector || "";
      state.selectedTopic = "";
      renderMappings(state.data.mappings || []);
      showView("mappings");
    });
  });

  el("hotspot-details").innerHTML = top10.map((item) => `
    <article class="hotspot-detail">
      <div class="detail-head">
        <span class="rank-badge">#${item.rank}</span>
        <div><h3>${escapeHtml(item.name)}</h3><small>${escapeHtml(item.topic_type || "概念")} · ${escapeHtml(item.primary_industry || "硬科技")} · 热度 ${item.score ?? "-"} 分${item.topic_tags?.length ? " · " + escapeHtml(item.topic_tags.join("、")) : ""}</small></div>
      </div>
      <p><b>催化</b> ${escapeHtml(item.catalyst || "待补充")}</p>
      <p><b>标的</b></p>
      <div class="stock-list">${renderLeaders(item.leaders || [])}</div>
      <p><b>产业链</b> ${escapeHtml(item.chain_notes || "待补充")}</p>
    </article>
  `).join("") || '<div class="empty">暂无 Top10 详细展开。</div>';

  el("hotspot-table-body").innerHTML = top20.map((item) => `
    <tr>
      <td>${item.rank ?? "-"}</td>
      <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.primary_industry || "")}</small></td>
      <td>${escapeHtml(item.change_pct || "待采集")}</td>
      <td>${escapeHtml(item.limit_up_count || "待采集")}</td>
      <td>${escapeHtml(item.net_inflow_100m || "待采集")}</td>
      <td><span class="score">${item.score ?? "-"}</span></td>
      <td>${escapeHtml((item.leaders || []).slice(0, 2).map((x) => x.split("|")[0]).join("、") || "待补充")}</td>
    </tr>
  `).join("");
}

function formatMarketValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value == null || value === "" ? "-" : String(value);
  if (Math.abs(number) >= 1e8) return (number / 1e8).toFixed(2) + " 亿元";
  if (Math.abs(number) >= 1e4) return (number / 1e4).toFixed(2) + " 万元";
  return number.toFixed(2);
}
function renderSecondaryMarket(items) {
  el("secondary-market-body").innerHTML = items.map((item) => {
    const quote = item.quote || {};
    const financial = (item.financial_indicators || [])[0] || {};
    const business = (item.business_composition || [])[0] || {};
    const price = quote["最新价"] ?? "-";
    const capKey = quote["总市值"] !== undefined ? "总市值" : quote["总市值(元)"] !== undefined ? "总市值(元)" : quote["流通市值(估算)"] !== undefined ? "流通市值(估算)" : "流通市值";
    const cap = quote[capKey] ?? "-";
    const pe = quote["市盈率-动态"] ?? quote["市盈率"] ?? "-";
    const pb = quote["市净率"] ?? "-";
    const financeText = [
      financial["营业收入"], financial["净利润"], financial["毛利率"],
      business["主营构成"], business["收入比例"], business["毛利率"],
    ].filter((value) => value !== undefined && value !== null && String(value).trim()).slice(0, 3).join(" / ") || (item.data_status === "quote" ? "实时行情已接入；财务接口待返回" : "待接口返回");
    const relatedTopics = item.hotspots?.length ? item.hotspots.join("、") : (item.hotspot || "-");
    const capText = capKey.includes("估算") ? formatMarketValue(cap) + "（流通估算）" : formatMarketValue(cap);
    return `<tr><td><strong>${escapeHtml(item.name || item.code || "-")}</strong><small>${escapeHtml(item.code || "")}</small></td><td>${escapeHtml(relatedTopics)}</td><td>${escapeHtml(String(price))}</td><td>${escapeHtml(capText)}</td><td>${escapeHtml(String(pe))} / ${escapeHtml(String(pb))}</td><td>${escapeHtml(financeText)}</td></tr>`;
  }).join("") || '<tr><td colspan="6"><div class="empty">暂无可用标的资料；行情接口失败时会保留来源错误。</div></td></tr>';
}
function renderLeaders(leaders) {
  if (!leaders.length) return '<span class="muted">待行情源补充</span>';
  return leaders.map((leader) => {
    const parts = String(leader).split("|");
    return `<span class="stock-chip"><b>${escapeHtml(parts[0])}</b><small>${escapeHtml(parts[1] || "参考标的")}</small></span>`;
  }).join("");
}

function renderIndustryStats(items) {
  const maxRows = Math.max(...items.map((item) => Number(item.mapping_rows) || 0), 1);
  el("industry-bars").innerHTML = items.map((item) => `
    <div class="industry-row">
      <div class="industry-label"><strong>${escapeHtml(item.industry)}</strong><span>${item.mapping_rows ?? 0} 项目</span></div>
      <div class="bar-track"><i style="width:${Math.round((item.mapping_rows || 0) / maxRows * 100)}%"></i></div>
      <small>热点 ${item.hotspots ?? 0} · 平均热度 ${item.avg_score ?? 0} · 联系覆盖 ${item.contact_rate ?? 0}%</small>
    </div>
  `).join("") || '<div class="empty">暂无行业统计。</div>';
  el("industry-table-body").innerHTML = items.map((item) => `
    <tr><td>${escapeHtml(item.industry)}</td><td>${item.hotspots ?? 0}</td><td>${item.mapping_rows ?? 0}</td><td>${item.contact_count ?? 0}</td><td>${item.contact_rate ?? 0}%</td></tr>
  `).join("");
}

function renderContacts(contacts) {
  el("contact-source").textContent = contacts.source ? "来源：" + contacts.source : "未找到 BD 总表";
  el("contact-rows").textContent = contacts.rows ?? 0;
  el("contact-found").textContent = contacts.with_contact ?? 0;
  el("contact-rate").textContent = (contacts.contact_rate ?? 0) + "%";
  el("contacted-count").textContent = contacts.contacted ?? 0;
  el("meeting-count").textContent = contacts.meetings ?? 0;
  el("contact-sector-body").innerHTML = (contacts.sector_breakdown || []).map((item) => `
    <tr><td>${escapeHtml(item.sector)}</td><td>${item.rows}</td><td>${item.with_contact}</td><td>${item.rate}%</td></tr>
  `).join("") || '<tr><td colspan="4" class="muted">暂无总表记录</td></tr>';
  el("contact-preview-body").innerHTML = (contacts.preview || []).map((item) => `
    <tr><td>${escapeHtml(item.sector)}</td><td>${escapeHtml(item.company)}</td><td>${escapeHtml(item.contact || "未找到")}</td><td>${escapeHtml(item.reached || "否")}</td></tr>
  `).join("") || '<tr><td colspan="4" class="muted">暂无联系记录</td></tr>';
}

function renderContactProgress(payload) {
  const rows = payload.rows || [];
  const stats = payload.stats || {};
  const industrySelect = el("contact-industry-filter");
  const progressSelect = el("contact-progress-filter");
  const searchInput = el("contact-progress-search");
  const body = el("contact-progress-body");
  const industryValues = [...new Set(rows.map((row) => row.industry || "待识别"))].sort();
  const progressValues = [...new Set(rows.map((row) => row.progress || "未填写"))].sort();
  industrySelect.innerHTML = '<option value="">全部行业</option>' + industryValues.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join("");
  progressSelect.innerHTML = '<option value="">全部状态</option>' + progressValues.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join("");

  const render = () => {
    const industry = industrySelect.value;
    const progress = progressSelect.value;
    const query = searchInput.value.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const rowIndustry = row.industry || "待识别";
      const rowProgress = row.progress || "未填写";
      const blob = [rowIndustry, row.company, rowProgress, row.meeting, row.companyType, row.intro, row.team, row.round, row.oneLiner, row.landline, row.mobile, row.email, row.person, row.source].join(" ").toLowerCase();
      return (!industry || rowIndustry === industry) && (!progress || rowProgress === progress) && (!query || blob.includes(query));
    });
    el("contact-progress-count").textContent = filtered.length + " 家";
    body.innerHTML = filtered.map((row) => {
      const link = row.url ? '<a class="source-link" href="' + escapeHtml(row.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(row.url) + '</a>' : "-";
      return '<tr><td>' + escapeHtml(row.industry || "待识别") + '</td><td><strong>' + escapeHtml(row.company || "-") + '</strong></td><td><span class="progress-pill">' + escapeHtml(row.progress || "未填写") + '</span></td><td>' + escapeHtml(row.meeting || "否") + '</td><td>' + escapeHtml(row.companyType || "-") + '</td><td>' + escapeHtml(row.intro || "-") + '</td><td>' + escapeHtml(row.team || "-") + '</td><td>' + escapeHtml(row.round || "-") + '</td><td>' + escapeHtml(row.oneLiner || "-") + '</td><td>' + escapeHtml(row.landline || "-") + '</td><td>' + escapeHtml(row.mobile || "-") + '</td><td>' + escapeHtml(row.email || "-") + '</td><td>' + escapeHtml(row.person || "-") + '</td><td>' + escapeHtml(row.source || "-") + '</td><td>' + escapeHtml(row.sourceDate || "-") + '</td><td>' + link + '</td></tr>';
    }).join("") || '<tr><td colspan="16" class="muted">没有匹配的联系进度记录。</td></tr>';
  };
  industrySelect.onchange = render;
  progressSelect.onchange = render;
  searchInput.oninput = render;
  el("contact-rows").textContent = stats.total ?? rows.length;
  el("contact-found").textContent = stats.withContact ?? rows.filter((row) => row.hasContact).length;
  el("contact-rate").textContent = (stats.contactRate ?? 0) + "%";
  el("contacted-count").textContent = stats.contacted ?? rows.filter((row) => row.progress && row.progress !== "未填写").length;
  el("meeting-count").textContent = stats.meetings ?? rows.filter((row) => row.meeting === "是").length;
  el("contact-source").textContent = "来源：招聘联系信息汇总_20260630_v1.xlsx；Mapping 仅用于补充研究字段";
  const industryRows = Object.entries(stats.industries || {});
  el("contact-sector-body").innerHTML = industryRows.map(([name, item]) => '<tr><td>' + escapeHtml(name) + '</td><td>' + (item.total ?? 0) + '</td><td>' + (item.withContact ?? 0) + '</td><td>' + (item.total ? Math.round((item.withContact || 0) / item.total * 100) : 0) + '%</td></tr>').join("") || '<tr><td colspan="4" class="muted">暂无联系记录</td></tr>';
  el("contact-preview-body").innerHTML = rows.slice(0, 10).map((row) => {
    const contact = [row.landline, row.mobile, row.email].filter(Boolean).join(" / ") || "未找到";
    return '<tr><td>' + escapeHtml(row.industry || "待识别") + '</td><td>' + escapeHtml(row.company || "-") + '</td><td>' + escapeHtml(contact) + '</td><td>' + escapeHtml(row.progress || "未填写") + '</td></tr>';
  }).join("") || '<tr><td colspan="4" class="muted">暂无联系记录</td></tr>';  render();
}
function renderReports(reports) {
  const visible = reports.filter((file) => file.type === "xlsx" || file.type === "json");
  const box = el("report-list");
  box.innerHTML = visible.length ? visible.map((file) => `
    <div class="file-row"><div><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.type || "file")}</small></div><a href="./${encodeURI(file.url)}" download>下载</a></div>
  `).join("") : '<div class="empty">暂无可下载的 Excel 产出。</div>';
}

function renderSidebarTopics(mappings) {
  if (!el("sidebar-topic-count") || !el("sidebar-topic-list")) return;
  const topics = [];
  mappings.forEach((mapping) => {
    (mapping.topics || []).forEach((topic) => {
      topics.push({ sector: mapping.sector, ...topic });
    });
  });
  el("sidebar-topic-count").textContent = topics.length;
  el("sidebar-topic-list").innerHTML = topics.map((topic) => `
    <button class="sidebar-topic" type="button" data-sector="${escapeHtml(topic.sector)}" data-topic="${escapeHtml(topic.name)}">
      <span>${escapeHtml(topic.name)}</span><small>${topic.row_count ?? 0}</small>
    </button>
  `).join("") || '<span class="muted">暂无主题</span>';

  document.querySelectorAll(".sidebar-topic").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSector = button.dataset.sector || "";
      state.selectedTopic = button.dataset.topic || "";
      renderMappings(state.data.mappings || []);
      showView("mappings");
    });
  });
}

function filteredMappings(mappings) {
  if (!state.query) return mappings;
  return mappings.filter((item) => {
    const topicText = (item.topics || []).flatMap((topic) => [topic.name, ...(topic.aliases || []), topic.summary || ""]);
    const previewText = (item.preview || []).flatMap((row) => Object.values(row));
    return [item.name, item.sector, ...topicText, ...previewText].join(" ").toLowerCase().includes(state.query);
  });
}

function renderMappings(mappings) {
  const filtered = filteredMappings(mappings);
  const sectorBox = el("mapping-sector-list");
  if (!filtered.length) {
    sectorBox.innerHTML = '<div class="empty">没有匹配的赛道或主题。</div>';
    el("topic-tags").innerHTML = "";
    el("topic-detail").innerHTML = '<div class="empty">请调整搜索条件。</div>';
    el("topic-breadcrumb").textContent = "暂无匹配";
    el("topic-download").removeAttribute("href");
    return;
  }

  if (!filtered.some((item) => item.sector === state.selectedSector)) {
    state.selectedSector = filtered.find((item) => item.sector === "先进封装")?.sector || filtered[0].sector;
    state.selectedTopic = "";
  }
  const selected = filtered.find((item) => item.sector === state.selectedSector) || filtered[0];
  state.selectedSector = selected.sector;
  const topic = (selected.topics || []).find((item) => item.name === state.selectedTopic) || selected.topics?.[0] || null;
  state.selectedTopic = topic?.name || "";

  sectorBox.innerHTML = filtered.map((item) => `
    <button class="mapping-sector-card ${item.sector === selected.sector ? "active" : ""}" type="button" data-sector="${escapeHtml(item.sector)}">
      <span><strong>${escapeHtml(item.sector)}</strong><small>${escapeHtml(item.name)}</small></span>
      <b>${item.row_count ?? 0}</b>
    </button>
  `).join("");
  document.querySelectorAll(".mapping-sector-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSector = button.dataset.sector || "";
      state.selectedTopic = "";
      renderMappings(mappings);
    });
  });

  el("topic-breadcrumb").textContent = selected.sector + " / " + (topic?.name || "暂无细分主题");
  el("topic-download").href = "./" + encodeURI(selected.url);
  el("topic-tags").innerHTML = (selected.topics || []).map((item) => `
    <button class="topic-tag ${item.name === state.selectedTopic ? "active" : ""}" type="button" data-topic="${escapeHtml(item.name)}">
      ${escapeHtml(item.name)}<small>${item.row_count ?? 0} 项目</small>
    </button>
  `).join("") || '<span class="muted">该赛道暂未配置细分主题。</span>';
  document.querySelectorAll(".topic-tag").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTopic = button.dataset.topic || "";
      renderMappings(mappings);
    });
  });

  renderTopicDetail(selected, topic);
}

function renderTopicDetail(mapping, topic) {
  if (!topic) {
    el("topic-detail").innerHTML = `
      <div class="topic-empty"><strong>${escapeHtml(mapping.sector)}</strong><p>该赛道暂无可用主题标签，请直接查看赛道 Excel。</p></div>
    `;
    return;
  }
  const aliases = topic.aliases?.length ? topic.aliases.join("、") : "未配置";
  el("topic-detail").innerHTML = `
    <div class="topic-detail-head"><div><div class="topic-overline">SELECTED TOPIC</div><h3>${escapeHtml(topic.name)}</h3><p>${escapeHtml(topic.summary || "暂无主题说明。")}</p></div><strong class="topic-count">${topic.row_count ?? 0}<small>匹配项目</small></strong></div>
    <div class="topic-meta"><span>关键词：${escapeHtml(aliases)}</span><span>联系方式：${mapping.contact_count ?? 0} / ${mapping.row_count ?? 0}</span><span>二级市场参照：${mapping.secondary_count ?? 0} 家</span></div>
    <div class="topic-preview-title">项目预览</div>
    ${renderTopicPreview(topic.preview || [])}
  `;
}

function renderTopicPreview(rows) {
  if (!rows.length) return '<div class="topic-empty">当前运行中暂无命中项目；上传或导入企名片数据后，这里会按主题关键词显示公司详情。</div>';
  return `<div class="table-wrap"><table><thead><tr><th>公司</th><th>地区</th><th>业务 / 技术</th><th>融资</th><th>联系方式</th></tr></thead><tbody>${rows.map((row) => `
    <tr><td><strong>${escapeHtml(row.company || "-")}</strong><small>${escapeHtml(row.founded_at || "")}</small></td><td>${escapeHtml(row.region || "-")}</td><td>${escapeHtml([row.business, row.product].filter(Boolean).join(" / ") || "-")}</td><td>${escapeHtml([row.round, row.amount].filter(Boolean).join(" / ") || "-")}</td><td>${escapeHtml(row.contact || "未找到")}</td></tr>
  `).join("")}</tbody></table></div>`;
}

function renderError(error) {
  document.body.innerHTML = `<main class="shell"><section class="panel"><h1>网站数据没有加载成功</h1><p class="empty">错误：${escapeHtml(error.message)}</p><p>推荐地址：<code>http://127.0.0.1:4173/</code></p></section></main>`;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

boot();











