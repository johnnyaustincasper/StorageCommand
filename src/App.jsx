import { useState, useRef, useEffect, useCallback } from "react";

const FACILITY = { name: "Riverside Storage", address: "4521 S Memorial Dr, Tulsa, OK 74145" };
const SIZES = [
  { key:"small", label:"5×5", sqft:25, price:49, desc:"Boxes & seasonal items", features:["Interior","Ground floor","24/7 access"] },
  { key:"medium", label:"10×10", sqft:100, price:99, desc:"1-bedroom apartment", features:["Drive-up","Ground floor","24/7","Wide doors"] },
  { key:"large", label:"10×20", sqft:200, price:169, desc:"2-3 bedroom home", features:["Drive-up","12ft ceiling","24/7","Wide doors"] },
  { key:"xl", label:"10×30", sqft:300, price:249, desc:"Commercial / multi-vehicle", features:["Drive-up","14ft ceiling","24/7","Forklift"] },
];
const STATUS = {
  available:{color:"#22c55e",label:"Available"},occupied:{color:"#ef4444",label:"Occupied"},
  reserved:{color:"#3b82f6",label:"Reserved"},maintenance:{color:"#f59e0b",label:"Maintenance"},
  overdue:{color:"#dc2626",label:"Past Due"},
};
const TENANTS=[{name:"Sarah Mitchell",phone:"(918) 555-0142",email:"sarah.m@email.com",since:"2024-03-15"},{name:"James Rodriguez",phone:"(918) 555-0198",email:"james.r@email.com",since:"2024-06-01"},{name:"Emily Chen",phone:"(918) 555-0267",email:"emily.c@email.com",since:"2025-01-10"},{name:"Marcus Johnson",phone:"(918) 555-0334",email:"marcus.j@email.com",since:"2024-11-20"},{name:"Lisa Park",phone:"(918) 555-0411",email:"lisa.p@email.com",since:"2025-02-05"},{name:"David Kim",phone:"(918) 555-0523",email:"david.k@email.com",since:"2024-08-14"},{name:"Rachel Foster",phone:"(918) 555-0647",email:"rachel.f@email.com",since:"2024-05-22"},{name:"Tom Williams",phone:"(918) 555-0718",email:"tom.w@email.com",since:"2025-03-01"}];

function genUnits(){
  const u=[],sts=["available","available","available","occupied","occupied","occupied","occupied","reserved","maintenance","overdue"];
  const dims={small:{w:1.1,h:0.9,d:1.3},medium:{w:1.6,h:1.1,d:1.8},large:{w:2.2,h:1.4,d:2.3},xl:{w:2.8,h:1.7,d:2.8}};
  const rZ=[{z:-6,f:1},{z:-2,f:-1},{z:4,f:1},{z:8,f:-1}];
  const rows=["A1","A2","B1","B2"];
  const cfg=[["small","small","medium","medium","large","xl","medium","small","small"],["small","medium","medium","large","large","xl","medium","small","small"],["medium","large","xl","xl","large","medium","small","small","small"],["medium","large","xl","large","medium","medium","small","small","small"]];
  let ti=0;
  rows.forEach((row,ri)=>{let x=-12;cfg[ri].forEach((type,i)=>{const d=dims[type];const s=SIZES.find(s=>s.key===type);const status=sts[Math.floor(Math.random()*sts.length)];const tenant=(status==="occupied"||status==="overdue")?TENANTS[ti++%TENANTS.length]:null;u.push({id:`${row}-${String(i+1).padStart(2,"0")}`,type,status,...s,w:d.w,h:d.h,d:d.d,tenant,balance:status==="overdue"?Math.floor(Math.random()*300)+80:0,x:x+d.w/2,y:0,z:rZ[ri].z+(rZ[ri].f*d.d)/2});x+=d.w+0.45;});});
  return u;
}
const ALL_UNITS=genUnits();
const genCode=()=>Math.floor(1000+Math.random()*9000)+String.fromCharCode(65+Math.floor(Math.random()*26));
const P={bg:"#fefefe",card:"#ffffff",border:"#f0ece4",borderLight:"#f7f4ef",text:"#1a1714",sub:"#8c8378",muted:"#b8afa5",gold:"#c9a84c",goldLight:"#f5eed9",goldDark:"#8b7432",blue:"#3b82f6",success:"#22c55e",danger:"#ef4444",font:"'Cormorant Garamond', serif",fontBody:"'Nunito', sans-serif",radius:12};
const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];

// ═══════════════════════════════════════════════
// CANVAS 3D RENDERER + REACT EVENT OVERLAY
// ═══════════════════════════════════════════════
function FacilityMap({ units, selId, onSelect, statusFilter }) {
  const canvasRef = useRef(null);
  const projRef = useRef([]);
  const camRef = useRef({ angle:30, tiltX:-1.1, cx:0, cz:1, zoom:28, dist:30 });
  const targetRef = useRef({ angle:30, tiltX:-1.1, cx:0, cz:1, zoom:28 });
  const selRef = useRef(null);
  const filterRef = useRef(null);
  const gestureRef = useRef({
    active:false, type:null,
    sx:0, sy:0, moved:false,
    startCx:0, startCz:0,
    startAngle:0, startRotAngle:0,
    startDist:0, startZoom:0,
    touches:[],
  });
  const idleRef = useRef(0);

  useEffect(()=>{selRef.current=selId;},[selId]);
  useEffect(()=>{filterRef.current=statusFilter;},[statusFilter]);

  useEffect(()=>{
    const t=targetRef.current;
    if(selId){
      const u=units.find(u=>u.id===selId);
      if(u){t.cx=u.x;t.cz=u.z;t.zoom=60;t.tiltX=-0.6;}
    }else{
      t.cx=0;t.cz=1;t.zoom=28;t.tiltX=-1.1;
    }
  },[selId,units]);

  const project = useCallback((x,y,z,c)=>{
    let dx=x-c.cx, dz=z-c.cz;
    const ca=Math.cos(c.angle*Math.PI/180),sa=Math.sin(c.angle*Math.PI/180);
    let rx=dx*ca-dz*sa, rz=dx*sa+dz*ca;
    const cb=Math.cos(c.tiltX),sb=Math.sin(c.tiltX);
    let ry=y*cb-rz*sb, rz2=y*sb+rz*cb;
    const sc=c.dist/(c.dist+rz2);
    return{sx:c.scx+rx*sc*c.zm,sy:c.scy-ry*sc*c.zm,dp:rz2,sc};
  },[]);

  useEffect(()=>{
    const cv=canvasRef.current;if(!cv)return;
    const ctx=cv.getContext("2d");
    let frame, last=performance.now();
    const render=(ts)=>{
      const dt=Math.min(0.05,(ts-last)/1000);last=ts;
      const t=ts*0.001;
      const c=camRef.current,tg=targetRef.current;

      c.angle+=(tg.angle-c.angle)*0.05;
      c.tiltX+=(tg.tiltX-c.tiltX)*0.04;
      c.cx+=(tg.cx-c.cx)*0.05;
      c.cz+=(tg.cz-c.cz)*0.05;
      c.zoom+=(tg.zoom-c.zoom)*0.04;

      if(!gestureRef.current.active && !selRef.current){
        idleRef.current+=dt;
        if(idleRef.current>5 && c.zoom < 35) tg.angle+=dt*1.5;
      }

      const dpr=window.devicePixelRatio||1;
      const rect=cv.getBoundingClientRect();
      cv.width=rect.width*dpr;cv.height=rect.height*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const W=rect.width,H=rect.height;
      c.scx=W/2;c.scy=H/2+H*0.06;c.zm=c.zoom;

      const bg=ctx.createRadialGradient(W/2,H*0.3,0,W/2,H*0.3,W*0.9);
      bg.addColorStop(0,"#f0ece4");bg.addColorStop(0.6,"#e5e0d8");bg.addColorStop(1,"#d8d3cb");
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

      const gP=[[-20,-14],[20,-14],[20,14],[-20,14]].map(([gx,gz])=>project(gx,-0.03,gz,c));
      ctx.beginPath();ctx.moveTo(gP[0].sx,gP[0].sy);gP.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
      ctx.fillStyle="rgba(180,175,168,0.35)";ctx.fill();

      for(let gx=-18;gx<=18;gx+=2){const p1=project(gx,0,-12,c),p2=project(gx,0,12,c);ctx.strokeStyle="rgba(150,145,138,0.08)";ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(p1.sx,p1.sy);ctx.lineTo(p2.sx,p2.sy);ctx.stroke();}
      for(let gz=-12;gz<=12;gz+=2){const p1=project(-18,0,gz,c),p2=project(18,0,gz,c);ctx.strokeStyle="rgba(150,145,138,0.08)";ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(p1.sx,p1.sy);ctx.lineTo(p2.sx,p2.sy);ctx.stroke();}

      [[-7.5,-0.5],[3,10]].forEach(([z1,z2])=>{
        const pp=[[-13.5,z1],[13.5,z1],[13.5,z2],[-13.5,z2]].map(([x,z])=>project(x,-0.02,z,c));
        ctx.beginPath();ctx.moveTo(pp[0].sx,pp[0].sy);pp.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
        ctx.fillStyle="rgba(195,190,182,0.3)";ctx.fill();
      });

      [[-1.2,-0.5],[9,10]].forEach(([z1,z2])=>{
        const pp=[[-14,z1],[14,z1],[14,z2],[-14,z2]].map(([x,z])=>project(x,-0.015,z,c));
        ctx.beginPath();ctx.moveTo(pp[0].sx,pp[0].sy);pp.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
        ctx.fillStyle="rgba(160,155,148,0.25)";ctx.fill();
      });

      [{z:-5,l:"BUILDING A"},{z:3,l:"BUILDING B"}].forEach(({z,l})=>{
        const p=project(0,0.01,z,c);
        ctx.font="800 9px 'Nunito',sans-serif";ctx.fillStyle="rgba(140,135,128,0.2)";ctx.textAlign="center";
        ctx.fillText(l,p.sx,p.sy);
      });

      const sorted=[...units].map(u=>({...u,_dp:project(u.x,u.y,u.z,c).dp})).sort((a,b)=>b._dp-a._dp);
      const projected=[];
      const curSel=selRef.current;
      const curFilter=filterRef.current;

      sorted.forEach(unit=>{
        const hw=unit.w/2,hd=unit.d/2;
        const isSel=unit.id===curSel;
        const isDim=(curFilter&&unit.status!==curFilter);
        const st=STATUS[unit.status];
        const [cr,cg,cb]=hx(st.color);
        const alpha=isDim?0.1:isSel?1.0:0.78;
        const unitH=isSel?unit.h*1.15:unit.h;
        const uhh=unitH/2;

        const corners=[
          [-hw,-uhh,-hd],[hw,-uhh,-hd],[hw,uhh,-hd],[-hw,uhh,-hd],
          [-hw,-uhh,hd],[hw,-uhh,hd],[hw,uhh,hd],[-hw,uhh,hd],
        ].map(([dx,dy,dz])=>project(unit.x+dx,unitH/2+dy,unit.z+dz,c));

        if(!isDim){
          const sh=[[-hw,0,-hd],[hw,0,-hd],[hw,0,hd],[-hw,0,hd]].map(([dx,,dz])=>project(unit.x+dx+0.15,-0.02,unit.z+dz+0.15,c));
          ctx.save();ctx.filter="blur(4px)";ctx.beginPath();ctx.moveTo(sh[0].sx+2,sh[0].sy+2);sh.slice(1).forEach(p=>ctx.lineTo(p.sx+2,p.sy+2));ctx.closePath();
          ctx.fillStyle=isSel?`${st.color}25`:"rgba(0,0,0,0.07)";ctx.fill();ctx.restore();
        }

        if(unit.status==="available"&&!isDim&&!isSel){
          const pulse=0.5+Math.sin(t*1.6+unit.x*0.3)*0.3;
          const gc=project(unit.x,unitH*0.6,unit.z,c);
          const gr=Math.max(10,corners[3].sc*c.zm*0.18);
          const glow=ctx.createRadialGradient(gc.sx,gc.sy,0,gc.sx,gc.sy,gr);
          glow.addColorStop(0,`rgba(34,197,94,${0.15*pulse})`);glow.addColorStop(1,"rgba(34,197,94,0)");
          ctx.fillStyle=glow;ctx.fillRect(gc.sx-gr,gc.sy-gr,gr*2,gr*2);
        }
        if(isSel){
          const sp=0.6+Math.sin(t*2.5)*0.4;
          const gc=project(unit.x,unitH,unit.z,c);
          const gr=Math.max(18,corners[3].sc*c.zm*0.3);
          const glow=ctx.createRadialGradient(gc.sx,gc.sy,0,gc.sx,gc.sy,gr);
          glow.addColorStop(0,`${st.color}${Math.round(55*sp).toString(16).padStart(2,'0')}`);glow.addColorStop(1,`${st.color}00`);
          ctx.fillStyle=glow;ctx.fillRect(gc.sx-gr,gc.sy-gr,gr*2,gr*2);
        }

        const faces=[
          {i:[0,1,2,3],b:0.78,n:"f"},{i:[5,4,7,6],b:0.68,n:"bk"},
          {i:[3,2,6,7],b:1.0,n:"t"},{i:[4,5,1,0],b:0.42,n:"bt"},
          {i:[4,0,3,7],b:0.55,n:"l"},{i:[1,5,6,2],b:0.88,n:"r"},
        ];
        faces.sort((a,b)=>{const dA=a.i.reduce((s,i)=>s+corners[i].dp,0);const dB=b.i.reduce((s,i)=>s+corners[i].dp,0);return dB-dA;});

        faces.forEach(face=>{
          const pts=face.i.map(i=>corners[i]);
          ctx.beginPath();ctx.moveTo(pts[0].sx,pts[0].sy);pts.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
          const br=face.b;
          if(face.n==="t"&&!isDim){
            const tg=ctx.createLinearGradient(pts[0].sx,pts[0].sy,pts[2].sx,pts[2].sy);
            tg.addColorStop(0,`rgba(${Math.round(cr*br)},${Math.round(cg*br)},${Math.round(cb*br)},${alpha})`);
            tg.addColorStop(1,`rgba(${Math.round(cr*br*0.85)},${Math.round(cg*br*0.85)},${Math.round(cb*br*0.85)},${alpha})`);
            ctx.fillStyle=tg;
          }else{
            ctx.fillStyle=`rgba(${Math.round(cr*br)},${Math.round(cg*br)},${Math.round(cb*br)},${alpha})`;
          }
          ctx.fill();
          if(isSel){ctx.strokeStyle="rgba(255,255,255,0.9)";ctx.lineWidth=2;ctx.stroke();}
          else if(!isDim){ctx.strokeStyle=face.n==="t"?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.04)";ctx.lineWidth=face.n==="t"?0.7:0.4;ctx.stroke();}
        });

        if(!isDim&&unit.status==="available"){
          const d1=project(unit.x-hw*0.5,0.02,unit.z-hd,c),d2=project(unit.x+hw*0.5,0.02,unit.z-hd,c);
          const d3=project(unit.x-hw*0.5,unitH*0.5,unit.z-hd,c),d4=project(unit.x+hw*0.5,unitH*0.5,unit.z-hd,c);
          ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.lineWidth=0.5;
          for(let dl=0;dl<=3;dl++){const f=dl/3;ctx.beginPath();ctx.moveTo(d1.sx+(d3.sx-d1.sx)*f,d1.sy+(d3.sy-d1.sy)*f);ctx.lineTo(d2.sx+(d4.sx-d2.sx)*f,d2.sy+(d4.sy-d2.sy)*f);ctx.stroke();}
        }

        if(!isDim){
          const tc={sx:(corners[2].sx+corners[3].sx+corners[6].sx+corners[7].sx)/4,sy:(corners[2].sy+corners[3].sy+corners[6].sy+corners[7].sy)/4};
          const ls=corners[3].sc*c.zm;
          if(ls>10){
            const fs=Math.max(6,Math.min(14,ls*0.13));
            ctx.font=`800 ${fs}px 'Nunito',sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillStyle="rgba(0,0,0,0.2)";ctx.fillText(unit.id,tc.sx+0.5,tc.sy+0.5);
            ctx.fillStyle=isSel?"#fff":"rgba(255,255,255,0.92)";ctx.fillText(unit.id,tc.sx,tc.sy);
            if(ls>22){ctx.font=`700 ${Math.max(5,fs*0.55)}px 'Nunito',sans-serif`;ctx.fillStyle=isSel?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.5)";ctx.fillText(`$${unit.price}/mo`,tc.sx,tc.sy+fs*0.9);}
          }
        }

        const ctr=project(unit.x,unitH/2+uhh,unit.z,c);
        projected.push({id:unit.id,sx:ctr.sx,sy:ctr.sy,radius:Math.max(18,ctr.sc*c.zm*0.2)});
      });
      projRef.current=projected;

      const now=new Date();
      const tStr=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
      const avC=units.filter(u=>u.status==="available").length;
      const ocP=Math.round(units.filter(u=>u.status!=="available").length/units.length*100);
      ctx.save();
      const dp=0.5+Math.sin(t*4)*0.5;
      ctx.beginPath();ctx.arc(15,17,3.5,0,Math.PI*2);ctx.fillStyle=`rgba(34,197,94,${0.3+dp*0.5})`;ctx.fill();
      ctx.beginPath();ctx.arc(15,17,1.8,0,Math.PI*2);ctx.fillStyle="#22c55e";ctx.fill();
      ctx.font="800 7px 'Nunito',sans-serif";ctx.textAlign="left";ctx.fillStyle="rgba(34,197,94,0.7)";ctx.fillText("LIVE",23,20);
      ctx.font="500 8px 'Nunito',sans-serif";ctx.fillStyle="rgba(140,131,120,0.5)";ctx.fillText(tStr,44,20);
      ctx.textAlign="right";ctx.font="600 8px 'Nunito',sans-serif";ctx.fillStyle="rgba(140,131,120,0.45)";ctx.fillText(`${ocP}% Occ · ${avC} open`,W-10,18);
      ctx.restore();

      frame=requestAnimationFrame(render);
    };
    render(performance.now());
    return()=>cancelAnimationFrame(frame);
  },[units,project]);

  const hitTest=(cx,cy)=>{
    const cv=canvasRef.current;if(!cv)return null;
    const rect=cv.getBoundingClientRect();
    const mx=cx-rect.left,my=cy-rect.top;
    let best=null,bestD=Infinity;
    projRef.current.forEach(({id,sx,sy,radius})=>{
      const d=Math.sqrt((mx-sx)**2+(my-sy)**2);
      if(d<radius*3&&d<bestD){bestD=d;best=id;}
    });
    return best;
  };

  const getTouchInfo=(touches)=>{
    if(touches.length<2)return{dist:0,angle:0,mx:touches[0]?.clientX||0,my:touches[0]?.clientY||0};
    const dx=touches[1].clientX-touches[0].clientX;
    const dy=touches[1].clientY-touches[0].clientY;
    return{dist:Math.sqrt(dx*dx+dy*dy),angle:Math.atan2(dy,dx),mx:(touches[0].clientX+touches[1].clientX)/2,my:(touches[0].clientY+touches[1].clientY)/2};
  };

  const applyPan=(dx,dy)=>{
    const t=targetRef.current;
    const scale=18/Math.max(t.zoom,10);
    const ang=t.angle*Math.PI/180;
    const ca=Math.cos(ang),sa=Math.sin(ang);
    t.cx+=(dx*ca-dy*sa)*scale*0.012;
    t.cz+=(dx*sa+dy*ca)*scale*0.012;
  };

  const ptrCache=useRef([]);
  const lastPan=useRef({x:0,y:0});
  const lastPinch=useRef({dist:0,angle:0,mx:0,my:0});

  const onPointerDown=(e)=>{
    ptrCache.current=ptrCache.current.filter(p=>p.pointerId!==e.pointerId);
    ptrCache.current.push({pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY});
    const g=gestureRef.current;
    g.moved=false;idleRef.current=0;
    if(ptrCache.current.length===1){
      g.active=true;g.type="pan";
      lastPan.current={x:e.clientX,y:e.clientY};
      g.sx=e.clientX;g.sy=e.clientY;
    }else if(ptrCache.current.length>=2){
      g.active=true;g.type="pinch";g.moved=true;
      const info=getTouchInfo(ptrCache.current);
      lastPinch.current={dist:info.dist,angle:info.angle,mx:info.mx,my:info.my};
    }
  };

  const onPointerMove=(e)=>{
    ptrCache.current=ptrCache.current.map(p=>p.pointerId===e.pointerId?{pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY}:p);
    const g=gestureRef.current;
    if(!g.active)return;
    if(g.type==="pan"&&ptrCache.current.length===1){
      const dx=e.clientX-lastPan.current.x;
      const dy=e.clientY-lastPan.current.y;
      if(Math.abs(e.clientX-g.sx)>4||Math.abs(e.clientY-g.sy)>4)g.moved=true;
      if(g.moved)applyPan(-dx,-dy);
      lastPan.current={x:e.clientX,y:e.clientY};
    }else if(g.type==="pinch"&&ptrCache.current.length>=2){
      const info=getTouchInfo(ptrCache.current);
      const lp=lastPinch.current;
      if(lp.dist>0){const ratio=info.dist/lp.dist;targetRef.current.zoom=Math.max(15,Math.min(100,targetRef.current.zoom*ratio));}
      const angleDelta=(info.angle-lp.angle)*180/Math.PI;
      targetRef.current.angle-=angleDelta;
      applyPan(-(info.mx-lp.mx),-(info.my-lp.my));
      lastPinch.current={dist:info.dist,angle:info.angle,mx:info.mx,my:info.my};
    }
  };

  const onPointerUp=(e)=>{
    ptrCache.current=ptrCache.current.filter(p=>p.pointerId!==e.pointerId);
    const g=gestureRef.current;
    if(ptrCache.current.length===0){
      if(!g.moved){const id=hitTest(e.clientX,e.clientY);if(id)onSelect(id);}
      g.active=false;g.type=null;
    }else if(ptrCache.current.length===1){
      const p=ptrCache.current[0];g.type="pan";lastPan.current={x:p.clientX,y:p.clientY};
    }
  };

  const onPointerCancel=(e)=>{
    ptrCache.current=ptrCache.current.filter(p=>p.pointerId!==e.pointerId);
    if(ptrCache.current.length===0){gestureRef.current.active=false;gestureRef.current.type=null;}
  };

  const onWheel=(e)=>{
    e.preventDefault();idleRef.current=0;
    const delta=e.deltaY>0?-3:3;
    targetRef.current.zoom=Math.max(15,Math.min(100,targetRef.current.zoom+delta));
  };

  return(
    <div style={{width:"100%",height:"100%",position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none"}}/>
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={onPointerCancel} onWheel={onWheel} style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:2,touchAction:"none",cursor:"grab"}}/>
    </div>
  );
}

// ═══════════════════════════════════════════════
// FORM STEPS
// ═══════════════════════════════════════════════
function Input({label,value,onChange,placeholder,type="text"}){return(<div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:P.sub,marginBottom:5,fontFamily:P.fontBody}}>{label}</label><input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"13px 16px",borderRadius:10,border:`1px solid ${P.border}`,background:P.card,fontSize:16,color:P.text,fontFamily:P.fontBody,outline:"none",boxSizing:"border-box",WebkitAppearance:"none"}} onFocus={e=>e.target.style.borderColor=P.gold} onBlur={e=>e.target.style.borderColor=P.border}/></div>);}
function Step2({formData,setForm}){const set=k=>v=>setForm({...formData,[k]:v});return(<div style={{padding:"20px 16px",paddingBottom:100}}><div style={{fontSize:24,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:4}}>Your Information</div><div style={{fontSize:13,color:P.sub,fontFamily:P.fontBody,marginBottom:20}}>Create your account.</div><Input label="First Name" value={formData.first} onChange={set("first")} placeholder="John"/><Input label="Last Name" value={formData.last} onChange={set("last")} placeholder="Smith"/><Input label="Email" value={formData.email} onChange={set("email")} placeholder="john@example.com" type="email"/><Input label="Phone" value={formData.phone} onChange={set("phone")} placeholder="(918) 555-0000" type="tel"/><Input label="Driver's License" value={formData.dl} onChange={set("dl")} placeholder="OK-123456789"/></div>);}
function Step3({formData,setForm,unit}){const set=k=>v=>setForm({...formData,[k]:v});const total=unit.price+34;return(<div style={{padding:"20px 16px",paddingBottom:100}}><div style={{fontSize:24,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:4}}>Payment</div><div style={{padding:16,borderRadius:P.radius,marginBottom:20,background:P.card,border:`1px solid ${P.border}`}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8,color:P.sub,fontFamily:P.fontBody}}><span>Unit {unit.id} — {unit.label}</span><span style={{fontWeight:600,color:P.text}}>${unit.price}/mo</span></div><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8,color:P.sub,fontFamily:P.fontBody}}><span>Admin + insurance</span><span style={{fontWeight:600,color:P.text}}>$34</span></div><div style={{borderTop:`1px solid ${P.border}`,paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:14,fontWeight:700,fontFamily:P.font}}>Due Today</span><span style={{fontSize:26,fontWeight:700,color:P.gold,fontFamily:P.font}}>${total}</span></div></div><Input label="Card Number" value={formData.cardNum} onChange={set("cardNum")} placeholder="4242 4242 4242 4242"/><div style={{display:"flex",gap:12}}><div style={{flex:1}}><Input label="Expiry" value={formData.cardExp} onChange={set("cardExp")} placeholder="MM/YY"/></div><div style={{flex:1}}><Input label="CVC" value={formData.cardCvc} onChange={set("cardCvc")} placeholder="123"/></div></div></div>);}
function Step4({agreed,setAgreed,unit}){return(<div style={{padding:"20px 16px",paddingBottom:100}}><div style={{fontSize:24,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:16}}>Agreement</div><div style={{padding:16,borderRadius:P.radius,background:P.card,border:`1px solid ${P.border}`,fontSize:12,color:P.sub,lineHeight:1.7,fontFamily:P.fontBody,marginBottom:16}}><p><strong>Unit {unit.id}</strong> — {unit.label} — ${unit.price}/mo. Personal property only. $15 late fee. Non-transferable access codes. $9/mo insurance. OK Title 42 lien rights.</p></div><div onClick={()=>setAgreed(!agreed)} style={{padding:16,borderRadius:P.radius,border:`1.5px solid ${agreed?P.gold:P.border}`,background:agreed?P.goldLight:P.card,cursor:"pointer",display:"flex",alignItems:"center",gap:14}}><div style={{width:26,height:26,borderRadius:7,border:`2px solid ${agreed?P.gold:"#d6d3d1"}`,background:agreed?P.gold:"#fff",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:700,flexShrink:0}}>{agreed&&"✓"}</div><div style={{fontSize:13,fontWeight:700,color:P.text,fontFamily:P.fontBody}}>I agree to the terms</div></div></div>);}
function Step5({unit,formData}){const[gc]=useState(genCode);const[uc]=useState(genCode);const[cp,scp]=useState(null);const copy=(t,w)=>{navigator.clipboard?.writeText(t);scp(w);setTimeout(()=>scp(null),2000);};return(<div style={{padding:"28px 16px",textAlign:"center",paddingBottom:40}}><style>{`@keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style><div style={{width:64,height:64,borderRadius:"50%",background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:28,color:"#fff",animation:"pop 0.5s ease-out",boxShadow:`0 8px 28px ${P.gold}40`}}>✓</div><div style={{fontSize:24,fontWeight:700,color:P.text,fontFamily:P.font,animation:"fadeUp 0.4s 0.15s both"}}>Welcome Home</div><div style={{fontSize:13,color:P.sub,fontFamily:P.fontBody,marginTop:4,marginBottom:20,animation:"fadeUp 0.4s 0.25s both"}}>Unit {unit.id} is yours.</div><div style={{display:"flex",flexDirection:"column",gap:10,animation:"fadeUp 0.4s 0.35s both"}}>{[{l:"GATE CODE",c:gc,i:"🚪",d:"Main gate"},{l:"UNIT CODE",c:uc,i:"🔐",d:"Unit lock"}].map(({l,c:code,i,d})=>(<div key={l} onClick={()=>copy(code,l)} style={{padding:"16px",borderRadius:P.radius,background:P.goldLight,border:`1.5px solid ${P.gold}30`,cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left"}}><div style={{fontSize:28}}>{i}</div><div style={{flex:1}}><div style={{fontSize:8,fontWeight:800,color:P.gold,letterSpacing:"0.12em",fontFamily:P.fontBody}}>{l}</div><div style={{fontSize:26,fontWeight:800,color:P.text,fontFamily:"monospace"}}>{code}</div><div style={{fontSize:10,color:P.sub,fontFamily:P.fontBody}}>{d}</div></div><div style={{fontSize:10,fontWeight:700,color:cp===l?P.gold:P.muted,fontFamily:P.fontBody}}>{cp===l?"COPIED!":"TAP"}</div></div>))}</div></div>);}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
export default function App(){
  const[mode,setMode]=useState(null);
  const[step,setStep]=useState(0);
  const[units]=useState(ALL_UNITS);
  const[selId,setSelId]=useState(null);
  const[sf,setSf]=useState(null);
  const[form,setForm]=useState({});
  const[agreed,setAgreed]=useState(false);
  const[fs,setFs]=useState(false);
  const sel=selId?units.find(u=>u.id===selId):null;
  const ok=()=>{if(step===0)return!!sel&&sel.status==="available";if(step===1)return form.first&&form.last&&form.email&&form.phone;if(step===2)return form.cardNum&&form.cardExp&&form.cardCvc;if(step===3)return agreed;return false;};

  if(!mode)return(
    <div style={{width:"100%",height:"100vh",maxWidth:480,margin:"0 auto",background:P.bg,fontFamily:P.fontBody,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,padding:32,boxSizing:"border-box",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <button onClick={()=>setMode("setup")} style={{position:"absolute",top:16,right:16,width:36,height:36,borderRadius:8,border:`1px solid ${P.border}`,background:P.card,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:P.muted}}>⚙️</button>
      <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff",boxShadow:`0 8px 28px ${P.gold}30`}}>SC</div>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30,fontWeight:700,color:P.text,fontFamily:P.font,letterSpacing:"-0.02em"}}>StorageCommand</div>
        <div style={{fontSize:13,color:P.muted,marginTop:4}}>{FACILITY.name}</div>
        <div style={{fontSize:11,color:P.sub,marginTop:2}}>{FACILITY.address}</div>
      </div>
      <div style={{display:"flex",gap:12,marginTop:4}}>
        {[{v:units.filter(u=>u.status==="available").length,l:"Available",c:STATUS.available.color},{v:units.length,l:"Total Units",c:P.sub},{v:Math.round(units.filter(u=>u.status!=="available").length/units.length*100)+"%",l:"Occupied",c:STATUS.occupied.color}].map(({v,l,c})=>(<div key={l} style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:c,fontFamily:P.font}}>{v}</div><div style={{fontSize:9,color:P.muted,fontFamily:P.fontBody}}>{l}</div></div>))}
      </div>
      <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
        <button onClick={()=>setMode("customer")} style={{width:"100%",padding:"16px",borderRadius:P.radius,border:"none",background:`linear-gradient(135deg,${P.gold},#b8943f)`,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,boxShadow:`0 4px 16px ${P.gold}25`}}>Rent a Unit</button>
        <button onClick={()=>setMode("owner")} style={{width:"100%",padding:"16px",borderRadius:P.radius,border:`1.5px solid ${P.border}`,background:P.card,color:P.text,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>Owner Dashboard</button>
      </div>
      <div style={{fontSize:10,color:P.muted,marginTop:4}}>24/7 Self-Service · Instant Access Codes</div>
    </div>
  );

  if(mode==="setup")return(
    <div style={{width:"100%",height:"100vh",maxWidth:480,margin:"0 auto",background:P.bg,fontFamily:P.fontBody,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{padding:"12px 16px",background:P.card,borderBottom:`1px solid ${P.border}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff"}}>SC</div>
          <div><div style={{fontSize:13,fontWeight:700,fontFamily:P.font}}>Facility Setup</div><div style={{fontSize:9,color:P.muted}}>Configuration & Tools</div></div>
        </div>
        <button onClick={()=>setMode(null)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>← Back</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px"}}>
        <div style={{fontSize:24,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:16}}>Setup & Configuration</div>
        {[{icon:"🛰️",title:"AI Satellite Scan",desc:"Upload an overhead photo and AI auto-generates your facility layout",tag:"Powered by Haiku",tagColor:P.gold},{icon:"🏗️",title:"Manual Builder",desc:"Configure buildings, rows, and units step by step",tag:"Full Control",tagColor:P.blue},{icon:"🎨",title:"Branding & Theme",desc:"Set your facility name, logo, colors, and contact info",tag:"Customize",tagColor:P.success},{icon:"💳",title:"Billing Setup",desc:"Connect Stripe for automated monthly payments",tag:"Coming Soon",tagColor:P.muted},{icon:"🔐",title:"Smart Lock Integration",desc:"Connect Nokē, Janus, or DoorKing for automated access codes",tag:"Coming Soon",tagColor:P.muted},{icon:"🤖",title:"AI Assistant Settings",desc:"Configure your facility's Haiku-powered AI copilot",tag:"Coming Soon",tagColor:P.muted}].map(({icon,title,desc,tag,tagColor})=>(<div key={title} style={{padding:16,borderRadius:P.radius,border:`1px solid ${P.border}`,background:P.card,marginBottom:10,cursor:"pointer",display:"flex",gap:14,alignItems:"flex-start"}}><div style={{fontSize:26,flexShrink:0,marginTop:2}}>{icon}</div><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}><span style={{fontSize:15,fontWeight:700,color:P.text,fontFamily:P.font}}>{title}</span><span style={{padding:"1px 6px",borderRadius:4,background:tagColor+"15",color:tagColor,fontSize:8,fontWeight:700,fontFamily:P.fontBody}}>{tag}</span></div><div style={{fontSize:11,color:P.sub,fontFamily:P.fontBody,lineHeight:1.4}}>{desc}</div></div></div>))}
        <div style={{marginTop:16,padding:16,borderRadius:P.radius,background:P.goldLight,border:`1px solid ${P.gold}20`}}>
          <div style={{fontSize:10,fontWeight:700,color:P.goldDark,fontFamily:P.fontBody,letterSpacing:"0.06em",marginBottom:8}}>CURRENT FACILITY</div>
          <div style={{fontSize:18,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:4}}>{FACILITY.name}</div>
          <div style={{fontSize:11,color:P.sub,fontFamily:P.fontBody}}>{FACILITY.address}</div>
          <div style={{display:"flex",gap:16,marginTop:10}}>
            <div><div style={{fontSize:18,fontWeight:700,color:P.gold,fontFamily:P.font}}>{units.length}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Units</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:P.success,fontFamily:P.font}}>{units.filter(u=>u.status==="available").length}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Available</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:P.danger,fontFamily:P.font}}>{units.filter(u=>u.status==="overdue").length}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Past Due</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:P.text,fontFamily:P.font}}>${units.filter(u=>u.status!=="available"&&u.status!=="maintenance").reduce((s,u)=>s+u.price,0).toLocaleString()}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Monthly Rev</div></div>
          </div>
        </div>
      </div>
    </div>
  );

  const detailCard=sel?(
    <div key={sel.id} style={{padding:"12px 16px",flexShrink:0,borderTop:`1px solid ${P.border}`,background:P.card}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
            <span style={{fontSize:18,fontWeight:700,color:P.text,fontFamily:P.font}}>Unit {sel.id}</span>
            <span style={{padding:"2px 8px",borderRadius:4,background:STATUS[sel.status].color+"18",color:STATUS[sel.status].color,fontSize:9,fontWeight:700,fontFamily:P.fontBody}}>{STATUS[sel.status].label}</span>
          </div>
          <div style={{fontSize:12,color:P.sub,fontFamily:P.fontBody}}>{sel.label} · {sel.sqft} ft²</div>
          <div style={{fontSize:11,color:P.muted,fontFamily:P.fontBody,marginTop:1}}>{sel.desc}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
          <div style={{fontSize:24,fontWeight:700,color:P.gold,fontFamily:P.font}}>${sel.price}</div>
          <div style={{fontSize:9,color:P.muted,fontFamily:P.fontBody}}>/month</div>
        </div>
      </div>
      {sel.tenant&&mode==="owner"&&(<div style={{padding:8,borderRadius:8,background:P.borderLight,marginBottom:6,border:`1px solid ${P.border}`}}><div style={{fontSize:12,fontWeight:700,color:P.text,fontFamily:P.fontBody}}>{sel.tenant.name}</div><div style={{fontSize:10,color:P.sub,fontFamily:P.fontBody}}>{sel.tenant.phone} · {sel.tenant.email}</div>{sel.balance>0&&<div style={{fontSize:11,fontWeight:700,color:"#dc2626",fontFamily:P.fontBody,marginTop:2}}>${sel.balance} past due</div>}</div>)}
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{(sel.features||[]).map((f,i)=>(<span key={i} style={{padding:"3px 8px",borderRadius:5,background:P.goldLight,color:P.goldDark,fontSize:9,fontWeight:700,fontFamily:P.fontBody}}>✓ {f}</span>))}</div>
      <button onClick={()=>setSelId(null)} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>✕ Deselect</button>
    </div>
  ):null;

  if(fs)return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:200,background:P.bg}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",height:"100%",position:"relative"}}>
        <FacilityMap units={units} selId={selId} onSelect={setSelId} statusFilter={sf}/>
        <button onClick={()=>setFs(false)} style={{position:"absolute",top:12,right:12,width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(8px)",border:`1px solid ${P.gold}20`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:P.sub,zIndex:10,fontWeight:700}}>✕</button>
        {sel&&<button onClick={()=>setSelId(null)} style={{position:"absolute",bottom:16,left:16,padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(8px)",border:`1px solid ${P.gold}20`,color:P.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,zIndex:10}}>↑ Zoom Out</button>}
        <div style={{position:"absolute",top:12,left:12,display:"flex",gap:4,zIndex:10,flexWrap:"wrap",maxWidth:"70%"}}>
          {Object.entries(STATUS).map(([k,v])=>(<button key={k} onClick={()=>setSf(sf===k?null:k)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${sf===k?v.color+"40":"rgba(240,236,228,0.6)"}`,background:sf===k?v.color+"18":"rgba(255,255,255,0.88)",backdropFilter:"blur(8px)",color:sf===k?v.color:P.muted,fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:v.color}}/>{v.label}</button>))}
        </div>
        {sel&&(<div style={{position:"absolute",bottom:16,right:16,maxWidth:"65%",padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(10px)",border:`1px solid ${P.gold}20`,zIndex:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div><span style={{fontSize:14,fontWeight:700,color:P.text,fontFamily:P.font}}>Unit {sel.id}</span><span style={{marginLeft:6,padding:"1px 6px",borderRadius:3,background:STATUS[sel.status].color+"18",color:STATUS[sel.status].color,fontSize:8,fontWeight:700,fontFamily:P.fontBody}}>{STATUS[sel.status].label}</span><div style={{fontSize:10,color:P.sub,fontFamily:P.fontBody,marginTop:2}}>{sel.label} · {sel.sqft} ft²</div></div><div style={{fontSize:18,fontWeight:700,color:P.gold,fontFamily:P.font,whiteSpace:"nowrap"}}>${sel.price}<span style={{fontSize:9,color:P.muted}}>/mo</span></div></div></div>)}
      </div>
    </div>
  );

  return(
    <div style={{width:"100%",height:"100vh",maxWidth:480,margin:"0 auto",background:P.bg,fontFamily:P.fontBody,color:P.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{padding:"10px 16px",background:P.card,borderBottom:`1px solid ${P.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff"}}>SC</div>
            <div><div style={{fontSize:13,fontWeight:700,fontFamily:P.font}}>{FACILITY.name}</div><div style={{fontSize:9,color:P.muted}}>{mode==="owner"?"Owner Dashboard":"24/7 Self-Service"}</div></div>
          </div>
          <div style={{display:"flex",gap:4}}>
            {step>0&&step<4&&<button onClick={()=>setStep(step-1)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>Back</button>}
            <button onClick={()=>{setMode(null);setStep(0);setSelId(null);}} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${P.border}`,background:P.card,color:P.muted,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:P.fontBody}}>Exit</button>
          </div>
        </div>
        {mode==="customer"&&step<4&&(<div style={{marginTop:8,display:"flex",gap:3}}>{["Select","Info","Pay","Sign"].map((s,i)=>(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{height:3,width:"100%",borderRadius:2,background:i<step?P.gold:i===step?P.goldDark:"#eae6df"}}/><span style={{fontSize:8,fontWeight:i===step?800:600,color:i<=step?P.gold:P.muted}}>{s}</span></div>))}</div>)}
      </div>
      <div style={{flex:1,overflow:step===0?"hidden":"auto",display:"flex",flexDirection:"column",minHeight:0}}>
        {step===0&&(
          <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
            <div style={{padding:"8px 16px 0",flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:4}}>{mode==="owner"?"Facility Overview":"Find Your Unit"}</div>
              <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:6}}>
                <button onClick={()=>setSf(null)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${!sf?P.gold:P.border}`,background:!sf?P.goldLight:P.card,color:!sf?P.goldDark:P.muted,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,whiteSpace:"nowrap",flexShrink:0}}>All</button>
                {Object.entries(STATUS).map(([k,v])=>(<button key={k} onClick={()=>setSf(sf===k?null:k)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${sf===k?v.color+"40":P.border}`,background:sf===k?v.color+"12":P.card,color:sf===k?v.color:P.muted,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:v.color}}/>{v.label}</button>))}
              </div>
            </div>
            <div style={{flex:1,minHeight:0,position:"relative"}}>
              <FacilityMap units={units} selId={selId} onSelect={setSelId} statusFilter={sf}/>
              <div style={{position:"absolute",bottom:8,right:8,display:"flex",gap:6,zIndex:5}}>
                <button onClick={()=>setFs(true)} style={{width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.9)",backdropFilter:"blur(8px)",border:`1px solid ${P.gold}20`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,color:P.sub}}>⛶</button>
              </div>
              {sel&&<button onClick={()=>setSelId(null)} style={{position:"absolute",bottom:8,left:8,padding:"6px 12px",borderRadius:8,background:"rgba(255,255,255,0.9)",backdropFilter:"blur(8px)",border:`1px solid ${P.gold}20`,color:P.sub,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,zIndex:5}}>↑ Zoom Out</button>}
            </div>
            {detailCard}
          </div>
        )}
        {step===1&&<Step2 formData={form} setForm={setForm}/>}
        {step===2&&<Step3 formData={form} setForm={setForm} unit={sel}/>}
        {step===3&&<Step4 agreed={agreed} setAgreed={setAgreed} unit={sel}/>}
        {step===4&&<Step5 unit={sel} formData={form}/>}
      </div>
      {mode==="customer"&&step<4&&(
        <div style={{padding:"8px 16px",paddingBottom:"max(8px,env(safe-area-inset-bottom))",background:P.card,borderTop:`1px solid ${P.border}`,flexShrink:0}}>
          <button onClick={()=>{if(ok())setStep(step+1)}} disabled={!ok()} style={{width:"100%",padding:"14px 0",borderRadius:P.radius,border:"none",background:ok()?`linear-gradient(135deg,${P.gold},#b8943f)`:"#eae6df",color:ok()?"#fff":"#b8afa5",fontSize:15,fontWeight:700,cursor:ok()?"pointer":"default",fontFamily:P.fontBody,boxShadow:ok()?`0 4px 16px ${P.gold}30`:"none"}}>
            {step===3?"Sign & Get Access Codes":step===0?(sel?(sel.status==="available"?`Reserve ${sel.id}`:`${sel.id} — ${STATUS[sel.status].label}`):"Select an Available Unit"):"Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
