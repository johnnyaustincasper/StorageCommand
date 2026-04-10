import { useState, useRef, useEffect, useCallback } from "react";

function useViewport(){
  const getWidth=()=>typeof window==="undefined"?1280:window.innerWidth;
  const [width,setWidth]=useState(getWidth);

  useEffect(()=>{
    const onResize=()=>setWidth(getWidth());
    window.addEventListener("resize",onResize);
    return()=>window.removeEventListener("resize",onResize);
  },[]);

  return {
    width,
    isTablet:width>=768,
    isDesktop:width>=1180,
  };
}

const FACILITY = { name: "Riverside Storage", address: "4521 S Memorial Dr, Tulsa, OK 74145" };
const SIZES = [
  { key:"small", label:"5×5", sqft:25, price:49, desc:"Boxes & seasonal items", features:["Interior","Ground floor","24/7 access"] },
  { key:"medium", label:"10×10", sqft:100, price:99, desc:"1-bedroom apartment", features:["Drive-up","Ground floor","24/7","Wide doors"] },
  { key:"large", label:"10×20", sqft:200, price:169, desc:"2-3 bedroom home", features:["Drive-up","12ft ceiling","24/7","Wide doors"] },
  { key:"xl", label:"10×30", sqft:300, price:249, desc:"Commercial / multi-vehicle", features:["Drive-up","14ft ceiling","24/7","Forklift"] },
];
const STATUS = {
  available:{color:"#22c55e",label:"Available"},
  occupied:{color:"#ef4444",label:"Occupied"},
  reserved:{color:"#3b82f6",label:"Reserved"},
  maintenance:{color:"#f59e0b",label:"Maintenance"},
  overdue:{color:"#dc2626",label:"Past Due"},
};
const TENANTS=[
  {name:"Sarah Mitchell",phone:"(918) 555-0142",email:"sarah.m@email.com",since:"2024-03-15"},
  {name:"James Rodriguez",phone:"(918) 555-0198",email:"james.r@email.com",since:"2024-06-01"},
  {name:"Emily Chen",phone:"(918) 555-0267",email:"emily.c@email.com",since:"2025-01-10"},
  {name:"Marcus Johnson",phone:"(918) 555-0334",email:"marcus.j@email.com",since:"2024-11-20"},
  {name:"Lisa Park",phone:"(918) 555-0411",email:"lisa.p@email.com",since:"2025-02-05"},
  {name:"David Kim",phone:"(918) 555-0523",email:"david.k@email.com",since:"2024-08-14"},
  {name:"Rachel Foster",phone:"(918) 555-0647",email:"rachel.f@email.com",since:"2024-05-22"},
  {name:"Tom Williams",phone:"(918) 555-0718",email:"tom.w@email.com",since:"2025-03-01"},
];

function genUnits(){
  const u=[];
  const sts=["available","available","available","occupied","occupied","occupied","occupied","reserved","maintenance","overdue"];
  // depth 1.0 so back-to-back rows don't overlap. Width 1.4 with 0.3 gap
  const dims={small:{w:1.4,h:0.7,d:1.0},medium:{w:1.4,h:1.1,d:1.0},large:{w:1.4,h:1.6,d:1.0},xl:{w:1.4,h:2.2,d:1.0}};
  // 3 buildings, each 2 back-to-back rows. Centers: A=-10, B=-4.5, C=1
  // Each building: row1 at center-1.3 (f=1), row2 at center+1.3 (f=-1)
  // 0.6 unit gap between unit backs, ~2.5 unit road between buildings
  const rows=[
    {name:"A1",z:-11.3,f:1},
    {name:"A2",z:-8.7, f:-1},
    {name:"B1",z:-5.8, f:1},
    {name:"B2",z:-3.2, f:-1},
    {name:"C1",z:-0.3, f:1},
    {name:"C2",z:2.3,  f:-1},
  ];
  const cfg=[
    ["small","small","medium","medium","large","xl","large","medium","small","small","medium","large","xl","large","medium","small","small"],
    ["small","medium","medium","large","xl","large","medium","small","small","medium","medium","large","xl","large","medium","small","small"],
    ["medium","small","small","medium","large","xl","large","medium","small","small","medium","large","xl","medium","small","small","small"],
    ["small","small","medium","large","xl","large","medium","medium","small","small","medium","xl","large","medium","small","small","small"],
    ["medium","medium","small","small","large","xl","medium","small","medium","large","xl","large","medium","small","small","small","medium"],
    ["small","medium","large","xl","large","medium","small","small","medium","medium","large","xl","medium","small","small","medium","small"],
  ];
  let ti=0;
  rows.forEach(({name,z,f},ri)=>{
    let x=-14;
    cfg[ri].forEach((type,i)=>{
      const d=dims[type];
      const s=SIZES.find(s=>s.key===type);
      const status=sts[(ri*17+i*3+7)%sts.length];
      const tenant=(status==="occupied"||status==="overdue")?TENANTS[ti++%TENANTS.length]:null;
      u.push({
        id:`${name}-${String(i+1).padStart(2,"0")}`,
        type,status,...s,
        w:d.w,h:d.h,d:d.d,
        tenant,
        balance:status==="overdue"?Math.floor((ri*17+i)*37%300)+80:0,
        x:x+d.w/2,y:0,
        z:z+(f*d.d/2),
      });
      x+=d.w+0.3;
    });
  });
  return u;
}

const ALL_UNITS=genUnits();
const genCode=()=>Math.floor(1000+Math.random()*9000)+String.fromCharCode(65+Math.floor(Math.random()*26));
const P={
  bg:"#fefefe",card:"#ffffff",border:"#f0ece4",borderLight:"#f7f4ef",
  text:"#1a1714",sub:"#8c8378",muted:"#b8afa5",
  gold:"#c9a84c",goldLight:"#f5eed9",goldDark:"#8b7432",
  blue:"#3b82f6",success:"#22c55e",danger:"#ef4444",
  font:"'Cormorant Garamond', serif",fontBody:"'Nunito', sans-serif",radius:12,
};
const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];

// ═══════════════════════════════════════════════
// CANVAS 3D RENDERER
// ═══════════════════════════════════════════════
function FacilityMap({ units, selId, onSelect, statusFilter }) {
  const canvasRef = useRef(null);
  const projRef = useRef([]);
  const camRef = useRef({ angle:30, tiltX:-1.1, cx:1, cz:-3, zoom:13, dist:30 });
  const targetRef = useRef({ angle:30, tiltX:-1.1, cx:1, cz:-3, zoom:13 });
  const selRef = useRef(null);
  const filterRef = useRef(null);
  const gestureRef = useRef({ active:false, type:null, sx:0, sy:0, moved:false });
  const idleRef = useRef(0);
  const ptrCache = useRef([]);
  const lastPan = useRef({x:0,y:0});
  const lastPinch = useRef({dist:0,angle:0,mx:0,my:0});

  // Critters state — initialized once
  const crittersRef = useRef(null);
  if(!crittersRef.current){
    const mkBunny=()=>({
      type:"bunny", x:(Math.random()-0.5)*32, z:(Math.random()-0.5)*20,
      tx:(Math.random()-0.5)*32, tz:(Math.random()-0.5)*20,
      wait:Math.random()*4, hopPhase:0, hopping:false,
      flip:Math.random()>0.5,
    });
    const mkSquirrel=()=>({
      type:"squirrel", x:(Math.random()-0.5)*32, z:(Math.random()-0.5)*20,
      tx:(Math.random()-0.5)*32, tz:(Math.random()-0.5)*20,
      wait:Math.random()*6, phase:0, flip:false,
    });
    const mkBird=()=>({
      type:"bird", x:-60, z:(Math.random()-0.5)*10,
      speed:18+Math.random()*12, y:3+Math.random()*2,
      wing:0, wait:Math.random()*12,
    });
    crittersRef.current=[
      mkBunny(),mkBunny(),mkBunny(),
      mkSquirrel(),mkSquirrel(),
      mkBird(),mkBird(),
    ];
  }

  // PC right-click rotate
  const rightDragRef = useRef({active:false,lx:0,ly:0});
  const onMouseDown=(e)=>{
    if(e.button===2){e.preventDefault();rightDragRef.current={active:true,lx:e.clientX,ly:e.clientY};}
  };
  const onMouseMove=(e)=>{
    if(!rightDragRef.current.active)return;
    const dx=e.clientX-rightDragRef.current.lx;
    targetRef.current.angle+=dx*0.4;
    rightDragRef.current={active:true,lx:e.clientX,ly:e.clientY};
    idleRef.current=0;
  };
  const onMouseUp=(e)=>{if(e.button===2)rightDragRef.current.active=false;};
  const onContextMenu=(e)=>e.preventDefault();

  useEffect(()=>{selRef.current=selId;},[selId]);
  useEffect(()=>{filterRef.current=statusFilter;},[statusFilter]);

  useEffect(()=>{
    const t=targetRef.current;
    if(selId){
      const u=units.find(u=>u.id===selId);
      if(u){t.cx=u.x;t.cz=u.z;t.zoom=60;t.tiltX=-0.6;}
    }else{
      t.cx=1;t.cz=-3;t.zoom=13;t.tiltX=-1.1;
    }
  },[selId,units]);

  const project = useCallback((x,y,z,c)=>{
    let dx=x-c.cx, dz=z-c.cz;
    const ca=Math.cos(c.angle*Math.PI/180),sa=Math.sin(c.angle*Math.PI/180);
    let rx=dx*ca-dz*sa, rz=dx*sa+dz*ca;
    const cb=Math.cos(c.tiltX),sb=Math.sin(c.tiltX);
    let ry=y*cb-rz*sb, rz2=y*sb+rz*cb;
    const sc=c.dist/(c.dist+rz2);
    return{sx:c.scx+rx*sc*c.zm, sy:c.scy-ry*sc*c.zm, dp:rz2, sc};
  },[]);

  const applyPan=(dx,dy)=>{
    const t=targetRef.current;
    const c=camRef.current;
    const scale=18/Math.max(c.zoom,10);
    const ang=c.angle*Math.PI/180;
    const ca=Math.cos(ang),sa=Math.sin(ang);
    const worldX= dx*ca - dy*sa;
    const worldZ=-dx*sa - dy*ca;
    const mx=worldX*scale*0.035;
    const mz=worldZ*scale*0.035;
    c.cx-=mx; c.cz-=mz;
    t.cx-=mx; t.cz-=mz;
  };

  const getTouchInfo=(touches)=>{
    if(touches.length<2)return{dist:0,angle:0,mx:touches[0]?.clientX||0,my:touches[0]?.clientY||0};
    const dx=touches[1].clientX-touches[0].clientX;
    const dy=touches[1].clientY-touches[0].clientY;
    return{dist:Math.sqrt(dx*dx+dy*dy),angle:Math.atan2(dy,dx),mx:(touches[0].clientX+touches[1].clientX)/2,my:(touches[0].clientY+touches[1].clientY)/2};
  };

  const hitTest=(cx,cy)=>{
    const cv=canvasRef.current; if(!cv)return null;
    const rect=cv.getBoundingClientRect();
    const mx=cx-rect.left, my=cy-rect.top;
    let best=null, bestD=Infinity;
    projRef.current.forEach(({id,sx,sy,radius})=>{
      const d=Math.sqrt((mx-sx)**2+(my-sy)**2);
      if(d<radius*3&&d<bestD){bestD=d;best=id;}
    });
    return best;
  };

  const onPointerDown=(e)=>{
    ptrCache.current=ptrCache.current.filter(p=>p.pointerId!==e.pointerId);
    ptrCache.current.push({pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY});
    const g=gestureRef.current;
    g.moved=false; idleRef.current=0;
    if(ptrCache.current.length===1){
      g.active=true; g.type="pan";
      lastPan.current={x:e.clientX,y:e.clientY};
      g.sx=e.clientX; g.sy=e.clientY;
    }else if(ptrCache.current.length>=2){
      g.active=true; g.type="pinch"; g.moved=true;
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
      if(g.moved)applyPan(dx,dy);
      lastPan.current={x:e.clientX,y:e.clientY};
    }else if(g.type==="pinch"&&ptrCache.current.length>=2){
      const info=getTouchInfo(ptrCache.current);
      const lp=lastPinch.current;
      if(lp.dist>0){const ratio=info.dist/lp.dist;targetRef.current.zoom=Math.max(15,Math.min(100,targetRef.current.zoom*ratio));}
      let angleDelta=(info.angle-lp.angle)*180/Math.PI;
      if(angleDelta>180)angleDelta-=360;
      if(angleDelta<-180)angleDelta+=360;
      angleDelta=Math.max(-10,Math.min(10,angleDelta));
      targetRef.current.angle-=angleDelta;
      applyPan(info.mx-lp.mx,info.my-lp.my);
      lastPinch.current={dist:info.dist,angle:info.angle,mx:info.mx,my:info.my};
    }
  };

  const onPointerUp=(e)=>{
    ptrCache.current=ptrCache.current.filter(p=>p.pointerId!==e.pointerId);
    const g=gestureRef.current;
    if(ptrCache.current.length===0){
      if(!g.moved){const id=hitTest(e.clientX,e.clientY);if(id)onSelect(id);}
      g.active=false; g.type=null;
    }else if(ptrCache.current.length===1){
      const p=ptrCache.current[0]; g.type="pan"; lastPan.current={x:p.clientX,y:p.clientY};
    }
  };

  const onPointerCancel=(e)=>{
    ptrCache.current=ptrCache.current.filter(p=>p.pointerId!==e.pointerId);
    if(ptrCache.current.length===0){gestureRef.current.active=false;gestureRef.current.type=null;}
  };

  const onWheel=(e)=>{
    e.preventDefault(); idleRef.current=0;
    const delta=e.deltaY>0?-3:3;
    targetRef.current.zoom=Math.max(15,Math.min(100,targetRef.current.zoom+delta));
  };

  useEffect(()=>{
    const cv=canvasRef.current; if(!cv)return;
    const ctx=cv.getContext("2d");
    let frame, last=performance.now();

    const render=(ts)=>{
      const dt=Math.min(0.05,(ts-last)/1000); last=ts;
      const t=ts*0.001;
      const c=camRef.current, tg=targetRef.current;

      c.angle+=(tg.angle-c.angle)*0.05;
      c.tiltX+=(tg.tiltX-c.tiltX)*0.04;
      c.cx+=(tg.cx-c.cx)*0.18;
      c.cz+=(tg.cz-c.cz)*0.18;
      c.zoom+=(tg.zoom-c.zoom)*0.04;

      if(!gestureRef.current.active && !selRef.current){
        idleRef.current+=dt;
        if(idleRef.current>5 && c.zoom<35) tg.angle+=dt*1.5;
      }

      const dpr=window.devicePixelRatio||1;
      const rect=cv.getBoundingClientRect();
      cv.width=rect.width*dpr; cv.height=rect.height*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const W=rect.width, H=rect.height;
      c.scx=W/2; c.scy=H/2+H*0.06; c.zm=c.zoom;

      // ── SKY ──
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,"#c9e8f5"); sky.addColorStop(0.7,"#e8f4fb"); sky.addColorStop(1,"#eef7e8");
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

      // ── GRASS (full ground) ──
      const gP=[[-36,-26],[36,-26],[36,26],[-36,26]].map(([gx,gz])=>project(gx,-0.05,gz,c));
      ctx.beginPath();ctx.moveTo(gP[0].sx,gP[0].sy);gP.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
      const grassG=ctx.createLinearGradient(0,gP[0].sy,0,gP[2].sy);
      grassG.addColorStop(0,"#7ec850");grassG.addColorStop(1,"#5fa832");
      ctx.fillStyle=grassG;ctx.fill();

      // ── ROAD SYSTEM ──
      // 3 buildings: A(z=-11.5 to -6.5), B(z=-4.5 to 0.5), C(z=2.5 to 7.5)
      // Units span x=-14.6 to +19.4
      const road="#c4b896";
      const roadEdge="rgba(180,168,138,0.5)";
      const drawRoad=(pts)=>{
        ctx.beginPath();ctx.moveTo(pts[0].sx,pts[0].sy);
        pts.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
        ctx.fillStyle=road;ctx.fill();
        ctx.strokeStyle=roadEdge;ctx.lineWidth=0.7;ctx.stroke();
      };
      // Perimeter top (above Bldg A, z=-13 to -12)
      drawRoad([[-19,-13],[21,-13],[21,-12],[-19,-12]].map(([x,z])=>project(x,-0.02,z,c)));
      // Perimeter bottom (below Bldg C, z=3 to 4.5)
      drawRoad([[-19,3],[21,3],[21,4.5],[-19,4.5]].map(([x,z])=>project(x,-0.02,z,c)));
      // Perimeter left
      drawRoad([[-19,-13],[-17,-13],[-17,4.5],[-19,4.5]].map(([x,z])=>project(x,-0.02,z,c)));
      // Perimeter right
      drawRoad([[19,-13],[21,-13],[21,4.5],[19,4.5]].map(([x,z])=>project(x,-0.02,z,c)));
      // Aisle between Bldg A and B (z=-8 to -6.5)
      drawRoad([[-19,-8.2],[21,-8.2],[21,-6.3],[-19,-6.3]].map(([x,z])=>project(x,-0.02,z,c)));
      // Aisle between Bldg B and C (z=-2.7 to -0.8)
      drawRoad([[-19,-2.7],[21,-2.7],[21,-0.8],[-19,-0.8]].map(([x,z])=>project(x,-0.02,z,c)));

      // ── ENTRY ROAD (leads from outside south edge to gate) ──
      // Gate at bottom center-right, x=1 to 5, entry road runs from z=4.5 down to z=9
      const entryRoad=[[1,4.5],[5,4.5],[5,9],[1,9]].map(([x,z])=>project(x,-0.02,z,c));
      ctx.beginPath();ctx.moveTo(entryRoad[0].sx,entryRoad[0].sy);
      entryRoad.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
      ctx.fillStyle=road;ctx.fill();

      // ── BLACK FENCE ──
      // Fence runs along perimeter: x=-19 to +21, z=-13 to +4.5
      // Gap for gate at x=1 to 5 on bottom edge (z=4.5)
      const fenceColor="#1a1a1a";
      const postColor="#111";
      const fenceH=0.55; // world height
      const drawFenceSegment=(x1,z1,x2,z2)=>{
        // Count posts along segment
        const dx=x2-x1, dz=z2-z1;
        const len=Math.sqrt(dx*dx+dz*dz);
        const spacing=1.2;
        const count=Math.max(2,Math.round(len/spacing));
        // Draw rail (two lines, top and mid)
        [0.55,0.3].forEach(ht=>{
          const pa=project(x1,ht,z1,c), pb=project(x2,ht,z2,c);
          ctx.beginPath();ctx.moveTo(pa.sx,pa.sy);ctx.lineTo(pb.sx,pb.sy);
          ctx.strokeStyle=fenceColor;ctx.lineWidth=Math.max(0.8,pa.sc*c.zm*0.04);ctx.stroke();
        });
        // Draw posts
        for(let i=0;i<=count;i++){
          const f=i/count;
          const px=x1+dx*f, pz=z1+dz*f;
          const bot=project(px,0,pz,c), top=project(px,fenceH,pz,c);
          ctx.beginPath();ctx.moveTo(bot.sx,bot.sy);ctx.lineTo(top.sx,top.sy);
          ctx.strokeStyle=postColor;ctx.lineWidth=Math.max(1,bot.sc*c.zm*0.055);ctx.stroke();
          // Post cap
          ctx.beginPath();ctx.arc(top.sx,top.sy,Math.max(0.8,top.sc*c.zm*0.04),0,Math.PI*2);
          ctx.fillStyle=postColor;ctx.fill();
        }
      };

      // Top edge
      drawFenceSegment(-19,-13, 21,-13);
      // Left edge
      drawFenceSegment(-19,-13,-19, 4.5);
      // Right edge
      drawFenceSegment( 21,-13, 21, 4.5);
      // Bottom left (up to gate gap)
      drawFenceSegment(-19, 4.5,  1, 4.5);
      // Bottom right (after gate gap)
      drawFenceSegment(  5, 4.5, 21, 4.5);

      // ── AUTOMATIC GATE ──
      // Gate sits at x=1 to 5, z=4.5. Two gate posts + animated sliding arm
      const gateOpen=0.5+Math.sin(t*0.4)*0.5; // slowly opens/closes for demo
      const gateSlide=gateOpen*3.5; // slides right up to 3.5 units
      const gLP=project(1,0,4.5,c), gRP=project(5,0,4.5,c);
      const gLT=project(1,fenceH*1.4,4.5,c), gRT=project(5,fenceH*1.4,4.5,c);
      // Left gate post
      ctx.beginPath();ctx.moveTo(gLP.sx,gLP.sy);ctx.lineTo(gLT.sx,gLT.sy);
      ctx.strokeStyle="#111";ctx.lineWidth=Math.max(2,gLP.sc*c.zm*0.1);ctx.stroke();
      ctx.beginPath();ctx.arc(gLT.sx,gLT.sy,Math.max(1.5,gLT.sc*c.zm*0.07),0,Math.PI*2);
      ctx.fillStyle="#222";ctx.fill();
      // Right gate post
      ctx.beginPath();ctx.moveTo(gRP.sx,gRP.sy);ctx.lineTo(gRT.sx,gRT.sy);
      ctx.strokeStyle="#111";ctx.lineWidth=Math.max(2,gRP.sc*c.zm*0.1);ctx.stroke();
      ctx.beginPath();ctx.arc(gRT.sx,gRT.sy,Math.max(1.5,gRT.sc*c.zm*0.07),0,Math.PI*2);
      ctx.fillStyle="#222";ctx.fill();
      // Gate arm — slides from left post toward right
      const gArmEnd=project(1+gateSlide,fenceH*0.9,4.5,c);
      const gArmStart=project(1,fenceH*0.9,4.5,c);
      ctx.beginPath();ctx.moveTo(gArmStart.sx,gArmStart.sy);ctx.lineTo(gArmEnd.sx,gArmEnd.sy);
      ctx.strokeStyle=gateOpen>0.5?"#e63939":"#e63939";
      ctx.lineWidth=Math.max(2,gArmStart.sc*c.zm*0.09);ctx.stroke();
      // Gate label
      const gMid=project(3,fenceH*1.6,4.5,c);
      ctx.font=`700 ${Math.max(6,gMid.sc*c.zm*0.12)}px 'Nunito',sans-serif`;
      ctx.fillStyle="rgba(220,50,50,0.85)";ctx.textAlign="center";
      ctx.fillText("GATE",gMid.sx,gMid.sy);

      // ── BUILDING LABELS ──
      [{z:-10,l:"BUILDING A"},{z:-4.5,l:"BUILDING B"},{z:1,l:"BUILDING C"}].forEach(({z,l})=>{
        const p=project(0,0.01,z,c);
        ctx.font="700 8px 'Nunito',sans-serif";ctx.fillStyle="rgba(80,70,50,0.22)";ctx.textAlign="center";
        ctx.fillText(l,p.sx,p.sy);
      });

      const ang0=c.angle*Math.PI/180;
      const ca0=Math.cos(ang0),sa0=Math.sin(ang0);
      const sorted=[...units].map(u=>{
        const hw=u.w/2,hd=u.d/2;
        const corners4=[[u.x-hw,u.z-hd],[u.x+hw,u.z-hd],[u.x+hw,u.z+hd],[u.x-hw,u.z+hd]];
        const maxDp=Math.max(...corners4.map(([x,z])=>{
          const dx=x-c.cx,dz=z-c.cz;
          return dx*sa0+dz*ca0;
        }));
        return{...u,_dp:maxDp};
      }).sort((a,b)=>b._dp-a._dp);
      const projected=[];
      const curSel=selRef.current;
      const curFilter=filterRef.current;

      sorted.forEach(unit=>{
        const hw=unit.w/2, hd=unit.d/2;
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

        const ang2=c.angle*Math.PI/180;
        const camDirX=Math.sin(ang2), camDirZ=Math.cos(ang2);
        const showFront=camDirZ>0;
        const showBack=camDirZ<0;
        const showLeft=camDirX<0;
        const showRight=camDirX>0;

        const drawFace=(pts,br,isTop)=>{
          ctx.beginPath();ctx.moveTo(pts[0].sx,pts[0].sy);pts.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
          if(isTop&&!isDim){
            const tg=ctx.createLinearGradient(pts[0].sx,pts[0].sy,pts[2].sx,pts[2].sy);
            tg.addColorStop(0,`rgba(${Math.round(cr*br)},${Math.round(cg*br)},${Math.round(cb*br)},${alpha})`);
            tg.addColorStop(1,`rgba(${Math.round(cr*br*0.85)},${Math.round(cg*br*0.85)},${Math.round(cb*br*0.85)},${alpha})`);
            ctx.fillStyle=tg;
          }else{
            ctx.fillStyle=`rgba(${Math.round(cr*br)},${Math.round(cg*br)},${Math.round(cb*br)},${alpha})`;
          }
          ctx.fill();
          if(isSel){ctx.strokeStyle="rgba(255,255,255,0.85)";ctx.lineWidth=1.5;ctx.stroke();}
          else if(!isDim){ctx.strokeStyle=isTop?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.18)";ctx.lineWidth=isTop?0.6:0.8;ctx.stroke();}
        };

        if(!showFront)drawFace([corners[0],corners[1],corners[2],corners[3]],0.55,false);
        if(!showBack) drawFace([corners[5],corners[4],corners[7],corners[6]],0.45,false);
        if(!showLeft) drawFace([corners[4],corners[0],corners[3],corners[7]],0.50,false);
        if(!showRight)drawFace([corners[1],corners[5],corners[6],corners[2]],0.65,false);
        if(showFront) drawFace([corners[0],corners[1],corners[2],corners[3]],0.72,false);
        if(showBack)  drawFace([corners[5],corners[4],corners[7],corners[6]],0.60,false);
        if(showLeft)  drawFace([corners[4],corners[0],corners[3],corners[7]],0.55,false);
        if(showRight) drawFace([corners[1],corners[5],corners[6],corners[2]],0.82,false);
        drawFace([corners[3],corners[2],corners[6],corners[7]],1.0,true);

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

      // ── CRITTERS ──
      crittersRef.current.forEach(cr=>{
        if(cr.type==="bunny"){
          if(!cr.hopping){
            cr.wait-=dt;
            if(cr.wait<=0){
              cr.tx=(Math.random()-0.5)*30; cr.tz=(Math.random()-0.5)*16;
              cr.hopping=true; cr.hopPhase=0;
              cr.flip=cr.tx<cr.x;
            }
          } else {
            const dx=cr.tx-cr.x, dz=cr.tz-cr.z;
            const dist=Math.sqrt(dx*dx+dz*dz);
            if(dist<0.3){cr.hopping=false;cr.wait=1.5+Math.random()*3;}
            else{
              const spd=3.5*dt; const nx=dx/dist,nz=dz/dist;
              cr.x+=nx*spd; cr.z+=nz*spd; cr.hopPhase+=dt*8;
            }
          }
          const hop=cr.hopping?Math.max(0,Math.sin(cr.hopPhase)*0.4):0;
          const bp=project(cr.x,hop,cr.z,c);
          const sc=Math.max(0.3,bp.sc*c.zm*0.07);
          ctx.save(); ctx.translate(bp.sx,bp.sy); if(cr.flip)ctx.scale(-1,1);
          // Shadow
          ctx.beginPath();ctx.ellipse(0,sc*0.4,sc*1.1,sc*0.35,0,0,Math.PI*2);
          ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fill();
          // Body
          ctx.beginPath();ctx.ellipse(0,0,sc*1.1,sc*0.75,0,0,Math.PI*2);
          ctx.fillStyle="#e8e0d4";ctx.fill();
          // Head
          ctx.beginPath();ctx.ellipse(sc*0.9,-sc*0.5,sc*0.65,sc*0.6,0,0,Math.PI*2);
          ctx.fillStyle="#e8e0d4";ctx.fill();
          // Ear 1
          ctx.beginPath();ctx.ellipse(sc*0.75,-sc*1.3,sc*0.18,sc*0.55,-0.2,0,Math.PI*2);
          ctx.fillStyle="#e8e0d4";ctx.fill();
          ctx.beginPath();ctx.ellipse(sc*0.75,-sc*1.3,sc*0.08,sc*0.35,-0.2,0,Math.PI*2);
          ctx.fillStyle="#f0a0b0";ctx.fill();
          // Ear 2
          ctx.beginPath();ctx.ellipse(sc*1.05,-sc*1.2,sc*0.18,sc*0.55,0.15,0,Math.PI*2);
          ctx.fillStyle="#ddd5c8";ctx.fill();
          // Eye
          ctx.beginPath();ctx.arc(sc*1.15,-sc*0.55,sc*0.12,0,Math.PI*2);
          ctx.fillStyle="#2a1a1a";ctx.fill();
          // Tail
          ctx.beginPath();ctx.arc(-sc*0.9,sc*0.1,sc*0.3,0,Math.PI*2);
          ctx.fillStyle="#fff";ctx.fill();
          ctx.restore();
        }

        if(cr.type==="squirrel"){
          cr.wait-=dt;
          if(cr.wait<=0){
            const moving=Math.random()>0.4;
            if(moving){cr.tx=(Math.random()-0.5)*30;cr.tz=(Math.random()-0.5)*16;cr.wait=0.8+Math.random()*1.5;}
            else cr.wait=0.5+Math.random()*1.5;
          }
          const dx=cr.tx-cr.x,dz=cr.tz-cr.z,dist=Math.sqrt(dx*dx+dz*dz);
          if(dist>0.4){const spd=5*dt;cr.x+=dx/dist*spd;cr.z+=dz/dist*spd;cr.flip=dx<0;}
          cr.phase+=dt*6;
          const sp=project(cr.x,0,cr.z,c);
          const sc=Math.max(0.3,sp.sc*c.zm*0.065);
          const bodyBob=dist>0.4?Math.sin(cr.phase)*sc*0.15:0;
          ctx.save();ctx.translate(sp.sx,sp.sy+bodyBob);if(cr.flip)ctx.scale(-1,1);
          // Shadow
          ctx.beginPath();ctx.ellipse(0,sc*0.3,sc,sc*0.3,0,0,Math.PI*2);
          ctx.fillStyle="rgba(0,0,0,0.12)";ctx.fill();
          // Body
          ctx.beginPath();ctx.ellipse(0,-sc*0.2,sc*0.9,sc*0.65,0,0,Math.PI*2);
          ctx.fillStyle="#b8752a";ctx.fill();
          // Belly
          ctx.beginPath();ctx.ellipse(sc*0.15,-sc*0.15,sc*0.45,sc*0.4,0,0,Math.PI*2);
          ctx.fillStyle="#e8c080";ctx.fill();
          // Head
          ctx.beginPath();ctx.ellipse(sc*0.85,-sc*0.75,sc*0.55,sc*0.5,0.2,0,Math.PI*2);
          ctx.fillStyle="#b8752a";ctx.fill();
          // Ear
          ctx.beginPath();ctx.ellipse(sc*0.9,-sc*1.25,sc*0.15,sc*0.28,0,0,Math.PI*2);
          ctx.fillStyle="#b8752a";ctx.fill();
          // Eye
          ctx.beginPath();ctx.arc(sc*1.1,-sc*0.78,sc*0.1,0,Math.PI*2);
          ctx.fillStyle="#1a0a00";ctx.fill();
          // Tail (big fluffy arc)
          ctx.beginPath();ctx.moveTo(-sc*0.5,-sc*0.1);
          ctx.bezierCurveTo(-sc*1.8,-sc*0.1,-sc*2,sc*1.2,-sc*0.8,sc*1.0);
          ctx.strokeStyle="#c8852a";ctx.lineWidth=sc*0.45;ctx.lineCap="round";ctx.stroke();
          ctx.strokeStyle="#d4a060";ctx.lineWidth=sc*0.2;ctx.stroke();
          ctx.restore();
        }

        if(cr.type==="bird"){
          cr.wait-=dt;
          if(cr.wait>0)return;
          cr.x+=cr.speed*dt;
          cr.wing+=dt*8;
          if(cr.x>70){cr.x=-70;cr.z=(Math.random()-0.5)*10;cr.wait=8+Math.random()*10;}
          const bp=project(cr.x,cr.y,cr.z,c);
          const sc=Math.max(0.5,bp.sc*c.zm*0.05);
          const wingY=Math.sin(cr.wing)*sc*0.7;
          ctx.save();ctx.translate(bp.sx,bp.sy);
          ctx.strokeStyle="#334";ctx.lineWidth=sc*0.4;ctx.lineCap="round";
          // Wings
          ctx.beginPath();ctx.moveTo(-sc*1.2,wingY);ctx.quadraticCurveTo(-sc*0.5,0,0,0);ctx.stroke();
          ctx.beginPath();ctx.moveTo(sc*1.2,wingY);ctx.quadraticCurveTo(sc*0.5,0,0,0);ctx.stroke();
          // Body
          ctx.beginPath();ctx.ellipse(sc*0.3,0,sc*0.5,sc*0.2,0.2,0,Math.PI*2);
          ctx.fillStyle="#445";ctx.fill();
          ctx.restore();
        }
      });

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

  return(
    <div style={{width:"100%",height:"100%",position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none"}}/>
      <div
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel} onWheel={onWheel}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:2,touchAction:"none",cursor:"grab"}}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════
// FORM STEPS
// ═══════════════════════════════════════════════
function Input({label,value,onChange,placeholder,type="text"}){
  return(
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:11,fontWeight:600,color:P.sub,marginBottom:5,fontFamily:P.fontBody}}>{label}</label>
      <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",padding:"13px 16px",borderRadius:10,border:`1px solid ${P.border}`,background:P.card,fontSize:16,color:P.text,fontFamily:P.fontBody,outline:"none",boxSizing:"border-box",WebkitAppearance:"none"}}
        onFocus={e=>e.target.style.borderColor=P.gold} onBlur={e=>e.target.style.borderColor=P.border}/>
    </div>
  );
}

function StepWrap({title,subtitle,children,aside}){
  const { isTablet, isDesktop } = useViewport();
  return(
    <div style={{padding:isTablet?"36px 28px 120px":"24px 16px 120px",maxWidth:1240,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
      <div style={{display:"grid",gridTemplateColumns:aside?(isDesktop?"minmax(0,1fr) 340px":"minmax(0,1fr)"):"minmax(0,820px)",gap:20,alignItems:"start",justifyContent:"center"}}>
        <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:18,padding:isTablet?28:20,boxShadow:"0 8px 30px rgba(20,16,10,0.04)"}}>
          <div style={{fontSize:isTablet?34:30,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:4}}>{title}</div>
          {subtitle&&<div style={{fontSize:14,color:P.sub,fontFamily:P.fontBody,marginBottom:22}}>{subtitle}</div>}
          {children}
        </div>
        {aside&&<div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:18,padding:20,boxShadow:"0 8px 30px rgba(20,16,10,0.04)",order:isDesktop?0:-1}}>{aside}</div>}
      </div>
    </div>
  );
}

function Step2({formData,setForm}){
  const set=k=>v=>setForm({...formData,[k]:v});
  return(
    <StepWrap title="Your Information" subtitle="Create your account.">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
        <div><Input label="First Name" value={formData.first} onChange={set("first")} placeholder="John"/></div>
        <div><Input label="Last Name" value={formData.last} onChange={set("last")} placeholder="Smith"/></div>
        <div style={{gridColumn:"1 / -1"}}><Input label="Email" value={formData.email} onChange={set("email")} placeholder="john@example.com" type="email"/></div>
        <div><Input label="Phone" value={formData.phone} onChange={set("phone")} placeholder="(918) 555-0000" type="tel"/></div>
        <div><Input label="Driver's License" value={formData.dl} onChange={set("dl")} placeholder="OK-123456789"/></div>
      </div>
    </StepWrap>
  );
}

function Step3({formData,setForm,unit}){
  const set=k=>v=>setForm({...formData,[k]:v});
  const total=unit.price+34;
  return(
    <StepWrap
      title="Payment"
      subtitle="Secure your unit and generate your access codes."
      aside={<div>
        <div style={{fontSize:10,fontWeight:800,color:P.gold,letterSpacing:"0.1em",fontFamily:P.fontBody,marginBottom:10}}>ORDER SUMMARY</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:10,color:P.sub,fontFamily:P.fontBody}}><span>Unit {unit.id} — {unit.label}</span><span style={{fontWeight:700,color:P.text}}>${unit.price}/mo</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:10,color:P.sub,fontFamily:P.fontBody}}><span>Admin + insurance</span><span style={{fontWeight:700,color:P.text}}>$34</span></div>
        <div style={{borderTop:`1px solid ${P.border}`,paddingTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:14,fontWeight:700,fontFamily:P.font}}>Due Today</span><span style={{fontSize:28,fontWeight:700,color:P.gold,fontFamily:P.font}}>${total}</span></div>
      </div>}
    >
      <Input label="Card Number" value={formData.cardNum} onChange={set("cardNum")} placeholder="4242 4242 4242 4242"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14}}>
        <div><Input label="Expiry" value={formData.cardExp} onChange={set("cardExp")} placeholder="MM/YY"/></div>
        <div><Input label="CVC" value={formData.cardCvc} onChange={set("cardCvc")} placeholder="123"/></div>
      </div>
    </StepWrap>
  );
}

function Step4({agreed,setAgreed,unit}){
  return(
    <StepWrap title="Agreement" subtitle="Review the rental terms and confirm to continue.">
      <div style={{padding:18,borderRadius:P.radius,background:P.borderLight,border:`1px solid ${P.border}`,fontSize:13,color:P.sub,lineHeight:1.8,fontFamily:P.fontBody,marginBottom:18}}>
        <p><strong>Unit {unit.id}</strong> — {unit.label} — ${unit.price}/mo. Personal property only. $15 late fee. Non-transferable access codes. $9/mo insurance. OK Title 42 lien rights.</p>
      </div>
      <div onClick={()=>setAgreed(!agreed)} style={{padding:18,borderRadius:P.radius,border:`1.5px solid ${agreed?P.gold:P.border}`,background:agreed?P.goldLight:P.card,cursor:"pointer",display:"flex",alignItems:"center",gap:14,maxWidth:520}}>
        <div style={{width:26,height:26,borderRadius:7,border:`2px solid ${agreed?P.gold:"#d6d3d1"}`,background:agreed?P.gold:"#fff",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:700,flexShrink:0}}>{agreed&&"✓"}</div>
        <div style={{fontSize:13,fontWeight:700,color:P.text,fontFamily:P.fontBody}}>I agree to the terms</div>
      </div>
    </StepWrap>
  );
}

function Step5({unit}){
  const [gc]=useState(genCode);
  const [uc]=useState(genCode);
  const [cp,scp]=useState(null);
  const copy=(txt,w)=>{navigator.clipboard?.writeText(txt);scp(w);setTimeout(()=>scp(null),2000);};
  return(
    <div style={{padding:"28px 16px",textAlign:"center",paddingBottom:40}}>
      <style>{`@keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{width:64,height:64,borderRadius:"50%",background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:28,color:"#fff",animation:"pop 0.5s ease-out",boxShadow:`0 8px 28px ${P.gold}40`}}>✓</div>
      <div style={{fontSize:24,fontWeight:700,color:P.text,fontFamily:P.font,animation:"fadeUp 0.4s 0.15s both"}}>Welcome Home</div>
      <div style={{fontSize:13,color:P.sub,fontFamily:P.fontBody,marginTop:4,marginBottom:20,animation:"fadeUp 0.4s 0.25s both"}}>Unit {unit.id} is yours.</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,animation:"fadeUp 0.4s 0.35s both"}}>
        {[{l:"GATE CODE",c:gc,i:"🚪",d:"Main gate"},{l:"UNIT CODE",c:uc,i:"🔐",d:"Unit lock"}].map(({l,c:code,i,d})=>(
          <div key={l} onClick={()=>copy(code,l)} style={{padding:"16px",borderRadius:P.radius,background:P.goldLight,border:`1.5px solid ${P.gold}30`,cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left"}}>
            <div style={{fontSize:28}}>{i}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:8,fontWeight:800,color:P.gold,letterSpacing:"0.12em",fontFamily:P.fontBody}}>{l}</div>
              <div style={{fontSize:26,fontWeight:800,color:P.text,fontFamily:"monospace"}}>{code}</div>
              <div style={{fontSize:10,color:P.sub,fontFamily:P.fontBody}}>{d}</div>
            </div>
            <div style={{fontSize:10,fontWeight:700,color:cp===l?P.gold:P.muted,fontFamily:P.fontBody}}>{cp===l?"COPIED!":"TAP"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
export default function App(){
  const { isTablet, isDesktop } = useViewport();
  const [mode,setMode]=useState(null);
  const [step,setStep]=useState(0);
  const [units]=useState(ALL_UNITS);
  const [selId,setSelId]=useState(null);
  const [sf,setSf]=useState(null);
  const [form,setForm]=useState({});
  const [agreed,setAgreed]=useState(false);
  const [fs,setFs]=useState(false);
  const sel=selId?units.find(u=>u.id===selId):null;
  const ok=()=>{
    if(step===0)return!!sel&&sel.status==="available";
    if(step===1)return form.first&&form.last&&form.email&&form.phone;
    if(step===2)return form.cardNum&&form.cardExp&&form.cardCvc;
    if(step===3)return agreed;
    return false;
  };

  const fonts=<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>;

  // ── HOME ──
  if(!mode)return(
    <div style={{width:"100%",minHeight:"100vh",background:P.bg,fontFamily:P.fontBody,display:"flex",alignItems:"center",justifyContent:"center",padding:32,boxSizing:"border-box",position:"relative"}}>
      {fonts}
      <div style={{width:"100%",maxWidth:1280,display:"grid",gridTemplateColumns:isTablet?"minmax(0,1.05fr) minmax(420px,0.95fr)":"1fr",gap:28,alignItems:"stretch"}}>
        <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:24,padding:isDesktop?44:isTablet?36:28,position:"relative",display:"flex",flexDirection:"column",justifyContent:"center",minHeight:isTablet?680:"auto"}}>
          <button onClick={()=>setMode("setup")} style={{position:"absolute",top:20,right:20,width:40,height:40,borderRadius:10,border:`1px solid ${P.border}`,background:P.card,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:P.muted}}>⚙️</button>
          <div style={{width:72,height:72,borderRadius:18,background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,color:"#fff",boxShadow:`0 8px 28px ${P.gold}30`,marginBottom:18}}>SC</div>
          <div style={{fontSize:42,fontWeight:700,color:P.text,fontFamily:P.font,letterSpacing:"-0.03em"}}>StorageCommand</div>
          <div style={{fontSize:17,color:P.muted,marginTop:8}}>{FACILITY.name}</div>
          <div style={{fontSize:13,color:P.sub,marginTop:4,maxWidth:480}}>{FACILITY.address}</div>
          <div style={{display:"flex",gap:24,marginTop:28,flexWrap:"wrap"}}>
            {[
              {v:units.filter(u=>u.status==="available").length,l:"Available",c:STATUS.available.color},
              {v:units.length,l:"Total Units",c:P.sub},
              {v:Math.round(units.filter(u=>u.status!=="available").length/units.length*100)+"%",l:"Occupied",c:STATUS.occupied.color},
            ].map(({v,l,c})=>(<div key={l} style={{minWidth:100}}><div style={{fontSize:32,fontWeight:700,color:c,fontFamily:P.font}}>{v}</div><div style={{fontSize:11,color:P.muted,fontFamily:P.fontBody,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div></div>))}
          </div>
          <div style={{width:"100%",display:"flex",flexDirection:isTablet?"row":"column",gap:12,marginTop:28}}>
            <button onClick={()=>setMode("customer")} style={{flex:1,padding:"18px",borderRadius:P.radius,border:"none",background:`linear-gradient(135deg,${P.gold},#b8943f)`,color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,boxShadow:`0 4px 16px ${P.gold}25`}}>Rent a Unit</button>
            <button onClick={()=>setMode("owner")} style={{flex:1,padding:"18px",borderRadius:P.radius,border:`1.5px solid ${P.border}`,background:P.card,color:P.text,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>Owner Dashboard</button>
          </div>
          <div style={{fontSize:11,color:P.muted,marginTop:18}}>24/7 Self-Service · Instant Access Codes</div>
        </div>
        <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:24,padding:isDesktop?20:16,minHeight:isTablet?680:420,overflow:"hidden",position:"relative"}}>
          <FacilityMap units={units} selId={selId} onSelect={setSelId} statusFilter={sf}/>
        </div>
      </div>
    </div>
  );

  // ── SETUP ──
  if(mode==="setup")return(
    <div style={{width:"100%",minHeight:"100vh",background:P.bg,fontFamily:P.fontBody,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {fonts}
      <div style={{padding:"12px 16px",background:P.card,borderBottom:`1px solid ${P.border}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff"}}>SC</div>
          <div><div style={{fontSize:13,fontWeight:700,fontFamily:P.font}}>Facility Setup</div><div style={{fontSize:9,color:P.muted}}>Configuration & Tools</div></div>
        </div>
        <button onClick={()=>setMode(null)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>← Back</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:isTablet?"32px":"20px 16px"}}>
        <div style={{fontSize:24,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:16}}>Setup & Configuration</div>
        {[
          {icon:"🛰️",title:"AI Satellite Scan",desc:"Upload an overhead photo and AI auto-generates your facility layout",tag:"Powered by Haiku",tagColor:P.gold},
          {icon:"🏗️",title:"Manual Builder",desc:"Configure buildings, rows, and units step by step",tag:"Full Control",tagColor:P.blue},
          {icon:"🎨",title:"Branding & Theme",desc:"Set your facility name, logo, colors, and contact info",tag:"Customize",tagColor:P.success},
          {icon:"💳",title:"Billing Setup",desc:"Connect Stripe for automated monthly payments",tag:"Coming Soon",tagColor:P.muted},
          {icon:"🔐",title:"Smart Lock Integration",desc:"Connect Nokē, Janus, or DoorKing for automated access codes",tag:"Coming Soon",tagColor:P.muted},
          {icon:"🤖",title:"AI Assistant Settings",desc:"Configure your facility's Haiku-powered AI copilot",tag:"Coming Soon",tagColor:P.muted},
        ].map(({icon,title,desc,tag,tagColor})=>(
          <div key={title} style={{padding:16,borderRadius:P.radius,border:`1px solid ${P.border}`,background:P.card,marginBottom:10,cursor:"pointer",display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{fontSize:26,flexShrink:0,marginTop:2}}>{icon}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                <span style={{fontSize:15,fontWeight:700,color:P.text,fontFamily:P.font}}>{title}</span>
                <span style={{padding:"1px 6px",borderRadius:4,background:tagColor+"15",color:tagColor,fontSize:8,fontWeight:700,fontFamily:P.fontBody}}>{tag}</span>
              </div>
              <div style={{fontSize:11,color:P.sub,fontFamily:P.fontBody,lineHeight:1.4}}>{desc}</div>
            </div>
          </div>
        ))}
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

  // ── FULLSCREEN MAP ──
  if(fs)return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:200,background:P.bg}}>
      {fonts}
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

  // ── CUSTOMER / OWNER FLOW ──
  const detailCard=sel?(
    <div key={sel.id} style={{padding:isTablet?"24px":"12px 16px",flexShrink:0,borderTop:isTablet?"none":`1px solid ${P.border}`,borderLeft:isTablet?`1px solid ${P.border}`:"none",background:P.card,height:"100%",overflowY:"auto"}}>
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
      <button onClick={()=>setSelId(null)} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>✕ Deselect</button>
    </div>
  ):null;

  return(
    <div style={{width:"100%",height:"100vh",background:P.bg,fontFamily:P.fontBody,color:P.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {fonts}
      <div style={{padding:isTablet?"14px 24px":"10px 16px",background:P.card,borderBottom:`1px solid ${P.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff"}}>SC</div>
            <div><div style={{fontSize:13,fontWeight:700,fontFamily:P.font}}>{FACILITY.name}</div><div style={{fontSize:9,color:P.muted}}>{mode==="owner"?"Owner Dashboard":"24/7 Self-Service"}</div></div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {step>0&&step<4&&<button onClick={()=>setStep(step-1)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>Back</button>}
            <button onClick={()=>{setMode(null);setStep(0);setSelId(null);}} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${P.border}`,background:P.card,color:P.muted,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:P.fontBody}}>Exit</button>
          </div>
        </div>
        {mode==="customer"&&step<4&&(
          <div style={{marginTop:8,display:"flex",gap:3}}>
            {["Select","Info","Pay","Sign"].map((s,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{height:3,width:"100%",borderRadius:2,background:i<step?P.gold:i===step?P.goldDark:"#eae6df"}}/>
                <span style={{fontSize:8,fontWeight:i===step?800:600,color:i<=step?P.gold:P.muted}}>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{flex:1,overflow:step===0?"hidden":"auto",display:"flex",flexDirection:"column",minHeight:0}}>
        {step===0&&(
          <div style={{display:"grid",gridTemplateColumns:isTablet?"minmax(0,1fr) 360px":"1fr",height:"100%",minHeight:0}}>
            <div style={{display:"flex",flexDirection:"column",minHeight:0,borderRight:isTablet&&sel?`1px solid ${P.border}`:"none"}}>
              <div style={{padding:isTablet?"20px 24px 0":"8px 16px 0",flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:isTablet?"center":"flex-start",gap:16,marginBottom:10,flexDirection:isTablet?"row":"column"}}>
                  <div>
                    <div style={{fontSize:isTablet?24:16,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:4}}>{mode==="owner"?"Facility Overview":"Find Your Unit"}</div>
                    <div style={{fontSize:isTablet?13:11,color:P.sub,fontFamily:P.fontBody}}>{isTablet?"Desktop and iPad layout with live map plus unit details.":"Tap a unit to inspect pricing and availability."}</div>
                  </div>
                  {isTablet&&(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(88px,1fr))",gap:10,minWidth:300}}>
                      {[
                        {v:units.filter(u=>u.status==="available").length,l:"Open",c:STATUS.available.color},
                        {v:units.length,l:"Units",c:P.text},
                        {v:`${Math.round(units.filter(u=>u.status!=="available").length/units.length*100)}%`,l:"Occupied",c:STATUS.occupied.color},
                      ].map(({v,l,c})=>(<div key={l} style={{padding:"10px 12px",borderRadius:12,background:P.borderLight,border:`1px solid ${P.border}`}}><div style={{fontSize:24,fontWeight:700,color:c,fontFamily:P.font}}>{v}</div><div style={{fontSize:10,color:P.muted,fontWeight:700,fontFamily:P.fontBody,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div></div>))}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,flexWrap:isTablet?"wrap":"nowrap"}}>
                  <button onClick={()=>setSf(null)} style={{padding:isTablet?"7px 12px":"5px 10px",borderRadius:999,border:`1px solid ${!sf?P.gold:P.border}`,background:!sf?P.goldLight:P.card,color:!sf?P.goldDark:P.muted,fontSize:isTablet?11:9,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,whiteSpace:"nowrap",flexShrink:0}}>All Units</button>
                  {Object.entries(STATUS).map(([k,v])=>(<button key={k} onClick={()=>setSf(sf===k?null:k)} style={{padding:isTablet?"7px 12px":"5px 10px",borderRadius:999,border:`1px solid ${sf===k?v.color+"40":P.border}`,background:sf===k?v.color+"12":P.card,color:sf===k?v.color:P.muted,fontSize:isTablet?11:9,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:v.color}}/>{v.label}</button>))}
                </div>
              </div>
              <div style={{flex:1,minHeight:isTablet?520:0,position:"relative",padding:isTablet?"0 24px 24px":"0"}}>
                <div style={{height:"100%",minHeight:isTablet?520:0,border:isTablet?`1px solid ${P.border}`:"none",borderRadius:isTablet?22:0,overflow:"hidden",background:P.card}}>
                  <FacilityMap units={units} selId={selId} onSelect={setSelId} statusFilter={sf}/>
                </div>
                <div style={{position:"absolute",bottom:isTablet?36:8,right:isTablet?36:8,display:"flex",gap:6,zIndex:5}}>
                  <button onClick={()=>setFs(true)} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.9)",backdropFilter:"blur(8px)",border:`1px solid ${P.gold}20`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,color:P.sub}}>⛶</button>
                </div>
                {sel&&<button onClick={()=>setSelId(null)} style={{position:"absolute",bottom:isTablet?36:8,left:isTablet?36:8,padding:isTablet?"8px 14px":"6px 12px",borderRadius:10,background:"rgba(255,255,255,0.9)",backdropFilter:"blur(8px)",border:`1px solid ${P.gold}20`,color:P.sub,fontSize:isTablet?11:10,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,zIndex:5}}>↑ Zoom Out</button>}
              </div>
            </div>
            {isTablet?(detailCard||<div style={{padding:"24px",background:P.card,display:"flex",alignItems:"center",justifyContent:"center",color:P.sub,fontFamily:P.fontBody}}><div style={{maxWidth:240,textAlign:"center"}}><div style={{fontSize:24,marginBottom:10}}>🗺️</div><div style={{fontSize:18,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:6}}>Select a unit</div><div style={{fontSize:13,lineHeight:1.6}}>Choose any building on the map to review pricing, features, and tenant details.</div></div></div>):detailCard}
          </div>
        )}
        {step===1&&<Step2 formData={form} setForm={setForm}/>}
        {step===2&&sel&&<Step3 formData={form} setForm={setForm} unit={sel}/>}
        {step===3&&sel&&<Step4 agreed={agreed} setAgreed={setAgreed} unit={sel}/>}
        {step===4&&sel&&<Step5 unit={sel} formData={form}/>}
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
