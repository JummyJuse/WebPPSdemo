const express=require('express');
const http=require('node:http');
const crypto=require('node:crypto');
const {Server}=require('socket.io');
const QRCode=require('qrcode');
const app=express(),server=http.createServer(app),io=new Server(server);
const rooms=new Map(),MAX=6;
const letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(){let c;do{c=Array.from(crypto.randomBytes(6),v=>letters[v%letters.length]).join('')}while(rooms.has(c));return c}
function publicRoom(r){return {code:r.code,players:[...r.players.values()],max:MAX,full:r.players.size===MAX}}
function closeOrLeave(socket){
 const c=socket.data.room; if(!c)return;
 const r=rooms.get(c);socket.leave(c);socket.data.room=null;
 if(!r)return;
 if(r.host===socket.id){rooms.delete(c);io.to(c).emit('closed');return}
 r.players.delete(socket.id);io.to(c).emit('update',publicRoom(r));
}
io.on('connection',s=>{
 s.on('create',reply=>{
  if(s.data.room)return reply({error:'Already in a room'});
  const c=code(),r={code:c,host:s.id,players:new Map()};
  rooms.set(c,r);s.join(c);s.data.room=c;s.data.host=true;reply({room:publicRoom(r)});
 });
 s.on('join',({code:requested,name}={},reply)=>{
  if(typeof reply!=='function')return;
  if(s.data.room)return reply({error:'Already in a room'});
  const r=rooms.get(String(requested||'').toUpperCase().trim());
  if(!r)return reply({error:'Room not found'});
  if(r.players.size>=MAX)return reply({error:'This room is full (6/6)'});
  const clean=typeof name==='string'?name.trim().replace(/\s+/g,' ').slice(0,24):'';
  if(!clean)return reply({error:'Enter your name'});
  r.players.set(s.id,{id:s.id,name:clean});s.data.room=r.code;s.data.host=false;s.join(r.code);
  io.to(r.code).emit('update',publicRoom(r));reply({room:publicRoom(r)});
 });
 s.on('leave',reply=>{closeOrLeave(s);if(typeof reply==='function')reply({ok:true})});
 s.on('disconnect',()=>closeOrLeave(s));
});
app.get('/api/qr/:code',async(req,res)=>{
 const r=rooms.get(req.params.code.toUpperCase());if(!r)return res.status(404).send('Room not found');
 const origin=(process.env.PUBLIC_ORIGIN||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
 try{const png=await QRCode.toBuffer(`${origin}/join/${r.code}`,{width:300,margin:2});res.type('png').send(png)}
 catch{res.status(500).send('Unable to generate QR')}
});
app.get('/join/:code',(req,res)=>res.redirect('/?join='+encodeURIComponent(req.params.code)));
app.get('/',(_req,res)=>res.type('html').send(page));
const page=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PPS | Power Plant Control Room</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,sans-serif;background:radial-gradient(ellipse at 80% 12%,#164137 0,transparent 34%),#08141e;color:#edf7f8}
main{max-width:900px;margin:auto;padding:28px 18px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #294552;padding-bottom:21px;color:#aef080;font-weight:900;letter-spacing:2px}header small{font-size:10px;color:#7aa79e}
.box{margin:40px 0 0;background:#122632;border:1px solid #31515b;border-radius:18px;padding:clamp(22px,5vw,46px);box-shadow:0 20px 80px #0005}
.label{color:#9bccbd;letter-spacing:2px;font-size:11px;font-weight:800}h1{font-size:clamp(32px,5vw,58px);margin:12px 0 15px;letter-spacing:-1.8px}h1 em{color:#b9fc7c;font-style:normal}
p{color:#adc1c7;line-height:1.6}button{border:0;border-radius:9px;padding:13px 19px;font-weight:800;cursor:pointer;background:#b7f981;color:#11271c}button.alt{background:#31505a;color:#ecf8fa}button.ghost{background:transparent;color:#9bbdc8;padding-left:0}input{width:100%;background:#0a1c25;border:1px solid #43616b;border-radius:8px;padding:13px;color:white;font:inherit}
form{max-width:400px}label{display:block;margin:15px 0;font-size:11px;letter-spacing:1px;color:#adc4cd}label input{margin-top:8px}
.hidden{display:none!important}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.count{font-size:33px;font-weight:900;color:#b7f981;background:#1b3940;padding:15px 20px;border-radius:12px}.share{display:grid;grid-template-columns:210px 1fr;gap:25px;align-items:center;background:#091e26;border:1px solid #31525a;border-radius:12px;padding:20px;margin:26px 0}.share img{width:200px;max-width:100%;padding:9px;background:white;border-radius:8px}.flex{display:flex;gap:8px}.flex input{min-width:0}h2{font-size:19px}.roster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.seat{border:1px solid #31505b;border-radius:10px;padding:15px;background:#0a1e28;overflow-wrap:anywhere}.seat b{color:#b6fa87;font-size:10px;letter-spacing:1px}.seat span{display:block;font-size:14px;margin-top:5px}.seat.empty span{color:#78949c}.status{color:#b7f981;font-weight:750}#notice{color:#ffc29a;min-height:24px;margin-top:16px}footer{text-align:center;font-size:10px;letter-spacing:2px;color:#688994;margin:40px 0}
@media(max-width:650px){.share{grid-template-columns:1fr}.share img{margin:auto}.roster{grid-template-columns:repeat(2,minmax(0,1fr))}.flex{flex-wrap:wrap}}
</style></head><body><main><header><span>⚡ PPS <small>POWER PLANT SIMULATOR</small></span><small>● LOBBY NETWORK</small></header>
<section class="box" id="home"><div class="label">MULTIPLAYER / CONTROL ROOM</div><h1>Operate Together.<br><em>Power the Plant.</em></h1><p>Start a room as host, or join a six-person operations crew using a code or QR invitation.</p><div class="flex"><button id="create">Create Host Room</button><button class="alt" id="joinButton">Join a Room</button></div></section>
<section class="box hidden" id="join"><div class="label">CREW ACCESS</div><h1>Join <em>Control Room</em></h1><form id="joinForm"><label>OPERATOR NAME<input id="name" maxlength="24" required placeholder="Your name" autocomplete="nickname"></label><label>SIX-CHARACTER CODE<input id="roomCode" maxlength="6" required placeholder="ABC123"></label><button type="submit">Join Crew</button></form><button class="ghost" id="back">← Back</button></section>
<section class="box hidden" id="lobby"><div class="top"><div><div class="label" id="role">ROOM HOST</div><h1>Room <em id="code"></em></h1></div><div class="count" id="count">0/6</div></div><p id="hint"></p>
<div class="share" id="share"><img id="qr" alt="QR code to join this power plant room"><div><div class="label">INVITE YOUR CREW</div><p>Scan the QR code or share this link with operators on any device.</p><div class="flex"><input id="link" readonly aria-label="Join link"><button id="copy">Copy</button></div></div></div>
<h2>Operator Roster</h2><div class="roster" id="roster"></div><p class="status" id="status"></p><button class="ghost" id="leave">Leave / Close Room</button></section><p id="notice" role="alert"></p><footer>PPS · REAL-TIME MULTIPLAYER LOBBY DEMO · 6 PLAYERS</footer></main><script src="/socket.io/socket.io.js"></script><script>
const socket=io(),get=id=>document.getElementById(id);let roomCode='',host=false;
function show(id){['home','join','lobby'].forEach(v=>get(v).classList.toggle('hidden',v!==id));get('notice').textContent=''}
function error(msg){get('notice').textContent=msg}
function reset(message){roomCode='';host=false;history.replaceState(null,'','/');show('home');if(message)error(message)}
function render(r){get('role').textContent=host?'ROOM HOST':'CREW MEMBER';get('code').textContent=r.code;get('count').textContent=r.players.length+'/6';get('hint').textContent=host?'Waiting for six operators to join your control room.':'You are connected to this crew. Waiting for the other operators.';
 get('share').classList.toggle('hidden',!host);
 get('qr').src='/api/qr/'+encodeURIComponent(r.code);get('link').value=location.origin+'/join/'+encodeURIComponent(r.code);
 const roster=get('roster');roster.replaceChildren();for(let i=0;i<6;i++){const el=document.createElement('div');el.className='seat'+(r.players[i]?'':' empty');const label=document.createElement('b');label.textContent='OPERATOR '+String(i+1).padStart(2,'0');const n=document.createElement('span');n.textContent=r.players[i]?.name||'Awaiting player';el.append(label,n);roster.append(el)}
 get('status').textContent=r.full?'✓ CREW COMPLETE — 6/6 OPERATORS CONNECTED':'Waiting for '+(6-r.players.length)+' more operator(s)…';show('lobby')}
get('create').onclick=()=>socket.emit('create',data=>{if(data.error)return error(data.error);host=true;roomCode=data.room.code;render(data.room)});
get('joinButton').onclick=()=>show('join');get('back').onclick=()=>show('home');
get('joinForm').onsubmit=e=>{e.preventDefault();socket.emit('join',{code:get('roomCode').value,name:get('name').value},data=>{if(data.error)return error(data.error);host=false;roomCode=data.room.code;history.replaceState(null,'','/join/'+roomCode);render(data.room)})};
get('leave').onclick=()=>socket.emit('leave',()=>reset());
get('copy').onclick=async()=>{try{await navigator.clipboard.writeText(get('link').value);get('copy').textContent='Copied!';setTimeout(()=>get('copy').textContent='Copy',1400)}catch{get('link').select();error('Please copy the selected link manually.')}};
socket.on('update',r=>{if(r.code===roomCode)render(r)});
socket.on('closed',()=>{if(roomCode)reset('The host has closed the room.')});
socket.on('disconnect',()=>{if(roomCode)reset('Connection lost. Please rejoin.')});
const invited=new URLSearchParams(location.search).get('join');if(invited){get('roomCode').value=invited.slice(0,6).toUpperCase();show('join')}
</script></body></html>`;
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('PPS lobby running'));
