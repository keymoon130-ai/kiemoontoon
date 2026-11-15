// 최기문웹툰 3D 배경 스튜디오 (three.js)
// 에셋: Kenney (MIT/CC0), KayKit (CC0), pmndrs market (CC0) — public/3d/LICENSES.txt
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const V3=THREE.Vector3;
const ASSET=new URL('./3d/',import.meta.url).href;
const loader=new GLTFLoader();
const cache={};
let R,scene,camera,controls,root,dollRoot,raf=0,S,host,onCap,cutW,cutH,sunL,hemiL,fillL,lampLights=[];
const keys={};

/* ================= 공통 도우미 ================= */
const MATS={};
function mat(color,o={}){const k=color+JSON.stringify(o);if(!MATS[k])MATS[k]=new THREE.MeshStandardMaterial({color,roughness:o.r??0.85,metalness:o.m??0,transparent:!!o.t,opacity:o.t??1,side:o.side||THREE.FrontSide,map:o.map||null});return MATS[k]}
function box(w,h,d,color,x=0,y=0,z=0,o={}){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),o.mat||mat(color,o));m.position.set(x,y+h/2,z);if(o.ry)m.rotation.y=o.ry;m.castShadow=m.receiveShadow=true;(o.p||root).add(m);return m}
function cyl(rt,rb,h,color,x=0,y=0,z=0,o={}){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,o.seg||16),o.mat||mat(color,o));m.position.set(x,y+h/2,z);if(o.rx)m.rotation.x=o.rx;if(o.rz)m.rotation.z=o.rz;m.castShadow=m.receiveShadow=true;(o.p||root).add(m);return m}
function sph(r,color,x,y,z,o={}){const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),mat(color,o));m.position.set(x,y,z);m.castShadow=true;(o.p||root).add(m);return m}
function grp(x=0,y=0,z=0,ry=0,p=root){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;p.add(g);return g}
function texText(lines,{w=512,h=128,bg='#fff',fg='#111',font='bold 64px "Noto Sans KR",sans-serif',align='center',border=null,lh=1.15}={}){
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  if(bg){x.fillStyle=bg;x.fillRect(0,0,w,h)}if(border){x.strokeStyle=border;x.lineWidth=h*0.06;x.strokeRect(0,0,w,h)}
  x.fillStyle=fg;x.font=font;x.textAlign=align;x.textBaseline='middle';
  const L=Array.isArray(lines)?lines:[lines];const fs=parseInt(font.match(/(\d+)px/)[1]);
  L.forEach((t,i)=>x.fillText(t,align==='center'?w/2:align==='left'?w*0.05:w*0.95,h/2+(i-(L.length-1)/2)*fs*lh));
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function sign(text,w,h,x,y,z,ry=0,o={}){const t=texText(text,{w:Math.round(512*Math.max(1,w/h)/2),h:256,font:`bold ${o.fs||150}px ${o.ff||'"Noto Sans KR",sans-serif'}`,...o});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:0.6,transparent:o.bg===null,alphaTest:o.bg===null?0.1:0,emissive:o.glow?new THREE.Color('#fff'):new THREE.Color('#000'),emissiveMap:o.glow?t:null,emissiveIntensity:o.glow?0.6:0}));
  m.position.set(x,y,z);m.rotation.y=ry;(o.p||root).add(m);m.userData.noEdge=true;return m}
function canvasTex(draw,w=512,h=512,rep=[1,1]){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...rep);t.colorSpace=THREE.SRGBColorSpace;return t}
const TEX={};
function tile(c1,c2,n=8,rep=[4,4],grout=null){const k='t'+c1+c2+n+rep+grout;return TEX[k]||(TEX[k]=canvasTex((x,w,h)=>{const s=w/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){x.fillStyle=(i+j)%2?c1:c2;x.fillRect(i*s,j*s,s,s)}if(grout){x.strokeStyle=grout;x.lineWidth=3;for(let i=0;i<=n;i++){x.beginPath();x.moveTo(i*s,0);x.lineTo(i*s,h);x.stroke();x.beginPath();x.moveTo(0,i*s);x.lineTo(w,i*s);x.stroke()}}},512,512,rep))}
function planks(c,rep=[4,4]){const k='p'+c+rep;return TEX[k]||(TEX[k]=canvasTex((x,w,h)=>{x.fillStyle=c;x.fillRect(0,0,w,h);const rows=8;for(let i=0;i<rows;i++){const y=i*h/rows;x.fillStyle=`rgba(0,0,0,${0.03+((i*37)%5)*0.012})`;x.fillRect(0,y,w,h/rows);x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,y,w,2);const off=(i%2)*w/3;for(let k=0;k<3;k++)x.fillRect(off+k*w/1.5,y,2,h/rows)}},512,512,rep))}
function bricks(c,m='#cfc6bb',rep=[4,4]){const k='b'+c+m+rep;return TEX[k]||(TEX[k]=canvasTex((x,w,h)=>{x.fillStyle=m;x.fillRect(0,0,w,h);const bh=h/16,bw=w/6;for(let r=0;r<16;r++)for(let i=-1;i<7;i++){const off=r%2?bw/2:0;const v=((r*7+i*13)%9)/60;x.fillStyle=shade(c,v-0.07);x.fillRect(i*bw+off+2,r*bh+2,bw-4,bh-4)}},512,512,rep))}
function tatami(rep=[2,2]){return TEX.tat||(TEX.tat=canvasTex((x,w,h)=>{x.fillStyle='#cdbf86';x.fillRect(0,0,w,h);x.strokeStyle='rgba(90,80,40,.25)';for(let i=0;i<h;i+=5){x.beginPath();x.moveTo(0,i);x.lineTo(w,i);x.stroke()}x.fillStyle='#3f5a2e';x.fillRect(0,0,w,10);x.fillRect(0,h-10,w,10)},512,512,rep))}
function zebra(){return TEX.zb||(TEX.zb=canvasTex((x,w,h)=>{x.fillStyle='#4a4d52';x.fillRect(0,0,w,h);x.fillStyle='#f2f2f2';for(let i=0;i<8;i++)x.fillRect(i*w/8+w/32,0,w/16,h)},512,256,[1,1]))}
function asphalt(rep){const k='as'+rep;return TEX[k]||(TEX[k]=canvasTex((x,w,h)=>{x.fillStyle='#55585d';x.fillRect(0,0,w,h);for(let i=0;i<3000;i++){x.fillStyle=`rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},.04)`;x.fillRect(Math.random()*w,Math.random()*h,2,2)}},256,256,rep))}
function shade(hex,v){const c=new THREE.Color(hex);c.offsetHSL(0,0,v);return '#'+c.getHexString()}
function texMat(t,o={}){return new THREE.MeshStandardMaterial({map:t,roughness:o.r??0.85,color:o.color||'#fff'})}
function floor(w,d,t,x=0,z=0,y=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),typeof t==='string'?mat(t):texMat(t));m.rotation.x=-Math.PI/2;m.position.set(x,y+0.001,z);m.receiveShadow=true;root.add(m);m.userData.noEdge=true;return m}
async function asset(name){
  if(!cache[name])cache[name]=loader.loadAsync(ASSET+name+'.glb').then(g=>g.scene);
  const o=(await cache[name]).clone(true);
  o.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;if(m.material){m.material=m.material.clone();if(m.material.map)m.material.map.colorSpace=THREE.SRGBColorSpace}}});
  return o;
}
async function put(name,{x=0,y=0,z=0,ry=0,h,l,w,k:kk,sz,p}={}){
  const o=await asset(name);const b=new THREE.Box3().setFromObject(o),s=b.getSize(new V3()),c=b.getCenter(new V3());
  o.position.set(-c.x,-b.min.y,-c.z);const g=new THREE.Group();g.add(o);
  if(sz)g.scale.set(sz[0]/Math.max(s.x,1e-6),sz[1]/Math.max(s.y,1e-6),sz[2]/Math.max(s.z,1e-6));
  else{const k=kk||(h?h/s.y:l?l/Math.max(s.x,s.z):w?w/s.x:1);g.scale.setScalar(k)}g.position.set(x,y,z);g.rotation.y=ry;(p||root).add(g);return g;
}
function rnd(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return s/2147483647}}

/* ================= 테마 ================= */
const TX={
  kr:{font:'"Noto Sans KR",sans-serif',classSign:'2학년 3반',class2:'2학년 4반',class1:'2학년 2반',store:'24시 편의점',store2:'행복마트',menu:['오늘의 급식','제육볶음 · 미역국','깍두기 · 쌀밥'],
    board:['자습','떠들면 이름 적음'],slogan:'꿈을 향해 한 걸음',shops:['분식','PC방','치킨','노래방','약국','카페','세탁소','미용실','부동산','편의점'],exit:'비상구',park:'어린이공원',bus:'버스 정류장',roof:'옥상 출입 금지',toilet:'화장실',
    posters:['학원 원생 모집','분리수거 철저'],wall:'#e9e3d6',roofCol:'#8b3a2e',street:'#c9c2b6'},
  jp:{font:'"Noto Sans KR",sans-serif',classSign:'2年3組',class2:'2年4組',class1:'2年2組',store:'コンビニ',store2:'スーパー',menu:['本日の給食','カレーライス','牛乳 · サラダ'],
    board:['日直','静かに！'],slogan:'一期一会',shops:['ラーメン','本屋','喫茶店','居酒屋','薬局','パン屋','花屋','カラオケ','寿司','タバコ'],exit:'非常口',park:'さくら公園',bus:'バス停',roof:'立入禁止',toilet:'トイレ',
    posters:['部員募集中','廊下を走るな'],wall:'#ece6d8',roofCol:'#46505e',street:'#cfcac1'},
  west:{font:'"Noto Sans KR",sans-serif',classSign:'Room 203',class2:'Room 204',class1:'Room 202',store:'MINI MART',store2:'DELI',menu:['TODAY\'S LUNCH','Pizza · Salad','Milk · Apple'],
    board:['HOMEWORK','p.42 #1-10'],slogan:'Dream Big',shops:['DINER','BOOKS','COFFEE','BAR','PHARMACY','BAKERY','FLOWERS','ARCADE','PIZZA','LAUNDRY'],exit:'EXIT',park:'CITY PARK',bus:'BUS STOP',roof:'NO ENTRY',toilet:'RESTROOM',
    posters:['Join the Club!','No Running'],wall:'#e7e1d7',roofCol:'#5b4636',street:'#cbc6bd'}
};

/* ================= 장소 ================= */
// 공통: 방(바닥 · 벽 · 천장), 창문 벽
function room(w,d,h,{floorTex,wall='#eee',ceil='#f6f6f2',open=[]}={}){
  floor(w,d,floorTex||'#bbb');
  const c=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat(ceil,{side:THREE.DoubleSide}));c.rotation.x=Math.PI/2;c.position.y=h;root.add(c);c.userData.noEdge=true;
  const W=(len,x,z,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(len,h),mat(wall,{side:THREE.DoubleSide}));m.position.set(x,h/2,z);m.rotation.y=ry;m.receiveShadow=true;root.add(m);m.userData.noEdge=true;return m};
  const walls={};
  if(!open.includes('n'))walls.n=W(w,0,-d/2,0);if(!open.includes('s'))walls.s=W(w,0,d/2,Math.PI);
  if(!open.includes('w'))walls.w=W(d,-w/2,0,Math.PI/2);if(!open.includes('e'))walls.e=W(d,w/2,0,-Math.PI/2);
  // 걸레받이 · 천장 몰딩 선 (선화에서 공간감)
  [['n',w,0,-d/2+0.01,0],['s',w,0,d/2-0.01,0],['w',d,-w/2+0.01,0,Math.PI/2],['e',d,w/2-0.01,0,Math.PI/2]].forEach(([k,l,x,z,ry])=>{if(walls[k]){box(l,0.1,0.02,'#8a7d6b',x,0,z,{ry});box(l,0.05,0.02,'#ddd',x,h-0.05,z,{ry})}});
  return walls;
}
function windowRow(axis,fixed,from,to,{y=0.9,h=1.5,n=4,frame='#9aa3ab',sill=true,curtain=null}={}){
  // 창문: 벽면에 프레임 + 유리 + 창살
  const len=(to-from)/n;for(let i=0;i<n;i++){const c=from+len*(i+0.5),fw=len*0.86;
    const g=grp(axis==='x'?c:fixed,y,axis==='x'?fixed:c,axis==='x'?0:Math.PI/2);
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(fw,h),new THREE.MeshStandardMaterial({color:'#bfe6ff',transparent:true,opacity:0.35,roughness:0.1,emissive:'#9ccfff',emissiveIntensity:0.35}));glass.position.y=h/2;g.add(glass);glass.userData.noEdge=true;
    box(fw,0.06,0.08,frame,0,0,0,{p:g});box(fw,0.06,0.08,frame,0,h-0.06,0,{p:g});box(0.06,h,0.08,frame,-fw/2,0,0,{p:g});box(0.06,h,0.08,frame,fw/2,0,0,{p:g});box(0.04,h,0.06,frame,0,0,0,{p:g});
    if(sill)box(fw+0.1,0.04,0.2,'#d8d2c5',0,-0.04,0.06,{p:g});
    if(curtain){box(fw*0.22,h+0.2,0.05,curtain,-fw/2+fw*0.11,-0.05,0.12,{p:g});box(fw*0.22,h+0.2,0.05,curtain,fw/2-fw*0.11,-0.05,0.12,{p:g})}
  }
}
function door(x,z,ry,{w=0.9,h=2.1,color='#8b6b4a',glass=true,label=null,T}={}){const g=grp(x,0,z,ry);box(w,h,0.06,color,0,0,0,{p:g});box(w+0.12,0.08,0.1,'#6d5b45',0,h,0,{p:g});
  if(glass){const gl=new THREE.Mesh(new THREE.PlaneGeometry(w*0.4,0.5),mat('#cfe9ff',{t:0.6}));gl.position.set(0,1.55,0.035);g.add(gl)}
  box(0.04,0.04,0.08,'#ccc',w*0.38,1.0,0.04,{p:g});
  if(label)sign(label,0.6,0.22,0,h+0.3,0.06,0,{p:g,bg:'#fff',border:'#333',fs:110});return g}
function lightsCeil(w,d,h,nx,nz){for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const x=-w/2+w*(i+0.5)/nx,z=-d/2+d*(j+0.5)/nz;const m=box(0.25,0.06,1.2,'#fff',x,h-0.07,z);m.material=new THREE.MeshStandardMaterial({color:'#fff',emissive:'#fffbe8',emissiveIntensity:1.2})}}
function deskKR(x,z,ry,col='#b98a55'){const g=grp(x,0,z,ry);box(0.65,0.03,0.48,col,0,0.72,0,{p:g});box(0.6,0.12,0.42,'#7f8a92',0,0.6,0,{p:g});[[-.29,-.2],[.29,-.2],[-.29,.2],[.29,.2]].forEach(([a,b])=>cyl(0.015,0.015,0.6,'#666',a,0,b,{p:g,seg:6}));
  const c=grp(0,0,0.45,0,g);box(0.4,0.03,0.38,col,0,0.43,0,{p:c});box(0.4,0.32,0.03,col,0,0.6,0.18,{p:c});[[-.18,-.16],[.18,-.16],[-.18,.16],[.18,.16]].forEach(([a,b])=>cyl(0.013,0.013,0.43,'#666',a,0,b,{p:c,seg:6}));return g}
function shelf(x,z,ry,w,h,d,col,levels){const g=grp(x,0,z,ry);box(w,h,0.03,col,0,0,-d/2,{p:g});box(0.03,h,d,col,-w/2,0,0,{p:g});box(0.03,h,d,col,w/2,0,0,{p:g});for(let i=0;i<=levels;i++)box(w,0.03,d,col,0,i*h/levels-(i===levels?0.03:0),0,{p:g});return g}
function books(p,w,y,d,r){let x=-w/2+0.03;while(x<w/2-0.05){const bw=0.025+r()*0.03,bh=0.18+r()*0.1;box(bw,bh,d*0.8,['#c0392b','#2c3e50','#27ae60','#f1c40f','#8e44ad','#d35400','#7f8c8d','#2980b9'][Math.floor(r()*8)],x+bw/2,y,0,{p});x+=bw+0.004}}
function tree(x,z,s=1){const g=grp(x,0,z);cyl(0.12*s,0.16*s,2.2*s,'#6b4b2e',0,0,0,{p:g,seg:8});[[0,2.6,0,1.1],[0.5,2.3,0.2,0.8],[-0.5,2.4,-0.1,0.85],[0.1,3.1,-0.3,0.8]].forEach(([a,b,c,r])=>sph(r*s,'#4f8a3b',a*s,b*s,c*s,{p:g}));return g}
function sakura(x,z,s=1){const g=grp(x,0,z);cyl(0.12*s,0.18*s,2.2*s,'#5a3d2b',0,0,0,{p:g,seg:8});[[0,2.6,0,1.2],[0.7,2.4,0.2,0.9],[-0.7,2.5,-0.1,0.9],[0.1,3.2,-0.3,0.85]].forEach(([a,b,c,r])=>sph(r*s,'#f4b6c9',a*s,b*s,c*s,{p:g}));return g}
function pole(x,z,{wires=true,h=9,T='kr'}={}){const g=grp(x,0,z);cyl(0.13,0.17,h,'#9a9a95',0,0,0,{p:g,seg:10});box(1.6,0.1,0.1,'#777',0,h-0.8,0,{p:g});box(1.2,0.1,0.1,'#777',0,h-1.4,0,{p:g});
  cyl(0.18,0.18,0.5,'#888',0.35,h-2.3,0.15,{p:g});if(T==='jp')sign('電柱 12',0.18,0.6,0,2.2,0.17,0,{p:g,bg:'#fff',fs:90});else sign('한전 3-12',0.2,0.6,0,2.2,0.17,0,{p:g,bg:'#fff',fs:80});return g}
function wire(a,b,sag=0.6,color='#222'){const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(new V3(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-Math.sin(Math.PI*t)*sag,a.z+(b.z-a.z)*t))}const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color}));root.add(l);l.userData.isWire=true}
function streetLamp(x,z,ry=0,h=6){const g=grp(x,0,z,ry);cyl(0.07,0.1,h,'#555',0,0,0,{p:g,seg:8});box(0.06,0.06,1.0,'#555',0,h,0.45,{p:g});const head=box(0.3,0.1,0.5,'#666',0,h-0.08,0.95,{p:g});lampLights.push({obj:head,pos:new V3(x,h-0.2,z)});return g}
function vending(x,z,ry,col='#d9262c'){const g=grp(x,0,z,ry);box(1.0,1.83,0.75,col,0,0,0,{p:g});const f=new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.7),new THREE.MeshStandardMaterial({color:'#eef',emissive:'#fff',emissiveIntensity:0.6}));f.position.set(0,1.35,0.38);g.add(f);
  const r=rnd(7);for(let i=0;i<3;i++)for(let j=0;j<6;j++)box(0.08,0.16,0.02,['#e74c3c','#3498db','#f1c40f','#2ecc71','#ecf0f1'][Math.floor(r()*5)],-0.32+j*0.128,1.08+i*0.22,0.39,{p:g});box(0.6,0.15,0.05,'#222',0,0.25,0.38,{p:g});return g}
function acUnit(x,y,z,ry,p=root){const g=grp(x,y,z,ry,p);box(0.8,0.55,0.3,'#e8e8e8',0,0,0,{p:g});cyl(0.2,0.2,0.02,'#555',0.1,0.27,0.16,{p:g,rx:Math.PI/2});return g}
function bench(x,z,ry){return put('bench',{x,z,ry,l:1.6})}
function car(name,x,z,ry,l=4.4){return put(name,{x,z,ry,l})}
function trafficLight(x,z,ry,T){const g=grp(x,0,z,ry);cyl(0.09,0.11,5.2,'#5b5f63',0,0,0,{p:g,seg:10});
  if(T==='west'){box(0.12,0.12,1.4,'#5b5f63',0,5,0.7,{p:g});const hd=grp(0,3.9,1.35,0,g);box(0.35,1.0,0.3,'#2b2f33',0,0,0,{p:hd});[['#e53935',0.8],['#fbc02d',0.5],['#43a047',0.2]].forEach(([c,y])=>sph(0.1,c,0,y,0.16,{p:hd,m:0}))}
  else{box(0.1,0.1,2.6,'#5b5f63',0,5,1.3,{p:g});const hd=grp(0,4.75,2.2,0,g);box(1.1,0.35,0.3,'#2b2f33',0,0,0,{p:hd});[['#e53935',-0.35],['#fbc02d',0],['#43a047',0.35]].forEach(([c,xx])=>sph(0.11,c,xx,0.17,0.16,{p:hd}))}
  const pd=grp(0,2.4,0.12,0,g);box(0.3,0.55,0.15,'#2b2f33',0,0,0,{p:pd});sph(0.07,'#e53935',0,0.38,0.08,{p:pd});sph(0.07,'#43a047',0,0.16,0.08,{p:pd});return g}
async function cityBlock(x,z,ry,T,seed,{w=14,d=12,floors=4,kind='shop'}={}){
  // 건물: 1층 상가 + 위층 창문 + 간판
  const r=rnd(seed),g=grp(x,0,z,ry),fh=3.1,h=fh*floors;
  const col=T==='west'?['#a4553f','#b86b4c','#8c7a6b','#c9b79c'][seed%4]:T==='jp'?['#d8d2c7','#c4c9cf','#e0d6c2','#b9b2a6'][seed%4]:['#d9cfc0','#c8c2b8','#e3dccd','#b7a99a'][seed%4];
  const bm=T==='west'?texMat(bricks(col,'#d8cfc4',[w/3,h/3])):mat(col);
  box(w,h,d,col,0,0,0,{p:g,mat:bm});
  // 1층 유리 상가
  const sf=new THREE.Mesh(new THREE.PlaneGeometry(w*0.9,2.4),new THREE.MeshStandardMaterial({color:'#9fc4d8',roughness:0.15,metalness:0.2,emissive:'#d9ecff',emissiveIntensity:0.25}));sf.position.set(0,1.3,d/2+0.01);g.add(sf);sf.userData.noEdge=false;
  for(let i=0;i<=6;i++)box(0.08,2.5,0.06,'#444',-w*0.45+i*w*0.15,0.05,d/2+0.03,{p:g});
  // 간판
  const shops=TX[T].shops,name=shops[seed%shops.length];const sc=['#e53935','#1e88e5','#fb8c00','#43a047','#6a1b9a','#00897b'][seed%6];
  sign(name,w*0.75,0.9,0,3.0,d/2+0.08,0,{p:g,bg:sc,fg:'#fff',fs:150,ff:TX[T].font,glow:true});
  // 위층 창문
  for(let f=1;f<floors;f++)for(let i=0;i<4;i++){const wx=-w*0.36+i*w*0.24;const wm=new THREE.Mesh(new THREE.PlaneGeometry(w*0.15,1.4),mat('#9db8c9',{r:0.2}));wm.position.set(wx,f*fh+1.5,d/2+0.01);g.add(wm);
    box(w*0.17,0.08,0.12,'#ddd',wx,f*fh+0.75,d/2,{p:g});
    if(T==='kr'&&r()<0.5)acUnit(wx+w*0.09,f*fh+0.6,d/2+0.2,0,g);
    if(T==='kr'&&f===1&&i===1)sign(shops[(seed+3)%shops.length],w*0.15,1.2,wx,f*fh+1.5,d/2+0.02,0,{p:g,bg:'#fff',fg:sc,fs:90,ff:TX[T].font});}
  if(T==='kr'||T==='jp'){for(let f=1;f<floors;f++)sign(shops[(seed+f+5)%shops.length],0.6,2.0,w/2+0.35,f*fh+0.6,d/2-0.4,Math.PI/2,{p:g,bg:['#fff','#ffeb3b','#e3f2fd'][f%3],fg:sc,fs:120,ff:TX[T].font})}
  if(T==='west'){for(let f=1;f<floors;f++){box(w*0.5,0.06,1.0,'#333',w*0.15,f*fh,d/2+0.5,{p:g});for(let i=0;i<8;i++)box(0.03,0.9,0.03,'#333',w*0.15-w*0.25+i*w*0.071,f*fh,d/2+0.98,{p:g})}}
  box(w+0.2,0.3,d+0.2,shade(col,-0.15),0,h,0,{p:g});
  return g;
}

const PLACES={
async classroom(T){
  const W=9,D=8,H=3;room(W,D,H,{floorTex:planks('#b48a5a',[6,6]),wall:TX[T].wall});
  windowRow('z',W/2-0.02,-D/2+0.5,D/2-0.5,{n:4,y:0.9,h:1.6,curtain:T==='kr'?'#d9e8d0':T==='jp'?'#f2efe6':'#c9d6e8'});
  // 칠판
  const bc=T==='west'?'#f5f7f8':'#2f5d46';box(4.2,1.25,0.06,'#6b5a45',0,0.85,-D/2+0.03);
  const bm=new THREE.Mesh(new THREE.PlaneGeometry(4.0,1.1),new THREE.MeshStandardMaterial({map:texText(TX[T].board,{w:1024,h:280,bg:bc,fg:T==='west'?'#1e3a8a':'#f7f7f2',font:`bold 90px ${TX[T].font}`,align:'left'}),roughness:0.9}));bm.position.set(0,1.475,-D/2+0.065);root.add(bm);bm.userData.noEdge=true;
  box(4.2,0.05,0.12,'#6b5a45',0,0.82,-D/2+0.08);
  // 교탁
  box(1.0,1.05,0.55,'#8b6b4a',0,0,-D/2+1.3);
  // 학생 책상
  for(let i=0;i<5;i++)for(let j=0;j<4;j++)deskKR(-3.2+i*1.6,-1.6+j*1.35,Math.PI,T==='west'?'#c8a87a':'#b98a55');
  // 뒤쪽 사물함
  for(let i=0;i<10;i++){box(0.85,1.1,0.45,T==='west'?'#5f7d95':'#d8d1c0',-3.85+i*0.86,0,D/2-0.25);box(0.06,0.1,0.02,'#888',-3.85+i*0.86+0.3,0.7,D/2-0.47)}
  // 시계 · 게시판 · 액자
  cyl(0.22,0.22,0.04,'#fff',-3.2,2.35,-D/2+0.04,{rx:Math.PI/2});cyl(0.24,0.24,0.03,'#333',-3.2,2.35,-D/2+0.02,{rx:Math.PI/2});
  sign(TX[T].slogan,1.6,0.5,0,2.55,-D/2+0.03,0,{bg:'#fff',border:'#7a5',fs:120,ff:TX[T].font});
  const bb=box(2.4,1.2,0.04,'#b88b5a',0,1.1,D/2-0.47);sign(TX[T].posters,1.6,0.9,-0.4,1.7,D/2-0.5,Math.PI,{bg:'#fffbe6',fs:70,ff:TX[T].font,w:512,h:512});
  door(-W/2+0.03,-D/2+1.2,Math.PI/2,{label:TX[T].classSign});door(-W/2+0.03,D/2-1.2,Math.PI/2);
  lightsCeil(W,D,H,3,3);
  if(T==='jp')box(0.4,0.6,0.3,'#ddd',W/2-0.4,2.2,-D/2+0.2);// 스피커
  await put('plant',{x:W/2-0.6,z:-D/2+0.6,h:1.1});
  return {cam:[3.6,1.45,3.4],tgt:[-1,1.2,-2.5],indoor:true};
},
async hallway(T){
  const W=3.2,D=34,H=3.1;room(W,D,H,{floorTex:T==='west'?tile('#d7d2c8','#bfb8ab',8,[2,20]):planks('#c7a77a',[2,24]),wall:TX[T].wall});
  windowRow('z',W/2-0.02,-D/2+1,D/2-1,{n:9,y:1.0,h:1.4});
  const cls=[TX[T].class1,TX[T].classSign,TX[T].class2];
  for(let i=0;i<3;i++){const z=-10+i*10;door(-W/2+0.03,z-2.5,Math.PI/2,{w:1.0,label:i===1?cls[1]:null});door(-W/2+0.03,z+2.5,Math.PI/2,{w:1.0});
    sign(cls[i],0.15,0.35,-W/2+0.25,2.6,z-2.5,0,{bg:'#fff',border:'#333',fs:40,w:128,h:256,ff:TX[T].font});
    const pl=sign(cls[i],1.0,0.3,-W/2+0.32,2.55,z-2.5,Math.PI/2,{bg:'#fff',border:'#333',fs:110,ff:TX[T].font});
    // 복도 창 (교실 쪽)
    const g=new THREE.Mesh(new THREE.PlaneGeometry(3,0.9),mat('#cfe5f5',{t:0.5}));g.position.set(-W/2+0.02,2.1,z);g.rotation.y=Math.PI/2;root.add(g)}
  if(T==='west')for(let i=0;i<3;i++)for(let k=0;k<6;k++){const z=-10+i*10-1.5+k*0.6;box(0.42,1.75,0.56,['#3b6e9e','#c94c4c'][i%2],-W/2+0.22,0,z);box(0.02,0.2,0.4,'#2a4d6e',-W/2+0.44,1.4,z)}
  if(T==='jp'){for(let i=0;i<8;i++)box(0.5,1.6,0.35,'#d8d1c0',-W/2+0.2,0,13+(i%2)*0.5-(i>3?1.2:0))}
  box(0.18,0.5,0.18,'#d32f2f',W/2-0.15,0,3);sign(TX[T].exit,0.7,0.25,0,2.8,-D/2+0.02,0,{bg:'#1b8f3a',fg:'#fff',fs:120,glow:true,ff:TX[T].font});
  sign(TX[T].toilet,0.9,0.28,-W/2+0.32,2.55,14,Math.PI/2,{bg:'#e3f2fd',fs:100,ff:TX[T].font});
  lightsCeil(W,D,H,1,8);
  return {cam:[0.6,1.5,15],tgt:[-0.2,1.3,0],indoor:true};
},
async bedroom(T){
  const W=4.2,D=4.4,H=2.5;
  const ft=T==='jp'?tatami([3,3]):T==='kr'?planks('#d9b77e',[5,5]):planks('#9a6b43',[5,5]);
  room(W,D,H,{floorTex:ft,wall:T==='jp'?'#efe8d8':T==='kr'?'#f3efe6':'#dfe6ea'});
  windowRow('x',-D/2+0.02,-1.4,1.4,{n:2,y:0.9,h:1.3,curtain:T==='west'?'#7a8fb8':'#e8d6c0'});
  if(T==='jp'){ // 이불 + 낮은 상
    box(1.0,0.12,2.0,'#f6f3ea',-1.4,0,0.6);box(1.0,0.06,1.4,'#7aa3c7',-1.4,0.12,0.9);box(0.6,0.12,0.35,'#fff',-1.4,0.12,-0.25);
    box(1.0,0.35,0.7,'#8b5e3c',0.6,0,0.6);box(0.5,0.08,0.5,'#c94',0.6,0,1.3);
    box(1.8,2.3,0.6,'#e9e0c9',1.2,0,-D/2+0.3);for(let i=0;i<2;i++)box(0.86,2.2,0.02,'#f6f1e3',0.75+i*0.9,0.05,-D/2+0.61);
  }else{
    // 침대
    const bx=-1.25,bz=0.7;box(1.1,0.35,2.05,'#7b5b3e',bx,0,bz);box(1.0,0.2,1.95,'#f4f4f4',bx,0.35,bz);box(1.02,0.08,1.4,T==='kr'?'#9cc3a8':'#3d5a80',bx,0.55,bz+0.3);box(0.6,0.12,0.35,'#fff',bx,0.57,bz-0.7);box(1.1,0.9,0.06,'#7b5b3e',bx,0,bz-1.02);
    // 책상 + 의자 + 모니터
    box(1.2,0.04,0.6,'#e0d6c5',1.3,0.72,-D/2+0.35);box(0.04,0.72,0.55,'#bbb',0.72,0,-D/2+0.35);box(0.04,0.72,0.55,'#bbb',1.88,0,-D/2+0.35);
    box(0.55,0.33,0.03,'#111',1.3,0.85,-D/2+0.2);box(0.08,0.12,0.08,'#333',1.3,0.76,-D/2+0.2);box(0.45,0.02,0.15,'#333',1.3,0.76,-D/2+0.45);
    const ch=grp(1.3,0,-D/2+0.95);box(0.48,0.06,0.48,'#2d2d2d',0,0.45,0,{p:ch});box(0.48,0.6,0.06,'#2d2d2d',0,0.55,0.24,{p:ch});cyl(0.03,0.03,0.42,'#555',0,0,0,{p:ch,seg:8});
    // 옷장 · 책장
    box(1.0,2.1,0.6,T==='kr'?'#f1ece2':'#8a6a4a',1.55,0,D/2-0.3);box(0.02,2.0,0.01,'#999',1.55,0.05,D/2-0.61);
    const sh=shelf(-W/2+0.2,-1.0,Math.PI/2,0.9,1.8,0.3,'#c9a87a',4);const r=rnd(3);for(let i=0;i<4;i++){const p=grp(0,i*0.45+0.03,0,0,sh);books(p,0.85,0,0.28,r)}
    sign(T==='kr'?'아이돌 포스터':T==='west'?'ROCK TOUR':'',0.6,0.85,-W/2+0.01,1.6,1.2,Math.PI/2,{bg:'#ff7aa2',fg:'#fff',fs:60});
    box(1.4,0.01,1.0,T==='kr'?'#e6c7a8':'#b44',0.2,0,0.6);
  }
  box(0.25,0.4,0.25,'#f3e3c3',-W/2+0.4,0,-D/2+0.4);
  const lp=box(0.4,0.06,0.4,'#fff',0,H-0.07,0);lp.material=new THREE.MeshStandardMaterial({color:'#fff',emissive:'#fff6dd',emissiveIntensity:1});
  door(W/2-0.03,1.4,-Math.PI/2,{glass:false,color:'#e8e0d0'});
  await put('plant',{x:W/2-0.4,z:-D/2+0.4,h:0.9});
  return {cam:[1.6,1.5,1.9],tgt:[-1,0.9,-0.8],indoor:true};
},
async store(T){
  const W=10,D=8,H=3;room(W,D,H,{floorTex:tile('#eceae6','#dedbd5',8,[5,4],'#c9c5be'),wall:'#f7f7f5',open:['s']});
  // 앞면 유리
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(W,H),mat('#cfe8f5',{t:0.25}));gl.position.set(0,H/2,D/2);root.add(gl);gl.userData.noEdge=true;
  for(let i=0;i<=5;i++)box(0.08,H,0.08,'#666',-W/2+i*W/5,0,D/2);box(W,0.1,0.1,'#666',0,H-0.1,D/2);
  // 진열대
  const r=rnd(11),cols=['#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#8e24aa','#ffffff','#795548','#ff80ab'];
  for(let k=0;k<3;k++){const z=-1.6+k*1.6,s=grp(-0.6,0,z);box(5.2,0.12,0.9,'#ddd',0,0,0,{p:s});box(5.2,1.4,0.05,'#e8e8e8',0,0.12,0,{p:s});
    for(const side of [-1,1])for(let lv=0;lv<4;lv++){box(5.2,0.03,0.4,'#cfcfcf',0,0.2+lv*0.38,side*0.22,{p:s});let x=-2.5;while(x<2.45){const bw=0.08+r()*0.12,bh=0.12+r()*0.18;box(bw,bh,0.25,cols[Math.floor(r()*cols.length)],x+bw/2,0.23+lv*0.38,side*0.24,{p:s});x+=bw+0.01}}}
  // 냉장고 벽
  for(let i=0;i<6;i++){const x=-W/2+0.9+i*1.3;box(1.25,2.2,0.7,'#cfd8dc',x,0,-D/2+0.35);const g=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.9),new THREE.MeshStandardMaterial({color:'#e3f4ff',transparent:true,opacity:0.4,emissive:'#e8f6ff',emissiveIntensity:0.5}));g.position.set(x,1.15,-D/2+0.71);root.add(g);g.userData.noEdge=true;
    for(let lv=0;lv<4;lv++)for(let j=0;j<6;j++){const c=cols[Math.floor(r()*cols.length)];cyl(0.04,0.04,0.25,c,x-0.45+j*0.18,0.3+lv*0.45,-D/2+0.5,{seg:8})}}
  // 계산대
  box(2.6,1.0,0.7,'#455a64',W/2-1.6,0,1.8);box(0.4,0.3,0.35,'#222',W/2-1.2,1.0,1.8);box(0.35,0.25,0.03,'#9ad',W/2-1.2,1.3,1.65);
  box(2.0,1.8,0.3,'#eee',W/2-1.6,0.9,3.1);for(let i=0;i<5;i++)for(let j=0;j<8;j++)box(0.08,0.12,0.06,cols[(i*3+j)%cols.length],W/2-2.5+j*0.24,1.0+i*0.32,2.95);
  sign(TX[T].store,4,0.7,0,2.55,-D/2+0.01,0,{bg:T==='kr'?'#0b8a43':T==='jp'?'#1e5bb8':'#c62828',fg:'#fff',fs:150,glow:true,ff:TX[T].font});
  lightsCeil(W,D,H,4,3);
  for(const n of ['soda-bottle','can','bottle','carton'])for(let i=0;i<3;i++)await put(n,{x:W/2-2.2+i*0.25,y:1.0,z:1.6+(n.length%3)*0.1,h:0.22});
  return {cam:[3.8,1.6,3.2],tgt:[-1.5,1.1,-1.8],indoor:true};
},
async alley(T){
  const L=40;floor(4.2,L,asphalt([1,20]),0,0);
  floor(80,80,'#6b6f72',0,0,-0.01);
  const r=rnd(5);
  for(const side of [-1,1])for(let i=0;i<5;i++){const z=-16+i*8+(side>0?2:0),x=side*(2.1+4);
    if(T==='west'){const g=grp(x,0,z,side>0?-Math.PI/2:Math.PI/2);box(8,9+r()*6,8,'#000',0,0,0,{p:g,mat:texMat(bricks(['#9c4a32','#a75b42','#7d4636'][i%3],'#cfc6bb',[3,4]))});
      for(let f=1;f<4;f++){box(3,0.06,0.9,'#2b2b2b',0,f*3,4.45,{p:g});for(let k=0;k<6;k++)box(0.03,0.9,0.03,'#2b2b2b',-1.5+k*0.6,f*3,4.88,{p:g})}
      for(let f=0;f<4;f++)for(let k=0;k<3;k++){const w=new THREE.Mesh(new THREE.PlaneGeometry(1,1.5),mat('#8fb0c2',{r:0.2}));w.position.set(-2.5+k*2.5,f*3+1.6,4.01);g.add(w)}}
    else{const g=grp(x,0,z,side>0?-Math.PI/2:Math.PI/2);const h=T==='kr'?9+r()*4:6+r()*2;
      box(7.6,h,7.6,T==='kr'?['#d7cbbb','#c9bda9','#e1d5c3','#bfb3a2'][i%4]:['#e2dcd0','#cfc9bd','#d8d2c4'][i%3],0,0,0,{p:g});
      if(T==='jp'){const rf=new THREE.Mesh(new THREE.ConeGeometry(6,1.6,4),mat(TX.jp.roofCol));rf.position.y=h+0.8;rf.rotation.y=Math.PI/4;g.add(rf);box(7.6,1.8,0.2,'#d8d2c4',0,0,3.95,{p:g})}
      for(let f=0;f<Math.floor(h/3);f++)for(let k=0;k<2;k++){const wx=-1.8+k*3.6;const w=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.2),mat('#93aebd',{r:0.2}));w.position.set(wx,f*3+1.6,3.81);g.add(w);
        if(T==='kr'){box(1.6,0.6,0.3,'#d0d0d0',wx,f*3+0.7,3.95,{p:g});if(f>0)acUnit(wx+1.2,f*3+0.3,4.1,0,g)}
        if(T==='jp'&&f===1)box(1.6,0.05,0.5,'#888',wx,f*3+0.9,4.05,{p:g})}
      if(T==='kr'){cyl(0.04,0.04,h,'#c0a050',3.4,0,3.85,{p:g,seg:6});box(1.2,0.25,0.06,'#1e3a6e',-2.6,2.6,3.84,{p:g});sign(['101동','빌라','주차금지'][i%3],1.4,0.4,1.6,2.4,3.84,0,{p:g,bg:'#1e3a6e',fg:'#fff',fs:120})}
      if(T==='jp')sign(['田中','佐藤','鈴木','高橋'][i%4],0.35,0.6,2.8,1.7,3.84,0,{p:g,bg:'#fff',fs:110,w:256,h:512})}}
  // 소품
  if(T!=='west'){for(let i=0;i<4;i++){pole(1.85,-15+i*10,{T});}for(let i=0;i<3;i++){const a=new V3(1.85,8.2,-15+i*10),b=new V3(1.85,8.2,-5+i*10);wire(a,b,0.5);wire(a.clone().setY(7.6),b.clone().setY(7.6),0.6)}}
  if(T==='jp'){vending(-1.7,2,Math.PI/2);vending(-1.7,3.1,Math.PI/2,'#1e5bb8')}
  if(T==='kr'){box(0.6,1.1,0.6,'#d32f2f',-1.8,0,-3);sign('우체통',0.4,0.12,-1.49,0.9,-3,Math.PI/2,{bg:'#d32f2f',fg:'#fff',fs:110});for(let i=0;i<5;i++)box(0.45,0.7,0.45,['#2e7d32','#1565c0','#f9a825'][i%3],1.7,0,6+i*0.5)}
  if(T==='west'){box(1.8,1.2,1.0,'#2e5d3a',-1.6,0,4);box(1.9,0.1,1.05,'#244a2e',-1.6,1.2,4);streetLamp(1.9,-8,Math.PI/2)}
  await car(T==='west'?'sedan':'hatchback',1.0,-6,0.05,3.9);
  return {cam:[0.4,1.6,14],tgt:[0,2.2,0],indoor:false};
},
async crossroad(T){
  const RW=12,SW=4;
  // 도로 · 인도
  floor(120,RW,asphalt([30,3]),0,0);floor(RW,120,asphalt([3,30]),0,0,0.002);
  for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const c=RW/2+30;box(60,0.15,60,T==='west'?'#bdb7ad':TX[T].street,sx*c,0,sz*c,{mat:texMat(tile(T==='kr'?'#c9b9a6':'#c8c3ba',T==='kr'?'#b9a691':'#bab4aa',8,[15,15]))});box(60,0.16,0.25,'#999',sx*c,0,sz*(RW/2+0.12),{});box(0.25,0.16,60,'#999',sx*(RW/2+0.12),0,sz*c)}
  // 횡단보도 · 차선
  const zb=zebra();const mk=(x,z,w,d,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({map:zb,roughness:0.9}));m.rotation.x=-Math.PI/2;m.rotation.z=ry;m.position.set(x,0.006,z);root.add(m);m.userData.noEdge=true};
  mk(0,RW/2+2.2,RW,3.2,0);mk(0,-RW/2-2.2,RW,3.2,0);mk(RW/2+2.2,0,RW,3.2,Math.PI/2);mk(-RW/2-2.2,0,RW,3.2,Math.PI/2);
  const lineCol=T==='kr'?'#f2c230':'#f5f5f5';
  for(const s of [1,-1]){box(50,0.01,0.15,lineCol,s*(RW/2+4+25),0,0);box(0.15,0.01,50,lineCol,0,0,s*(RW/2+4+25));for(let i=0;i<10;i++){box(2,0.01,0.12,'#f5f5f5',s*(RW/2+6+i*4.5),0,s*RW/4);box(0.12,0.01,2,'#f5f5f5',s*RW/4,0,s*(RW/2+6+i*4.5))}
    box(0.4,0.01,RW/2,'#f5f5f5',s*(RW/2+4.3),0,-s*RW/4);box(RW/2,0.01,0.4,'#f5f5f5',s*RW/4,0,s*(RW/2+4.3))}
  // 신호등
  trafficLight(RW/2+0.8,RW/2+0.8,-Math.PI/2,T);trafficLight(-RW/2-0.8,-RW/2-0.8,Math.PI/2,T);trafficLight(-RW/2-0.8,RW/2+0.8,Math.PI,T);trafficLight(RW/2+0.8,-RW/2-0.8,0,T);
  // 건물 4모퉁이
  let sd=1;for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]])for(let i=0;i<3;i++){
    await cityBlock(sx*(RW/2+SW+7),sz*(RW/2+SW+6+i*13),sx>0?-Math.PI/2:Math.PI/2,T,sd++,{w:12,d:12,floors:3+((sd*7)%4)});
    await cityBlock(sx*(RW/2+SW+6+i*13+13),sz*(RW/2+SW+7),sz>0?Math.PI:0,T,sd++,{w:12,d:12,floors:3+((sd*5)%4)});}
  // 가로등 · 전봇대 · 나무 · 정류장
  for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){streetLamp(sx*(RW/2+0.6),sz*(RW/2+9),sx>0?-Math.PI/2:Math.PI/2);if(T!=='west')pole(sx*(RW/2+9),sz*(RW/2+0.6),{T});else tree(sx*(RW/2+1.2),sz*(RW/2+14),0.9)}
  if(T!=='west'){wire(new V3(RW/2+9,8.2,RW/2+0.6),new V3(-RW/2-9,8.2,RW/2+0.6),1.2);wire(new V3(RW/2+9,8.2,-RW/2-0.6),new V3(RW/2+9,8.2,RW/2+0.6),1.0)}
  const bs=grp(RW/2+1.5,0,-RW/2-14,0);box(3,0.08,1.2,'#455a64',0,2.4,0,{p:bs});box(0.08,2.4,0.08,'#455a64',-1.4,0,-0.5,{p:bs});box(0.08,2.4,0.08,'#455a64',1.4,0,-0.5,{p:bs});box(2.8,1.6,0.04,'#cfe8f5',0,0.6,-0.55,{p:bs,t:0.4});box(2,0.08,0.4,'#795548',0,0.45,-0.3,{p:bs});sign(TX[T].bus,1.2,0.35,0,2.7,0.62,0,{p:bs,bg:'#1e88e5',fg:'#fff',fs:110,ff:TX[T].font});
  // 차량
  const cars=[['taxi',-3,-26,0],['sedan',3,22,Math.PI],['suv',-22,3,Math.PI/2],['van',26,-3,-Math.PI/2],['hatchback',-3,-40,0],['police-car',3,40,Math.PI],['k-vehicle-truck-red',-40,3,Math.PI/2]];
  for(const [n,x,z,ry] of cars)await car(n,x,z,ry,n==='k-vehicle-truck-red'?6:4.4);
  return {cam:[-1.5,1.6,RW/2+2.2],tgt:[2,2.4,-18],indoor:false};
},
async cafeteria(T){
  const W=16,D=12,H=3.4;room(W,D,H,{floorTex:tile('#e8e4dc','#d8d2c6',8,[8,6]),wall:TX[T].wall});
  windowRow('z',W/2-0.02,-D/2+1,D/2-1,{n:5,y:1.0,h:1.6});
  // 배식대
  box(9,0.95,0.8,'#b0bec5',-1,0,-D/2+1.4);box(9,0.04,0.9,'#cfd8dc',-1,0.95,-D/2+1.4);for(let i=0;i<6;i++){box(0.9,0.15,0.5,'#90a4ae',-4.8+i*1.5,0.99,-D/2+1.4);box(0.85,0.02,0.45,['#c0392b','#f1c40f','#27ae60','#e67e22','#ecf0f1','#8d6e63'][i],-4.8+i*1.5,1.13,-D/2+1.4)}
  box(9,0.06,0.5,'#cfd8dc',-1,1.6,-D/2+1.15);
  // 식판 더미
  for(let i=0;i<8;i++)box(0.45,0.02,0.32,'#c0c6cc',4.8,0.95+i*0.025,-D/2+1.4);
  // 긴 식탁
  for(let r=0;r<3;r++)for(let c=0;c<2;c++){const x=-4+c*6.5,z=-1.2+r*2.6;box(5,0.04,0.9,'#e0e0e0',x,0.74,z);for(let k=0;k<4;k++)box(0.05,0.74,0.05,'#888',x-2.3+(k%2)*4.6,0,z-0.38+(k>1?0.76:0));
    for(let s=0;s<6;s++)for(const sd of [-1,1]){cyl(0.17,0.17,0.04,'#5c6bc0',x-2+s*0.8,0.44,z+sd*0.75,{seg:12});cyl(0.02,0.02,0.44,'#777',x-2+s*0.8,0,z+sd*0.75,{seg:6})}
    for(let s=0;s<3;s++){box(0.42,0.02,0.3,'#b0bec5',x-1.6+s*1.5,0.78,z-0.2);sph(0.06,'#f5f5f5',x-1.7+s*1.5,0.82,z-0.22);}}
  sign(TX[T].menu,2.6,1.2,4,2.4,-D/2+0.02,0,{bg:'#2f5d46',fg:'#fff',fs:60,ff:TX[T].font,w:768,h:384});
  lightsCeil(W,D,H,4,3);
  return {cam:[6,1.6,4.5],tgt:[-2,1,-2.5],indoor:true};
},
async rooftop(T){
  const W=16,D=12;floor(W,D,tile('#9ea3a3','#8f9494',8,[6,5],'#7d8282'));
  floor(400,400,'#7c8a8f',0,0,-14);
  box(W,0.5,0.3,'#9ea3a3',0,0,-D/2);box(W,0.5,0.3,'#9ea3a3',0,0,D/2);box(0.3,0.5,D,'#9ea3a3',-W/2,0,0);box(0.3,0.5,D,'#9ea3a3',W/2,0,0);
  // 철망 펜스
  const fence=canvasTex((x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle='#6d7478';x.lineWidth=3;for(let i=-h;i<w;i+=24){x.beginPath();x.moveTo(i,0);x.lineTo(i+h,h);x.stroke();x.beginPath();x.moveTo(i+h,0);x.lineTo(i,h);x.stroke()}},256,256,[6,1.5]);
  const fm=new THREE.MeshStandardMaterial({map:fence,transparent:true,alphaTest:0.3,side:THREE.DoubleSide});
  for(const [x,z,l,ry] of [[0,-D/2,W,0],[0,D/2,W,0],[-W/2,0,D,Math.PI/2],[W/2,0,D,Math.PI/2]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(l,2.2),fm);m.position.set(x,1.6,z);m.rotation.y=ry;root.add(m);m.userData.noEdge=true;box(l,0.06,0.06,'#6d7478',x,2.7,z,{ry});for(let i=0;i<=l/2;i++){const t=-l/2+i*2;box(0.06,2.2,0.06,'#6d7478',x+(ry?0:t),0.5,z+(ry?t:0))}}
  // 계단실 · 물탱크 · 실외기
  box(3.5,3,3.5,'#c9c3b8',-W/2+2.2,0,-D/2+2.2);door(-W/2+2.2,-D/2+3.96,0,{glass:false,color:'#7d8b96'});sign(TX[T].roof,1.4,0.4,-W/2+2.2,2.5,-D/2+3.97,0,{bg:'#ffd600',fs:110,ff:TX[T].font});
  cyl(1.1,1.1,2.2,'#4a90c2',W/2-2,0.6,-D/2+2,{seg:24});for(let i=0;i<4;i++)box(0.1,0.6,0.1,'#666',W/2-2.7+(i%2)*1.4,0,-D/2+1.3+(i>1?1.4:0));
  for(let i=0;i<4;i++)acUnit(W/2-1.2-i*1.0,0,D/2-1.0,Math.PI);
  box(2,0.45,0.5,'#8d6e63',-1,0,2);
  // 주변 빌딩
  const r=rnd(21);for(let i=0;i<40;i++){const a=r()*Math.PI*2,d=25+r()*60;const h=8+r()*30;box(8+r()*8,h,8+r()*8,['#b0b8c0','#c8c2b8','#9aa5ae','#d6d0c4'][i%4],Math.cos(a)*d,-14,Math.sin(a)*d)}
  return {cam:[3,1.6,4],tgt:[-3,1.6,-3],indoor:false};
},
async park(T){
  floor(80,80,canvasTex((x,w,h)=>{x.fillStyle='#7bae5a';x.fillRect(0,0,w,h);for(let i=0;i<4000;i++){x.fillStyle=`rgba(${40+Math.random()*60},${100+Math.random()*80},40,.25)`;x.fillRect(Math.random()*w,Math.random()*h,2,4)}},256,256,[20,20]));
  floor(4,80,T==='jp'?'#d8c9a8':'#cdbb9a',0,0,0.003);floor(60,3,T==='jp'?'#d8c9a8':'#cdbb9a',0,8,0.004);
  const r=rnd(9);
  for(let i=0;i<22;i++){const x=(r()<.5?-1:1)*(4+r()*25),z=-35+r()*60;if(Math.abs(z-8)<3)continue;
    if(T==='jp')sakura(x,z,0.9+r()*0.5);else if(i%2)await put(r()<.5?'tree-big':'tree-small',{x,z,h:4+r()*3});else tree(x,z,0.9+r()*0.5)}
  for(let i=0;i<5;i++)await put('bench',{x:2.6,z:-12+i*5,ry:-Math.PI/2,l:1.6});
  for(let i=0;i<6;i++)streetLamp(-2.4,-14+i*6,Math.PI/2,4);
  // 분수 · 연못
  cyl(3,3,0.4,'#b8b0a4',10,0,-6,{seg:32});const wtr=new THREE.Mesh(new THREE.CircleGeometry(2.8,32),new THREE.MeshStandardMaterial({color:'#6fb6d8',roughness:0.1}));wtr.rotation.x=-Math.PI/2;wtr.position.set(10,0.36,-6);root.add(wtr);cyl(0.3,0.4,1.4,'#b8b0a4',10,0.3,-6,{seg:16});
  // 놀이터
  const pg=grp(-12,0,-4);box(0.1,2.3,0.1,'#e53935',-1.5,0,0,{p:pg});box(0.1,2.3,0.1,'#e53935',1.5,0,0,{p:pg});box(3.2,0.1,0.1,'#e53935',0,2.3,0,{p:pg});for(const s of [-0.7,0.7]){box(0.5,0.05,0.25,'#333',s,0.5,0,{p:pg});box(0.02,1.8,0.02,'#999',s-0.2,0.5,0,{p:pg});box(0.02,1.8,0.02,'#999',s+0.2,0.5,0,{p:pg})}
  const sl=grp(-12,0,2);box(1,1.6,1,'#fbc02d',0,0,0,{p:sl});const ramp=box(0.8,0.06,2.6,'#1e88e5',0,0.8,1.6,{p:sl});ramp.rotation.x=0.6;
  sign(TX[T].park,2.2,0.6,1.8,1.6,12,-Math.PI/2,{bg:'#2e7d32',fg:'#fff',fs:120,ff:TX[T].font});
  if(T==='jp'){const tg=grp(0,0,-30);box(0.35,4,0.35,'#c62828',-2,0,0,{p:tg});box(0.35,4,0.35,'#c62828',2,0,0,{p:tg});box(5.6,0.35,0.5,'#c62828',0,4,0,{p:tg});box(5,0.25,0.35,'#c62828',0,3.2,0,{p:tg})}
  return {cam:[1,1.6,16],tgt:[0,1.8,0],indoor:false};
},
async empty(T){floor(60,60,tile('#d9d9d9','#cccccc',8,[15,15]));return {cam:[0,1.6,6],tgt:[0,1,0],indoor:false}}
};
/* ================= 추가 장소 (KayKit · Kenney · pmndrs 무료 에셋 + 직접 만든 구조물) ================= */
const LB=(T,kr,jp,west)=>T==='jp'?jp:T==='west'?west:kr;
const glow=(c,i=1)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i});
function grass(rep=20){return TEX['gr'+rep]||(TEX['gr'+rep]=canvasTex((x,w,h)=>{x.fillStyle='#7bae5a';x.fillRect(0,0,w,h);for(let i=0;i<4000;i++){x.fillStyle=`rgba(${40+Math.random()*60},${100+Math.random()*80},40,.25)`;x.fillRect(Math.random()*w,Math.random()*h,2,4)}},256,256,[rep,rep]))}
function noiseTex(base,dots,rep){const k='nz'+base+dots+rep;return TEX[k]||(TEX[k]=canvasTex((x,w,h)=>{x.fillStyle=base;x.fillRect(0,0,w,h);for(let i=0;i<3500;i++){x.fillStyle=dots[i%dots.length];x.globalAlpha=0.25;x.fillRect(Math.random()*w,Math.random()*h,2,2)}x.globalAlpha=1},256,256,[rep,rep]))}
function water(w,d,x=0,z=0,y=0.02,col='#5aa6c9'){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({color:col,roughness:0.08,metalness:0.1}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;root.add(m);m.userData.noEdge=true;return m}
function monitor(x,y,z,ry,p=root,big=false){const g=grp(x,y,z,ry,p),w=big?0.7:0.55;box(w,w*0.6,0.04,'#111',0,0.12,0,{p:g});const s=new THREE.Mesh(new THREE.PlaneGeometry(w*0.94,w*0.54),glow('#3b6fd6',0.6));s.position.set(0,0.12+w*0.3,0.025);g.add(s);s.userData.noEdge=true;box(0.06,0.12,0.06,'#333',0,0,0,{p:g});box(0.25,0.015,0.15,'#333',0,0,0,{p:g});return g}
function keyboard(x,y,z,ry,p=root){const g=grp(x,y,z,ry,p);box(0.45,0.025,0.15,'#222',0,0,0,{p:g});box(0.08,0.025,0.11,'#333',0.33,0,0,{p:g});return g}
function officeChair(x,z,ry,col='#2d2d2d',p=root){const g=grp(x,0,z,ry,p);box(0.5,0.08,0.5,col,0,0.45,0,{p:g});box(0.5,0.65,0.08,col,0,0.53,-0.24,{p:g});cyl(0.03,0.03,0.42,'#555',0,0.03,0,{p:g,seg:8});for(let i=0;i<5;i++){const a=i/5*Math.PI*2;box(0.04,0.03,0.3,'#444',Math.sin(a)*0.15,0.02,Math.cos(a)*0.15,{p:g,ry:a})}return g}
function gamingChair(x,z,ry,col='#d32f2f',p=root){const g=officeChair(x,z,ry,'#1b1b1b',p);box(0.42,0.75,0.09,col,0,0.62,-0.25,{p:g});box(0.3,0.15,0.1,'#1b1b1b',0,1.25,-0.25,{p:g});return g}
function seatRow(x,z,ry,n,col,p=root,w=0.46){const g=grp(x,0,z,ry,p);for(let i=0;i<n;i++){const sx=(i-(n-1)/2)*w;box(w-0.04,0.1,0.45,col,sx,0.42,0,{p:g});box(w-0.04,0.5,0.08,col,sx,0.52,-0.2,{p:g})}box(n*w,0.4,0.4,'#555',0,0,0.02,{p:g});return g}
function rail(x1,z1,x2,z2,y,col='#b0b6bc'){const dx=x2-x1,dz=z2-z1,l=Math.hypot(dx,dz);const m=cyl(0.025,0.025,l,col,(x1+x2)/2,y,(z1+z2)/2,{rz:Math.PI/2,seg:8});m.position.y=y;m.rotation.set(0,-Math.atan2(dz,dx),Math.PI/2);return m}
function strap(x,y,z,p=root){const g=grp(x,y,z,0,p);box(0.02,0.25,0.02,'#ddd',0,-0.25,0,{p:g});const r=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.012,6,16),mat('#f2f2f2'));r.position.y=-0.31;g.add(r);return g}
function netTex(){return TEX.net||(TEX.net=canvasTex((x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle='#f4f4f4';x.lineWidth=2;for(let i=0;i<=w;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(w,i);x.stroke()}},256,256,[4,2]))}
function netPlane(w,h,x,y,z,ry,rx=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:netTex(),transparent:true,alphaTest:0.3,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx,ry,0);root.add(m);m.userData.noEdge=true;return m}
function soccerGoal(x,z,ry){const g=grp(x,0,z,ry);const W=7.3,H=2.4,D=1.8,c='#fafafa';cyl(0.06,0.06,H,c,-W/2,0,0,{p:g,seg:10});cyl(0.06,0.06,H,c,W/2,0,0,{p:g,seg:10});const bar=cyl(0.06,0.06,W,c,0,H,0,{p:g,seg:10,rz:Math.PI/2});bar.position.y=H;
  const n1=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshStandardMaterial({map:netTex(),transparent:true,alphaTest:0.3,side:THREE.DoubleSide}));n1.position.set(0,H/2,-D);g.add(n1);
  const top=n1.clone();top.geometry=new THREE.PlaneGeometry(W,D);top.rotation.x=Math.PI/2;top.position.set(0,H,-D/2);g.add(top);
  for(const s of [-1,1]){const sd=n1.clone();sd.geometry=new THREE.PlaneGeometry(D,H);sd.rotation.y=Math.PI/2;sd.position.set(s*W/2,H/2,-D/2);g.add(sd)}return g}
function hoop(x,z,ry,h=3.05){const g=grp(x,0,z,ry);box(0.15,h+0.9,0.15,'#555',0,0,-1.2,{p:g});box(0.12,0.12,1.1,'#555',0,h+0.6,-0.65,{p:g});box(1.8,1.05,0.05,'#fff',0,h-0.15,-0.1,{p:g});box(0.6,0.45,0.06,'#d32f2f',0,h,-0.09,{p:g});box(0.5,0.35,0.07,'#fff',0,h+0.05,-0.085,{p:g});
  const r=new THREE.Mesh(new THREE.TorusGeometry(0.23,0.02,8,24),mat('#e65100'));r.rotation.x=Math.PI/2;r.position.set(0,h,0.2);g.add(r);
  const n=new THREE.Mesh(new THREE.CylinderGeometry(0.23,0.15,0.4,16,1,true),new THREE.MeshStandardMaterial({map:netTex(),transparent:true,alphaTest:0.3,side:THREE.DoubleSide}));n.position.set(0,h-0.2,0.2);g.add(n);n.userData.noEdge=true;return g}
function courtTex(){return TEX.court||(TEX.court=canvasTex((x,w,h)=>{x.fillStyle='#d7a46a';x.fillRect(0,0,w,h);for(let i=0;i<w;i+=16){x.fillStyle=`rgba(0,0,0,${0.03+(i/16%3)*0.02})`;x.fillRect(i,0,16,h);x.fillStyle='rgba(0,0,0,.15)';x.fillRect(i,0,1,h)}
  x.strokeStyle='#fff';x.lineWidth=6;x.strokeRect(40,40,w-80,h-80);x.beginPath();x.moveTo(w/2,40);x.lineTo(w/2,h-40);x.stroke();x.beginPath();x.arc(w/2,h/2,90,0,Math.PI*2);x.stroke();
  x.strokeStyle='#c62828';x.fillStyle='rgba(198,40,40,.25)';for(const s of [0,1]){const X=s?w-40-190:40;x.fillRect(X,h/2-110,190,220);x.strokeRect(X,h/2-110,190,220);x.beginPath();x.arc(s?w-40:40,h/2,330,s?Math.PI/2:-Math.PI/2,s?Math.PI*1.5:Math.PI/2);x.stroke()}},1024,640,[1,1]))}
function trackTex(){return TEX.track||(TEX.track=canvasTex((x,w,h)=>{x.fillStyle='#c26b4a';x.fillRect(0,0,w,h);x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=3;for(let i=0;i<6;i++){x.beginPath();x.ellipse(w/2,h/2,w/2-8-i*14,h/2-8-i*14,0,0,Math.PI*2);x.stroke()}
  x.fillStyle='#b99c74';x.beginPath();x.ellipse(w/2,h/2,w/2-92,h/2-92,0,0,Math.PI*2);x.fill();x.strokeStyle='#fff';x.lineWidth=3;x.strokeRect(w*0.18,h*0.3,w*0.64,h*0.4);x.beginPath();x.moveTo(w/2,h*0.3);x.lineTo(w/2,h*0.7);x.stroke();x.beginPath();x.arc(w/2,h/2,40,0,Math.PI*2);x.stroke()},1024,640,[1,1]))}
function lockerRow(x,z,ry,n,col){const g=grp(x,0,z,ry);for(let i=0;i<n;i++){box(0.42,1.8,0.45,col,(i-(n-1)/2)*0.43,0,0,{p:g});box(0.02,0.2,0.02,'#666',(i-(n-1)/2)*0.43+0.15,1.0,0.23,{p:g});for(let k=0;k<3;k++)box(0.25,0.015,0.01,shade(col,-0.15),(i-(n-1)/2)*0.43,1.5+k*0.05,0.226,{p:g})}return g}
function schoolFacade(x,z,ry,T,w=40,floors=4){const g=grp(x,0,z,ry);const col=LB(T,'#e9e1d2','#e8e4dc','#b5654a');box(w,floors*3.4,12,col,0,0,0,{p:g,mat:T==='west'?texMat(bricks('#a5553d','#d8cfc4',[w/3,floors])):null});
  for(let f=0;f<floors;f++)for(let i=0;i<Math.floor(w/3);i++){const wm=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.6),mat('#9db8c9',{r:0.2}));wm.position.set(-w/2+1.5+i*3,f*3.4+1.7,6.01);g.add(wm);box(2.3,0.06,0.15,'#ddd',-w/2+1.5+i*3,f*3.4+0.85,6.02,{p:g})}
  cyl(0.5,0.5,0.06,'#fff',0,floors*3.4-1.2,6.05,{p:g,rx:Math.PI/2});sign(LB(T,'최기문고등학교','最木文高等学校','KIEMOON HIGH'),8,1,0,floors*3.4+0.2,6.05,0,{p:g,bg:null,fg:'#333',fs:150});return g}
function ivStand(x,z){const g=grp(x,0,z);cyl(0.015,0.015,1.9,'#ccc',0,0,0,{p:g,seg:6});box(0.3,0.02,0.02,'#ccc',0,1.88,0,{p:g});box(0.1,0.18,0.04,'#e3f2fd',0.1,1.65,0,{p:g,t:0.7});for(let i=0;i<5;i++){const a=i/5*Math.PI*2;box(0.02,0.02,0.25,'#ccc',Math.sin(a)*0.12,0,Math.cos(a)*0.12,{p:g,ry:a})}return g}
function hospBed(x,z,ry){const g=grp(x,0,z,ry);box(0.95,0.08,2.0,'#9aa5ae',0,0.5,0,{p:g});box(0.9,0.15,1.95,'#f5f7f8',0,0.58,0,{p:g});box(0.92,0.08,1.2,'#a8c8e6',0,0.73,0.35,{p:g});box(0.6,0.12,0.35,'#fff',0,0.73,-0.75,{p:g});
  box(0.95,0.7,0.05,'#cfd8dc',0,0.5,-1.02,{p:g});box(0.95,0.45,0.05,'#cfd8dc',0,0.5,1.02,{p:g});for(const s of [-1,1]){box(0.03,0.25,1.0,'#b0bec5',s*0.49,0.66,-0.3,{p:g})}for(const [a,b] of [[-.4,-.9],[.4,-.9],[-.4,.9],[.4,.9]])cyl(0.03,0.03,0.5,'#888',a,0,b,{p:g,seg:6});return g}
function curtainRail(x,z,w,ry,col='#cfe3ec'){const g=grp(x,0,z,ry);box(w,0.03,0.03,'#bbb',0,2.4,0,{p:g});for(let i=0;i<Math.round(w/0.25);i++)box(0.22,1.9,0.03,shade(col,(i%2)*-0.05),-w/2+0.12+i*0.25,0.45,(i%2)*0.05,{p:g});return g}
function toilet(x,z,ry){const g=grp(x,0,z,ry);box(0.38,0.4,0.5,'#fafafa',0,0,0.05,{p:g});box(0.42,0.04,0.55,'#fff',0,0.4,0.05,{p:g});box(0.4,0.42,0.18,'#fafafa',0,0.4,-0.24,{p:g});return g}
function sinkUnit(x,z,ry){const g=grp(x,0,z,ry);box(0.6,0.12,0.45,'#fafafa',0,0.8,0,{p:g});box(0.4,0.03,0.3,'#dfe9ef',0,0.9,0.02,{p:g});cyl(0.02,0.02,0.18,'#ccc',0,0.92,-0.15,{p:g,seg:6});box(0.03,0.03,0.14,'#ccc',0,1.08,-0.1,{p:g});box(0.1,0.8,0.1,'#e0e0e0',0,0,-0.1,{p:g});return g}
function easel(x,z,ry,col='#fafafa'){const g=grp(x,0,z,ry);const l1=box(0.04,1.6,0.04,'#a07850',-0.3,0,0,{p:g});l1.rotation.z=-0.12;const l2=box(0.04,1.6,0.04,'#a07850',0.3,0,0,{p:g});l2.rotation.z=0.12;const l3=box(0.04,1.6,0.04,'#a07850',0,0,-0.35,{p:g});l3.rotation.x=0.25;box(0.7,0.03,0.08,'#a07850',0,0.75,0.04,{p:g});box(0.6,0.75,0.03,col,0,0.78,0.06,{p:g});return g}
function stageCurtain(w,h,x,z,col='#9b1c2e'){const g=grp(x,0,z);const n=Math.round(w/0.35);for(let i=0;i<n;i++)box(0.33,h,0.08,shade(col,(i%2)*-0.06),-w/2+0.17+i*0.35,0,(i%2)*0.06,{p:g});return g}

Object.assign(PLACES,{
/* ---------- 🏫 학교 ---------- */
async field(T){
  floor(160,160,grass(40));const tr=new THREE.Mesh(new THREE.PlaneGeometry(90,56),new THREE.MeshStandardMaterial({map:trackTex(),roughness:0.95}));tr.rotation.x=-Math.PI/2;tr.position.y=0.005;root.add(tr);tr.userData.noEdge=true;
  soccerGoal(0,-20.5,0);soccerGoal(0,20.5,Math.PI);
  // 스탠드
  for(let i=0;i<5;i++)box(40,0.45,0.9,'#b0b6bc',0,i*0.45,-32-i*0.9);for(let i=0;i<5;i++)for(let k=0;k<26;k++)box(1.0,0.06,0.4,['#1e88e5','#e53935','#fdd835'][i%3],-18.5+k*1.5,i*0.45+0.45,-31.9-i*0.9);
  // 철봉 · 국기봉 · 나무
  const pb=grp(48,0,-6);for(let i=0;i<4;i++){box(0.08,1.4+i*0.35,0.08,'#888',i*1.4,0,0,{p:pb})}for(let i=0;i<3;i++){const b=cyl(0.025,0.025,1.4,'#bbb',i*1.4+0.7,0,0,{p:pb,rz:Math.PI/2,seg:6});b.position.y=1.4+i*0.35}
  cyl(0.06,0.06,10,'#ccc',-46,0,-28,{seg:8});box(1.6,1,0.02,T==='west'?'#1d3e8a':T==='jp'?'#fff':'#fff',-45.2,8.4,-28);if(T==='jp')cyl(0.28,0.28,0.03,'#c62828',-45.2,8.9,-27.98,{rx:Math.PI/2});
  for(let i=0;i<14;i++)tree(-70+i*10,-44,1.2);
  schoolFacade(0,-58,0,T,70,4);
  for(let i=0;i<4;i++)await put('bench',{x:-49,z:-12+i*7,ry:Math.PI/2,l:1.8});
  return {cam:[30,1.6,12],tgt:[0,2,-8],indoor:false};
},
async gym(T){
  const W=30,D=20,H=10;room(W,D,H,{floorTex:courtTex(),wall:LB(T,'#e9e3d6','#ece6d8','#d8d2c8')});
  windowRow('z',W/2-0.02,-D/2+1,D/2-1,{n:6,y:6,h:2.5});windowRow('z',-W/2+0.02,-D/2+1,D/2-1,{n:6,y:6,h:2.5});
  hoop(-W/2+1.4,0,Math.PI/2);hoop(W/2-1.4,0,-Math.PI/2);
  // 무대 + 2층 난간
  box(W*0.5,1.1,4,'#8b6b4a',0,0,-D/2+2);stageCurtain(W*0.5,5.5,0,-D/2+0.2);box(W*0.5,0.6,0.3,'#7a1626',0,6.6,-D/2+0.5);
  sign(LB(T,'제 25회 체육대회','第25回 体育祭','SPORTS DAY'),8,1.2,0,7.6,-D/2+0.03,0,{bg:'#fff',fg:'#1e3a8a',fs:120});
  box(W,0.15,1.6,'#9aa5ae',0,5,D/2-0.8);for(let i=0;i<30;i++)box(0.04,1.0,0.04,'#7d8b96',-W/2+0.5+i,5.15,D/2-1.6);box(W,0.06,0.06,'#7d8b96',0,6.15,D/2-1.6);
  for(let i=0;i<3;i++)box(2,0.25,1.2,'#1e5aa8',W/2-3-i*2.2,i*0.25*0,D/2-2.4);for(let i=0;i<4;i++)box(1.2,0.2,0.8,'#d0c4a8',-W/2+3,i*0.2,D/2-2.2);
  for(let i=0;i<6;i++)sph(0.12,'#e65100',-W/2+5+i*0.3,0.12,D/2-3);
  lightsCeil(W,D,H,4,3);
  return {cam:[8,1.6,7],tgt:[-6,2.5,-3],indoor:true};
},
async science(T){
  const W=10,D=8,H=3;room(W,D,H,{floorTex:tile('#e2e5e7','#d3d7da',8,[5,4]),wall:TX[T].wall});windowRow('z',W/2-0.02,-D/2+0.5,D/2-0.5,{n:4,y:0.9,h:1.6});
  const bc='#2f5d46';box(4.2,1.25,0.06,'#6b5a45',0,0.85,-D/2+0.03);sign(LB(T,['산과 염기','pH 측정 실험'],['酸とアルカリ','pH測定'],['Acids & Bases','pH Lab']),4.0,1.1,0,1.475,-D/2+0.07,0,{bg:bc,fg:'#fff',fs:80});
  for(let i=0;i<2;i++)for(let j=0;j<3;j++){const x=-2+i*4,z=-1.5+j*2;box(2.6,0.9,1.2,'#e9e4d8',x,0,z);box(2.7,0.06,1.3,'#1d1f22',x,0.9,z);box(0.5,0.05,0.4,'#bcc6cc',x+0.9,0.96,z);cyl(0.015,0.015,0.35,'#bbb',x+0.9,0.96,z-0.25,{seg:6});
    for(let k=0;k<3;k++){cyl(0.05,0.07,0.16,'#cfeefc',x-0.8+k*0.25,0.96,z+0.2,{t:0.6,seg:10});cyl(0.02,0.02,0.18,'#ffe082',x-0.2+k*0.12,0.96,z-0.25,{seg:6})}
    for(const s of [-1,1])for(let k=0;k<2;k++){cyl(0.17,0.17,0.04,'#455a64',x-0.6+k*1.2,0.62,z+s*0.85,{seg:12});cyl(0.02,0.02,0.62,'#777',x-0.6+k*1.2,0,z+s*0.85,{seg:6})}}
  for(let i=0;i<4;i++){box(1.2,2,0.45,'#d8d1c0',-W/2+0.25,0,-2.5+i*1.25,{ry:Math.PI/2});const g=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.0),mat('#cfe9ff',{t:0.4}));g.position.set(-W/2+0.48,1.4,-2.5+i*1.25);g.rotation.y=Math.PI/2;root.add(g);for(let k=0;k<4;k++)cyl(0.05,0.05,0.2,['#ffcc80','#a5d6a7','#90caf9','#ef9a9a'][k],-W/2+0.3,1.05,-2.85+i*1.25+k*0.22,{seg:8})}
  // 인체 모형
  const sk=grp(W/2-0.8,0,-D/2+0.8);cyl(0.02,0.02,1.1,'#888',0,0,0,{p:sk,seg:6});box(0.3,0.03,0.3,'#888',0,0,0,{p:sk});sph(0.11,'#f5f0e6',0,1.6,0,{p:sk});box(0.32,0.45,0.12,'#f5f0e6',0,1.05,0,{p:sk});for(const s of [-1,1]){box(0.05,0.55,0.05,'#f5f0e6',s*0.2,0.95,0,{p:sk});box(0.06,0.7,0.06,'#f5f0e6',s*0.08,0.35,0,{p:sk})}
  door(-W/2+0.03,D/2-1.2,Math.PI/2,{label:LB(T,'과학실','理科室','SCIENCE')});lightsCeil(W,D,H,3,3);
  return {cam:[4.5,1.6,3.8],tgt:[-1.2,1.0,-2.0],indoor:true};
},
async artroom(T){
  const W=10,D=8,H=3;room(W,D,H,{floorTex:planks('#c2a07a',[6,6]),wall:'#f1ede4'});windowRow('z',W/2-0.02,-D/2+0.5,D/2-0.5,{n:4,y:0.9,h:1.7});
  const r=rnd(4);for(let i=0;i<3;i++)for(let j=0;j<3;j++){easel(-3+i*2.6+r()*0.3,-1.8+j*1.8,Math.PI+(r()-0.5)*0.5,['#fff','#fdf3e1','#eef6ff'][j]);box(0.4,0.45,0.4,'#9c7b55',-3+i*2.6,0,-1.8+j*1.8+0.7)}
  // 석고상 · 정물대
  box(0.9,0.9,0.9,'#fafafa',0,0,-D/2+1.2);sph(0.22,'#f2efe8',0,1.18,-D/2+1.2);box(0.3,0.3,0.22,'#f2efe8',0,0.9,-D/2+1.2);
  box(1.4,0.75,0.8,'#8d6e63',2.6,0,-D/2+1.3);sph(0.09,'#e53935',2.4,0.84,-D/2+1.2);sph(0.09,'#fbc02d',2.65,0.84,-D/2+1.35);cyl(0.07,0.09,0.3,'#5d8aa8',2.9,0.75,-D/2+1.2,{seg:12});
  for(let i=0;i<6;i++)sign('',0.8,0.6,-W/2+0.02,1.6,-3+i*1.1,Math.PI/2,{bg:['#ffcdd2','#c5e1a5','#b3e5fc','#ffe0b2','#d1c4e9','#f8bbd0'][i]});
  shelf(W/2-0.25,2.5,-Math.PI/2,2,1.8,0.4,'#b08a62',4);
  door(-W/2+0.03,D/2-1.2,Math.PI/2,{label:LB(T,'미술실','美術室','ART')});lightsCeil(W,D,H,3,3);
  return {cam:[4.5,1.6,3.8],tgt:[-1.2,1.0,-2.0],indoor:true};
},
async staffroom(T){
  const W=12,D=9,H=3;room(W,D,H,{floorTex:tile('#d9d6cf','#cfcbc3',8,[6,5]),wall:TX[T].wall});windowRow('z',W/2-0.02,-D/2+0.5,D/2-0.5,{n:5,y:0.9,h:1.6});
  for(let c=0;c<2;c++)for(let i=0;i<3;i++)for(const s of [-1,1]){const x=-3.5+c*5+i*1.25,z=-0.5+s*0.4;box(1.2,0.04,0.75,'#c9c3b5',x,0.72,z);box(1.15,0.7,0.05,'#9aa1a6',x,0,z+s*0.35);monitor(x,0.74,z-s*0.05,s>0?Math.PI:0);keyboard(x,0.75,z+s*0.2,s>0?Math.PI:0);officeChair(x,z+s*0.75,s>0?0:Math.PI);
    box(0.3,0.2,0.22,['#ef5350','#42a5f5','#66bb6a'][i],x+0.4,0.74,z,{});}
  box(4,1.3,0.05,'#fff',0,0.9,-D/2+0.03);sign(LB(T,['이번 주 일정','월: 교직원 회의','수: 모의고사'],['今週の予定','月: 職員会議','水: 模試'],['THIS WEEK','Mon: Staff Meeting','Wed: Exam']),3.8,1.2,0,1.55,-D/2+0.06,0,{bg:'#fff',fg:'#1a237e',fs:60,align:'left'});
  for(let i=0;i<4;i++){box(0.5,1.3,0.6,'#9aa1a6',W/2-0.4,0,-3+i*0.55);for(let k=0;k<3;k++)box(0.3,0.03,0.02,'#666',W/2-0.7,0.3+k*0.4,-3+i*0.55)}
  box(1.0,1.0,0.7,'#ddd',W/2-1.2,0,D/2-0.6);box(0.9,0.05,0.6,'#555',W/2-1.2,1.0,D/2-0.6);
  await put('plant',{x:-W/2+0.6,z:-D/2+0.6,h:1.2});door(-W/2+0.03,D/2-1.2,Math.PI/2,{label:LB(T,'교무실','職員室','STAFF')});lightsCeil(W,D,H,4,3);
  return {cam:[4.6,1.5,3.6],tgt:[-1.5,1.1,-1.5],indoor:true};
},
async stairs(T){
  const W=6,D=8,H=7;room(W,D,H,{floorTex:tile('#cfc9bd','#c4bdb0',8,[3,4]),wall:TX[T].wall});
  const sw=W/2-0.1,n=12,rise=0.29,run=0.3;
  for(let i=0;i<n;i++){box(sw,rise*(i+1),run,'#bdb6a8',-W/4,0,D/2-0.6-i*run);box(sw,0.03,0.05,'#5b5f63',-W/4,rise*(i+1)-0.01,D/2-0.6-i*run+run/2-0.02)}
  box(W,0.25,1.6,'#c9c2b4',0,n*rise-0.25,-D/2+0.8);
  for(let i=0;i<n;i++)box(sw,rise*(i+1)+n*rise,run,'#bdb6a8',W/4,0,-D/2+1.6+i*run,{});
  // 난간
  for(const x of [0])for(let i=0;i<=n;i+=2){box(0.04,0.9,0.04,'#7d8b96',x,rise*i,D/2-0.6-i*run)}
  const hr=box(0.06,0.06,n*run*1.25,'#8d6e63',0,0.9+n*rise/2,D/2-0.6-n*run/2);hr.rotation.x=Math.atan(rise/run);
  windowRow('x',-D/2+0.02,-1.5,1.5,{n:2,y:n*rise+0.9,h:1.4});
  box(0.18,0.5,0.18,'#d32f2f',W/2-0.2,n*rise,-D/2+1.4);sign(TX[T].exit,0.7,0.25,W/2-0.02,2.4,0,-Math.PI/2,{bg:'#1b8f3a',fg:'#fff',fs:120,glow:true});
  sign(LB(T,'2층','2F','2F'),0.6,0.4,-W/2+0.02,n*rise+2,-D/2+1,Math.PI/2,{bg:'#fff',fg:'#333',fs:150});
  sign(LB(T,'뛰지 마세요','走らない','NO RUNNING'),0.9,0.5,-W/2+0.02,1.6,D/2-1.5,Math.PI/2,{bg:'#fff59d',fs:90});
  lightsCeil(W,D,H,1,2);
  return {cam:[1.6,1.6,D/2-0.4],tgt:[-1.4,2.0,-1.0],indoor:true};
},
async schoolgate(T){
  floor(120,120,TX[T].street);floor(12,120,asphalt([3,30]),-16,0);
  floor(14,30,tile('#c9b9a6','#b9a691',8,[4,8]),0,-10,0.003);
  for(const s of [-1,1]){box(1.1,3.2,1.1,'#bdb6a8',s*4,0,0);box(30,2.2,0.4,LB(T,'#d7cdbd','#cfc9bd','#a5553d'),s*19,0,0,{mat:T==='west'?texMat(bricks('#a5553d','#d8cfc4',[10,1])):null})}
  sign(LB(T,'최기문고등학교','最木文高等学校','KIEMOON HIGH SCHOOL'),0.6,2.6,-4,1.6,0.56,0,{bg:'#3e3a34',fg:'#f1e9d6',fs:100,w:256,h:1024});
  const gt=grp(1.5,0,0.2);for(let i=0;i<12;i++)box(0.05,1.5,0.05,'#5b5f63',-2.6+i*0.45,0.15,0,{p:gt});box(5.2,0.08,0.08,'#5b5f63',0,1.6,0,{p:gt});box(5.2,0.08,0.08,'#5b5f63',0,0.25,0,{p:gt});
  schoolFacade(0,-34,0,T,46,4);
  for(let i=0;i<8;i++){tree(-10-i*3,-6,0.9);tree(10+i*3,-6,0.9)}
  const bs=grp(-9.5,0,6,Math.PI/2);box(3,0.08,1.2,'#455a64',0,2.4,0,{p:bs});box(0.08,2.4,0.08,'#455a64',-1.4,0,-0.5,{p:bs});box(0.08,2.4,0.08,'#455a64',1.4,0,-0.5,{p:bs});box(2,0.08,0.4,'#795548',0,0.45,-0.3,{p:bs});sign(TX[T].bus,1.2,0.35,0,2.7,0.62,0,{p:bs,bg:'#1e88e5',fg:'#fff',fs:110});
  streetLamp(-10,-3,Math.PI/2);streetLamp(-10,14,Math.PI/2);await car('sedan',-14,8,0);
  return {cam:[2,1.6,16],tgt:[0,2.4,0],indoor:false};
},
/* ---------- 🏠 생활 ---------- */
async livingroom(T){
  const W=6.5,D=5.5,H=2.6;room(W,D,H,{floorTex:T==='jp'?tatami([4,3]):planks(LB(T,'#c9a06a','#c9a06a','#8f6743'),[6,5]),wall:LB(T,'#f3efe6','#efe8d8','#e3e9e6')});
  windowRow('z',W/2-0.02,-1.6,1.6,{n:2,y:0.3,h:2.0,curtain:'#d8c8b0'});
  await put('kf-rug_rectangle_stripes_A',{x:-0.3,z:0,sz:[2.8,0.02,1.9]});
  await put('kf-couch_pillows',{x:-0.3,z:-D/2+0.55,l:2.2});await put('kf-armchair_pillows',{x:-2.4,z:0.2,ry:Math.PI/2,l:0.95});
  await put('kf-table_low',{x:-0.3,z:0.1,sz:[1.2,0.4,0.7]});await put('cup',{x:-0.5,y:0.4,z:0.1,h:0.1});await put('kf-book_set',{x:0,y:0.4,z:0.05,h:0.12,ry:0.3});
  await put('kf-lamp_standing',{x:-2.6,z:-D/2+0.4,h:1.6});await put('kf-cabinet_medium_decorated',{x:-0.3,z:D/2-0.3,ry:Math.PI,l:1.6});
  box(1.4,0.82,0.05,'#111',-0.3,1.05,D/2-0.12);const tv=new THREE.Mesh(new THREE.PlaneGeometry(1.32,0.74),glow('#2a4b8d',0.4));tv.position.set(-0.3,1.46,D/2-0.15);tv.rotation.y=Math.PI;root.add(tv);
  await put('kf-pictureframe_large_A',{x:-0.8,y:1.4,z:-D/2+0.05,h:0.6});await put('kf-pictureframe_medium',{x:0.2,y:1.5,z:-D/2+0.05,h:0.45});
  await put('kf-shelf_B_large_decorated',{x:-W/2+0.12,y:1.35,z:1.2,ry:Math.PI/2,l:1.1});await put('plant',{x:W/2-0.5,z:-D/2+0.5,h:1.1});
  await put('kf-table_small',{x:1.3,z:-D/2+0.5,sz:[0.5,0.5,0.5]});await put('kf-lamp_table',{x:1.3,y:0.5,z:-D/2+0.5,h:0.45});
  door(-W/2+0.03,-1.2,Math.PI/2,{glass:false,color:'#e8e0d0'});
  const lp=box(0.5,0.06,0.5,'#fff',0,H-0.07,0);lp.material=glow('#fff6dd',1);
  return {cam:[1.8,1.5,2.0],tgt:[-1,0.8,-1],indoor:true};
},
async kitchen(T){
  const W=5.5,D=4.5,H=2.6;room(W,D,H,{floorTex:tile('#e8e4dc','#d6d0c4',8,[4,3],'#c4bdb0'),wall:'#f4f1ea'});windowRow('x',-D/2+0.02,0.6,2.0,{n:1,y:1.2,h:0.9});
  const z0=-D/2+0.45;
  await put('kr-fridge_A_decorated',{x:-W/2+0.5,z:z0+0.05,h:1.9});
  await put('kr-kitchencounter_straight_A_decorated',{x:-1.35,z:z0,sz:[0.9,1.1,0.65]});
  await put('kr-kitchencounter_sink',{x:-0.45,z:z0,sz:[0.9,1.05,0.65]});
  await put('kr-kitchencounter_straight_B',{x:0.45,z:z0,sz:[0.9,0.9,0.65]});await put('kr-stove_multi_countertop',{x:0.45,y:0.9,z:z0,sz:[0.7,0.1,0.55]});
  await put('kr-extractorhood',{x:0.45,y:1.6,z:z0-0.05,sz:[0.85,0.85,0.6]});
  await put('kr-kitchencounter_straight_A',{x:1.35,z:z0,sz:[0.9,0.9,0.65]});await put('kr-oven',{x:2.25,z:z0,sz:[0.9,0.9,0.65]});
  for(const x of [-1.35,1.35])await put('kr-kitchencabinet',{x,y:1.55,z:-D/2+0.17,sz:[0.9,0.7,0.35]});
  await put('kr-pot_A',{x:0.3,y:1.0,z:z0,h:0.2});await put('kr-pan_A',{x:0.62,y:1.0,z:z0+0.05,h:0.08});await put('kr-papertowel',{x:1.6,y:0.9,z:z0-0.05,h:0.3});
  await put('kr-kitchentable_A',{x:0.2,z:0.6,sz:[1.4,0.75,0.85]});
  for(const [x,z,ry] of [[-0.2,-0.05,0],[0.6,-0.05,0],[-0.2,1.25,Math.PI],[0.6,1.25,Math.PI]])await put('kr-chair_A',{x,z,ry,h:0.85});
  await put('kr-food_stew',{x:0.2,y:0.75,z:0.7,h:0.12});await put('plate-dinner',{x:-0.2,y:0.75,z:0.55,l:0.25});await put('plate-dinner',{x:0.6,y:0.75,z:0.85,l:0.25});
  door(W/2-0.03,1.2,-Math.PI/2,{glass:false,color:'#e8e0d0'});const lp=box(0.5,0.06,0.5,'#fff',0,H-0.07,0.5);lp.material=glow('#fff6dd',1);
  return {cam:[2.5,1.6,2.1],tgt:[-0.8,1.0,-1.3],indoor:true};
},
async cafe(T){
  const W=9,D=7,H=3;room(W,D,H,{floorTex:planks('#9a7552',[6,5]),wall:LB(T,'#efe6d8','#ece3d2','#e7ddd0'),open:['s']});
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(W,H),mat('#cfe8f5',{t:0.25}));gl.position.set(0,H/2,D/2);root.add(gl);gl.userData.noEdge=true;for(let i=0;i<=4;i++)box(0.08,H,0.08,'#3e2f25',-W/2+i*W/4,0,D/2);
  for(let i=0;i<3;i++)await put('kr-kitchencounter_straight_A',{x:-2.5+i*0.95,z:-D/2+1.1,ry:Math.PI,sz:[0.95,1.0,0.6]});
  box(3.2,0.05,0.7,'#3e2f25',-1.55,1.0,-D/2+1.1);
  await put('cake',{x:-2.6,y:1.05,z:-D/2+1.05,h:0.14});await put('cupcake',{x:-2.2,y:1.05,z:-D/2+1.1,h:0.12});await put('croissant',{x:-1.9,y:1.05,z:-D/2+1.0,l:0.15});await put('donut-sprinkles',{x:-1.6,y:1.05,z:-D/2+1.15,l:0.12});
  await put('frappe',{x:-0.8,y:1.05,z:-D/2+1.05,h:0.18});await put('cup-saucer',{x:-0.5,y:1.05,z:-D/2+1.1,l:0.15});
  box(0.6,0.3,0.4,'#222',-1.0,1.05,-D/2+0.55);box(3.4,0.5,0.03,'#2d2d2d',-1.5,1.9,-D/2+0.02);sign(LB(T,['아메리카노 4,500','카페라떼 5,000'],['ブレンド ¥450','カフェラテ ¥500'],['AMERICANO $4','LATTE $5']),3.2,0.9,-1.5,2.1,-D/2+0.05,0,{bg:'#2d2d2d',fg:'#fff',fs:70});
  for(let i=0;i<3;i++)await put('kr-chair_stool',{x:-2.5+i*0.95,z:-D/2+1.9,h:0.75});
  for(const [x,z] of [[1.6,-1.6],[3.2,-0.2],[1.4,1.2],[3.2,2.4],[-1.8,1.6]]){await put('kr-table_round_A',{x,z,sz:[0.75,0.74,0.75]});await put('kr-chair_A',{x:x-0.6,z,ry:Math.PI/2,h:0.9});await put('kr-chair_A',{x:x+0.6,z,ry:-Math.PI/2,h:0.9});await put('cup-saucer',{x,y:0.74,z,l:0.14})}
  await put('kf-lamp_standing',{x:W/2-0.4,z:-D/2+0.4,h:1.7});await put('plant',{x:-W/2+0.5,z:D/2-0.6,h:1.2});
  sign(LB(T,'CAFÉ 기문','喫茶 きもん','KIEMOON COFFEE'),2.6,0.6,2.5,2.5,-D/2+0.02,0,{bg:'#3e2f25',fg:'#f6e7c8',fs:120,glow:true});
  for(let i=0;i<4;i++){const l=box(0.25,0.3,0.25,'#f6d58e',-2.5+i*1.1,H-0.6,-D/2+1.2);l.material=glow('#ffd27a',0.8);box(0.01,0.3,0.01,'#333',-2.5+i*1.1,H-0.3,-D/2+1.2)}
  return {cam:[3.6,1.5,3.2],tgt:[-1.5,1.1,-2.2],indoor:true};
},
async snackbar(T){
  const W=8,D=6,H=2.8;room(W,D,H,{floorTex:tile('#e2ddd3','#d2ccc0',8,[5,4]),wall:LB(T,'#fff5e0','#f6efe2','#fff')});
  await put('kr-kitchencounter_straight_A',{x:-2.2,z:-D/2+0.4,sz:[1.2,1.0,0.7]});await put('kr-kitchencounter_straight_B',{x:-1.0,z:-D/2+0.4,sz:[1.2,0.95,0.7]});await put('kr-stove_multi_countertop',{x:-1.0,y:0.95,z:-D/2+0.4,sz:[0.9,0.1,0.6]});
  await put('kr-pot_A',{x:-1.0,y:1.05,z:-D/2+0.4,h:0.25});await put('kr-dishrack_plates',{x:-2.3,y:1.0,z:-D/2+0.4,h:0.35});
  box(3,0.9,0.4,'#c0392b',-1.6,0,-D/2+1.1);box(3.1,0.05,0.5,'#fafafa',-1.6,0.9,-D/2+1.1);
  const menu=LB(T,['떡볶이 4,000','김밥 3,000','순대 4,000','라면 4,500','튀김 3,000','어묵 2,000'],['ラーメン ¥800','餃子 ¥400','カレー ¥700','うどん ¥600','おにぎり ¥200','焼きそば ¥600'],['BURGER $6','HOT DOG $4','FRIES $3','PIZZA $5','SODA $2','SALAD $5']);
  for(let i=0;i<6;i++)sign(menu[i],1.15,0.5,-3.2+i*1.25,2.25,-D/2+0.02,0,{bg:['#fff59d','#ffe0b2','#fff59d','#ffe0b2','#fff59d','#ffe0b2'][i],fg:'#b71c1c',fs:80});
  sign(LB(T,'기문 분식','きもん食堂','KIEMOON DINER'),3,0.5,W/2-1.8,2.4,-D/2+0.02,0,{bg:'#b71c1c',fg:'#fff',fs:130,glow:true});
  const foods=LB(T,['food_stew','dim-sum','food_burger'],['bowl-soup','dim-sum','sushi-salmon'],['food_burger','fries','hot-dog']);
  let k=0;for(const [x,z] of [[0.8,-1.0],[2.6,-1.0],[0.8,0.9],[2.6,0.9],[-1.6,1.2]]){await put('kr-kitchentable_A',{x,z,sz:[1.1,0.72,0.7]});for(const s of [-1,1])await put('kr-chair_B',{x,z:z+s*0.6,ry:s>0?Math.PI:0,h:0.85});
    const f=foods[k++%3];await put(f.startsWith('food')?'kr-'+f:f,{x,y:0.72,z,h:f==='dim-sum'?0.08:0.15});if(T!=='west')await put('chopstick',{x:x+0.25,y:0.72,z,l:0.22,ry:0.2});else{await put('kr-ketchup',{x:x+0.35,y:0.72,z,h:0.18})}}
  await put('kr-menu',{x:-1.6,y:0.9,z:-D/2+1.1,h:0.25});vending(W/2-0.55,1.8,-Math.PI/2,'#1e88e5');
  lightsCeil(W,D,H,3,2);
  return {cam:[3.2,1.5,2.6],tgt:[-1.2,1.0,-1.6],indoor:true};
},
async library(T){
  const W=14,D=11,H=3.4;room(W,D,H,{floorTex:planks('#a07a52',[8,6]),wall:LB(T,'#ece6d8','#ebe5d6','#e1d8c8')});windowRow('z',W/2-0.02,-D/2+1,D/2-1,{n:5,y:0.9,h:1.9});
  const r=rnd(17);
  for(let i=0;i<5;i++){const z=-D/2+1.2+i*1.5;for(const sd of [-1,1]){const sh=shelf(-3.2,z+sd*0.2,sd>0?0:Math.PI,5,2.1,0.38,'#8b6b4a',5);for(let lv=0;lv<5;lv++){const p=grp(0,lv*0.42+0.03,0,0,sh);books(p,4.9,0,0.34,r)}}}
  for(let i=0;i<3;i++){await put('kf-table_medium_long',{x:3.2,z:-3+i*2.6,sz:[2.2,0.75,1.0]});for(const s of [-1,1])for(const dx of [-0.6,0.6])await put('kf-chair_A_wood',{x:3.2+dx,z:-3+i*2.6+s*0.75,ry:s>0?Math.PI:0,h:0.9});
    await put('kf-lamp_table',{x:3.0,y:0.75,z:-3+i*2.6,h:0.4});await put('kf-book_set',{x:3.6,y:0.75,z:-3+i*2.6-0.15,h:0.18,ry:0.4})}
  box(2.6,1.0,0.7,'#6d4c33',4,0,D/2-1.2);monitor(4.4,1.0,D/2-1.25,Math.PI);sign(LB(T,'대출 · 반납','貸出・返却','CHECK OUT'),1.6,0.35,4,1.6,D/2-0.85,Math.PI,{bg:'#fff',fs:110});
  sign(LB(T,'조용히 해 주세요','お静かに','QUIET PLEASE'),2.2,0.45,0,2.6,-D/2+0.02,0,{bg:'#2e4a3a',fg:'#fff',fs:110});
  await put('plant',{x:W/2-0.6,z:-D/2+0.6,h:1.3});lightsCeil(W,D,H,4,3);
  return {cam:[5.6,1.55,4.2],tgt:[-1.5,1.2,-1.5],indoor:true};
},
async apartment(T){
  floor(120,120,grass(30));floor(8,120,asphalt([2,30]),0,0,0.002);floor(30,14,asphalt([8,4]),12,12,0.003);
  for(let i=0;i<9;i++)box(0.12,0.01,2.4,'#f5f5f5',8+i*2.6,0,10.5);
  const r=rnd(31);
  for(const [x,z,ry,label] of [[-16,-14,0,'101'],[16,-14,0,'102'],[-16,26,Math.PI,'103']]){const g=grp(x,0,z,ry),fl=T==='west'?6:15,w=24,d=10,h=fl*2.8;
    box(w,h,d,LB(T,'#ecebe6','#e6e3dc','#c79c7f'),0,0,0,{p:g});
    for(let f=1;f<fl;f++){box(w,0.15,1.2,LB(T,'#d8d6cf','#d2cfc6','#a97c62'),0,f*2.8-0.1,d/2+0.6,{p:g});for(let k=0;k<6;k++){const wm=new THREE.Mesh(new THREE.PlaneGeometry(3,1.6),mat('#9db8c9',{r:0.2}));wm.position.set(-w/2+2+k*4,f*2.8+1.1,d/2+0.01);g.add(wm);box(3.2,0.9,0.06,'#bfc7cc',-w/2+2+k*4,f*2.8,d/2+1.2,{p:g,t:0.6})}}
    if(T!=='west')sign(label+LB(T,'동','号棟',''),2.6,1.6,w/2-2,h-2.4,d/2+0.02,0,{p:g,bg:null,fg:'#3a6ea5',fs:200});}
  // 놀이터 · 경비실 · 주차장 차
  const pg=grp(-4,0,6);box(0.1,2.3,0.1,'#e53935',-1.5,0,0,{p:pg});box(0.1,2.3,0.1,'#e53935',1.5,0,0,{p:pg});box(3.2,0.1,0.1,'#e53935',0,2.3,0,{p:pg});for(const s of [-0.7,0.7]){box(0.5,0.05,0.25,'#333',s,0.5,0,{p:pg});box(0.02,1.8,0.02,'#999',s-0.2,0.5,0,{p:pg});box(0.02,1.8,0.02,'#999',s+0.2,0.5,0,{p:pg})}
  floor(8,6,'#e0c48f',-6,6,0.004);const sl=grp(-8,0,5);box(1,1.6,1,'#fbc02d',0,0,0,{p:sl});const ramp=box(0.8,0.06,2.6,'#1e88e5',0,0.8,1.6,{p:sl});ramp.rotation.x=0.6;
  box(3,2.6,2.5,'#d9cfc0',5,0,-2);sign(LB(T,'경비실','管理人室','OFFICE'),1.4,0.4,5,2.1,-0.73,0,{bg:'#1e3a6e',fg:'#fff',fs:110});
  const cars=['sedan','suv','hatchback','van','taxi'];for(let i=0;i<5;i++)await car(cars[i],8+i*2.6,15,Math.PI,4.2);
  for(let i=0;i<8;i++)tree(-28+i*7,-4,0.9+r()*0.3);for(let i=0;i<3;i++)await put('bench',{x:-10+i*3,z:10,ry:Math.PI,l:1.6});
  return {cam:[2,1.6,18],tgt:[-2,4,0],indoor:false};
},
async elevator(T){
  const W=1.8,D=1.7,H=2.4;room(W,D,H,{floorTex:tile('#6d6f72','#5f6164',4,[2,2]),wall:'#c3c8cd'});
  const steel=new THREE.MeshStandardMaterial({color:'#c9ced3',metalness:0.7,roughness:0.3});
  for(const [x,z,ry,l] of [[0,-D/2+0.01,0,W],[-W/2+0.01,0,Math.PI/2,D],[W/2-0.01,0,-Math.PI/2,D]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(l,H),steel);m.position.set(x,H/2,z);m.rotation.y=ry;root.add(m)}
  const mr=new THREE.Mesh(new THREE.PlaneGeometry(W*0.8,1.2),new THREE.MeshStandardMaterial({color:'#e8f0f5',metalness:0.9,roughness:0.05}));mr.position.set(0,1.4,-D/2+0.02);root.add(mr);
  rail(-W/2+0.3,-D/2+0.06,W/2-0.3,-D/2+0.06,0.9,'#999');
  // 문 · 버튼 패널 · 층 표시
  box(0.5,H,0.04,'#a7adb3',-W/2+0.25,0,D/2-0.02);box(0.5,H,0.04,'#a7adb3',W/2-0.25,0,D/2-0.02);box(0.8,2.1,0.03,'#b8bec4',0,0,D/2-0.04);box(0.01,2.1,0.035,'#888',0,0,D/2-0.06);
  const pn=grp(W/2-0.02,1.0,D/2-0.35,-Math.PI/2);box(0.25,0.6,0.02,'#3a3d40',0,0,0,{p:pn});for(let i=0;i<10;i++){const b=cyl(0.025,0.025,0.015,i===3?'#ffd54f':'#ddd',-0.05+(i%2)*0.1,0.08+Math.floor(i/2)*0.1,0.015,{p:pn,rx:Math.PI/2,seg:12});if(i===3)b.material=glow('#ffd54f',0.8)}
  sign('▲ 7',0.3,0.12,0,2.25,D/2-0.06,Math.PI,{bg:'#111',fg:'#ff5252',fs:130,glow:true});
  const lp=box(1.2,0.04,1.0,'#fff',0,H-0.05,0);lp.material=glow('#fffbe8',1.1);
  return {cam:[-0.72,1.65,-0.72],tgt:[0.3,1.1,0.85],indoor:true};
},
async toiletroom(T){
  const W=6,D=5,H=2.7;room(W,D,H,{floorTex:tile('#cfd8dc','#b0bec5',8,[4,3],'#90a4ae'),wall:'#e8eef0'});
  const wt=new THREE.Mesh(new THREE.PlaneGeometry(W,1.4),new THREE.MeshStandardMaterial({map:tile('#ffffff','#f2f5f6',8,[8,2],'#c9d3d8')}));wt.position.set(0,0.7,-D/2+0.01);root.add(wt);wt.userData.noEdge=true;
  for(let i=0;i<3;i++){const x=-2.0+i*1.1;box(0.04,2.0,1.3,'#4f8fb8',x-0.53,0.1,-D/2+0.65);box(1.02,2.0,0.04,'#5b9bc4',x,0.1,-D/2+1.32);box(0.05,0.08,0.03,'#ddd',x+0.35,1.0,-D/2+1.35);toilet(x,-D/2+0.35,0)}
  box(0.04,2.0,1.3,'#4f8fb8',-2.0+3*1.1-0.53,0.1,-D/2+0.65);
  if(T!=='jp')for(let i=0;i<2;i++){const g=grp(1.9+i*0.7,0,-D/2+0.15);box(0.38,0.6,0.3,'#fafafa',0,0.55,0,{p:g})}
  for(let i=0;i<3;i++)sinkUnit(-1.5+i*1.2,D/2-0.3,Math.PI);
  const mr=new THREE.Mesh(new THREE.PlaneGeometry(3.6,0.9),new THREE.MeshStandardMaterial({color:'#e8f0f5',metalness:0.9,roughness:0.05}));mr.position.set(-0.3,1.6,D/2-0.02);mr.rotation.y=Math.PI;root.add(mr);
  await put('kr-towelrail',{x:1.6,y:1.0,z:D/2-0.05,ry:Math.PI,l:0.5});
  sign(TX[T].toilet,1.0,0.3,W/2-0.02,2.2,0.6,-Math.PI/2,{bg:'#e3f2fd',fs:100});door(W/2-0.03,1.4,-Math.PI/2,{glass:false,color:'#5b9bc4'});
  lightsCeil(W,D,H,2,2);
  return {cam:[2.2,1.55,1.6],tgt:[-1.2,1.0,-1.4],indoor:true};
},
async pcbang(T){
  const W=10,D=8,H=2.8;room(W,D,H,{floorTex:tile('#4a4d55','#41444b',8,[5,4]),wall:'#363a45',ceil:'#23262d'});lightsCeil(W,D,H,3,2);
  for(let r=0;r<3;r++)for(let i=0;i<6;i++)for(const s of [-1,1]){const x=-3.3+i*1.0,z=-2.2+r*2.2+s*0.45;box(0.95,0.04,0.6,'#1b1d22',x,0.72,z);box(0.9,0.7,0.04,'#2a2d34',x,0,z+s*0.28);monitor(x,0.74,z+s*0.15,s>0?Math.PI:0,root,true);keyboard(x,0.75,z-s*0.1,s>0?Math.PI:0);gamingChair(x,z-s*0.7,s>0?0:Math.PI,['#d32f2f','#1e88e5','#43a047'][r]);
    box(0.95,0.25,0.02,'#111',x,0.76,z);}
  for(let r=0;r<3;r++){const n=box(6.2,0.03,0.03,'#00e5ff',-0.8,0.73,-2.2+r*2.2);n.material=glow('#00e5ff',1.5)}
  box(2.4,1.05,0.7,'#30333a',W/2-1.6,0,D/2-0.9);monitor(W/2-1.4,1.05,D/2-0.95,Math.PI);
  const nb=sign(LB(T,'PC방','ネットカフェ','GAME ZONE'),2.4,0.6,0,2.2,-D/2+0.02,0,{bg:'#111',fg:'#ff4dff',fs:150,glow:true});
  for(let i=0;i<4;i++){const l=box(0.6,0.03,0.6,'#fff',-3+i*2,H-0.05,0);l.material=glow(['#7c4dff','#00e5ff','#ff4081','#7c4dff'][i],0.8)}
  vending(W/2-0.55,-1,-Math.PI/2,'#7c4dff');
  return {cam:[4.2,1.75,3.7],tgt:[-1.5,0.8,-1.5],indoor:true};
},
async karaoke(T){
  const W=4.5,D=4,H=2.5;room(W,D,H,{floorTex:tile('#3a2d4a','#33283f',6,[3,3]),wall:'#2d2440',ceil:'#1e1830'});
  await put('kf-couch_pillows',{x:-W/2+0.5,z:0.1,ry:Math.PI/2,l:2.6});await put('kf-couch_pillows',{x:0.3,z:D/2-0.5,ry:Math.PI,l:2.4});
  await put('kf-table_low',{x:-0.3,z:0.2,sz:[1.4,0.45,0.8]});await put('soda-can',{x:-0.5,y:0.45,z:0.1,h:0.12});await put('soda-bottle',{x:-0.2,y:0.45,z:0.3,h:0.25});
  box(2.4,1.4,0.06,'#111',0.4,0.7,-D/2+0.05);const kt=texText([LB(T,'♪ 반짝 반짝 ♪','♪ キラキラ ♪','♪ SING ALONG ♪'),'━━━━━━'],{w:1024,h:576,bg:'#1a237e',fg:'#fff',font:'bold 90px "Noto Sans KR",sans-serif'});
  const sc=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.3),new THREE.MeshStandardMaterial({map:kt,emissive:'#fff',emissiveIntensity:0.6,emissiveMap:kt}));sc.position.set(0.4,1.4,-D/2+0.09);root.add(sc);sc.userData.noEdge=true;
  box(1.0,0.5,0.4,'#222',0.4,0.15,-D/2+0.25);for(let i=0;i<2;i++){cyl(0.025,0.02,0.22,'#333',-0.6+i*0.2,0.45,0.35,{seg:8});sph(0.045,'#555',-0.6+i*0.2,0.69,0.35)}
  const mb=sph(0.2,'#ddd',0,H-0.35,0,{m:0.9,r:0.1});
  for(let i=0;i<6;i++){const s=sph(0.06,['#ff4081','#00e5ff','#ffd740','#7c4dff','#69f0ae','#ff6e40'][i],-1.8+i*0.7,H-0.1,-1.2+(i%2)*2.4);s.material=glow(s.material.color.getStyle(),1.2)}
  sign(LB(T,'123번 방','123号室','ROOM 123'),0.8,0.25,W/2-0.02,2.1,-0.8,-Math.PI/2,{bg:'#ff4081',fg:'#fff',fs:110,glow:true});door(W/2-0.03,-0.8,-Math.PI/2,{color:'#5e3a87'});
  return {cam:[1.4,1.25,1.4],tgt:[-0.6,1.0,-1.2],indoor:true};
},
/* ---------- 🚌 이동 · 바깥 ---------- */
async bus(T){
  const W=2.45,L=11,H=2.3;room(W,L,H,{floorTex:tile('#5d6066','#55585e',4,[2,10]),wall:'#e8e8e4',ceil:'#f2f2ee'});
  for(const s of [-1,1]){windowRow('z',s*(W/2-0.02),-L/2+1.8,L/2-0.6,{n:6,y:0.95,h:0.95,frame:'#555',sill:false})}
  const seatC=LB(T,'#2e5aa8','#3d6b4f','#7a2f3a');
  for(let i=0;i<7;i++){const z=-L/2+2.3+i*1.15;seatRow(-W/2+0.5,z,0,2,seatC,root,0.45);if(i<6)seatRow(W/2-0.5,z,0,2,seatC,root,0.45)}
  for(const x of [-0.25,0.25]){const r=box(0.04,0.04,L-2,'#ffcf33',x,H-0.25,0.5);for(let i=0;i<14;i++)strap(x,H-0.25,-L/2+1.8+i*0.65)}
  for(let i=0;i<5;i++)cyl(0.025,0.025,H,'#ffcf33',(i%2?0.45:-0.45),0,-L/2+2.8+i*1.8,{seg:8});
  // 운전석
  box(W,0.9,1.0,'#3a3d42',0,0,-L/2+0.5);cyl(0.22,0.22,0.04,'#222',-0.6,1.0,-L/2+1.0,{rx:1.1,seg:16});officeChair(-0.6,-L/2+1.5,Math.PI,'#333');
  const ws=new THREE.Mesh(new THREE.PlaneGeometry(W-0.1,1.1),mat('#cfe8f5',{t:0.3}));ws.position.set(0,1.5,-L/2+0.02);root.add(ws);
  sign(LB(T,'다음 정류장: 최기문고등학교','次は 最木文高校前','NEXT: KIEMOON HIGH'),1.8,0.2,0,H-0.2,-L/2+1.2,0,{bg:'#111',fg:'#ff9800',fs:90,glow:true});
  for(let i=0;i<3;i++){const b=box(0.06,0.04,0.04,'#e53935',W/2-0.03,1.4,-1+i*2);b.material=glow('#e53935',0.6)}
  lightsCeil(W,L,H,1,5);
  return {cam:[0.2,1.5,L/2-0.6],tgt:[0,1.3,-2],indoor:true};
},
async subway(T){
  const W=3,L=18,H=2.3;room(W,L,H,{floorTex:tile('#b0b4b8','#a5a9ad',4,[2,12]),wall:'#e6e9ec',ceil:'#f3f4f5'});
  const seatC=LB(T,'#4a7fc1','#2e7d32','#8e8e8e');
  for(const s of [-1,1]){for(let k=0;k<3;k++){const z=-L/2+3+k*6;box(0.5,0.42,3.6,'#bbb',s*(W/2-0.25),0,z);box(0.5,0.1,3.6,seatC,s*(W/2-0.25),0.42,z);box(0.08,0.5,3.6,seatC,s*(W/2-0.04),0.5,z);
      const wm=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.8),mat('#cfe8f5',{t:0.35}));wm.position.set(s*(W/2-0.02),1.4,z);wm.rotation.y=-s*Math.PI/2;root.add(wm);wm.userData.noEdge=true}
    for(let k=0;k<2;k++){const z=-L/2+6+k*6;box(0.05,2.0,1.3,'#9aa1a6',s*(W/2-0.03),0,z);const gl=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.8),mat('#cfe8f5',{t:0.4}));gl.position.set(s*(W/2-0.06),1.4,z-0.3);gl.rotation.y=-s*Math.PI/2;root.add(gl);const gl2=gl.clone();gl2.position.z=z+0.3;root.add(gl2)}}
  for(const x of [-0.75,0.75]){box(0.035,0.035,L-1,'#d0d4d8',x,H-0.3,0);for(let i=0;i<26;i++)strap(x,H-0.3,-L/2+1+i*0.62)}
  for(let k=0;k<2;k++)cyl(0.025,0.025,H,'#d0d4d8',0,0,-L/2+6+k*6,{seg:8});
  for(let i=0;i<6;i++)sign(['',''][0],0.7,0.35,(i%2?1:-1)*(W/2-0.02),2.0,-L/2+2+i*2.6,(i%2?-1:1)*Math.PI/2,{bg:['#ffcdd2','#c5e1a5','#b3e5fc','#ffe0b2','#d1c4e9','#fff59d'][i]});
  sign(LB(T,'2호선 · 다음 역: 강남','山手線 · 次は 渋谷','LINE 2 · NEXT: CENTRAL'),2.2,0.25,0,H-0.15,-L/2+0.05,0,{bg:'#111',fg:'#4caf50',fs:90,glow:true});
  box(W,H,0.05,'#c8ccd0',0,0,-L/2+0.02);door(0,-L/2+0.06,0,{w:0.8,h:1.9,color:'#b0b6bc'});
  lightsCeil(W,L,H,2,8);
  return {cam:[0.3,1.5,L/2-1],tgt:[0,1.2,-3],indoor:true};
},
async riverside(T){
  water(400,60,0,-36,-0.6,'#4f8fb0');floor(400,20,'#7bae5a',0,4);floor(400,4,LB(T,'#c9b9a6','#cfc6b4','#b9b2a6'),0,4,0.003);floor(400,2.4,'#8a3f3f',0,8,0.004);
  for(let i=-30;i<30;i++)box(0.08,0.01,0.6,'#fff',i*4,0,8);
  box(400,0.6,0.5,'#9a9a95',0,-0.6,-6);for(let i=0;i<60;i++){box(0.06,1.0,0.06,'#666',-120+i*4,0,-5.8)}box(400,0.06,0.06,'#666',0,1.0,-5.8);
  // 다리
  for(let i=0;i<8;i++)box(2.2,14,3,'#b0b4b8',-70+i*20,-0.6,-40);box(180,1.6,14,'#9aa1a6',0,13.4,-40);for(let i=0;i<40;i++)box(0.1,1,0.1,'#666',-90+i*4.6,15,-33.2);
  // 건너편 빌딩
  const r=rnd(41);for(let i=0;i<30;i++){const h=10+r()*40;box(10+r()*8,h,10,['#b0b8c0','#c8c2b8','#9aa5ae','#d6d0c4'][i%4],-140+i*10,-0.6,-90-r()*20)}
  for(let i=0;i<10;i++){streetLamp(-40+i*9,2.2,Math.PI,4.5);await put('bench',{x:-36+i*9,z:2.4,ry:Math.PI,l:1.6})}
  for(let i=0;i<14;i++)tree(-60+i*9,13,1);
  await put('boat-small',{x:12,y:-0.55,z:-20,l:5,ry:1.2});
  return {cam:[4.5,1.6,7],tgt:[2,3,-30],indoor:false};
},
async downtown(T){
  floor(200,200,'#9a9893');const K=4;
  for(let i=-6;i<=6;i++){await put(i===0?'kc-road_junction':'kc-road_straight',{x:i*8,z:0,sz:[8,0.4,8],ry:Math.PI/2});if(i)await put(i===2||i===-2?'kc-road_straight_crossing':'kc-road_straight',{x:0,z:i*8,sz:[8,0.4,8]})}
  const bl=['A','B','C','D','E','F','G','H'];let k=0;
  for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]])for(let i=0;i<4;i++){const b=bl[k++%8];await put('kc-building_'+b+'_withoutBase',{x:sx*(10+i*10),z:sz*8.5,ry:sz>0?Math.PI:0,k:K*1.45});
    await put('kc-building_'+bl[(k+3)%8]+'_withoutBase',{x:sx*8.5,z:sz*(10+i*10),ry:sx>0?-Math.PI/2:Math.PI/2,k:K*1.45})}
  for(const [x,z,ry] of [[5,5,Math.PI],[-5,-5,0],[5,-5,-Math.PI/2],[-5,5,Math.PI/2]])await put('kc-trafficlight_B',{x,z,ry,k:K*1.2});
  for(let i=1;i<6;i++)for(const s of [-1,1]){await put('kc-streetlight',{x:i*9*s,z:4.6,ry:Math.PI,k:K*1.3});await put('kc-streetlight',{x:-4.6,z:i*9*s,ry:Math.PI/2,k:K*1.3})}
  await put('kc-firehydrant',{x:6,z:4.6,k:K});await put('kc-dumpster',{x:-14,z:5,k:K});await put('kc-bench',{x:12,z:5,ry:Math.PI,k:K});await put('kc-bush',{x:16,z:5,k:K});await put('kc-bush',{x:17,z:5,k:K});
  const cars=['kc-car_taxi','kc-car_sedan','kc-car_police','kc-car_hatchback','kc-car_stationwagon'];for(let i=0;i<5;i++)await put(cars[i],{x:(i%2?1.8:-1.8),z:-34+i*14,ry:i%2?Math.PI:0,k:K*1.05});
  for(let i=0;i<3;i++)await put(cars[(i+2)%5],{x:-28+i*20,z:i%2?1.8:-1.8,ry:i%2?-Math.PI/2:Math.PI/2,k:K*1.05});
  return {cam:[-2.6,1.6,30],tgt:[0.5,3.5,0],indoor:false};
},
async beach(T){
  floor(300,120,'#e9d7a8',0,30);water(300,200,0,-100,0.03,'#3f9bc4');floor(300,5,'#d9c38f',0,2.5,0.004);
  const r=rnd(51);for(let i=0;i<14;i++)await put(['palm-long','palm-short','palm-detailed-long'][i%3],{x:-60+i*9+r()*3,z:26+r()*10,h:6+r()*3,ry:r()*6});
  await put('boat-small',{x:-6,y:0,z:-4,l:4.5,ry:0.4});await put('boat-large',{x:14,y:0,z:-16,l:9,ry:-0.6});await put('ship-light',{x:-40,y:0,z:-80,l:40,ry:1.2});
  for(let i=0;i<6;i++)await put(i%2?'formation-rock':'formation-large-rock',{x:30+i*3,z:2+r()*4,h:1.5+r()*2,ry:r()*6});
  // 파라솔 · 방파제
  for(let i=0;i<4;i++){const g=grp(-14+i*6,0,10);cyl(0.04,0.04,2.4,'#eee',0,0,0,{p:g,seg:6});const c=new THREE.Mesh(new THREE.ConeGeometry(1.4,0.6,12),mat(['#e53935','#1e88e5','#fbc02d','#43a047'][i]));c.position.y=2.4;g.add(c);box(0.7,0.08,1.8,'#fff',1.2,0.2,0,{p:g})}
  for(let i=0;i<12;i++)box(3,1.6,3,'#a8a8a0',40+i*2.2,-0.6,-6-i*2.5,{ry:0.6});
  return {cam:[0,1.6,18],tgt:[0,1.5,-10],indoor:false};
},
async forest(T){
  floor(200,200,noiseTex('#5f7f3f',['#3e5a28','#7a9a4f','#6b5a3a'],30));floor(2.6,200,'#9a7a54',0,0,0.025);
  const r=rnd(61);
  for(let i=0;i<170;i++){const x=(r()<.5?-1:1)*(2.6+Math.pow(r(),1.6)*32),z=-80+r()*92;const n=r();
    if(n<0.3)await put('tree-big',{x,z,h:6+r()*5,ry:r()*6});else if(n<0.5)await put('km-tree_single_B',{x,z,h:6+r()*4,ry:r()*6});else if(n<0.7)await put('low-poly-tree',{x,z,h:5+r()*4,ry:r()*6});else if(n<0.8)await put('kh-tree_pine_yellow_medium',{x,z,h:7+r()*4,ry:r()*6});else tree(x,z,1.2+r()*0.8)}
  for(let i=0;i<20;i++)await put(i%2?'formation-rock':'formation-large-rock',{x:(r()<.5?-1:1)*(2+r()*15),z:-60+r()*80,h:0.5+r()*1.6,ry:r()*6});
  for(let i=0;i<24;i++)await put('mushroom',{x:(r()<.5?-1:1)*(1.6+r()*4),z:-20+r()*30,h:0.12+r()*0.1});
  for(let i=0;i<8;i++){box(2.8,0.12,0.25,'#6d4c33',0,0.1,-30-i*0.6)}
  const g=grp(2,0,-6);box(0.12,1.3,0.12,'#6d4c33',0,0,0,{p:g});sign(LB(T,'등산로 →','登山道 →','TRAIL →'),0.9,0.3,0.45,1.15,0.07,0,{p:g,bg:'#6d4c33',fg:'#fff',fs:110});
  return {cam:[0.4,1.6,12],tgt:[0,2.4,-10],indoor:false};
},
/* ---------- 🎭 특별한 장면 ---------- */
async hospital(T){
  const W=7,D=6,H=2.8;room(W,D,H,{floorTex:tile('#e9ecef','#dee2e6',8,[4,4]),wall:'#eef3f5'});windowRow('x',-D/2+0.02,-2,2,{n:2,y:0.9,h:1.4,curtain:'#cfe3ec'});
  for(let i=0;i<2;i++){const x=-1.6+i*3.2;hospBed(x,-D/2+1.3,0);ivStand(x+0.7,-D/2+0.9);box(0.5,0.75,0.45,'#e0e0e0',x-0.8,0,-D/2+0.5);monitor(x+0.75,0.75,-D/2+0.35,0);
    curtainRail(x+1.45,-D/2+0.75,1.3,Math.PI/2)}
  await put('kf-chair_A',{x:-2.4,z:0.3,ry:2.6,h:0.9});await put('plant',{x:W/2-0.4,z:D/2-0.4,h:1});
  box(0.5,0.25,0.04,'#fff',0,2.1,-D/2+0.02);sign(LB(T,'면회 시간 18:00 ~ 20:00','面会時間 18:00〜20:00','VISITING 6-8 PM'),1.6,0.35,1.5,1.7,D/2-0.02,Math.PI,{bg:'#fff',fg:'#1565c0',fs:80});
  door(W/2-0.03,1.6,-Math.PI/2,{color:'#cfd8dc',label:'301'});lightsCeil(W,D,H,2,2);
  return {cam:[2.7,1.6,2.4],tgt:[-0.8,0.8,-1.6],indoor:true};
},
async police(T){
  const W=10,D=8,H=3;room(W,D,H,{floorTex:tile('#c8c9c4','#bdbeb8',8,[5,4]),wall:LB(T,'#e9eef2','#e6ebef','#d9dfe4')});windowRow('z',W/2-0.02,-D/2+1,1,{n:2,y:1.0,h:1.4});
  for(let i=0;i<3;i++){const x=-2.4+i*2.2;await put('kf-table_medium',{x,z:0,sz:[1.5,0.75,0.8]});monitor(x,0.75,-0.2,0);keyboard(x,0.76,0.15,0);officeChair(x,0.8,Math.PI);box(0.3,0.08,0.22,'#f5f5f5',x+0.5,0.75,0.1);officeChair(x,-0.75,0,'#555')}
  // 유치장
  const cz=-D/2+1.4;box(4,0.02,2.8,'#8a8c88',2.6,0,-D/2+1.4);for(let i=0;i<20;i++)cyl(0.025,0.025,H,'#4a4d50',0.65+i*0.2,0,cz+1.35,{seg:6});box(4,0.08,0.08,'#4a4d50',2.6,1.0,cz+1.35);box(4,0.08,0.08,'#4a4d50',2.6,2.0,cz+1.35);
  box(1.8,0.45,0.6,'#9aa1a6',3.4,0,-D/2+0.35);
  box(3,1.2,0.04,'#fff',-2.4,1.0,-D/2+0.03);for(let i=0;i<6;i++)box(0.35,0.45,0.01,['#ffcdd2','#fff9c4','#c8e6c9'][i%3],-3.5+i*0.45,1.3+((i%2)*0.1),-D/2+0.06);
  sign(LB(T,'최기문 경찰서','最木文警察署','KIEMOON POLICE'),3,0.5,-2.4,2.5,-D/2+0.02,0,{bg:'#0d2c6b',fg:'#fff',fs:120});
  for(let i=0;i<3;i++){box(0.5,1.3,0.6,'#7d8b96',-W/2+0.35,0,1.5+i*0.55)}
  door(W/2-0.03,2.5,-Math.PI/2,{label:LB(T,'민원실','受付','FRONT DESK')});lightsCeil(W,D,H,3,3);
  return {cam:[3.8,1.55,3.3],tgt:[-1,1.0,-1.8],indoor:true};
},
async auditorium(T){
  const W=22,D=24,H=8;room(W,D,H,{floorTex:planks('#8a5a3c',[10,10]),wall:'#3a2a26',ceil:'#2a1f1c'});
  box(W-4,1.1,6,'#5d4030',0,0,-D/2+3);box(W-4,0.04,0.2,'#d0b080',0,1.1,-D/2+6);stageCurtain(W-4,6.5,0,-D/2+0.3);box(W-2,1.0,0.4,'#7a1626',0,6.8,-D/2+0.6);for(const s of [-1,1])stageCurtain(2.4,6.9,s*(W/2-3.2),-D/2+6.2);
  box(0.7,1.15,0.5,'#6d4c33',W/4,1.1,-D/2+4.8);cyl(0.01,0.01,0.4,'#333',W/4,2.25,-D/2+4.6,{seg:6});
  sign(LB(T,'제 1회 최기문 학예회','第1回 文化祭','SCHOOL TALENT SHOW'),10,1.3,0,4.6,-D/2+0.4,0,{bg:null,fg:'#ffd54f',fs:120,glow:true});
  for(let r=0;r<10;r++)for(let i=0;i<14;i++){if(i===7)continue;seatRow(-W/2+3+i*1.2,-D/2+9+r*1.3,Math.PI,1,'#8e1b2b',root,0.55)}
  for(let i=0;i<4;i++){const s=cyl(0.25,0.18,0.5,'#222',-6+i*4,H-0.6,-D/2+9,{rx:0.9,seg:12});const l=sph(0.15,'#fff',-6+i*4,H-0.8,-D/2+8.8);l.material=glow('#fff3c4',2)}
  return {cam:[2,2.2,D/2-2],tgt:[0,2.2,-D/2+3],indoor:true};
},
async warehouse(T){
  const W=20,D=16,H=6;room(W,D,H,{floorTex:noiseTex('#6e6b66',['#4f4c48','#85817a','#5a4a3a'],8),wall:'#8a8680',ceil:'#4a4845'});
  for(let i=0;i<4;i++)for(let k=0;k<2;k++){box(0.35,H,0.35,'#5b5f63',-W/2+3+i*4.5,0,-D/2+4+k*8)}
  windowRow('z',W/2-0.02,-D/2+2,D/2-2,{n:4,y:3.4,h:1.6,frame:'#444'});
  await put('kd-crates_stacked',{x:-6,z:-5,h:2.4,ry:0.3});await put('kd-box_stacked',{x:-3,z:-6,h:3,ry:-0.2});await put('kd-barrel_large',{x:4,z:-5.5,h:1.1});await put('kd-barrel_large',{x:5.2,z:-5.0,h:1.1,ry:1});await put('kd-barrel_small_stack',{x:6.5,z:-6,h:1.0});
  await put('kd-keg',{x:-7,z:3,h:1.1,ry:1.6});await put('kd-box_large',{x:-5.5,z:4.2,h:0.9,ry:0.5});await put('kd-box_large',{x:-5.6,y:0.9,z:4.1,h:0.9,ry:0.2});
  await put('kd-table_medium_broken',{x:2,z:2,l:1.6,ry:0.4});await put('kd-chair',{x:2.6,z:3.2,h:0.9,ry:2.2});await put('kd-rubble_half',{x:7,z:4,l:3});await put('kd-rubble_large',{x:-1,z:6,l:4,ry:0.6});
  await put('ks-cargo_A_stacked',{x:8,z:-1,h:2.4,ry:0.2});await put('kd-trunk_large_A',{x:-2,z:-2,l:1.0,ry:0.8});
  for(let i=0;i<5;i++)box(0.12,0.02,1.2,'#7a5a3a',-1+i*0.6,0.01,0,{ry:0.3+i*0.5});
  box(4,4.5,0.1,'#6d7a85',0,0,D/2-0.1);for(let i=0;i<14;i++)box(4,0.03,0.12,'#5b6670',0,0.3+i*0.3,D/2-0.16);
  const lp=box(0.5,0.1,0.5,'#fff',0,H-0.5,0);lp.material=glow('#ffe9a8',0.8);
  return {cam:[5,1.6,6],tgt:[-2,1.2,-3],indoor:true};
},
async village(T){
  floor(200,200,grass(40));floor(4,200,'#b89b6e',0,0,0.003);floor(60,4,'#b89b6e',0,-8,0.004);const K=6;
  const r=rnd(71);const bs=['km-building_home_A_blue','km-building_home_B_blue','km-building_home_A_red','km-building_home_B_yellow','km-building_tavern_blue','km-building_blacksmith_blue','km-building_market_blue'];
  for(let i=0;i<7;i++){await put(bs[i],{x:-7,z:12-i*8,ry:Math.PI/2,k:K});await put(bs[(i+3)%7],{x:7,z:10-i*8,ry:-Math.PI/2,k:K})}
  await put('km-building_well_blue',{x:0,z:-8,k:K*0.9});await put('km-building_windmill_blue',{x:-24,z:-24,ry:0.6,k:K*1.2});await put('km-building_church_blue',{x:18,z:-28,ry:-0.4,k:K*1.1});await put('km-building_castle_blue',{x:0,z:-70,k:K*2.4});
  await put('km-building_tower_A_blue',{x:-30,z:-50,k:K*1.6});
  for(const [n,x,z] of [['km-barrel',2.4,4],['km-barrel',2.8,4.5],['km-crate_A_big',-2.6,2],['km-crate_open',-2.4,6],['km-sack',2.5,-2],['km-wheelbarrow',-2.6,-3],['km-tent',4,-14],['km-weaponrack',-3,-12],['km-resource_lumber',3,-18]])await put(n,{x,z,k:K,ry:r()*6});
  for(let i=0;i<20;i++)await put(r()<.5?'km-tree_single_A':'km-tree_single_B',{x:(r()<.5?-1:1)*(14+r()*30),z:-40+r()*60,k:K*(0.9+r()*0.4),ry:r()*6});
  await put('km-flag_red',{x:3,z:-9,k:K});
  return {cam:[0,1.6,18],tgt:[0,3,-10],indoor:false};
},
async graveyard(T){
  floor(200,200,noiseTex('#4e5a3c',['#3a432c','#5f6b48','#4a3d2c'],30));floor(3,200,'#7d6e58',0,0,0.003);
  const r=rnd(81);
  for(let i=0;i<12;i++)for(const s of [-1,1]){const n=['kh-grave_A','kh-grave_B','kh-gravestone','kh-gravemarker_A'][Math.floor(r()*4)];await put(n,{x:s*(3+(i%3)*3.2+r()*0.4),z:-4-Math.floor(i/3)*4.5-r()*0.5,h:n==='kh-gravemarker_A'?0.9:1.1,ry:(s>0?-1:1)*0.05+(r()-0.5)*0.2})}
  await put('kh-crypt',{x:0,z:-28,h:6});await put('kh-arch_gate',{x:0,z:6,h:4});
  for(let i=0;i<10;i++)for(const s of [-1,1])await put(r()<0.2?'kh-fence_broken':'kh-fence',{x:s*(4+i*3.6),z:6,l:3.6});
  for(let i=0;i<10;i++)await put(r()<.6?'kh-tree_dead_large':'kh-tree_dead_medium',{x:(r()<.5?-1:1)*(14+r()*20),z:-40+r()*40,h:5+r()*3,ry:r()*6});
  for(let i=0;i<6;i++)await put('kh-post_lantern',{x:(i%2?2:-2),z:2-i*5,h:2.6,ry:i%2?Math.PI:0});
  await put('kh-pumpkin_orange_jackolantern',{x:2.2,z:-2,h:0.5});await put('kh-pumpkin_orange',{x:2.7,z:-2.4,h:0.35});await put('kh-shrine_candles',{x:-3,z:-24,h:1.4});await put('kh-coffin',{x:3.5,z:-22,l:2,ry:0.4});await put('kh-bench_decorated',{x:-3.5,z:0,l:1.8,ry:Math.PI/2});
  return {cam:[0.4,1.6,12],tgt:[0,1.4,-10],indoor:false};
},
async spacebase(T){
  floor(300,300,noiseTex('#b5694a',['#8a4a32','#c98563','#9b573c'],40));const K=5;
  const mods=['ks-basemodule_A','ks-basemodule_B','ks-basemodule_C','ks-basemodule_D','ks-basemodule_E','ks-basemodule_garage'];
  for(let i=0;i<6;i++)await put(mods[i],{x:-14+(i%3)*10,z:-8-Math.floor(i/3)*11,k:K,ry:(i%2)*Math.PI/2});
  await put('ks-tunnel_straight_A',{x:-9,y:0,z:-8,k:K});await put('ks-tunnel_straight_A',{x:1,y:0,z:-8,k:K});
  await put('ks-landingpad_large',{x:16,z:2,k:K});await put('ks-lander_A',{x:16,y:2.4,z:2,k:K*1.1});
  for(let i=0;i<4;i++)await put('ks-solarpanel',{x:-22+i*4.5,z:8,k:K,ry:0.3});await put('ks-windturbine_tall',{x:24,z:-20,k:K*1.3});await put('ks-structure_tall',{x:-30,z:-20,k:K});await put('ks-drill_structure',{x:30,z:12,k:K});
  await put('ks-cargo_A_stacked',{x:6,z:4,k:K*0.8});await put('ks-cargo_B_packed',{x:8,z:5,k:K});await put('ks-spacetruck',{x:3,z:9,k:K*1.2,ry:-0.6});await put('ks-lights',{x:-4,z:5,k:K});
  const r=rnd(91);for(let i=0;i<14;i++)await put(r()<.5?'ks-rocks_A':'ks-rock_A',{x:(r()-0.5)*120,z:-30-r()*60,k:K*(1+r()*3),ry:r()*6});
  const pl=sph(30,'#e8a87c',-120,90,-260);pl.material=glow('#e8a87c',0.4);
  return {cam:[0,1.6,22],tgt:[0,3,-6],indoor:false};
}
});

const PLACE_GROUPS=[
  ['🏫 학교',[['classroom','🏫 교실'],['hallway','🚪 복도'],['stairs','🪜 계단'],['cafeteria','🍱 급식실'],['science','🧪 과학실'],['artroom','🎨 미술실'],['library','📚 도서관'],['staffroom','🗂️ 교무실'],['gym','🏀 체육관'],['auditorium','🎭 강당·무대'],['field','⚽ 운동장'],['rooftop','🏢 옥상'],['schoolgate','🚸 교문']]],
  ['🏠 집 · 가게',[['bedroom','🛏️ 내 방'],['livingroom','🛋️ 거실'],['kitchen','🍳 부엌'],['toiletroom','🚻 화장실'],['elevator','🛗 엘리베이터'],['store','🏪 편의점'],['cafe','☕ 카페'],['snackbar','🍜 분식집'],['pcbang','🖥️ PC방'],['karaoke','🎤 노래방'],['hospital','🏥 병실'],['police','🚓 경찰서']]],
  ['🌆 바깥 · 이동',[['alley','🏘️ 골목'],['crossroad','🚦 사거리'],['downtown','🏙️ 시내 거리'],['apartment','🏢 아파트 단지'],['park','🌳 공원'],['riverside','🌉 강변'],['beach','🏖️ 바닷가'],['forest','🌲 숲길'],['bus','🚌 버스 안'],['subway','🚇 지하철 안']]],
  ['🎬 특별한 장면',[['warehouse','📦 폐창고'],['graveyard','🪦 공동묘지'],['village','🏰 판타지 마을'],['spacebase','🚀 우주기지'],['empty','⬜ 빈 바닥 (인형용)']]]];
const PLACE_LIST=PLACE_GROUPS.flatMap(g=>g[1]);
const THEMES=[['kr','🇰🇷 한국'],['jp','🇯🇵 일본'],['west','🇺🇸 서양']];

/* ================= 포즈 인형 ================= */
const JOINTS=['hips','spine','chest','neck','head','lShoulder','lElbow','lWrist','rShoulder','rElbow','rWrist','lHip','lKnee','lAnkle','rHip','rKnee','rAnkle'];
const JNAME={hips:'골반',spine:'허리',chest:'가슴',neck:'목',head:'머리',lShoulder:'왼 어깨',lElbow:'왼 팔꿈치',lWrist:'왼 손목',rShoulder:'오른 어깨',rElbow:'오른 팔꿈치',rWrist:'오른 손목',lHip:'왼 고관절',lKnee:'왼 무릎',lAnkle:'왼 발목',rHip:'오른 고관절',rKnee:'오른 무릎',rAnkle:'오른 발목'};
const POSES={
  stand:{lShoulder:[0,0,8],rShoulder:[0,0,8]},
  walk:{lShoulder:[28,0,6],lElbow:[-20,0,0],rShoulder:[-28,0,6],rElbow:[-20,0,0],lHip:[-25,0,0],lKnee:[10,0,0],rHip:[22,0,0],rKnee:[25,0,0],spine:[-4,0,0]},
  run:{spine:[-14,0,0],lShoulder:[60,0,10],lElbow:[-85,0,0],rShoulder:[-45,0,10],rElbow:[-85,0,0],lHip:[-60,0,0],lKnee:[70,0,0],rHip:[30,0,0],rKnee:[80,0,0],rAnkle:[-20,0,0]},
  sit:{lHip:[-90,0,4],rHip:[-90,0,4],lKnee:[90,0,0],rKnee:[90,0,0],lShoulder:[-10,0,8],rShoulder:[-10,0,8],lElbow:[-40,0,0],rElbow:[-40,0,0],_y:-0.42},
  wave:{rShoulder:[0,0,150],rElbow:[0,0,30],lShoulder:[0,0,8],head:[0,-10,4]},
  point:{rShoulder:[-90,0,0],rElbow:[0,0,0],lShoulder:[0,0,8],head:[0,-15,0],chest:[0,-15,0]},
  cross:{lShoulder:[-40,30,-20],lElbow:[-110,0,0],rShoulder:[-40,30,-20],rElbow:[-110,0,0]},
  surprise:{lShoulder:[0,0,120],lElbow:[0,0,40],rShoulder:[0,0,120],rElbow:[0,0,40],spine:[8,0,0],head:[-10,0,0]},
  think:{rShoulder:[-55,20,-15],rElbow:[-130,0,0],lShoulder:[-30,25,-10],lElbow:[-90,0,0],head:[8,0,8]},
  hands_hips:{lShoulder:[0,0,45],lElbow:[0,-90,-60],rShoulder:[0,0,45],rElbow:[0,-90,-60]},
  crouch:{spine:[25,0,0],lHip:[-110,0,8],rHip:[-110,0,8],lKnee:[130,0,0],rKnee:[130,0,0],lAnkle:[-20,0,0],rAnkle:[-20,0,0],lShoulder:[-30,0,10],rShoulder:[-30,0,10],_y:-0.55},
  fall:{_lie:true,lShoulder:[0,0,90],rShoulder:[0,0,90],lHip:[0,0,10],rHip:[0,0,10]},
  fight:{spine:[5,-20,0],lShoulder:[-70,20,-20],lElbow:[-110,0,0],rShoulder:[-50,20,-20],rElbow:[-130,0,0],lHip:[-20,0,10],rHip:[15,0,10],rKnee:[20,0,0],lKnee:[15,0,0]},
  despair:{spine:[40,0,0],neck:[30,0,0],lShoulder:[-20,0,5],rShoulder:[-20,0,5],lHip:[-90,0,5],rHip:[-90,0,5],lKnee:[150,0,0],rKnee:[150,0,0],_y:-0.75}
};
const POSE_LIST=[['stand','🧍 서기'],['walk','🚶 걷기'],['run','🏃 달리기'],['sit','🪑 앉기'],['crouch','🧎 웅크리기'],['wave','👋 손 흔들기'],['point','👉 가리키기'],['cross','🙅 팔짱'],['hands_hips','🦸 허리에 손'],['think','🤔 생각'],['surprise','😱 놀람'],['fight','🥊 싸움 자세'],['despair','😩 좌절'],['fall','😵 쓰러짐']];
const BODY={adult:{h:1.72,sh:0.2,lw:1},teen:{h:1.6,sh:0.18,lw:0.95},kid:{h:1.2,sh:0.15,lw:0.9},big:{h:1.85,sh:0.25,lw:1.25}};
function makeDoll(kind='adult',color='#e9c9a8'){
  const B=BODY[kind],k=B.h/1.72,lw=B.lw;const M=new THREE.MeshStandardMaterial({color,roughness:0.6});const MJ=new THREE.MeshStandardMaterial({color:shade(color,-0.15),roughness:0.6});
  const doll=new THREE.Group();doll.userData={doll:true,kind,joints:{},color,baseY:0.98*k};
  const J=(name,parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x*k,y*k,z*k);g.userData.joint=name;parent.add(g);doll.userData.joints[name]=g;return g};
  const seg=(j,len,r,dir=-1,o={})=>{const m=new THREE.Mesh(new THREE.CapsuleGeometry(r*k*lw,len*k,4,10),M);m.position.y=dir*len*k/2;if(o.z)m.position.z=o.z*k;m.castShadow=true;m.userData.part=j.userData.joint;j.add(m);const s=new THREE.Mesh(new THREE.SphereGeometry(r*1.05*k*lw,12,10),MJ);s.userData.part=j.userData.joint;s.castShadow=true;j.add(s);return m};
  const hips=J('hips',doll,0,0.98,0);const pel=new THREE.Mesh(new THREE.BoxGeometry(0.32*k*lw,0.16*k,0.2*k*lw),M);pel.position.y=-0.02*k;pel.userData.part='hips';pel.castShadow=true;hips.add(pel);
  const spine=J('spine',hips,0,0.08,0);seg(spine,0.14,0.11,1);
  const chest=J('chest',spine,0,0.2,0);const ch=new THREE.Mesh(new THREE.BoxGeometry(0.36*k*lw,0.3*k,0.22*k*lw),M);ch.position.y=0.13*k;ch.userData.part='chest';ch.castShadow=true;chest.add(ch);
  const neck=J('neck',chest,0,0.3,0);seg(neck,0.06,0.045,1);
  const head=J('head',neck,0,0.09,0);const hd=new THREE.Mesh(new THREE.SphereGeometry(0.11*k,20,16),M);hd.scale.set(0.9,1.15,1);hd.position.y=0.1*k;hd.userData.part='head';hd.castShadow=true;head.add(hd);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.02*k,0.05*k,8),MJ);nose.rotation.x=Math.PI/2;nose.position.set(0,0.1*k,0.11*k);nose.userData.part='head';head.add(nose);
  for(const [s,sx] of [['l',1],['r',-1]]){
    const sh=J(s+'Shoulder',chest,sx*B.sh,0.25,0);seg(sh,0.26,0.048);
    const el=J(s+'Elbow',sh,0,-0.3,0);seg(el,0.23,0.042);
    const wr=J(s+'Wrist',el,0,-0.26,0);const hand=new THREE.Mesh(new THREE.BoxGeometry(0.06*k,0.14*k,0.03*k),M);hand.position.y=-0.07*k;hand.userData.part=s+'Wrist';hand.castShadow=true;wr.add(hand);
    const hp=J(s+'Hip',hips,sx*0.1,-0.06,0);seg(hp,0.38,0.065);
    const kn=J(s+'Knee',hp,0,-0.43,0);seg(kn,0.38,0.055);
    const an=J(s+'Ankle',kn,0,-0.42,0);const ft=new THREE.Mesh(new THREE.BoxGeometry(0.09*k,0.06*k,0.22*k),M);ft.position.set(0,-0.04*k,0.06*k);ft.userData.part=s+'Ankle';ft.castShadow=true;an.add(ft);
  }
  doll.traverse(o=>{if(o.isMesh)o.userData.isDoll=true});
  return doll;
}
function applyPose(d,name){const P=POSES[name]||{};const js=d.userData.joints,D=THREE.MathUtils;for(const j of JOINTS){const r=P[j]||[0,0,0];const sx=/^l[A-Z]/.test(j)?1:/^r[A-Z]/.test(j)?-1:1;js[j].rotation.set(D.degToRad(r[0]),D.degToRad(r[1]*sx),D.degToRad(r[2]*sx))}
  js.hips.position.y=d.userData.baseY+(P._y||0)*(BODY[d.userData.kind].h/1.72);d.rotation.x=0;js.hips.rotation.x=0;
  if(P._lie){js.hips.rotation.x=-Math.PI/2;js.hips.position.y=0.12}d.userData.pose=name}

/* ================= 스타일 · 조명 ================= */
const GRAD=(()=>{const d=new Uint8Array([90,170,255]);const t=new THREE.DataTexture(d,3,1,THREE.RedFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t})();
const EDGE_MAT=new THREE.LineBasicMaterial({color:'#1a1a1a'});
const HULL_MAT=new THREE.ShaderMaterial({uniforms:{thick:{value:0.04},col:{value:new THREE.Color('#151515')}},side:THREE.BackSide,
  vertexShader:`uniform float thick;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vec3 n=normalize(normalMatrix*normal);mv.xyz+=n*thick*(-mv.z)*0.06;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform vec3 col;void main(){gl_FragColor=vec4(col,1.0);}`});
function styleScene(style){
  const all=[];[root,dollRoot].forEach(r=>r.traverse(o=>{if(o.isMesh&&!o.userData.helper)all.push(o)}));
  for(const m of all){
    if(!m.userData.orig)m.userData.orig=m.material;
    // 기존 외곽선 제거
    (m.userData.lines||[]).forEach(l=>l.removeFromParent());m.userData.lines=[];
    const o=m.userData.orig,arr=Array.isArray(o)?o:[o];
    const conv=fn=>Array.isArray(o)?arr.map(fn):fn(o);
    if(style==='real')m.material=o;
    else if(style==='toon')m.material=conv(x=>{const t=new THREE.MeshToonMaterial({color:x.color?x.color.clone():new THREE.Color('#ccc'),map:x.map||null,gradientMap:GRAD,transparent:x.transparent,opacity:x.opacity,side:x.side,alphaTest:x.alphaTest});if(x.emissive){t.emissive=x.emissive.clone();t.emissiveIntensity=x.emissiveIntensity;t.emissiveMap=x.emissiveMap}return t});
    else if(style==='line'||style==='soft')m.material=conv(x=>{const keepMap=m.userData.noEdge&&x.map&&!x.transparent;return new THREE.MeshBasicMaterial({color:keepMap?'#fff':'#fafafa',map:keepMap?x.map:(x.alphaTest?x.map:null),transparent:x.transparent,opacity:x.transparent?Math.min(0.25,x.opacity):1,side:x.side,alphaTest:x.alphaTest})});
    if(style!=='real'){
      const isGlass=arr.some(x=>x.transparent&&x.opacity<0.7);
      if(!m.userData.noEdge&&!isGlass){
        const thr=m.userData.isDoll?60:28;const key=m.geometry.uuid+thr;
        if(!EDGECACHE[key])EDGECACHE[key]=new THREE.EdgesGeometry(m.geometry,thr);
        const l=new THREE.LineSegments(EDGECACHE[key],EDGE_MAT);l.userData.helper=true;l.raycast=()=>{};m.add(l);m.userData.lines.push(l);
        if(m.geometry.attributes.normal&&(m.userData.isDoll||m.geometry.attributes.position.count>60)){const h=new THREE.Mesh(m.geometry,HULL_MAT);h.userData.helper=true;h.raycast=()=>{};m.add(h);m.userData.lines.push(h)}
      }else if(m.userData.noEdge&&!isGlass&&m.geometry.type==='PlaneGeometry'&&style!=='toon'){
        const key=m.geometry.uuid+'p';if(!EDGECACHE[key])EDGECACHE[key]=new THREE.EdgesGeometry(m.geometry,1);const l=new THREE.LineSegments(EDGECACHE[key],EDGE_MAT);l.userData.helper=true;m.add(l);m.userData.lines.push(l)}
    }
  }
  all.forEach(m=>m.userData.styled=m.material);
  root.traverse(o=>{if(o.isLine&&o.userData.isWire)o.material.color.set(style==='real'?'#222':'#111')});
  if(R)R.domElement.style.filter=style==='line'?'grayscale(1) contrast(1.08)':'';if(S&&S.dolls)highlight();
}
const EDGECACHE={};
function setTime(t,indoor){
  const P={day:{sky:'#bfe3ff',sun:'#ffffff',si:2.4,hemi:1.1,pos:[30,60,20],g:'#8a8a7a'},
    sunset:{sky:'#f6a96b',sun:'#ffb070',si:2.0,hemi:0.7,pos:[60,12,-10],g:'#6a4a3a'},
    night:{sky:'#0f1630',sun:'#9db8ff',si:0.35,hemi:0.25,pos:[-20,40,10],g:'#1b1f2a'},
    indoor:{sky:'#e9eef2',sun:'#fff7e8',si:1.0,hemi:1.4,pos:[10,30,10],g:'#a09888'}}[t];
  scene.background=new THREE.Color(P.sky);sunL.color.set(P.sun);sunL.intensity=P.si;sunL.position.set(...P.pos);
  hemiL.intensity=P.hemi;hemiL.color.set(t==='night'?'#6b7bb5':'#ffffff');hemiL.groundColor.set(P.g);
  fillL.intensity=indoor?0.9:0.3;
  lampLights.forEach(l=>{l.obj.userData.orig=new THREE.MeshStandardMaterial({color:'#fff',emissive:t==='night'||t==='sunset'?'#ffd98a':'#000',emissiveIntensity:1.5})});if(S.style)styleScene(S.style);
  if(S.night)S.night.forEach(l=>l.removeFromParent());S.night=[];
  if(t==='night')lampLights.slice(0,8).forEach(l=>{const p=new THREE.PointLight('#ffd98a',8,14,1.6);p.position.copy(l.pos);scene.add(p);S.night.push(p)});
  scene.fog=indoor?null:new THREE.Fog(P.sky,60,220);
}

/* ================= UI ================= */
const CSS=`
#studio{position:fixed;inset:0;z-index:260;background:#17181b;color:#eee;display:flex;font-family:'Noto Sans KR',sans-serif;user-select:none}
#studio .sl{width:250px;flex:none;overflow-y:auto;padding:10px;background:#1e1f22;border-right:1px solid #000;font-size:12px}
#studio .sl h4{font-size:12px;color:#9aa;margin:12px 0 6px;font-weight:700}
#studio .gr{display:grid;grid-template-columns:1fr 1fr;gap:4px}
#studio .pg{font-size:11px;color:#8fa3c0;margin:8px 0 3px;font-weight:700}
#studio .gr3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px}
#studio .b{background:#383a40;color:#eee;border:none;border-radius:6px;padding:7px 4px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
#studio .b.on{background:#1E6BFF;color:#fff}
#studio .b.red{background:#5c2224;color:#ffb3b3}
#studio .row{display:flex;align-items:center;gap:6px;margin:4px 0}
#studio .row input[type=range]{flex:1}
#studio .main{flex:1;display:flex;flex-direction:column;min-width:0}
#studio .top{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#1e1f22;border-bottom:1px solid #000;flex-wrap:wrap}
#studio .stage{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:#111}
#studio canvas.v{display:block;box-shadow:0 0 0 2px #1E6BFF,0 0 30px rgba(0,0,0,.6);touch-action:none}
#studio .hint{position:absolute;left:12px;bottom:10px;font-size:11px;color:#aab;background:rgba(0,0,0,.45);padding:6px 9px;border-radius:6px;pointer-events:none;line-height:1.5}
#studio .pad{position:absolute;right:14px;bottom:14px;display:grid;grid-template-columns:repeat(3,42px);gap:4px}
#studio .pad button{height:42px;border-radius:8px;background:rgba(40,42,48,.85);color:#fff;border:1px solid #444;font-size:16px}
#studio .load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);font-size:14px}
#studio .jsel{background:#24324f;border-radius:8px;padding:8px;margin-top:6px}
@media(max-width:760px){#studio{flex-direction:column-reverse}#studio .sl{width:auto;height:38vh;border-right:none;border-top:1px solid #000}#studio .pad{grid-template-columns:repeat(3,36px)}#studio .pad button{height:36px}}
`;
function h(tag,attrs={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='on')Object.entries(v).forEach(([ev,f])=>e.addEventListener(ev,f));else if(k==='html')e.innerHTML=v;else e.setAttribute(k,v)}kids.flat().forEach(k=>k!=null&&e.append(k));return e}

export async function open3D({w,h:hh,onCapture}){
  cutW=w;cutH=hh;onCap=onCapture;
  if(!document.getElementById('studioCss'))document.head.append(h('style',{id:'studioCss'},CSS));
  S=S||{place:'classroom',theme:'kr',style:'line',time:'day',fov:50};Object.assign(S,{dolls:[],sel:null,joint:null,moveMode:false,night:[]});
  host=h('div',{id:'studio'});document.body.append(host);
  host.innerHTML=`<div class="sl" id="s3l"></div><div class="main"><div class="top" id="s3t"></div><div class="stage" id="s3s"><div class="load" id="s3load">3D 배경을 불러오는 중…</div>
    <div class="hint" id="s3hint">끌기: 회전 · 휠/두 손가락: 확대 · 오른쪽 끌기/Shift+끌기: 이동<br>WASD·방향키: 걷기 · Q/E: 위아래</div>
    <div class="pad"><span></span><button data-m="f">▲</button><button data-m="u">⤒</button><button data-m="l">◀</button><button data-m="b">▼</button><button data-m="r">▶</button><span></span><span></span><button data-m="d">⤓</button></div></div></div>`;
  const stage=host.querySelector('#s3s');
  R=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});R.setPixelRatio(Math.min(2,devicePixelRatio));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.outputColorSpace=THREE.SRGBColorSpace;
  R.domElement.className='v';stage.prepend(R.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(S.fov,w/hh,0.05,800);
  hemiL=new THREE.HemisphereLight('#fff','#888',1);scene.add(hemiL);
  sunL=new THREE.DirectionalLight('#fff',2.4);sunL.castShadow=true;sunL.shadow.mapSize.set(2048,2048);Object.assign(sunL.shadow.camera,{left:-40,right:40,top:40,bottom:-40,far:200});sunL.shadow.bias=-0.0005;scene.add(sunL);
  fillL=new THREE.DirectionalLight('#fff',0.4);fillL.position.set(-10,8,-12);scene.add(fillL);
  root=new THREE.Group();scene.add(root);dollRoot=new THREE.Group();scene.add(dollRoot);
  controls=new OrbitControls(camera,R.domElement);controls.enableDamping=true;controls.dampingFactor=0.12;controls.screenSpacePanning=true;controls.maxPolarAngle=Math.PI*0.98;
  window.addEventListener('resize',fit);fit();
  bindKeys(true);bindPick();
  host.querySelectorAll('.pad button').forEach(b=>{let t;const go=()=>{walk(b.dataset.m,0.35)};b.onpointerdown=e=>{e.preventDefault();go();t=setInterval(go,60)};b.onpointerup=b.onpointerleave=()=>clearInterval(t)});
  renderUI();await buildScene();
  const loop=()=>{raf=requestAnimationFrame(loop);tickKeys();controls.update();R.render(scene,camera)};loop();
}
function fit(){const st=host.querySelector('#s3s'),W=st.clientWidth-24,H=st.clientHeight-24,a=cutW/cutH;let w=W,hh=W/a;if(hh>H){hh=H;w=H*a}R.setSize(Math.floor(w),Math.floor(hh));camera.aspect=a;camera.updateProjectionMatrix()}
function close3D(){cancelAnimationFrame(raf);bindKeys(false);window.removeEventListener('resize',fit);controls.dispose();R.dispose();R.forceContextLoss&&R.forceContextLoss();host.remove();host=null}
async function buildScene(){
  const ld=host.querySelector('#s3load');ld.style.display='flex';
  root.clear();lampLights=[];
  try{const info=await PLACES[S.place](S.theme);S.info=info;
    camera.position.set(...info.cam);controls.target.set(...info.tgt);camera.fov=S.fov;camera.updateProjectionMatrix();
    if(info.indoor&&S.time==='day')S.time='indoor';if(!info.indoor&&S.time==='indoor')S.time='day';
    setTime(S.time,info.indoor);styleScene(S.style);renderUI();
  }catch(e){console.error(e);ld.textContent='불러오지 못했어요: '+e.message;return}
  ld.style.display='none';
}
function renderUI(){
  const L=host.querySelector('#s3l'),T=host.querySelector('#s3t');
  const btn=(lab,on,fn,cls='')=>{const b=h('button',{class:'b '+(on?'on ':'')+cls},lab);b.onclick=fn;return b};
  T.replaceChildren(
    btn('✕ 닫기',0,()=>close3D()),
    h('b',{style:'font-size:14px'},'🎥 3D 배경'),
    h('span',{style:'flex:1'}),
    btn('📸 배경으로 넣기',0,()=>capture(true),'on'),
    btn('✏️ 대고 그리기용으로 넣기',0,()=>capture(false)));
  const sel=S.sel;
  L.replaceChildren(
    h('h4',{},'나라 느낌'),h('div',{class:'gr3'},THEMES.map(([k,n])=>btn(n,S.theme===k,()=>{S.theme=k;buildScene()}))),
    h('h4',{},'장소'),...PLACE_GROUPS.flatMap(([g,L])=>[h('div',{class:'pg'},g),h('div',{class:'gr'},L.map(([k,n])=>btn(n,S.place===k,()=>{S.place=k;buildScene()})))]),
    h('h4',{},'그림 스타일'),h('div',{class:'gr'},[['line','✏️ 선화'],['toon','🎨 툰 채색'],['soft','⬜ 흐린 밑그림'],['real','📷 실사풍']].map(([k,n])=>btn(n,S.style===k,()=>{S.style=k;styleScene(k);renderUI()}))),
    h('h4',{},'시간 · 조명'),h('div',{class:'gr'},[['day','☀️ 낮'],['sunset','🌇 노을'],['night','🌙 밤'],['indoor','💡 실내등']].map(([k,n])=>btn(n,S.time===k,()=>{S.time=k;setTime(k,S.info&&S.info.indoor);renderUI()}))),
    h('h4',{},'카메라'),
    h('div',{class:'gr'},[['eye','👀 눈높이',1.6],['sit','🪑 앉은 눈높이',1.15],['low','🐜 바닥에서 올려다보기',0.25],['high','🦅 위에서 내려다보기',8]].map(([k,n,y])=>btn(n,0,()=>camHeight(k,y)))),
    h('div',{class:'row'},'화각',(()=>{const i=h('input',{type:'range',min:15,max:110,value:S.fov});i.oninput=()=>{S.fov=+i.value;camera.fov=S.fov;camera.updateProjectionMatrix();i.nextSibling.textContent=i.value+'°'};return i})(),h('span',{},S.fov+'°')),
    h('div',{class:'gr'},btn('📐 수평 맞추기',0,()=>{controls.target.y=camera.position.y;controls.update()}),btn('↺ 처음 시점',0,()=>{camera.position.set(...S.info.cam);controls.target.set(...S.info.tgt)})),
    h('h4',{},'🧍 포즈 인형'),
    h('div',{class:'gr'},[['adult','🧍 어른'],['teen','🧑 학생'],['kid','🧒 어린이'],['big','💪 덩치']].map(([k,n])=>btn('+ '+n,0,()=>addDoll(k)))),
    sel?dollPanel(sel):h('div',{style:'color:#889;margin-top:6px;line-height:1.5'},'인형을 추가하고 몸을 눌러 관절을 고르세요. 슬라이더로 굽히고 돌려요.')
  );
}
function dollPanel(d){
  const btn=(lab,on,fn,cls='')=>{const b=h('button',{class:'b '+(on?'on ':'')+cls},lab);b.onclick=fn;return b};
  const box=h('div',{class:'jsel'});
  const sl=(lab,min,max,step,get,set)=>{const v=get();const i=h('input',{type:'range',min,max,step,value:v});const s=h('span',{style:'width:38px;text-align:right'},String(Math.round(v*10)/10));i.oninput=()=>{set(+i.value);s.textContent=i.value};return h('div',{class:'row'},lab,i,s)};
  box.append(h('b',{},'선택한 인형'),
    h('div',{class:'gr',style:'margin-top:6px'},POSE_LIST.map(([k,n])=>btn(n,d.userData.pose===k,()=>{applyPose(d,k);S.joint=null;renderUI()}))),
    h('h4',{},'위치 · 방향'),
    sl('좌우',-30,30,0.05,()=>d.position.x,v=>d.position.x=v),sl('앞뒤',-30,30,0.05,()=>d.position.z,v=>d.position.z=v),sl('높이',-1,5,0.01,()=>d.position.y,v=>d.position.y=v),
    sl('방향',-180,180,1,()=>THREE.MathUtils.radToDeg(d.rotation.y),v=>d.rotation.y=THREE.MathUtils.degToRad(v)),
    sl('크기',0.5,1.6,0.01,()=>d.scale.x,v=>d.scale.setScalar(v)),
    h('div',{class:'gr',style:'margin-top:4px'},btn(S.moveMode?'📍 바닥 누르면 이동: 켜짐':'📍 바닥 눌러 옮기기',S.moveMode,()=>{S.moveMode=!S.moveMode;renderUI()}),btn('🧭 카메라 쪽 보기',0,()=>{d.rotation.y=Math.atan2(camera.position.x-d.position.x,camera.position.z-d.position.z);renderUI()}),
      btn('⧉ 복제',0,()=>{const n=addDoll(d.userData.kind,d);}),btn('🗑️ 삭제',0,()=>{d.removeFromParent();S.dolls=S.dolls.filter(x=>x!==d);S.sel=null;S.joint=null;renderUI()},'red')));
  if(S.joint){const j=d.userData.joints[S.joint];const D=THREE.MathUtils;
    box.append(h('h4',{},'관절: '+JNAME[S.joint]),
      sl('앞뒤로 굽힘',-180,180,1,()=>D.radToDeg(j.rotation.x),v=>j.rotation.x=D.degToRad(v)),
      sl('비틀기',-180,180,1,()=>D.radToDeg(j.rotation.y),v=>j.rotation.y=D.degToRad(v)),
      sl('옆으로 벌림',-180,180,1,()=>D.radToDeg(j.rotation.z),v=>j.rotation.z=D.degToRad(v)),
      btn('↺ 이 관절 초기화',0,()=>{j.rotation.set(0,0,0);renderUI()}));
  }else box.append(h('div',{style:'color:#9ab;margin-top:8px'},'몸의 한 부분을 누르면 그 관절을 움직일 수 있어요.'));
  const jl=h('div',{class:'gr3',style:'margin-top:6px'},JOINTS.map(j=>btn(JNAME[j],S.joint===j,()=>{S.joint=j;highlight();renderUI()})));box.append(h('h4',{},'관절 바로 고르기'),jl);
  return box;
}
function addDoll(kind,from){
  const d=makeDoll(kind,['#e9c9a8','#d6b08c','#f1d6bf','#c99e7a'][S.dolls.length%4]);
  const t=controls.target,dir=new V3().subVectors(t,camera.position).setY(0).normalize();
  const side=new V3(-dir.z,0,dir.x),n=S.dolls.length,off=(n%2?1:-1)*Math.ceil(n/2)*0.9;const p=from?from.position.clone().add(side.clone().multiplyScalar(0.9)):new V3(camera.position.x+dir.x*3+side.x*off,0,camera.position.z+dir.z*3+side.z*off);
  d.position.copy(p);d.position.y=from?from.position.y:0;d.rotation.y=Math.atan2(camera.position.x-p.x,camera.position.z-p.z);
  dollRoot.add(d);S.dolls.push(d);applyPose(d,from?from.userData.pose:'stand');
  if(from){const fj=from.userData.joints,tj=d.userData.joints;JOINTS.forEach(j=>tj[j].rotation.copy(fj[j].rotation));tj.hips.position.copy(fj.hips.position);d.scale.copy(from.scale)}
  styleScene(S.style);S.sel=d;S.joint=null;highlight();renderUI();return d;
}
const HL=new THREE.MeshBasicMaterial({color:'#7fa8ff'});
function highlight(){S.dolls.forEach(d=>d.traverse(o=>{if(o.isMesh&&o.userData.isDoll&&!o.userData.helper){const on=d===S.sel&&S.joint&&o.userData.part===S.joint;o.material=on?HL:(o.userData.styled||o.material)}}))}
function bindPick(){
  const el=R.domElement;let down=null;const ray=new THREE.Raycaster();
  el.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});
  el.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=el.getBoundingClientRect();
    const p=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(p,camera);
    if(S.moveMode&&S.sel){const hit=ray.intersectObjects(root.children,true)[0];if(hit){S.sel.position.x=hit.point.x;S.sel.position.z=hit.point.z;S.sel.position.y=hit.point.y>1.5?S.sel.position.y:hit.point.y;renderUI()}return}
    const hit=ray.intersectObjects(dollRoot.children,true).find(h=>h.object.userData.isDoll&&!h.object.userData.helper);
    if(hit){let d=hit.object;while(d&&!d.userData.doll)d=d.parent;S.sel=d;S.joint=hit.object.userData.part||null;highlight();renderUI()}
    else if(S.sel){S.sel=null;S.joint=null;highlight();renderUI()}});
}
function camHeight(k,y){const c=camera.position,t=controls.target;
  if(k==='high'){const d=new V3().subVectors(c,t).setY(0);if(d.length()<0.1)d.set(0,0,1);d.setLength(Math.max(4,d.length()));camera.position.set(t.x+d.x,t.y+y,t.z+d.z)}
  else if(k==='low'){c.y=y;t.y=y+1.6}
  else{const dy=y-c.y;c.y=y;t.y+=dy}controls.update()}
function walk(m,s){const f=new V3().subVectors(controls.target,camera.position).setY(0).normalize(),r=new V3().crossVectors(f,new V3(0,1,0));const v=new V3();
  if(m==='f')v.copy(f);if(m==='b')v.copy(f).negate();if(m==='l')v.copy(r).negate();if(m==='r')v.copy(r);if(m==='u')v.set(0,1,0);if(m==='d')v.set(0,-1,0);v.multiplyScalar(s);camera.position.add(v);controls.target.add(v)}
function onKey(e){if(e.target.tagName==='INPUT')return;keys[e.key.toLowerCase()]=e.type==='keydown';if(e.type==='keydown'&&e.key==='Escape')close3D()}
function bindKeys(on){['keydown','keyup'].forEach(t=>on?window.addEventListener(t,onKey):window.removeEventListener(t,onKey))}
function tickKeys(){const s=keys.shift?0.25:0.1;if(keys.w||keys.arrowup)walk('f',s);if(keys.s||keys.arrowdown)walk('b',s);if(keys.a||keys.arrowleft)walk('l',s);if(keys.d||keys.arrowright)walk('r',s);if(keys.q)walk('d',s);if(keys.e)walk('u',s)}
async function capture(inc){
  const sc=Math.min(3,Math.max(1.5,2048/Math.max(cutW,cutH)));const W=Math.round(cutW*sc),H=Math.round(cutH*sc);
  const prevSel=S.sel,prevJ=S.joint;S.sel=null;S.joint=null;highlight();
  const old=new THREE.Vector2();R.getSize(old);const pr=R.getPixelRatio();R.setPixelRatio(1);R.setSize(W,H,false);camera.aspect=cutW/cutH;camera.updateProjectionMatrix();R.render(scene,camera);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');if(S.style==='line')x.filter='grayscale(1) contrast(1.08)';x.drawImage(R.domElement,0,0);x.filter='none';
  R.setPixelRatio(pr);R.setSize(old.x,old.y);S.sel=prevSel;S.joint=prevJ;highlight();
  if(S.style==='soft'){x.globalCompositeOperation='saturation';x.fillStyle='#888';x.globalAlpha=0.7;x.fillRect(0,0,W,H);x.globalCompositeOperation='source-over';x.globalAlpha=0.55;x.fillStyle='#fff';x.fillRect(0,0,W,H);x.globalAlpha=1}
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));const img=new Image();img.src=URL.createObjectURL(blob);await img.decode();
  close3D();onCap&&onCap(img,blob,inc);
}
