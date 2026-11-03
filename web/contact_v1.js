(function () {
  "use strict";
  var pageSize = 20, page = 0, rows = [], stats = {};
  var workspace, model;
  var $ = function (id) { return document.getElementById(id); };
  var clean = function (v) { return String(v == null ? "" : v).trim(); };
  var esc = function (v) { return clean(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); };
  function filtered() {
    var industry = clean($("contact-industry-filter").value), progress = clean($("contact-progress-filter").value), query = clean($("contact-progress-search").value).toLowerCase();
    return rows.filter(function (r) {
      var ri = clean(r.industry) || "待识别", rp = clean(r.progress) || "未填写", blob = [ri, r.company, rp, r.meeting, r.companyType, r.intro, r.team, r.round, r.oneLiner, r.landline, r.mobile, r.email, r.person, r.source].join(" ").toLowerCase();
      return (!industry || ri === industry) && (!progress || rp === progress) && (!query || blob.includes(query));
    });
  }
  function render() {
    var list = filtered(), pages = Math.max(1, Math.ceil(list.length / pageSize)); page = Math.min(page, pages - 1);
    var slice = list.slice(page * pageSize, (page + 1) * pageSize), body = $("contact-progress-body");
    $("contact-progress-count").textContent = list.length + " 家";
    body.innerHTML = slice.map(function (r) {
      var link = r.url ? '<a class="source-link" href="' + esc(r.url) + '" target="_blank" rel="noreferrer">' + esc(r.url) + '</a>' : "-";
      return '<tr><td>' + esc(r.industry || "待识别") + '</td><td><strong>' + esc(r.company || "-") + '</strong></td><td><span class="progress-pill">' + esc(r.progress || "未填写") + '</span></td><td>' + esc(r.meeting || "否") + '</td><td>' + esc(r.companyType || "-") + '</td><td>' + esc(r.intro || "-") + '</td><td>' + esc(r.team || "-") + '</td><td>' + esc(r.round || "-") + '</td><td>' + esc(r.oneLiner || "-") + '</td><td>' + esc(r.landline || "-") + '</td><td>' + esc(r.mobile || "-") + '</td><td>' + esc(r.email || "-") + '</td><td>' + esc(r.person || "-") + '</td><td>' + esc(r.source || "-") + '</td><td>' + esc(r.sourceDate || "-") + '</td><td>' + link + '</td></tr>';
    }).join("") || '<tr><td colspan="16" class="muted">没有匹配的联系进度记录。</td></tr>';
    if(workspace)body.querySelectorAll('tr').forEach(function(tr,i){
      var row=slice[i];if(!row)return;
      var item=workspace.contacts.find(function(c){return c.key===model.companyKey(row.company);});
      var cell=document.createElement('td'),input=document.createElement('input');
      input.type='checkbox';input.className='contact-confirm';input.checked=!!item?.flags.reached;
      input.setAttribute('aria-label','已联系 '+row.company);input.title='确认已通过微信或电话建立联系';
      input.onchange=async function(){var checked=input.checked;input.disabled=true;try{await model.confirmContact(row.company,checked);$('contact-save-status').textContent='已保存联系确认';}catch(e){input.checked=!checked;$('contact-save-status').textContent=e.message;}finally{input.disabled=false;}};
      cell.append(input);tr.insertBefore(cell,tr.children[2]);
    });
    var controls = $("contact-v1-pagination");
    if (!controls) { controls = document.createElement("div"); controls.id = "contact-v1-pagination"; controls.className = "contact-v1-pagination"; $("contact-progress-body").closest(".contact-progress-table").after(controls); }
    controls.innerHTML = '<button type="button" data-page="prev">上一页</button><span>第 ' + (page + 1) + ' / ' + pages + ' 页，共 ' + list.length + ' 家</span><button type="button" data-page="next">下一页</button>';
    controls.querySelector('[data-page="prev"]').disabled = page === 0;
    controls.querySelector('[data-page="next"]').disabled = page >= pages - 1;
    controls.querySelector('[data-page="prev"]').onclick = function () { page -= 1; render(); };
    controls.querySelector('[data-page="next"]').onclick = function () { page += 1; render(); };
  }
  function init() {
    import('./workspace_model.mjs').then(async function(m){model=m;workspace=await m.loadWorkspace();return [workspace.site];}).then(function (v) {
      var payload = v[0].contact_progress || {}; rows = payload.rows || []; stats = payload.stats || {};
      var header=$('contact-progress-body').closest('table').querySelector('thead tr');
      if(!header.querySelector('.contact-confirm-heading')){var th=document.createElement('th');th.textContent='已联系';th.className='contact-confirm-heading';header.insertBefore(th,header.children[2]);}
      if(!$('contact-save-status')){var status=document.createElement('p');status.id='contact-save-status';status.setAttribute('role','status');status.textContent='勾选确认已通过微信或电话建立联系';$('contact-progress-body').closest('.contact-progress-table').before(status);}
      var industries = [], progresses = [];
      rows.forEach(function (r) { industries.push(clean(r.industry) || "待识别"); progresses.push(clean(r.progress) || "未填写"); });
      $("contact-industry-filter").innerHTML = '<option value="">全部行业</option>' + Array.from(new Set(industries)).sort().map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
      $("contact-progress-filter").innerHTML = '<option value="">全部状态</option>' + Array.from(new Set(progresses)).sort().map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
      $("contact-rows").textContent = stats.total || rows.length; $("contact-found").textContent = stats.with_contact || 0; $("contact-rate").textContent = (stats.contact_rate || 0) + "%"; $("contacted-count").textContent = stats.contacted || 0; $("meeting-count").textContent = stats.meetings || 0;
      $("contact-industry-filter").onchange = function () { page = 0; render(); }; $("contact-progress-filter").onchange = function () { page = 0; render(); }; $("contact-progress-search").oninput = function () { page = 0; render(); }; render();
      $('contacted-count').textContent=workspace.contacts.filter(function(c){return c.flags.reached;}).length;
      window.addEventListener('contact-confirmed',render);
    }).catch(function (e) { console.warn("contact v1 unavailable", e); });
  }
  window.setTimeout(init, 1400);
}());
