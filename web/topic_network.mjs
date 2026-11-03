import * as THREE from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {loadWorkspace,clean} from './workspace_model.mjs';

// Lieflat B2 hub/satellite grammar, extended to a spherical topic navigator at user request.
const COLORS={ink:0x33452d,data:0x71865f,contact:0xa4b498,unknown:0xc2c7b8,edge:0x9fae91,grid:0xcbd0bf};
const $=id=>document.getElementById(id);
const panel=$('topic-network'),host=$('network-canvas'),labels=$('network-labels');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let topics=[],recordCount=0,theme=null,selected=null,hover='',renderer,scene,camera,controls,group,frame=0,paused=reduced.matches,objects=[],edges=[],radius=175;
let fallback=false,query='',pointerDown=null,drawing=false;
const sphere=new THREE.SphereGeometry(1,28,20);
const raycaster=new THREE.Raycaster();
const vector=new THREE.Vector2();
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value??'';return e;};
function button(value,action){const b=text('button',value);b.type='button';b.onclick=action;return b;}
function renderSelection(company){
 const box=$('network-selection');box.replaceChildren();
 if(company){
   box.append(text('h3',company.company));
   const flags=company.contact?.flags;
   box.append(text('p',flags?.reached?'已建立联系':flags?.attempted?'已发起联系':flags?.hasContact?'有联系方式':'联系状态未记录'));
   const dl=document.createElement('dl');
   const aliases=[['业务',['业务描述','一句话业务','主要业务']],['核心技术',['核心产品/技术','产品技术','核心产品']],['融资',['融资轮次','融资历史']],['团队',['公司团队','团队信息']],['地区',['地区','总部所在地']]];
   for(const [label,keys] of aliases){const value=keys.map(k=>company.fields[k]).find(v=>clean(v));if(value)dl.append(text('dt',label),text('dd',value));}
   if(!dl.childElementCount)box.append(text('p','当前导入记录尚无研究详情。'));else box.append(dl);
   const source=company.sources[0];box.append(text('p',`来源：${source.source} / ${source.sheet} / 第 ${source.row} 行`));
 }else if(theme){
   box.append(text('h3',theme.name),text('p',`${theme.companies.length} 家一级市场公司`),text('p','线条表示公司属于该研究主题。'));
   const link=button('进入该主题 Mapping',()=>{
     document.querySelector('.side-nav a[href="#primary-mappings"]')?.click();
     setTimeout(()=>document.querySelector(`#primary-mappings [data-title="${CSS.escape(theme.name)}"]`)?.click(),180);
   });link.className='network-detail-link';box.append(link);
 }else{
   const unique=new Set(topics.flatMap(t=>t.companies.map(c=>c.id)));
   box.append(text('h3','一级市场研究'),text('p',`${topics.length} 个主题 · ${unique.size} 家公司`),text('p',`${recordCount} 条导入记录；公司在各主题内按名称精确去重。`));
 }
}
function renderList(){
 const list=$('network-list');list.replaceChildren();
 const q=query.toLowerCase();
 if(!theme){
   const filtered=topics.filter(t=>t.name.toLowerCase().includes(q)||t.companies.some(c=>c.company.toLowerCase().includes(q)));
   for(const t of filtered){const b=button('',()=>openTheme(t));b.dataset.networkTopic=t.id;b.append(text('span',t.name),text('small',t.companies.length+' 家'));list.append(b);}
   if(!filtered.length)list.append(text('p','没有匹配的主题或公司。'));
 }else{
   const filtered=theme.companies.filter(c=>c.company.toLowerCase().includes(q)||theme.name.toLowerCase().includes(q));
   for(const c of filtered){const b=button(c.company,()=>selectCompany(c));b.dataset.networkCompany=c.id;b.setAttribute('aria-pressed',String(selected?.id===c.id));list.append(b);}
   if(!filtered.length)list.append(text('p','当前主题中没有匹配的公司。'));
 }
}
function selectCompany(company){selected=company;renderSelection(company);renderList();drawFrame();}
function clearScene(){
 if(!group)return;
 for(const child of [...group.children]){group.remove(child);if(child.geometry&&child.geometry!==sphere)child.geometry.dispose();if(child.material)child.material.dispose();}
 labels.replaceChildren();objects=[];edges=[];hover='';
}
function makeNode(id,name,position,nodeRadius,kind,item){
 const flags=item?.contact?.flags;
 const color=kind==='topic'?COLORS.data:kind==='hub'?COLORS.ink:flags?.reached?COLORS.ink:flags?.hasContact?COLORS.contact:COLORS.unknown;
 const material=new THREE.MeshStandardMaterial({color,roughness:.95,metalness:0});
 const mesh=new THREE.Mesh(sphere,material);mesh.scale.setScalar(nodeRadius);
 const node={id,name,kind,item,mesh,radius:nodeRadius,target:position.clone(),label:null};mesh.userData.node=node;
 mesh.position.copy(reduced.matches?position:position.clone().multiplyScalar(.2));
 group.add(mesh);objects.push(node);
 if(kind==='topic'||kind==='hub'||kind==='company'){
   const b=button('',()=>kind==='topic'?openTheme(item):kind==='company'?selectCompany(item):null);
   b.className='network-node-label';b.append(text('strong',name));
   if(kind!=='company')b.append(text('small',(kind==='topic'?item.companies.length:theme.companies.length)+' 家一级公司'));
   b.setAttribute('aria-label',kind==='company'?name:`展开${name}一级公司网络`);
   if(kind==='hub')b.disabled=true;
   if(kind==='topic')b.dataset.networkTopic=id;
   labels.append(b);node.label=b;
 }
 return node;
}
function wireSphere(){
 const points=Array.from({length:97},(_,i)=>new THREE.Vector3(Math.cos(i/96*Math.PI*2)*145,Math.sin(i/96*Math.PI*2)*145,0));
 for(let i=0;i<3;i++){
   const geometry=new THREE.BufferGeometry().setFromPoints(points);
   const ring=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:COLORS.grid}));
   if(i===1)ring.rotation.x=Math.PI/2;if(i===2)ring.rotation.y=Math.PI/2;
   group.add(ring);
 }
}
function fitCamera(){
 if(!camera||!renderer)return;
 const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
 renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
 const halfFov=Math.min(THREE.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
 const distance=radius/Math.sin(halfFov)*1.26;
 camera.position.set(0,theme?0:radius*.16,distance);controls.target.set(0,0,0);controls.update();controls.saveState();drawFrame();
}
function updateHeader(){
 panel.dataset.mode=theme?'companies':'themes';panel.dataset.topicCount=topics.length;panel.dataset.companyCount=theme?theme.companies.length:0;
 $('network-breadcrumb').textContent=theme?`全部主题 / ${theme.name}`:'全部主题';
 $('network-summary').textContent=theme?`${theme.name} · ${theme.companies.length} 家一级公司`:`${topics.length} 个已导入主题 · ${recordCount} 条一级市场记录`;
 if(!fallback)$('network-render-status').textContent=theme?'线条表示主题归属；深色为已建立联系，浅绿为有联系方式，灰色为未匹配联系记录。':'节点表示主题；节点大小按一级公司数编码。';
 $('network-home').disabled=!theme;
 $('network-motion').disabled=!!theme||fallback;
 $('network-motion').textContent=paused?'继续旋转':'暂停旋转';$('network-motion').setAttribute('aria-pressed',String(paused));
 if(controls)controls.autoRotate=!theme&&!paused&&!reduced.matches;
}
function showThemes(){
 theme=null;selected=null;query='';$('network-search').value='';clearScene();radius=180;
 if(!fallback){
   wireSphere();
   topics.forEach((t,i)=>{
     const y=1-2*(i+.5)/Math.max(1,topics.length),r=Math.sqrt(1-y*y),angle=i*Math.PI*(3-Math.sqrt(5));
     const position=new THREE.Vector3(Math.cos(angle)*r*138,y*138,Math.sin(angle)*r*138);
     makeNode(t.id,t.name,position,Math.sqrt(t.companies.length)*3.3,'topic',t);
   });
   controls.enableRotate=true;fitCamera();
 }
 updateHeader();renderSelection();renderList();drawFrame();
}
function openTheme(t){
 theme=t;selected=null;clearScene();
 if(!fallback){
   const data=[{id:'topic-hub',fx:0,fy:0,hub:true},...t.companies.map(c=>({id:c.id,item:c}))];
   const links=t.companies.map(c=>({source:'topic-hub',target:c.id}));
   const sim=window.d3.forceSimulation(data).randomSource(window.d3.randomLcg(.42))
     .force('link',window.d3.forceLink(links).id(d=>d.id).distance(95))
     .force('charge',window.d3.forceManyBody().strength(-190))
     .force('center',window.d3.forceCenter(0,0))
     .force('collide',window.d3.forceCollide(d=>d.hub?30:14)).stop();
   sim.tick(280);sim.stop();
   const hub=makeNode('topic-hub',t.name,new THREE.Vector3(0,0,0),12,'hub',null);
   data.slice(1).forEach(n=>{
     const company=makeNode(n.id,n.item.company,new THREE.Vector3(n.x,-n.y,0),5,'company',n.item);
     const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
     const edge=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:COLORS.edge}));group.add(edge);edges.push({edge,from:hub,to:company});
   });
   radius=Math.max(100,...data.map(n=>Math.hypot(n.x,n.y)))+34;
   controls.enableRotate=false;fitCamera();
 }
 updateHeader();renderSelection();renderList();drawFrame();
}
function drawFrame(){
 if(drawing||!renderer||!panel.classList.contains('active'))return;
 const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
 drawing=true;
 controls.update();
 for(const node of objects){
   if(reduced.matches)node.mesh.position.copy(node.target);else node.mesh.position.lerp(node.target,.15);
   node.mesh.scale.setScalar(node.radius*((node.id===hover||node.id===selected?.id)?1.15:1));
 }
 for(const item of edges){
   const positions=item.edge.geometry.attributes.position;
   positions.setXYZ(0,...item.from.mesh.position.toArray());positions.setXYZ(1,...item.to.mesh.position.toArray());positions.needsUpdate=true;
   item.edge.material.color.setHex(selected&&item.to.id===selected.id?COLORS.ink:COLORS.edge);
 }
 scene.updateMatrixWorld();camera.updateMatrixWorld();
 const placements=[];
 for(const node of objects){
   const b=node.label;if(!b)continue;
   const visible=node.kind!=='company'||node.id===hover||node.id===selected?.id;
   const p=node.mesh.position.clone().project(camera);
   b.hidden=!visible||p.z>1||p.z< -1;
   if(!b.hidden){
     const bw=b.offsetWidth||130,bh=b.offsetHeight||42;
     let x=Math.max(4,Math.min(width-bw-4,(p.x+1)/2*width-bw/2));
     let y=Math.max(4,Math.min(height-bh-4,(-p.y+1)/2*height+node.radius*.8+8));
     for(const old of placements)if(Math.abs(x-old.x)<Math.max(bw,old.w)&&Math.abs(y-old.y)<Math.max(bh,old.h))y=Math.max(4,old.y-bh-5);
     placements.push({x,y,w:bw,h:bh});b.style.transform=`translate(${x}px,${y}px)`;b.dataset.selected=String(node.id===selected?.id);
   }
 }
 renderer.render(scene,camera);host.dataset.frames=String(Number(host.dataset.frames||0)+1);drawing=false;
}
function animate(){frame=0;if(!panel.classList.contains('active')||document.hidden)return;drawFrame();if(!reduced.matches)frame=requestAnimationFrame(animate);}
function syncVisibility(){
 if(frame){cancelAnimationFrame(frame);frame=0;}
 if(panel.classList.contains('active')&&!document.hidden){requestAnimationFrame(()=>{fitCamera();animate();});}
}
function pointAt(event){
 const box=renderer.domElement.getBoundingClientRect();vector.set((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1);
 raycaster.setFromCamera(vector,camera);return raycaster.intersectObjects(objects.map(n=>n.mesh),false)[0]?.object.userData.node;
}
function initRenderer(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xfbf7f1,0);
 renderer.domElement.setAttribute('aria-label','主题球形与一级公司网络画布');host.append(renderer.domElement);host.dataset.renderer='three';
 scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x788768,2.7));
 const light=new THREE.DirectionalLight(0xffffff,1.6);light.position.set(-180,200,350);scene.add(light);
 camera=new THREE.PerspectiveCamera(45,1,.1,5000);group=new THREE.Group();scene.add(group);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.autoRotateSpeed=.65;controls.minDistance=60;controls.maxDistance=2200;controls.enablePan=true;
 controls.addEventListener('change',()=>{if(reduced.matches)drawFrame();});
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointermove',e=>{hover=pointAt(e)?.id||'';canvas.style.cursor=hover?'pointer':'grab';if(reduced.matches)drawFrame();});
 canvas.addEventListener('pointerleave',()=>{hover='';if(reduced.matches)drawFrame();});
 canvas.addEventListener('pointerup',e=>{
   if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>7)return;
   const node=pointAt(e);if(node?.kind==='topic')openTheme(node.item);else if(node?.kind==='company')selectCompany(node.item);
 });
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('network-render-status').textContent='图形上下文已中断，主题和公司列表仍可使用。';});
 new ResizeObserver(()=>{if(panel.classList.contains('active'))fitCamera();}).observe(host);
}
async function init(){
 try{
   const workspace=await loadWorkspace();topics=workspace.graph.topics;recordCount=workspace.graph.recordCount;
   try{initRenderer();}catch(e){fallback=true;host.dataset.renderer='fallback';$('network-render-status').textContent='三维视图不可用，可通过主题与公司列表继续查看。';}
   if(!topics.length)$('network-render-status').textContent='暂无一级市场 Mapping，导入后可查看主题网络。';
   $('network-home').onclick=showThemes;
   $('network-reset').onclick=()=>fitCamera();
   $('network-motion').onclick=()=>{paused=!paused;updateHeader();drawFrame();};
   $('network-search').oninput=e=>{query=e.target.value.trim();renderList();};
   new MutationObserver(syncVisibility).observe(panel,{attributes:true,attributeFilter:['class']});
   document.addEventListener('visibilitychange',syncVisibility);
   reduced.addEventListener('change',()=>{paused=reduced.matches;updateHeader();syncVisibility();});
   showThemes();syncVisibility();
   if(!fallback)$('network-render-status').textContent='节点表示主题；节点大小按一级公司数编码。';
 }catch(e){$('network-summary').textContent='主题网络暂时不可用';$('network-render-status').textContent=e.message;}
}
init();
