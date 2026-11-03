const fs=require('node:fs');
const path=require('node:path');
function build(root=process.cwd()){
 const output=path.join(root,'.vercel','output');
 const destination=path.join(output,'functions','api','gateway.func');
 fs.mkdirSync(destination,{recursive:true});
 fs.copyFileSync(path.join(__dirname,'api','gateway.js'),path.join(destination,'index.js'));
 fs.writeFileSync(path.join(destination,'.vc-config.json'),JSON.stringify({runtime:'nodejs22.x',handler:'index.js',launcherType:'Nodejs',maxDuration:60},null,2));
 fs.writeFileSync(path.join(output,'config.json'),JSON.stringify({version:3,routes:[{src:'/(.*)',dest:'/api/gateway'}]},null,2));
 console.log('MAPPING_GATEWAY_BUILD_V2: generated 1 Node.js function; all routes -> /api/gateway; no business data included');
 return output;
}
if(require.main===module)build();
module.exports={build};
