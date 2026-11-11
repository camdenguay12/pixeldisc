const ORIGIN='https://camdenguay12.github.io';
const LENGTHS=[3,6,9,18];
const today=()=>new Date().toISOString().slice(0,10);
function respond(data,status=200,origin=ORIGIN){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}})}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const allowed=!origin||origin===ORIGIN||origin==='http://localhost:8787'||origin==='http://127.0.0.1:8787';
 if(!allowed)return respond({ok:false,error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}});
 if(!env.DB)return respond({ok:false,error:'D1 binding DB is missing'},503);
 try{
 const url=new URL(request.url),day=today();
 if(request.method==='GET'&&url.pathname==='/health'){await env.DB.prepare('SELECT 1').first();return respond({ok:true,service:'pixeldisc',date:day})}
 if(request.method==='GET'&&url.pathname==='/leaderboard'){
  const leaderboards={};for(const n of LENGTHS){const {results}=await env.DB.prepare('SELECT player AS name,score,throws,created_at AS submitted FROM scores WHERE day=? AND holes=? ORDER BY score ASC, throws ASC, created_at ASC LIMIT 20').bind(day,n).all();leaderboards[n]=results}
  return respond({ok:true,date:day,leaderboards})
 }
 if(request.method==='GET'&&url.pathname==='/stats'){
  const row=await env.DB.prepare("SELECT COUNT(DISTINCT CASE WHEN event='visit' THEN session END) AS visitors, SUM(CASE WHEN event='round_start' THEN 1 ELSE 0 END) AS roundsStarted, SUM(CASE WHEN event='round_complete' THEN 1 ELSE 0 END) AS roundsCompleted, SUM(CASE WHEN event='hole_complete' THEN 1 ELSE 0 END) AS holesPlayed FROM activity WHERE day=?").bind(day).first();
  const {results}=await env.DB.prepare("SELECT day AS date, SUM(CASE WHEN event='hole_complete' THEN 1 ELSE 0 END) AS holesPlayed FROM activity GROUP BY day ORDER BY day DESC LIMIT 7").all();
  return respond({ok:true,today:{visitors:row?.visitors||0,roundsStarted:row?.roundsStarted||0,roundsCompleted:row?.roundsCompleted||0,holesPlayed:row?.holesPlayed||0},history:results.reverse()})
 }
 if(request.method==='POST'&&url.pathname==='/event'){
  if(Number(request.headers.get('Content-Length')||0)>4096)return respond({ok:false,error:'Payload too large'},413);
  let data;try{data=await request.json()}catch{return respond({ok:false,error:'Invalid JSON'},400)}
  const session=String(data.session||'');if(!/^[a-zA-Z0-9_-]{8,100}$/.test(session))return respond({ok:false,error:'Invalid session'},400);
  if(data.action==='activity'){
   const event=String(data.event||''),holes=Number(data.holes||0);
   if(!['visit','round_start','hole_complete','round_complete'].includes(event)||!LENGTHS.concat(0).includes(holes))return respond({ok:false,error:'Invalid activity'},400);
   const query=event==='visit'?'INSERT OR IGNORE INTO activity(day,event,session,holes) VALUES(?,?,?,?)':'INSERT INTO activity(day,event,session,holes) VALUES(?,?,?,?)';
   await env.DB.prepare(query).bind(day,event,session,holes).run();return respond({ok:true,stored:true})
  }
  if(data.action==='score'){
   const name=String(data.name||''),holes=Number(data.holes),throws=Number(data.throws),par=Number(data.par),id=String(data.submissionId||'');
   if(!/^[A-Z0-9]{4}$/.test(name)||!LENGTHS.includes(holes)||!Number.isInteger(throws)||throws<holes||throws>holes*30||!Number.isInteger(par)||par<holes*2||par>holes*6||!/^[-a-zA-Z0-9]{8,100}$/.test(id))return respond({ok:false,error:'Invalid score'},400);
   await env.DB.prepare('INSERT OR IGNORE INTO scores(id,day,player,holes,throws,par,score) VALUES(?,?,?,?,?,?,?)').bind(id,day,name,holes,throws,par,throws-par).run();return respond({ok:true,stored:true})
  }
  return respond({ok:false,error:'Unknown action'},400)
 }
 return respond({ok:false,error:'Not found'},404)
 }catch(e){console.error(e);return respond({ok:false,error:'Backend error'},500)}
 }};