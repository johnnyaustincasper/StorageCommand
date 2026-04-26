import { Suspense, lazy, useState, useRef, useEffect, useCallback } from "react";

const FacilityBuilder = lazy(() => import("./FacilityBuilder"));

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

const DEFAULT_FACILITY = { name: "Riverside Storage", address: "4521 S Memorial Dr, Tulsa, OK 74145" };
const STORAGE_KEYS = {
  facility: "storage-command.facility",
  units: "storage-command.units",
};
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

const SIZE_DEFAULTS = {
  "5×5": { key:"small", label:"5×5", sqft:25, price:49, desc:"Boxes & seasonal items", features:["Interior","Ground floor","24/7 access"], w:1.4, h:0.7, d:1.0 },
  "10×10": { key:"medium", label:"10×10", sqft:100, price:99, desc:"1-bedroom apartment", features:["Drive-up","Ground floor","24/7","Wide doors"], w:1.4, h:1.1, d:1.0 },
  "10×20": { key:"large", label:"10×20", sqft:200, price:169, desc:"2-3 bedroom home", features:["Drive-up","12ft ceiling","24/7","Wide doors"], w:1.4, h:1.6, d:1.0 },
  "10×30": { key:"xl", label:"10×30", sqft:300, price:249, desc:"Commercial / multi-vehicle", features:["Drive-up","14ft ceiling","24/7","Forklift"], w:1.4, h:2.2, d:1.0 },
};

const getSizeDefaults=(size)=>SIZE_DEFAULTS[size]||SIZE_DEFAULTS["10×10"];

function createLayoutScaler(builderUnits){
  const pts=builderUnits.map((u)=>u.center).filter((center)=>Array.isArray(center)&&center.length===2);
  if(!pts.length)return null;
  const lngs=pts.map(([lng])=>lng);
  const lats=pts.map(([,lat])=>lat);
  const minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
  const minLat=Math.min(...lats), maxLat=Math.max(...lats);
  const spanLng=Math.max(maxLng-minLng,0.0002);
  const spanLat=Math.max(maxLat-minLat,0.0002);
  return(center,index)=>{
    if(!Array.isArray(center)||center.length!==2){
      const col=index%6;
      const row=Math.floor(index/6);
      return { x:-12+col*4.6, z:-8+row*3.4 };
    }
    const [lng,lat]=center;
    const x=((lng-minLng)/spanLng-0.5)*28;
    const z=(0.5-(lat-minLat)/spanLat)*18;
    return { x,z };
  };
}

function normalizeAppUnit(unit,index,placeBuilderUnit){
  if(unit&&typeof unit.x==="number"&&typeof unit.z==="number"){
    const sizeDefaults=getSizeDefaults(unit.label);
    return {
      ...sizeDefaults,
      ...unit,
      price:Number(unit.price ?? sizeDefaults.price),
      sqft:Number(unit.sqft ?? sizeDefaults.sqft),
      features:Array.isArray(unit.features)&&unit.features.length?unit.features:sizeDefaults.features,
      desc:unit.desc||sizeDefaults.desc,
      w:Number(unit.w ?? sizeDefaults.w),
      h:Number(unit.h ?? sizeDefaults.h),
      d:Number(unit.d ?? sizeDefaults.d),
    };
  }

  const sizeDefaults=getSizeDefaults(unit?.size || unit?.label);
  const pos=placeBuilderUnit?.(unit?.center,index) || { x:-12+(index%6)*4.6, z:-8+Math.floor(index/6)*3.4 };
  return {
    id:unit?.id || `CUSTOM-${String(index+1).padStart(2,"0")}`,
    type:sizeDefaults.key,
    status:unit?.status || "available",
    label:unit?.size || sizeDefaults.label,
    sqft:sizeDefaults.sqft,
    price:Number(unit?.price ?? sizeDefaults.price),
    desc:sizeDefaults.desc,
    features:sizeDefaults.features,
    w:sizeDefaults.w,
    h:sizeDefaults.h,
    d:sizeDefaults.d,
    tenant:null,
    balance:0,
    x:pos.x,
    y:0,
    z:pos.z,
    sourceCenter:unit?.center || null,
    geometry:unit?.geometry || null,
    builderLabel:unit?.label || "",
  };
}

function normalizeUnits(units,fallback=ALL_UNITS){
  if(!Array.isArray(units)||!units.length)return fallback;
  const hasBuilderUnits=units.some((unit)=>typeof unit?.x!=="number"||typeof unit?.z!=="number");
  const placeBuilderUnit=hasBuilderUnits?createLayoutScaler(units):null;
  return units.map((unit,index)=>normalizeAppUnit(unit,index,placeBuilderUnit));
}

function toBuilderUnits(units){
  return normalizeUnits(units,[]).map((unit,index)=>({
    id:unit.id,
    label:unit.builderLabel || unit.id || `Unit ${index+1}`,
    size:unit.label || "10×10",
    price:String(unit.price ?? ""),
    status:unit.status || "available",
    center:Array.isArray(unit.sourceCenter)&&unit.sourceCenter.length===2
      ? unit.sourceCenter
      : [-95.9928 + unit.x * 0.00008, 36.154 - unit.z * 0.00012],
    geometry:unit.geometry || null,
  }));
}

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
const readStoredJson=(key,fallback)=>{
  if(typeof window==="undefined")return fallback;
  try{
    const raw=window.localStorage.getItem(key);
    return raw?JSON.parse(raw):fallback;
  }catch{
    return fallback;
  }
};
const genCode=()=>Math.floor(1000+Math.random()*9000)+String.fromCharCode(65+Math.floor(Math.random()*26));
const P={
  bg:"#fefefe",card:"#ffffff",border:"#f0ece4",borderLight:"#f7f4ef",
  text:"#1a1714",sub:"#8c8378",muted:"#b8afa5",
  gold:"#c9a84c",goldLight:"#f5eed9",goldDark:"#8b7432",
  blue:"#3b82f6",success:"#22c55e",danger:"#ef4444",
  font:"'Cormorant Garamond', serif",fontBody:"'Nunito', sans-serif",radius:12,
};
const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const rgba=(rgb,a)=>`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
const shade=(rgb,m)=>rgb.map(v=>Math.max(0,Math.min(255,Math.round(v*m))));

// ═══════════════════════════════════════════════
// CANVAS 3D RENDERER
// ═══════════════════════════════════════════════
function FacilityMap({ units, selId, onSelect, statusFilter }) {
  const canvasRef = useRef(null);
  const projRef = useRef([]);
  const camRef = useRef({ angle:34, tiltX:-1.0, cx:1, cz:-3, zoom:15, dist:34 });
  const targetRef = useRef({ angle:34, tiltX:-1.0, cx:1, cz:-3, zoom:15 });
  const selRef = useRef(null);
  const filterRef = useRef(null);
  const gestureRef = useRef({ active:false, type:null, sx:0, sy:0, moved:false });
  const idleRef = useRef(0);
  const ptrCache = useRef([]);
  const lastPan = useRef({x:0,y:0});
  const lastPinch = useRef({dist:0,angle:0,mx:0,my:0});

  // Critters state — initialized once
  const [critters] = useState(()=>{
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
    return [
      mkBunny(),mkBunny(),mkBunny(),
      mkSquirrel(),mkSquirrel(),
      mkBird(),mkBird(),
    ];
  });

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
      t.cx=1;t.cz=-3;t.zoom=15;t.tiltX=-1.0;
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

      // ── ENVIRONMENT ──
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,"#d9e3ea"); sky.addColorStop(0.62,"#edf1f3"); sky.addColorStop(1,"#f5f3ee");
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

      const sun=ctx.createRadialGradient(W*0.78,H*0.12,0,W*0.78,H*0.12,W*0.42);
      sun.addColorStop(0,"rgba(255,255,255,0.52)");sun.addColorStop(0.4,"rgba(255,255,255,0.16)");sun.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=sun;ctx.fillRect(0,0,W,H*0.65);

      // ── GROUNDS ──
      const gP=[[-36,-26],[36,-26],[36,26],[-36,26]].map(([gx,gz])=>project(gx,-0.05,gz,c));
      ctx.beginPath();ctx.moveTo(gP[0].sx,gP[0].sy);gP.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
      const grassG=ctx.createLinearGradient(0,gP[0].sy,0,gP[2].sy);
      grassG.addColorStop(0,"#8b9a73");grassG.addColorStop(1,"#667654");
      ctx.fillStyle=grassG;ctx.fill();

      const pad=[[-21,-14.3],[23,-14.3],[23,5.6],[-21,5.6]].map(([x,z])=>project(x,-0.04,z,c));
      ctx.beginPath();ctx.moveTo(pad[0].sx,pad[0].sy);pad.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
      ctx.fillStyle="rgba(70,73,72,0.18)";ctx.fill();

      // ── ROAD SYSTEM ──
      // 3 buildings: A(z=-11.5 to -6.5), B(z=-4.5 to 0.5), C(z=2.5 to 7.5)
      // Units span x=-14.6 to +19.4
      const road="#3b3d3d";
      const roadEdge="rgba(255,255,255,0.16)";
      const drawRoad=(pts)=>{
        ctx.beginPath();ctx.moveTo(pts[0].sx,pts[0].sy);
        pts.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
        const rg=ctx.createLinearGradient(pts[0].sx,pts[0].sy,pts[2].sx,pts[2].sy);
        rg.addColorStop(0,"#474a49");rg.addColorStop(0.55,road);rg.addColorStop(1,"#303232");
        ctx.fillStyle=rg;ctx.fill();
        ctx.strokeStyle=roadEdge;ctx.lineWidth=1;ctx.stroke();
        ctx.save();ctx.clip();
        ctx.strokeStyle="rgba(255,255,255,0.035)";ctx.lineWidth=0.6;
        for(let i=0;i<14;i++){
          const a=pts[0], b=pts[2];
          const x=a.sx+(b.sx-a.sx)*(i/13);
          ctx.beginPath();ctx.moveTo(x-22,a.sy-80);ctx.lineTo(x+28,b.sy+80);ctx.stroke();
        }
        ctx.restore();
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
      const erG=ctx.createLinearGradient(entryRoad[0].sx,entryRoad[0].sy,entryRoad[2].sx,entryRoad[2].sy);
      erG.addColorStop(0,"#4a4d4c");erG.addColorStop(1,"#303232");ctx.fillStyle=erG;ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.14)";ctx.lineWidth=1;ctx.stroke();

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
      ctx.strokeStyle="#9b2f2f";
      ctx.lineWidth=Math.max(2,gArmStart.sc*c.zm*0.09);ctx.stroke();
      // Gate label
      const gMid=project(3,fenceH*1.6,4.5,c);
      ctx.font=`700 ${Math.max(6,gMid.sc*c.zm*0.12)}px 'Nunito',sans-serif`;
      ctx.fillStyle="rgba(90,74,58,0.7)";ctx.textAlign="center";
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
      const rowDoorDirection=(unit)=>{
        const row=String(unit.id||"").split("-")[0];
        if(/[ABC]1$/.test(row))return -1;
        if(/[ABC]2$/.test(row))return 1;
        const streetZ=[-11.3,-8.7,-5.8,-3.2,-0.3,2.3];
        const nearest=streetZ.reduce((best,z)=>Math.abs(z-unit.z)<Math.abs(best-unit.z)?z:best,streetZ[0]);
        return nearest<unit.z?-1:1;
      };

      // Draw one continuous low building shell per A/B/C block. Individual units are doors
      // on opposite long sides of that building, like a real self-storage row.
      const drawBuildingShell=(groupUnits)=>{
        if(!groupUnits.length)return;
        const visualGapClose=0.28;
        const unitH=0.98, uhh=unitH/2;
        const wall=[213,207,194], roof=[178,173,160];
        const x1=Math.min(...groupUnits.map(u=>u.x-(u.w+visualGapClose)/2));
        const x2=Math.max(...groupUnits.map(u=>u.x+(u.w+visualGapClose)/2));
        const z1=Math.min(...groupUnits.map(u=>u.z-u.d/2));
        const z2=Math.max(...groupUnits.map(u=>u.z+u.d/2));
        const corners=[
          [x1,-uhh,z1],[x2,-uhh,z1],[x2,uhh,z1],[x1,uhh,z1],
          [x1,-uhh,z2],[x2,-uhh,z2],[x2,uhh,z2],[x1,uhh,z2],
        ].map(([x,dy,z])=>project(x,unitH/2+dy,z,c));

        const sh=[[x1,0,z1],[x2,0,z1],[x2,0,z2],[x1,0,z2]].map(([x,,z])=>project(x+0.42,-0.025,z+0.28,c));
        ctx.save();ctx.filter="blur(7px)";ctx.beginPath();ctx.moveTo(sh[0].sx+4,sh[0].sy+4);sh.slice(1).forEach(pt=>ctx.lineTo(pt.sx+4,pt.sy+4));ctx.closePath();ctx.fillStyle="rgba(0,0,0,0.16)";ctx.fill();ctx.restore();

        const ang2=c.angle*Math.PI/180;
        const camDirX=Math.sin(ang2), camDirZ=Math.cos(ang2);
        const showFront=camDirZ>0, showBack=camDirZ<0, showLeft=camDirX<0, showRight=camDirX>0;
        const drawFace=(pts,br,isTop)=>{
          ctx.beginPath();ctx.moveTo(pts[0].sx,pts[0].sy);pts.slice(1).forEach(pt=>ctx.lineTo(pt.sx,pt.sy));ctx.closePath();
          if(isTop){
            const tg=ctx.createLinearGradient(pts[0].sx,pts[0].sy,pts[2].sx,pts[2].sy);
            tg.addColorStop(0,rgba(shade(roof,br*1.12),0.94));
            tg.addColorStop(0.55,rgba(shade(roof,br*1.02),0.94));
            tg.addColorStop(1,rgba(shade(roof,br*0.92),0.94));
            ctx.fillStyle=tg;
          }else ctx.fillStyle=rgba(shade(wall,br),0.95);
          ctx.fill();ctx.strokeStyle=isTop?"rgba(255,255,255,0.18)":"rgba(33,37,41,0.24)";ctx.lineWidth=isTop?0.9:1;ctx.stroke();
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

        ctx.strokeStyle="rgba(255,255,255,0.18)";ctx.lineWidth=0.7;
        for(let i=1;i<=7;i++){
          const f=i/8;
          const a={sx:corners[3].sx+(corners[2].sx-corners[3].sx)*f,sy:corners[3].sy+(corners[2].sy-corners[3].sy)*f};
          const b={sx:corners[7].sx+(corners[6].sx-corners[7].sx)*f,sy:corners[7].sy+(corners[6].sy-corners[7].sy)*f};
          ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);ctx.stroke();
        }
      };

      const buildingGroups=Object.values(units.reduce((acc,u)=>{
        const key=String(u.id||"").charAt(0)||"X";
        (acc[key] ||= []).push(u);
        return acc;
      },{})).sort((a,b)=>{
        const az=a.reduce((s,u)=>s+u.z,0)/a.length, bz=b.reduce((s,u)=>s+u.z,0)/b.length;
        return bz-az;
      });
      buildingGroups.forEach(drawBuildingShell);

      sorted.forEach(unit=>{
        const visualGapClose=0.28;
        const hw=(unit.w+visualGapClose)/2, hd=unit.d/2;
        const isSel=unit.id===curSel;
        const isDim=(curFilter&&unit.status!==curFilter);
        const st=STATUS[unit.status];
        const accent=hx(st.color);
        const unitH=isSel?1.02:0.98;
        const uhh=unitH/2;
        const door=[228,224,214];

        const corners=[
          [-hw,-uhh,-hd],[hw,-uhh,-hd],[hw,uhh,-hd],[-hw,uhh,-hd],
          [-hw,-uhh,hd],[hw,-uhh,hd],[hw,uhh,hd],[-hw,uhh,hd],
        ].map(([dx,dy,dz])=>project(unit.x+dx,unitH/2+dy,unit.z+dz,c));

        if(isSel){
          const gc=project(unit.x,0.04,unit.z,c);
          const gr=Math.max(18,corners[3].sc*c.zm*0.34);
          const glow=ctx.createRadialGradient(gc.sx,gc.sy,0,gc.sx,gc.sy,gr);
          glow.addColorStop(0,"rgba(201,168,76,0.32)");glow.addColorStop(0.45,"rgba(201,168,76,0.14)");glow.addColorStop(1,"rgba(201,168,76,0)");
          ctx.fillStyle=glow;ctx.fillRect(gc.sx-gr,gc.sy-gr,gr*2,gr*2);
        }

        const ang2=c.angle*Math.PI/180;
        const camDirZ=Math.cos(ang2);
        const showFront=camDirZ>0;
        const showBack=camDirZ<0;

        if(!isDim){
          const doorSide=rowDoorDirection(unit);
          const doorVisible=doorSide<0?showFront:showBack;
          if(doorVisible){
            const doorZ=unit.z+doorSide*hd+doorSide*0.012;
            const d1=project(unit.x-hw*0.40,0.03,doorZ,c),d2=project(unit.x+hw*0.40,0.03,doorZ,c);
            const d3=project(unit.x-hw*0.40,unitH*0.80,doorZ,c),d4=project(unit.x+hw*0.40,unitH*0.80,doorZ,c);
            ctx.beginPath();ctx.moveTo(d1.sx,d1.sy);ctx.lineTo(d2.sx,d2.sy);ctx.lineTo(d4.sx,d4.sy);ctx.lineTo(d3.sx,d3.sy);ctx.closePath();
            const dg=ctx.createLinearGradient(d1.sx,d1.sy,d4.sx,d4.sy);
            dg.addColorStop(0,rgba(shade(door,0.86),0.94));dg.addColorStop(0.55,rgba(shade(door,1.03),0.96));dg.addColorStop(1,rgba(shade(door,0.82),0.94));
            ctx.fillStyle=dg;ctx.fill();
            ctx.strokeStyle=isSel?"rgba(201,168,76,0.95)":"rgba(31,41,55,0.26)";ctx.lineWidth=isSel?1.8:0.8;ctx.stroke();
            ctx.strokeStyle="rgba(255,255,255,0.22)";ctx.lineWidth=0.55;
            for(let dl=1;dl<=5;dl++){
              const f=dl/6;
              ctx.beginPath();ctx.moveTo(d1.sx+(d3.sx-d1.sx)*f,d1.sy+(d3.sy-d1.sy)*f);ctx.lineTo(d2.sx+(d4.sx-d2.sx)*f,d2.sy+(d4.sy-d2.sy)*f);ctx.stroke();
            }
            const accentZ=unit.z+doorSide*hd+doorSide*0.018;
            const a1=project(unit.x-hw*0.40,unitH*0.84,accentZ,c),a2=project(unit.x+hw*0.40,unitH*0.84,accentZ,c);
            ctx.beginPath();ctx.moveTo(a1.sx,a1.sy);ctx.lineTo(a2.sx,a2.sy);
            ctx.strokeStyle=rgba(accent,isSel?0.95:0.55);ctx.lineWidth=Math.max(1,a1.sc*c.zm*0.035);ctx.stroke();
          }
        }

        if(!isDim){
          const tc={sx:(corners[2].sx+corners[3].sx+corners[6].sx+corners[7].sx)/4,sy:(corners[2].sy+corners[3].sy+corners[6].sy+corners[7].sy)/4};
          const ls=corners[3].sc*c.zm;
          if(ls>10){
            const fs=Math.max(6,Math.min(14,ls*0.13));
            ctx.font=`800 ${fs}px 'Nunito',sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillStyle="rgba(255,255,255,0.38)";ctx.fillText(unit.id,tc.sx+0.5,tc.sy+0.5);
            ctx.fillStyle=isSel?"#f8fafc":"rgba(28,31,33,0.72)";ctx.fillText(unit.id,tc.sx,tc.sy);
            if(ls>22){ctx.font=`700 ${Math.max(5,fs*0.55)}px 'Nunito',sans-serif`;ctx.fillStyle=isSel?"rgba(255,255,255,0.78)":"rgba(28,31,33,0.46)";ctx.fillText(`$${unit.price}/mo`,tc.sx,tc.sy+fs*0.9);}
          }
        }

        const ctr=project(unit.x,unitH/2+uhh,unit.z,c);
        projected.push({id:unit.id,sx:ctr.sx,sy:ctr.sy,radius:Math.max(18,ctr.sc*c.zm*0.2)});
      });
      projRef.current=projected;

      // ── CRITTERS ──
      critters.forEach(cr=>{
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
  },[critters,units,project]);

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
  const [facility,setFacility]=useState(()=>readStoredJson(STORAGE_KEYS.facility,DEFAULT_FACILITY));
  const [units,setUnits]=useState(()=>normalizeUnits(readStoredJson(STORAGE_KEYS.units,ALL_UNITS)));
  const [selId,setSelId]=useState(null);
  const [sf,setSf]=useState(null);
  const [form,setForm]=useState({});
  const [agreed,setAgreed]=useState(false);
  const [fs,setFs]=useState(false);
  const sel=selId?units.find(u=>u.id===selId):null;

  useEffect(()=>{
    if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEYS.facility,JSON.stringify(facility));
  },[facility]);

  useEffect(()=>{
    if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEYS.units,JSON.stringify(units));
  },[units]);

  const openBuilder=()=>setMode("builder");
  const saveBuilder=({units:nextUnits,address:nextAddress})=>{
    setUnits(normalizeUnits(nextUnits));
    setFacility(prev=>({...prev,address:(nextAddress||prev.address).trim()}));
    setMode("setup");
  };
  const resetDemo=()=>{
    setFacility(DEFAULT_FACILITY);
    setUnits(ALL_UNITS);
    setSelId(null);
    setSf(null);
  };

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
          <div style={{fontSize:17,color:P.muted,marginTop:8}}>{facility.name}</div>
          <div style={{fontSize:13,color:P.sub,marginTop:4,maxWidth:480}}>{facility.address}</div>
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

  // ── BUILDER ──
  if(mode==="builder")return(
    <div style={{width:"100%",height:"100vh",background:P.bg,fontFamily:P.fontBody}}>
      {fonts}
      <Suspense fallback={
        <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:P.sub,fontSize:14}}>
          Loading facility builder...
        </div>
      }>
        <FacilityBuilder
          existingUnits={toBuilderUnits(units)}
          facilityAddress={facility.address}
          onSave={saveBuilder}
          onBack={()=>setMode("setup")}
        />
      </Suspense>
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
          {icon:"📐",title:"Starter Layout Draft",desc:"Open the builder and place a simple template around the current map center, then adjust each unit manually.",tag:"Template Based",tagColor:P.gold,action:openBuilder,cta:"Open Builder"},
          {icon:"🏗️",title:"Manual Builder",desc:"Configure buildings, rows, and units step by step on a live map.",tag:"Full Control",tagColor:P.blue,action:openBuilder,cta:"Launch Manual Builder"},
          {icon:"🎨",title:"Branding & Theme",desc:"Branding controls are next, but your facility address already saves from the builder.",tag:"In Progress",tagColor:P.success},
          {icon:"💳",title:"Billing Setup",desc:"Stripe connection is not wired up yet. This demo does not process live payments today.",tag:"Not Yet Connected",tagColor:P.muted},
          {icon:"🔐",title:"Smart Lock Integration",desc:"Device integrations are planned, but access codes here are still local demo values.",tag:"Planned",tagColor:P.muted},
          {icon:"🤝",title:"Operations Assistant",desc:"No live AI copilot is connected yet. We removed the fake setup flow until there is a real backend behind it.",tag:"Honest Placeholder",tagColor:P.muted},
        ].map(({icon,title,desc,tag,tagColor,action,cta})=>(
          <button key={title} onClick={action} disabled={!action} style={{width:"100%",padding:16,borderRadius:P.radius,border:`1px solid ${action?tagColor+"35":P.border}`,background:P.card,marginBottom:10,cursor:action?"pointer":"default",display:"flex",gap:14,alignItems:"flex-start",textAlign:"left"}}>
            <div style={{fontSize:26,flexShrink:0,marginTop:2}}>{icon}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,flexWrap:"wrap"}}>
                <span style={{fontSize:15,fontWeight:700,color:P.text,fontFamily:P.font}}>{title}</span>
                <span style={{padding:"1px 6px",borderRadius:4,background:tagColor+"15",color:tagColor,fontSize:8,fontWeight:700,fontFamily:P.fontBody}}>{tag}</span>
              </div>
              <div style={{fontSize:11,color:P.sub,fontFamily:P.fontBody,lineHeight:1.4}}>{desc}</div>
              {cta&&<div style={{fontSize:10,fontWeight:800,color:tagColor,fontFamily:P.fontBody,letterSpacing:"0.06em",marginTop:10}}>{cta} →</div>}
            </div>
          </button>
        ))}
        <div style={{marginTop:16,padding:16,borderRadius:P.radius,background:P.goldLight,border:`1px solid ${P.gold}20`}}>
          <div style={{fontSize:10,fontWeight:700,color:P.goldDark,fontFamily:P.fontBody,letterSpacing:"0.06em",marginBottom:8}}>CURRENT FACILITY</div>
          <div style={{fontSize:18,fontWeight:700,color:P.text,fontFamily:P.font,marginBottom:4}}>{facility.name}</div>
          <div style={{fontSize:11,color:P.sub,fontFamily:P.fontBody}}>{facility.address}</div>
          <div style={{display:"flex",gap:16,marginTop:10}}>
            <div><div style={{fontSize:18,fontWeight:700,color:P.gold,fontFamily:P.font}}>{units.length}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Units</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:P.success,fontFamily:P.font}}>{units.filter(u=>u.status==="available").length}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Available</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:P.danger,fontFamily:P.font}}>{units.filter(u=>u.status==="overdue").length}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Past Due</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:P.text,fontFamily:P.font}}>${units.filter(u=>u.status!=="available"&&u.status!=="maintenance").reduce((s,u)=>s+Number(u.price||0),0).toLocaleString()}</div><div style={{fontSize:8,color:P.muted,fontFamily:P.fontBody}}>Monthly Rev</div></div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
            <button onClick={openBuilder} style={{padding:"10px 14px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${P.gold},#b8943f)`,color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:P.fontBody}}>Open Facility Builder</button>
            <button onClick={resetDemo} style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody}}>Reset Demo Data</button>
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
  const occupancy=Math.round(units.filter(u=>u.status!=="available").length/units.length*100);
  const monthlyRevenue=units.filter(u=>u.status!=="available"&&u.status!=="maintenance").reduce((s,u)=>s+Number(u.price||0),0);
  const customerStatuses=["available","reserved"];
  const shownStatuses=mode==="customer"?customerStatuses:Object.keys(STATUS);
  const mapFilter=mode==="customer"?(sf || "available"):sf;

  const detailCard=sel?(
    <div key={sel.id} style={{padding:isTablet?"24px":"16px",flexShrink:0,borderTop:isTablet?"none":`1px solid ${P.border}`,borderLeft:isTablet?`1px solid ${P.border}`:"none",background:`linear-gradient(180deg,${P.card},#fffaf1)`,height:"100%",overflowY:"auto",boxShadow:isTablet?"inset 1px 0 0 rgba(255,255,255,.7)":"0 -18px 50px rgba(26,23,20,.08)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14}}>
        <div>
          <div style={{fontSize:10,fontWeight:900,letterSpacing:"0.12em",color:P.gold,fontFamily:P.fontBody,textTransform:"uppercase"}}>{mode==="owner"?"Unit Command":"Selected Unit"}</div>
          <div style={{fontSize:isTablet?30:24,fontWeight:700,color:P.text,fontFamily:P.font,lineHeight:1}}>Unit {sel.id}</div>
        </div>
        <span style={{padding:"7px 10px",borderRadius:999,background:STATUS[sel.status].color+"16",color:STATUS[sel.status].color,fontSize:10,fontWeight:900,fontFamily:P.fontBody,whiteSpace:"nowrap",border:`1px solid ${STATUS[sel.status].color}30`}}>{STATUS[sel.status].label}</span>
      </div>

      <div style={{padding:18,borderRadius:18,background:P.card,border:`1px solid ${P.gold}20`,boxShadow:"0 18px 44px rgba(26,23,20,.07)",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:14,marginBottom:14}}>
          <div>
            <div style={{fontSize:12,color:P.sub,fontFamily:P.fontBody,fontWeight:800}}>{sel.label} · {sel.sqft} ft²</div>
            <div style={{fontSize:12,color:P.muted,fontFamily:P.fontBody,marginTop:3,lineHeight:1.45}}>{mode==="customer"?sel.desc:"Live unit status, tenant, rent, and balance."}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:34,fontWeight:700,color:P.gold,fontFamily:P.font,lineHeight:.85}}>${sel.price}</div>
            <div style={{fontSize:10,color:P.muted,fontFamily:P.fontBody,fontWeight:800}}>/month</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
          {[
            {l:"Size",v:sel.label},
            {l:"Monthly",v:`$${sel.price}`},
            {l:"Status",v:STATUS[sel.status].label,c:STATUS[sel.status].color},
            {l:mode==="owner"?"Balance":"Access",v:mode==="owner"?`$${sel.balance||0}`:"24/7",c:mode==="owner"&&sel.balance>0?P.danger:P.text},
          ].map(({l,v,c})=>(<div key={l} style={{padding:"10px 12px",borderRadius:12,background:P.borderLight,border:`1px solid ${P.border}`}}><div style={{fontSize:9,color:P.muted,fontWeight:900,letterSpacing:"0.08em",fontFamily:P.fontBody,textTransform:"uppercase"}}>{l}</div><div style={{fontSize:14,color:c||P.text,fontWeight:900,fontFamily:P.fontBody,marginTop:2}}>{v}</div></div>))}
        </div>
      </div>

      {sel.tenant&&mode==="owner"&&(<div style={{padding:14,borderRadius:16,background:"#fff",marginBottom:12,border:`1px solid ${P.border}`,boxShadow:"0 12px 30px rgba(26,23,20,.05)"}}><div style={{fontSize:10,fontWeight:900,color:P.gold,letterSpacing:"0.1em",fontFamily:P.fontBody,marginBottom:6}}>TENANT</div><div style={{fontSize:15,fontWeight:900,color:P.text,fontFamily:P.fontBody}}>{sel.tenant.name}</div><div style={{fontSize:11,color:P.sub,fontFamily:P.fontBody,marginTop:2,lineHeight:1.5}}>{sel.tenant.phone}<br/>{sel.tenant.email}</div>{sel.balance>0&&<div style={{marginTop:8,padding:"7px 9px",borderRadius:10,background:"#fff1f2",color:"#dc2626",fontSize:11,fontWeight:900,fontFamily:P.fontBody}}>${sel.balance} past due</div>}</div>)}

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>{(sel.features||[]).map((f,i)=>(<span key={i} style={{padding:"6px 9px",borderRadius:999,background:P.goldLight,color:P.goldDark,fontSize:10,fontWeight:900,fontFamily:P.fontBody,border:`1px solid ${P.gold}22`}}>✓ {f}</span>))}</div>
      {mode==="customer"&&sel.status!=="available"&&<div style={{padding:12,borderRadius:14,background:P.borderLight,border:`1px solid ${P.border}`,color:P.sub,fontSize:12,fontWeight:800,fontFamily:P.fontBody,marginBottom:12}}>This unit is currently unavailable. Pick a green available unit to reserve instantly.</div>}
      <button onClick={()=>setSelId(null)} style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${P.border}`,background:P.card,color:P.sub,fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:P.fontBody}}>✕ Deselect</button>
    </div>
  ):null;

  return(
    <div style={{width:"100%",height:"100vh",background:P.bg,fontFamily:P.fontBody,color:P.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {fonts}
      <div style={{padding:isTablet?"14px 24px":"10px 16px",background:P.card,borderBottom:`1px solid ${P.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${P.gold},#d4a843)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff"}}>SC</div>
            <div><div style={{fontSize:13,fontWeight:700,fontFamily:P.font}}>{facility.name}</div><div style={{fontSize:9,color:P.muted}}>{mode==="owner"?"Owner Dashboard":"24/7 Self-Service"}</div></div>
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
                        {v:units.filter(u=>u.status==="available").length,l:mode==="owner"?"Open":"Ready",c:STATUS.available.color},
                        {v:mode==="owner"?`$${monthlyRevenue.toLocaleString()}`:units.length,l:mode==="owner"?"Revenue":"Units",c:P.text},
                        {v:`${occupancy}%`,l:"Occupied",c:STATUS.occupied.color},
                      ].map(({v,l,c})=>(<div key={l} style={{padding:"10px 12px",borderRadius:12,background:P.borderLight,border:`1px solid ${P.border}`}}><div style={{fontSize:24,fontWeight:700,color:c,fontFamily:P.font}}>{v}</div><div style={{fontSize:10,color:P.muted,fontWeight:700,fontFamily:P.fontBody,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div></div>))}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,flexWrap:isTablet?"wrap":"nowrap"}}>
                  <button onClick={()=>setSf(null)} style={{padding:isTablet?"7px 12px":"5px 10px",borderRadius:999,border:`1px solid ${!sf?P.gold:P.border}`,background:!sf?P.goldLight:P.card,color:!sf?P.goldDark:P.muted,fontSize:isTablet?11:9,fontWeight:700,cursor:"pointer",fontFamily:P.fontBody,whiteSpace:"nowrap",flexShrink:0}}>All Units</button>
                  {shownStatuses.map((k)=>{const v=STATUS[k];return <button key={k} onClick={()=>setSf(sf===k?null:k)} style={{padding:isTablet?"7px 12px":"6px 11px",borderRadius:999,border:`1px solid ${sf===k?v.color+"40":P.border}`,background:sf===k?v.color+"12":P.card,color:sf===k?v.color:P.muted,fontSize:isTablet?11:10,fontWeight:800,cursor:"pointer",fontFamily:P.fontBody,whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:v.color}}/>{v.label}</button>})}
                </div>
              </div>
              <div style={{flex:1,minHeight:isTablet?520:0,position:"relative",padding:isTablet?"0 24px 24px":"0"}}>
                <div style={{height:"100%",minHeight:isTablet?520:0,border:isTablet?`1px solid ${P.border}`:"none",borderRadius:isTablet?22:0,overflow:"hidden",background:P.card}}>
                  <FacilityMap units={units} selId={selId} onSelect={setSelId} statusFilter={mapFilter}/>
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
