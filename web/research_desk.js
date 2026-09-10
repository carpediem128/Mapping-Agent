(() => {
  'use strict';
  const host = document.querySelector('.main-column');
  if (!host || document.getElementById('research-desk')) return;
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
