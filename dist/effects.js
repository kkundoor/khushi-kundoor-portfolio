(() => {
  const toggle = document.querySelector('.effects-toggle');
  const reflection = document.querySelector('#reflections');
  const trail = document.querySelector('.cursor-trail');
  const light = reflection.getContext('2d');
  const ink = trail.getContext('2d');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const sampleWidth = 216;
  const sampleHeight = 144;
  const inkLifetime = 1050;
  let paused = motion.matches;
  let lightFrame = 0;
  let inkFrame = 0;
  let lastLight = 0;
  let lightTime = 0;
  let points = [];
  let split = true;

  reflection.width = sampleWidth;
  reflection.height = sampleHeight;
  const image = light?.createImageData(sampleWidth,sampleHeight);
  const porcelain = [243,245,244];
  const sageShadow = [170,183,174];
  const pearl = [255,255,255];

  function drawReflection(time) {
    if (!light) return;
    const drift = time*.31;
    for (let y=0;y<sampleHeight;y++) {
      for (let x=0;x<sampleWidth;x++) {
        const u=x/sampleWidth, v=y/sampleHeight;
        let px=u*7.6, py=v*6.6;
        // Fold the coordinate field twice so the bands curl into one another.
        px += 1.2*Math.sin(py*1.31+drift+Math.cos(px*.73));
        py += .9*Math.cos(px*1.52-drift*.8+v*2.2);
        px += .42*Math.sin(py*2.3-px*1.1-drift);
        py += .3*Math.cos(px*2.2+py*.9+drift);
        const folds = Math.sin(px*2.2+Math.sin(py*2.85)*1.8+Math.cos(px-py)*1.5);
        const hairline = Math.max(0,Math.cos(folds*15+px*.73+py*.4))**8;
        const sheen = Math.max(0,Math.sin(px*.95-py*1.6+drift*.52))**2;
        const shadow = Math.max(0,Math.min(1,v*.46+.16+(folds+Math.sin(px*.61+py*.87))*.19));
        const highlight = Math.min(.58,.12+hairline*.15+sheen*.29);
        const pixel=(y*sampleWidth+x)*4;
        for(let channel=0;channel<3;channel++) {
          const pigment=porcelain[channel]+(sageShadow[channel]-porcelain[channel])*shadow;
          image.data[pixel+channel]=Math.round(pigment+(pearl[channel]-pigment)*highlight);
        }
        image.data[pixel+3]=255;
      }
    }
    light.putImageData(image,0,0);
  }

  function animateLight(now) {
    lightFrame=0;
    if(paused || document.hidden) return;
    if(!lastLight || now-lastLight>=32) {
      if(lastLight) lightTime+=Math.min(now-lastLight,65)/1000;
      lastLight=now;
      drawReflection(lightTime);
    }
    lightFrame=requestAnimationFrame(animateLight);
  }

  function clearInk() {
    points=[];
    split=true;
    cancelAnimationFrame(inkFrame);
    inkFrame=0;
    ink?.clearRect(0,0,innerWidth,innerHeight);
  }

  function sizeInk() {
    if(!ink) return;
    const scale=Math.min(devicePixelRatio || 1,2);
    trail.width=Math.round(innerWidth*scale);
    trail.height=Math.round(innerHeight*scale);
    ink.setTransform(scale,0,0,scale,0,0);
    clearInk();
  }

  function drawInk(now) {
    inkFrame=0;
    ink.clearRect(0,0,innerWidth,innerHeight);
    points=points.filter(point=>now-point.time<inkLifetime);
    ink.lineCap='round';
    ink.lineJoin='round';
    for(let i=1;i<points.length;i++) {
      const from=points[i-1], to=points[i];
      if(to.split) continue;
      const freshness=Math.max(0,1-(now-to.time)/inkLifetime);
      ink.beginPath();
      ink.moveTo(from.x,from.y);
      ink.lineTo(to.x,to.y);
      ink.strokeStyle=`rgba(79,98,71,${.49*freshness**1.35})`;
      ink.lineWidth=.7+freshness*2.5;
      ink.stroke();
    }
    if(points.length) inkFrame=requestAnimationFrame(drawInk);
  }

  function syncLight() {
    cancelAnimationFrame(lightFrame);
    lightFrame=0;
    lastLight=0;
    if(!paused && !document.hidden && light) lightFrame=requestAnimationFrame(animateLight);
  }

  function setPaused(value) {
    paused=value;
    document.body.dataset.effects=paused?'paused':'playing';
    toggle.textContent=paused?'PLAY EFFECTS':'PAUSE EFFECTS';
    if(paused) clearInk();
    syncLight();
  }

  toggle.hidden=false;
  toggle.addEventListener('click',()=>setPaused(!paused));
  motion.addEventListener('change',event=>setPaused(event.matches));
  mouse.addEventListener('change',clearInk);
  window.addEventListener('resize',sizeInk,{passive:true});
  window.addEventListener('blur',()=>{split=true;});
  document.documentElement.addEventListener('pointerleave',()=>{split=true;});
  document.addEventListener('visibilitychange',syncLight);
  window.addEventListener('pointermove',event=>{
    if(!ink || paused || motion.matches || !mouse.matches || event.pointerType!=='mouse') return;
    const last=points.at(-1);
    const time=performance.now();
    if(last && Math.hypot(event.clientX-last.x,event.clientY-last.y)<1.5) return;
    points.push({x:event.clientX,y:event.clientY,time,split:split || !last || time-last.time>145});
    if(points.length>240) points.shift();
    split=false;
    if(!inkFrame) inkFrame=requestAnimationFrame(drawInk);
  },{passive:true});
  sizeInk();
  drawReflection(0);
  setPaused(paused);
})();
