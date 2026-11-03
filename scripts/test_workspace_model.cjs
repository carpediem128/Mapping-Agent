const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const {contactFlags,contactsModel,funnelStats,topicModel}=await import(pathToFileURL(path.resolve(__dirname,'../web/workspace_model.mjs')));
 assert.equal(contactFlags({progress:'未联系上'}).attempted,true);
 assert.equal(contactFlags({progress:'未联系上'}).reached,false);
 assert.equal(contactFlags({progress:'业务不相关'}).reached,false);
 assert.equal(contactFlags({progress:'已联系上',meeting:'未记录'}).meetingKnown,false);
 assert.equal(contactFlags({progress:'已加微信'}).reached,true);
 const contacts=contactsModel([{company:'甲公司',industry:'材料',progress:'已加微信',meeting:'未记录'},
  {company:' 甲公司 ',industry:'设备',progress:'未联系',meeting:'未记录'},
  {company:'乙公司',industry:'材料',progress:'未联系上',meeting:'否'},
  {company:'丙公司',industry:'设备',progress:'',meeting:'是'}]);
 assert.equal(contacts.length,3);
 assert.equal(contacts[0].industries.size,2);
 assert.deepEqual(funnelStats(contacts).stages.map(s=>s[1]),[3,3,2,1]);
 assert.equal(funnelStats(contacts).meetingUnknown,1);
 assert.equal(funnelStats(contacts,'材料').total,2);
 assert.equal(funnelStats(contacts,'不存在').total,0);
 const graph=topicModel({records:[{company:'甲公司',sheet:'一级市场',source_label:'261103_材料_Mapping',fields:{},row_number:2},
  {company:'甲公司',sheet:'一级市场',source_label:'261103_材料_Mapping',row_number:3},
  {company:'上市标的',sheet:'二级市场',source_label:'261103_材料_Mapping'},
  {company:'丙公司',sheet:'一级市场',source_label:'261104_设备_Mapping',row_number:2}]},contacts);
 assert.equal(graph.recordCount,3);assert.equal(graph.topics.length,2);
 assert.equal(graph.topics.find(t=>t.name==='材料').companies.length,1);
 assert.equal(graph.topics.find(t=>t.name==='材料').companies[0].sources.length,2);
 assert.equal(graph.topics.some(t=>t.companies.some(c=>c.company==='上市标的')),false);
 assert.equal(graph.topics.find(t=>t.name==='材料').companies[0].contact.flags.reached,true);
 console.log('PASS contact semantics, unknown meetings, exact-name dedupe, industry subsets, primary-only topic graph');
})().catch(e=>{console.error(e);process.exitCode=1});
