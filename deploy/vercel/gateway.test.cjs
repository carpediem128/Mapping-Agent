const {test}=require('node:test');
const assert=require('node:assert/strict');
const {authenticate,targetURL}=require('./api/gateway.js');
const handler=require('./api/gateway.js');
const {Readable}=require('node:stream');
test('requires a named account and correct password',()=>{
 const auth=s=>'Basic '+Buffer.from(s).toString('base64');
 assert.equal(authenticate(auth('colleague:example-pass'),{colleague:'example-pass'}),'colleague');
 assert.equal(authenticate(auth('colleague:wrong'),{colleague:'example-pass'}),'');
 assert.equal(authenticate(auth('__proto__:wrong'),{}),'');
 assert.equal(authenticate('',{}),'');
});
test('gateway fails closed and forwards only server credentials',async()=>{
 const original={...process.env},originalFetch=global.fetch;
 const make=(url='/',method='GET',headers={})=>{const req=Readable.from([]);Object.assign(req,{url,method,headers:{host:'team.example',...headers}});return req;};
 const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(b){this.body=String(b||'');}});
 try{
   delete process.env.MAPPING_BACKEND_TOKEN;let res=response();await handler(make(),res);assert.equal(res.statusCode,503);
   Object.assign(process.env,{MAPPING_BACKEND_ORIGIN:'https://backend.example',MAPPING_BACKEND_TOKEN:'x'.repeat(40),MAPPING_USERS_JSON:JSON.stringify({colleague:'a-long-password'})});
   res=response();await handler(make(),res);assert.equal(res.statusCode,401);
   let forwarded;
   global.fetch=async(url,options)=>{forwarded={url:String(url),options};return new Response('ok',{headers:{'Content-Type':'text/plain'}});};
   const authorization='Basic '+Buffer.from('colleague:a-long-password').toString('base64');
   res=response();await handler(make('/api/research?test=1','GET',{authorization}),res);
   assert.equal(res.body,'ok');assert.equal(forwarded.url,'https://backend.example/api/research?test=1');
   assert.equal(forwarded.options.headers['X-Mapping-Gateway-Token'],'x'.repeat(40));assert.equal(forwarded.options.headers.Authorization,undefined);
   res=response();await handler(make('/api/contact-confirmations','POST',{authorization,origin:'https://other.example'}),res);assert.equal(res.statusCode,403);
   res=response();await handler(make('/api/import-mappings','POST',{authorization,'content-length':5*1024*1024}),res);assert.equal(res.statusCode,413);
 }finally{process.env=original;global.fetch=originalFetch;}
});
test('preserves same-origin path and query without open proxy',()=>{
 assert.equal(targetURL('https://backend.example','/api/research?q=1').href,'https://backend.example/api/research?q=1');
 for(const p of ['//evil.example/path','https://evil.example','/\\evil'])assert.throws(()=>targetURL('https://backend.example',p));
 for(const origin of ['http://backend.example','https://user:pass@backend.example','https://backend.example/path'])assert.throws(()=>targetURL(origin,'/'));
});
