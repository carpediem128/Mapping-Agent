(() => {
  'use strict';
  const host = document.querySelector('.main-column');
  if (!host || document.getElementById('research-desk')) return;
  const sidebar = document.querySelector('.sidebar');
  const navigation = sidebar?.querySelector('.side-nav');
  if (navigation) {
    navigation.id = 'workspace-navigation';
    const menu = document.createElement('button');
    menu.className = 'workspace-menu'; menu.type = 'button'; menu.textContent = '导航';
    menu.setAttribute('aria-controls', navigation.id); menu.setAttribute('aria-expanded', 'false');
    menu.onclick = () => menu.setAttribute('aria-expanded', String(sidebar.classList.toggle('mobile-open')));
    navigation.before(menu);
    window.addEventListener('hashchange', () => {
      sidebar.classList.remove('mobile-open');menu.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('click', e => {
      if (e.target.closest('.side-nav a')) {
        document.querySelector('.sidebar')?.classList.remove('mobile-open');
        document.querySelector('.workspace-menu')?.setAttribute('aria-expanded', 'false');
      }
    }, true);
  }
  const desk = document.createElement('aside');
  desk.id = 'research-desk';
  desk.setAttribute('aria-label', '主题研究工作台');
  desk.innerHTML = `<div class="research-controls"><strong>主题研究</strong><form id="research-form"><input id="research-topic" maxlength="60" aria-label="研究主题" placeholder="输入主题，或拖入二级热点" required><button type="submit">开始研究</button></form><button id="research-toggle" type="button" aria-expanded="false">任务记录</button><span id="research-live" role="status"></span></div><div id="research-jobs" hidden></div>`;
  host.prepend(desk);
  const input = desk.querySelector('input');
  const jobs = desk.querySelector('#research-jobs');
  const status = desk.querySelector('#research-live');
  const toggle = desk.querySelector('#research-toggle');
  input.value = localStorage.getItem('research-topic') || '';
  input.addEventListener('input', () => localStorage.setItem('research-topic', input.value));
  const text = (tag, value) => { const el = document.createElement(tag); el.textContent = value || ''; return el; };
  async function api(url, payload) {
    const response = await fetch(url, payload === undefined ? {cache: 'no-store'} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '请求失败');
    return data;
  }
  toggle.onclick = () => { jobs.hidden = !jobs.hidden; toggle.setAttribute('aria-expanded', String(!jobs.hidden)); };
  desk.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const button = e.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      await api('/api/research', {topic: input.value.trim()});
      localStorage.setItem('research-topic', input.value.trim());
      jobs.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      await refresh();
    } catch (err) { status.textContent = err.message; }
    finally { button.disabled = false; }
  };
  function topicFor(el) {
    const card = el.closest('[data-sector], #hotspot-table-body tr, .hotspot-detail');
    return card && (card.dataset.sector || card.querySelector('td:nth-child(2) strong, h3')?.textContent?.trim());
  }
  function markDraggable() {
    document.querySelectorAll('[data-sector], #hotspot-table-body tr, .hotspot-detail').forEach(el => { if (!el.draggable) el.draggable = true; });
    document.querySelectorAll('td').forEach(cell => {
      cell.classList.toggle('numeric-cell', /^[+−-]?\d[\d,.]*(?:%|亿|万|元|家|个)?$/.test(cell.textContent.trim()));
    });
  }
  document.addEventListener('dragstart', e => {
    const topic = topicFor(e.target);
    if (topic) { e.dataTransfer.setData('text/plain', topic); e.dataTransfer.effectAllowed = 'copy'; }
  });
  desk.addEventListener('dragover', e => { e.preventDefault(); desk.classList.add('drop-active'); });
  desk.addEventListener('dragleave', () => desk.classList.remove('drop-active'));
  desk.addEventListener('drop', e => {
    e.preventDefault(); desk.classList.remove('drop-active');
    input.value = e.dataTransfer.getData('text/plain').trim().slice(0, 60);
    localStorage.setItem('research-topic', input.value); input.focus();
  });
  let last = '';
  async function refresh() {
    try {
      const data = await api('/api/research');
      const running = data.jobs.filter(j => ['running', 'queued'].includes(j.status));
      status.textContent = running.length ? `${running.length} 项研究进行中 · ${running[0].message}` : (data.jobs[0]?.message || '');
      const signature = JSON.stringify(data.jobs);
      if (signature === last) return;
      last = signature;
      jobs.replaceChildren();
      if (!data.jobs.length) jobs.append(text('p', '暂无研究任务'));
      data.jobs.forEach(job => {
        const row = document.createElement('section'); row.className = 'research-job';
        row.append(text('strong', job.topic), text('span', job.message));
        const progress = document.createElement('progress'); progress.max = 100; progress.value = job.progress || 0; progress.setAttribute('aria-label', `${job.topic}研究进度`); row.append(progress);
        if (job.status === 'completed') {
          if (job.sourcing) {
            const audit = document.createElement('details');
            audit.append(text('summary', `检索覆盖 · ${job.sourcing.coverage.filter(p => p.source_count).length} / 12 条路径有来源`));
            job.sourcing.coverage.forEach(p => audit.append(text('p', `${p.name} · ${p.failed ? '搜索失败' : p.executed ? '已执行' : '未执行'} · ${p.source_count} 条来源`)));
            audit.append(text('small', '投资吸引力与交易可行性待人工评估'));
            row.append(audit);
            const screening = document.createElement('details');
            screening.append(text('summary', '投资筛选'));
            const key = `sourcing-assessment-${job.id}`;
            let assessments = {};
            try { assessments = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
            const matrix = document.createElement('table');
            const header = document.createElement('tr');
            ['公司', '发现路径', '投资吸引力', '交易可行性', '跟进建议'].forEach(v => header.append(text('th', v)));
            matrix.append(header);
            job.sourcing.companies.forEach(company => {
              const tr = document.createElement('tr');
              const name = company['公司名称'];
              tr.append(text('td', name), text('td', company['发现路径'].join('、')));
              const value = assessments[name] || {attractiveness: '待判断', feasibility: '待判断'};
              const action = text('td', '待评估');
              const recommendation = () => {
                action.textContent = value.attractiveness === '待判断' || value.feasibility === '待判断' ? '待评估' :
                  ({'高高': '重点推进', '高低': '长期覆盖', '低高': '谨慎筛选', '低低': '暂不关注'}[value.attractiveness + value.feasibility]);
              };
              ['attractiveness', 'feasibility'].forEach((field, i) => {
                const cell = document.createElement('td'); const select = document.createElement('select');
                select.setAttribute('aria-label', `${name}${i ? '交易可行性' : '投资吸引力'}`);
                ['待判断', '高', '低'].forEach(v => { const option = text('option', v); option.value = v; select.append(option); });
                select.value = value[field];
                select.onchange = () => { value[field] = select.value; assessments[name] = value; localStorage.setItem(key, JSON.stringify(assessments)); recommendation(); };
                cell.append(select); tr.append(cell);
              });
              recommendation();tr.append(action);matrix.append(tr);
            });
            screening.append(text('small', '人工评估 · 仅保存在当前浏览器，下载文件保留研究时的待判断状态'), matrix);
            row.append(screening);
          }
          row.append(text('small', `确定性高 ${job.primary_count} · 待核验 ${job.review_count} · 排除上市 ${job.secondary_count} · 来源 ${job.source_count}`));
          const link = text('a', '下载 Mapping Excel'); link.href = job.download_url; row.append(link);
          const publish = text('button', job.published ? '已加入看板' : '加入 Mapping 看板'); publish.disabled = !!job.published || !job.primary_count;
          publish.onclick = async () => { publish.disabled = true; try { await api(`/api/research/${job.id}/publish`, {}); location.hash = '#primary-mappings'; location.reload(); } catch (e) { status.textContent = e.message; publish.disabled = false; } };
          row.append(publish);
          const details = document.createElement('details'); details.append(text('summary', '项目预览'));
          const table = document.createElement('table');
          const head = document.createElement('tr'); ['公司名称', '业务描述', '融资轮次', '信源链接'].forEach(k => head.append(text('th', k))); table.append(head);
          (job.preview || []).forEach(item => { const tr = document.createElement('tr'); ['公司名称', '业务描述', '融资轮次', '信源链接'].forEach(k => tr.append(text('td', item[k]))); table.append(tr); });
          details.append(table); row.append(details);
        }
        jobs.append(row);
      });
    } catch (err) { status.textContent = `研究服务连接失败：${err.message}`; }
  }
  new MutationObserver(markDraggable).observe(document.body, {childList: true, subtree: true});
  markDraggable(); refresh(); setInterval(refresh, 4000);
})();
