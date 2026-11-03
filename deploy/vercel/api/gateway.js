const {createHash,timingSafeEqual}=require('node:crypto');
const LIMIT=4*1024*1024;
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
function authenticate(header,users){
 if(!header?.startsWith('Basic '))return '';
 const value=Buffer.from(header.slice(6),'base64').toString('utf8'),split=value.indexOf(':');
 if(split<1)return '';
 const user=value.slice(0,split),password=value.slice(split+1);
 return typeof users[user]==='string'&&Object.hasOwn(users,user)&&equal(password,users[user])?user:'';
}
function targetURL(origin,path){
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('Expected HTTPS origin');
 if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw Error('Invalid path');
 const input=new URL(path,'https://gateway.invalid');base.pathname=input.pathname;base.search=input.search;return base;
}
async function handler(req,res){
 const send=(code,message)=>{res.statusCode=code;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(message);};
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 let users,target;
 try{
   users=JSON.parse(process.env.MAPPING_USERS_JSON||'{}');
   if(!users||typeof users!=='object'||Array.isArray(users)||!Object.keys(users).length||!process.env.MAPPING_BACKEND_TOKEN||process.env.MAPPING_BACKEND_TOKEN.length<32||process.env.MAPPING_BACKEND_TOKEN.includes('REPLACE_'))throw Error('Missing environment');
   if(Object.entries(users).some(([name,password])=>!name||typeof password!=='string'||password.length<12||password.includes('REPLACE_')))throw Error('Invalid team accounts');
   target=targetURL(process.env.MAPPING_BACKEND_ORIGIN,req.url);
 }catch{return send(503,'Deployment configuration incomplete. Contact the administrator.');}
 const user=authenticate(req.headers.authorization,users);
 if(!user){res.setHeader('WWW-Authenticate','Basic realm="Mapping Agent", charset="UTF-8"');return send(401,'Sign in with your team account.');}
 if(!['GET','HEAD','POST'].includes(req.method))return send(405,'Method not allowed');
 if(req.method==='POST'){
   const origin=req.headers.origin;
   try{if(origin&&new URL(origin).host!==req.headers.host)return send(403,'Cross-origin write rejected');}catch{return send(403,'Invalid origin');}
   if(req.headers['sec-fetch-site']==='cross-site')return send(403,'Cross-site write rejected');
 }
 try{
   let body;
   if(req.method==='POST'){
     if(Number(req.headers['content-length']||0)>LIMIT)return send(413,'Upload limit: 4 MiB per request. Split larger workbooks before uploading.');
     const chunks=[];let size=0;
     for await(const chunk of req){size+=chunk.length;if(size>LIMIT)return send(413,'Upload limit: 4 MiB per request.');chunks.push(chunk);}
     body=Buffer.concat(chunks);
   }
   const headers={'X-Mapping-Gateway-Token':process.env.MAPPING_BACKEND_TOKEN,'X-Mapping-User':user,'Accept':req.headers.accept||'*/*'};
   if(req.headers['content-type'])headers['Content-Type']=req.headers['content-type'];
   if(req.method==='POST')headers.Origin=target.origin;
   const response=await fetch(target,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(50000)});
   const length=Number(response.headers.get('content-length')||0);
   if(length>LIMIT)return send(502,'File exceeds gateway response limit. Contact the administrator.');
   res.statusCode=response.status;
   for(const name of ['content-type','content-disposition'])if(response.headers.has(name))res.setHeader(name,response.headers.get(name));
   if(response.status>=300&&response.status<400)return send(502,'Unexpected backend redirect');
   if(req.method==='HEAD')return res.end();
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length>LIMIT)return send(502,'Response exceeds gateway limit.');
   res.end(bytes);
 }catch{return send(502,'Backend unavailable or timed out. Please retry later.');}
}
module.exports=handler;
module.exports.authenticate=authenticate;
module.exports.targetURL=targetURL;
// Multipart uploads must reach the existing Python parser as raw bytes.
module.exports.config={api:{bodyParser:false}};
