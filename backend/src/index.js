const ORIGIN='https://pixeldiscgame.com';
const ALLOWED_ORIGINS=new Set([ORIGIN,'https://www.pixeldiscgame.com','https://camdenguay12.github.io','http://localhost:8787','http://127.0.0.1:8787']);
const LENGTHS=[3,6,9,18];
const LAYOUTS={random6:6,front9:9,back9:9,timbercreek:9,full18:18};
const PERMANENT=['front9','back9','timbercreek','full18'];
// Match the daily challenge's America/New_York calendar, including DST.
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function baseRespond(data,status=200,origin=ORIGIN){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Player-Id, X-Player-Token','Vary':'Origin'}})}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const allowed=!origin||ALLOWED_ORIGINS.has(origin);
 const respond=(data,status=200)=>baseRespond(data,status,allowed&&origin?origin:ORIGIN);
 if(!allowed)return respond({ok:false,error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Player-Id, X-Player-Token','Access-Control-Max-Age':'86400'}});
 if(!env.DB)return respond({ok:false,error:'D1 binding DB is missing'},503);
 try{
 const url=new URL(request.url),day=today();
 if(request.method==='GET'&&url.pathname==='/health'){await env.DB.prepare('SELECT 1').first();return respond({ok:true,service:'pixeldisc',date:day})}
 if(request.method==='GET'&&url.pathname==='/leaderboard'){
  const daily={},allTime={};
  for(const layout of Object.keys(LAYOUTS)){
   const {results}=await env.DB.prepare('SELECT player AS name,score,throws,created_at AS submitted FROM leaderboard_scores WHERE day=? AND layout=? ORDER BY score ASC,throws ASC,created_at ASC LIMIT 5').bind(day,layout).all();
   daily[layout]=results;
   if(PERMANENT.includes(layout)){const r=await env.DB.prepare('SELECT player AS name,score,throws,created_at AS submitted FROM leaderboard_scores WHERE layout=? ORDER BY score ASC,throws ASC,created_at ASC LIMIT 5').bind(layout).all();allTime[layout]=r.results}
  }
  return respond({ok:true,date:day,daily,allTime})
 }
 if(request.method==='GET'&&url.pathname==='/ace-leaderboard'){
  const {results}=await env.DB.prepare("SELECT COALESCE(p.display_name,'----') AS name,MAX(a.aces) AS aces FROM ace_runs a JOIN players p ON p.id=a.player_id WHERE a.day=? AND p.display_name IS NOT NULL GROUP BY a.player_id ORDER BY aces DESC,MIN(a.created_at) ASC LIMIT 10").bind(day).all();
  return respond({ok:true,date:day,rows:results})
 }
 if(request.method==='GET'&&url.pathname==='/stats'){
  const row=await env.DB.prepare("SELECT COUNT(DISTINCT CASE WHEN event='visit' THEN session END) AS visitors, SUM(CASE WHEN event='round_start' THEN 1 ELSE 0 END) AS roundsStarted, SUM(CASE WHEN event='round_complete' THEN 1 ELSE 0 END) AS roundsCompleted, SUM(CASE WHEN event='hole_complete' THEN 1 ELSE 0 END) AS holesPlayed FROM activity WHERE day=?").bind(day).first();
  const {results}=await env.DB.prepare("SELECT day AS date, SUM(CASE WHEN event='hole_complete' THEN 1 ELSE 0 END) AS holesPlayed FROM activity GROUP BY day ORDER BY day DESC LIMIT 7").all();
  return respond({ok:true,today:{visitors:row?.visitors||0,roundsStarted:row?.roundsStarted||0,roundsCompleted:row?.roundsCompleted||0,holesPlayed:row?.holesPlayed||0},history:results.reverse()})
 }

 // Account credentials are stored separately from anonymous browser credentials.
 if(url.pathname==='/auth'&&request.method==='POST'){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS player_passwords (player_id TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL, iterations INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL, blocked_until INTEGER NOT NULL)").run();
  let data;try{data=await request.json()}catch{return respond({ok:false,error:'Invalid JSON'},400)}
  const action=String(data.action||''),name=String(data.name||'').trim().toUpperCase(),password=String(data.password||'');
  if(!/^[A-Z0-9]{4}$/.test(name)||password.length<8||password.length>128)return respond({ok:false,error:'Enter a four-character username and password (8–128 characters).'},400);
  const encode=s=>new TextEncoder().encode(s);
  const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const hash=async(salt,pass,iterations)=>{const key=await crypto.subtle.importKey('raw',encode(pass),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(salt.match(/../g).map(x=>parseInt(x,16))),iterations},key,256))};
  if(action==='register'){
   const id=String(request.headers.get('X-Player-Id')||''),token=String(request.headers.get('X-Player-Token')||'');
   if(!/^[a-zA-Z0-9_-]{20,100}$/.test(id)||!/^[a-zA-Z0-9_-]{32,150}$/.test(token))return respond({ok:false,error:'Open your existing profile on this device to register.'},401);
   const current=await env.DB.prepare('SELECT display_name FROM players WHERE id=? AND token_hash=?').bind(id,hex(await crypto.subtle.digest('SHA-256',encode(token)))).first();
   if(!current)return respond({ok:false,error:'This device does not own that profile. Sign in or recover your original browser session.'},403);
   if(current.display_name&&current.display_name!==name)return respond({ok:false,error:'Use your existing username for this profile.'},409);
   const other=await env.DB.prepare('SELECT id FROM players WHERE display_name=? AND id<>?').bind(name,id).first();
   if(other)return respond({ok:false,error:'Username already taken. Sign in if it belongs to you.'},409);
   const prior=await env.DB.prepare('SELECT player_id FROM player_passwords WHERE player_id=?').bind(id).first();
   if(prior)return respond({ok:false,error:'This account already has a password. Sign in instead.'},409);
   const salt=hex(crypto.getRandomValues(new Uint8Array(16))),iterations=100000,digest=await hash(salt,password,iterations);
   try{await env.DB.batch([env.DB.prepare('UPDATE players SET display_name=? WHERE id=?').bind(name,id),env.DB.prepare('INSERT INTO player_passwords(player_id,salt,password_hash,iterations) VALUES(?,?,?,?)').bind(id,salt,digest,iterations)]);return respond({ok:true,name})}
   catch(e){if(/UNIQUE|constraint/i.test(String(e)))return respond({ok:false,error:'Username already registered.'},409);throw e}
  }
  if(action==='login'){
   const ip=request.headers.get('CF-Connecting-IP')||'unknown',key=hex(await crypto.subtle.digest('SHA-256',encode(ip+':'+name)));
   const attempt=await env.DB.prepare('SELECT failures,blocked_until FROM auth_attempts WHERE key=?').bind(key).first();
   if(attempt?.blocked_until>Date.now())return respond({ok:false,error:'Too many attempts. Try again later.'},429);
   const player=await env.DB.prepare('SELECT p.id,a.salt,a.password_hash,a.iterations FROM players p JOIN player_passwords a ON a.player_id=p.id WHERE p.display_name=?').bind(name).first();
   const fallbackSalt='00000000000000000000000000000000';
   const digest=await hash(player?.salt||fallbackSalt,password,player?.iterations||100000);
   if(!player||digest!==player.password_hash){
    const failures=(attempt?.failures||0)+1,blocked=failures>=5?Date.now()+15*60*1000:0;
    await env.DB.prepare('INSERT INTO auth_attempts(key,failures,blocked_until) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until').bind(key,failures,blocked).run();
    return respond({ok:false,error:'Incorrect username or password.'},401)
   }
   await env.DB.prepare('DELETE FROM auth_attempts WHERE key=?').bind(key).run();
   const token=hex(crypto.getRandomValues(new Uint8Array(32)));
   await env.DB.prepare('UPDATE players SET token_hash=? WHERE id=?').bind(hex(await crypto.subtle.digest('SHA-256',encode(token))),player.id).run();
   return respond({ok:true,name,id:player.id,token})
  }
  return respond({ok:false,error:'Unknown account action'},400)
 }
 const playerId=String(request.headers.get('X-Player-Id')||'');
 const playerToken=String(request.headers.get('X-Player-Token')||'');
 const authorized=/^[a-zA-Z0-9_-]{20,100}$/.test(playerId)&&/^[a-zA-Z0-9_-]{32,150}$/.test(playerToken);
 if(url.pathname==='/player'&&['GET','POST'].includes(request.method)){
  if(!authorized)return respond({ok:false,error:'Invalid player credentials'},401);
  const encoder=new TextEncoder(),bytes=await crypto.subtle.digest('SHA-256',encoder.encode(playerToken));
  const tokenHash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  let player=await env.DB.prepare('SELECT id,display_name FROM players WHERE id=? AND token_hash=?').bind(playerId,tokenHash).first();
  if(!player){const existing=await env.DB.prepare('SELECT id FROM players WHERE id=?').bind(playerId).first();if(existing)return respond({ok:false,error:'Player credential mismatch'},403);await env.DB.prepare('INSERT INTO players(id,token_hash) VALUES(?,?)').bind(playerId,tokenHash).run();player={id:playerId,display_name:null}}
  if(request.method==='GET'){
   const saved=await env.DB.prepare('SELECT state,updated_at FROM saved_rounds WHERE player_id=?').bind(playerId).first();
   const rounds=await env.DB.prepare('SELECT id,layout,holes,throws,par,score,completed_at FROM player_rounds WHERE player_id=? ORDER BY completed_at DESC LIMIT 100').bind(playerId).all();
   const stats=await env.DB.prepare('SELECT COUNT(*) AS rounds,COALESCE(SUM(holes),0) AS holes,COALESCE(SUM(throws),0) AS throws FROM player_rounds WHERE player_id=?').bind(playerId).first();
   const aceBest=await env.DB.prepare('SELECT MAX(aces) AS best,COUNT(*) AS runs FROM ace_runs WHERE player_id=?').bind(playerId).first();return respond({ok:true,player:{id:player.id,name:player.display_name},saved:saved?JSON.parse(saved.state):null,history:rounds.results,stats,aceBest:{best:aceBest?.best??null,runs:aceBest?.runs||0}})
  }
  let data;try{data=await request.json()}catch{return respond({ok:false,error:'Invalid JSON'},400)}
  if(data.action==='ace_run'){
   const id=String(data.id||''),aces=Number(data.aces);
   if(!/^[-a-zA-Z0-9]{8,100}$/.test(id)||!Number.isInteger(aces)||aces<0||aces>10)return respond({ok:false,error:'Invalid ace run'},400);
   await env.DB.prepare('INSERT OR IGNORE INTO ace_runs(id,player_id,day,aces) VALUES(?,?,?,?)').bind(id,playerId,day,aces).run();
   return respond({ok:true,stored:true})
  }
  if(data.action==='remove_name'){const protectedName=await env.DB.prepare('SELECT player_id FROM player_passwords WHERE player_id=?').bind(playerId).first();if(protectedName)return respond({ok:false,error:'Registered usernames cannot be removed.'},403);await env.DB.prepare('UPDATE players SET display_name=NULL WHERE id=?').bind(playerId).run();return respond({ok:true,stored:true,name:null})}
  if(data.action==='name'){const protectedName=await env.DB.prepare('SELECT player_id FROM player_passwords WHERE player_id=?').bind(playerId).first();if(protectedName)return respond({ok:false,error:'Registered usernames cannot be changed.'},403);const name=String(data.name||'').toUpperCase();if(!/^[A-Z0-9]{4}$/.test(name))return respond({ok:false,error:'Use four letters or numbers'},400);try{const taken=await env.DB.prepare('SELECT id FROM players WHERE display_name=? AND id<>? LIMIT 1').bind(name,playerId).first();if(taken)return respond({ok:false,error:'Username already taken. Choose another four-character name.',code:'NAME_TAKEN'},409);await env.DB.prepare('UPDATE players SET display_name=? WHERE id=?').bind(name,playerId).run();return respond({ok:true,stored:true,name})}catch(e){if(/UNIQUE constraint failed/i.test(String(e)))return respond({ok:false,error:'Username already taken. Choose another four-character name.',code:'NAME_TAKEN'},409);throw e}}
  if(data.action==='save'){
   const state=data.state;if(!state||typeof state!=='object'||!Array.isArray(state.roundHoles)||state.roundHoles.length>18||!state.roundHoles.every(n=>Number.isInteger(n)&&n>=0&&n<18)||!Number.isInteger(state.roundIndex)||state.roundIndex<0||state.roundIndex>=state.roundHoles.length||!Array.isArray(state.pos)||state.pos.length!==2||!state.pos.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=-50&&n<=500)||!Number.isInteger(state.strokes)||state.strokes<0||state.strokes>100)return respond({ok:false,error:'Invalid saved round'},400);
   const json=JSON.stringify(state);if(json.length>4000)return respond({ok:false,error:'Saved round too large'},413);
   await env.DB.prepare('INSERT INTO saved_rounds(player_id,state) VALUES(?,?) ON CONFLICT(player_id) DO UPDATE SET state=excluded.state,updated_at=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')').bind(playerId,json).run();return respond({ok:true,stored:true})
  }
  if(data.action==='clear'){await env.DB.prepare('DELETE FROM saved_rounds WHERE player_id=?').bind(playerId).run();return respond({ok:true,stored:true})}
  if(data.action==='complete'){
   const id=String(data.id||''),layout=String(data.layout||''),holes=Number(data.holes),throws=Number(data.throws),par=Number(data.par);
   if(!/^[-a-zA-Z0-9]{8,100}$/.test(id)||!Object.hasOwn(LAYOUTS,layout)||LAYOUTS[layout]!==holes||!Number.isInteger(throws)||throws<holes||throws>holes*30||!Number.isInteger(par)||par<holes*2||par>holes*6)return respond({ok:false,error:'Invalid completed round'},400);
   await env.DB.prepare('INSERT OR IGNORE INTO player_rounds(id,player_id,layout,holes,throws,par,score) VALUES(?,?,?,?,?,?,?)').bind(id,playerId,layout,holes,throws,par,throws-par).run();
   await env.DB.prepare('DELETE FROM saved_rounds WHERE player_id=?').bind(playerId).run();return respond({ok:true,stored:true})
  }
  return respond({ok:false,error:'Unknown player action'},400)
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
   const name=String(data.name||''),layout=String(data.layout||''),holes=Number(data.holes),throws=Number(data.throws),par=Number(data.par),id=String(data.submissionId||'');
   if(!/^[A-Z0-9]{4}$/.test(name)||!Object.hasOwn(LAYOUTS,layout)||LAYOUTS[layout]!==holes||!Number.isInteger(throws)||throws<holes||throws>holes*30||!Number.isInteger(par)||par<holes*2||par>holes*6||!/^[-a-zA-Z0-9]{8,100}$/.test(id))return respond({ok:false,error:'Invalid score'},400);
   const score=throws-par;
   const existing=await env.DB.prepare('SELECT id FROM leaderboard_scores WHERE id=?').bind(id).first();
   if(existing)return respond({ok:true,stored:true,qualified:true,duplicate:true});
   const daily=await env.DB.prepare('SELECT score,throws FROM leaderboard_scores WHERE day=? AND layout=? ORDER BY score,throws,created_at LIMIT 5').bind(day,layout).all();
   const all=PERMANENT.includes(layout)?await env.DB.prepare('SELECT score,throws FROM leaderboard_scores WHERE layout=? ORDER BY score,throws,created_at LIMIT 5').bind(layout).all():null;
   const qualifies=rows=>rows.length<5||score<rows[4].score||(score===rows[4].score&&throws<rows[4].throws);
   if(!qualifies(daily.results)&&!(all&&qualifies(all.results)))return respond({ok:true,stored:false,qualified:false});
   await env.DB.prepare('INSERT INTO leaderboard_scores(id,day,layout,player,holes,throws,par,score) VALUES(?,?,?,?,?,?,?,?)').bind(id,day,layout,name,holes,throws,par,score).run();
   // Retain only daily top five and (for fixed layouts) all-time top five.
   await env.DB.prepare(`DELETE FROM leaderboard_scores WHERE id IN (
    SELECT id FROM (
      SELECT id,day,layout,
      ROW_NUMBER() OVER(PARTITION BY day,layout ORDER BY score,throws,created_at,id) AS daily_rank,
      ROW_NUMBER() OVER(PARTITION BY layout ORDER BY score,throws,created_at,id) AS lifetime_rank
      FROM leaderboard_scores
    ) WHERE daily_rank>5 AND (layout NOT IN ('front9','back9','timbercreek','full18') OR lifetime_rank>5)
   )`).run();
   return respond({ok:true,stored:true,qualified:true})
  }
  return respond({ok:false,error:'Unknown action'},400)
 }
 return respond({ok:false,error:'Not found'},404)
 }catch(e){console.error(e);return respond({ok:false,error:'Backend error'},500)}
 }};