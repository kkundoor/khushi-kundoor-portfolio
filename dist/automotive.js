(() => {
  function syncNav() {
    document.querySelectorAll('nav a[href^="#"]').forEach(link => {
      if (link.hash === location.hash) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  addEventListener('hashchange',syncNav);
  syncNav();

  const stage=document.querySelector('.auto-stage');
  const drawing=document.querySelector('#auto-drawing');
  const canvas=document.querySelector('#auto-model');
  const loading=document.querySelector('#auto-loading');
  const controls=document.querySelector('.auto-steps');
  const buttons=[...controls.querySelectorAll('button')];
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const stages=[
    ['Define','scope the problem','Identify the user need, constraints, and what success looks like.','SIDE ELEVATION'],
    ['Design','plan the solution','Sketch the user flow and decide how the pieces fit together.','PLAN VIEW'],
    ['Build','make it work','Implement a working version and integrate the pieces.','3D PROTOTYPE'],
    ['Validate','test the behavior','Check expected behavior, edge cases, and failure recovery.','OVERHEAD INSPECTION'],
    ['Release','ship and learn','Deploy, monitor real usage, and use feedback to decide what comes next.','360° TURNTABLE']
  ];

  const T=window.THREE;
  let renderer;
  try {
    renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});
  } catch {
    loading.textContent='This vehicle study needs WebGL. You can still read each development stage.';
  }
  let scene,camera,car,draftScene,draftCamera;
  let modelReady=false;
  let modelRequested=false;
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.14;
    scene=new T.Scene();
    camera=new T.PerspectiveCamera(30,1,0.1,50);
    scene.add(new T.HemisphereLight(0xe7eeff,0x79736b,1.24));
    const key=new T.DirectionalLight(0xffecd7,2.1);
    key.position.set(-3,5,4);
    scene.add(key);
    const rim=new T.DirectionalLight(0xc4d9ff,2.6);
    rim.position.set(2,3,-4);
    scene.add(rim);

    car=new T.Group();
    scene.add(car);
    const environment=new T.Scene();
    environment.background=new T.Color(0x444a52);
    function softbox(w,h,x,y,z,intensity) {
      const panel=new T.Mesh(new T.PlaneGeometry(w,h),
        new T.MeshBasicMaterial({color:new T.Color(1,0.96,0.90).multiplyScalar(intensity),side:T.DoubleSide}));
      panel.position.set(x,y,z);
      panel.lookAt(0,0,0);
      environment.add(panel);
    }
    softbox(7,3.4,-1,5,2.6,3.4);
    softbox(6,0.68,0,2.6,-4.3,4.0);
    softbox(3.5,1.8,-4.6,1.6,0.5,2.3);
    softbox(2,3.2,4.9,1.5,1.3,1.65);
    const pmrem=new T.PMREMGenerator(renderer);
    scene.environment=pmrem.fromScene(environment,0.033).texture;
    pmrem.dispose();
    environment.traverse(object=>{
      object.geometry?.dispose();
      object.material?.dispose();
    });

    const shade=document.createElement('canvas');
    shade.width=shade.height=128;
    const brush=shade.getContext('2d');
    const fade=brush.createRadialGradient(64,64,10,64,64,64);
    fade.addColorStop(0,'#000000c9');
    fade.addColorStop(0.5,'#0000006f');
    fade.addColorStop(1,'#00000000');
    brush.fillStyle=fade;
    brush.fillRect(0,0,128,128);
    const shadow=new T.Mesh(new T.PlaneGeometry(6.25,3.3),
      new T.MeshBasicMaterial({map:new T.CanvasTexture(shade),transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;
    shadow.position.y=0.003;
    car.add(shadow);
  }

  function addAlumniPlate(model) {
    const plate=document.createElement('canvas');
    plate.width=512;
    plate.height=256;
    const ink=plate.getContext('2d');
    ink.fillStyle='#ffcb05';
    ink.fillRect(0,0,512,256);
    ink.fillStyle='#00274c';
    ink.fillRect(12,12,488,232);
    ink.fillStyle='#ffcb05';
    ink.textAlign='center';
    ink.font='900 122px system-ui';
    ink.fillText('U-M',256,142);
    ink.font='800 56px system-ui';
    ink.fillText('ALUMNI',256,218);
    const texture=new T.CanvasTexture(plate);
    texture.colorSpace=T.SRGBColorSpace;
    texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
    const plateMesh=new T.Mesh(new T.PlaneGeometry(0.34,0.17),new T.MeshBasicMaterial({map:texture}));
    plateMesh.position.set(0,0.455,-2.493);
    plateMesh.rotation.y=Math.PI;
    model.add(plateMesh);
  }

  function makeDraft(model) {
    draftScene=new T.Scene();
    draftCamera=new T.OrthographicCamera(-3.4,3.4,1.55,-1.55,0.1,30);
    const drawing=model.clone(true);
    const paper=new T.MeshBasicMaterial({color:0xf6f0e5,side:T.DoubleSide,
      polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,toneMapped:false});
    const ink=new T.LineBasicMaterial({color:0x49362e,transparent:true,opacity:0.69,toneMapped:false});
    const meshes=[];
    drawing.traverse(object=>{ if (object.isMesh) meshes.push(object); });
    for (const mesh of meshes) {
      const name=mesh.material.name;
      if (mesh.material.opacity<0.2 || /INT_|cockpit|sw_carbon/.test(name)) {
        mesh.visible=false;
        continue;
      }
      mesh.material=paper;
      mesh.add(new T.LineSegments(new T.EdgesGeometry(mesh.geometry,35),ink));
    }
    draftScene.add(drawing);
  }

  async function prepareModel() {
    if (!renderer || modelRequested || !window.loadMustang) return;
    modelRequested=true;
    const asset=document.createElement('script');
    asset.src='vendor/mustang-data.js';
    try {
      await new Promise((resolve,reject)=>{
        asset.onload=resolve;
        asset.onerror=reject;
        document.head.append(asset);
      });
      const bytes=Uint8Array.from(atob(window.mustangAsset),letter=>letter.charCodeAt(0));
      delete window.mustangAsset;
      const {scene:model}=await window.loadMustang(bytes.buffer);
      const paint=new T.MeshPhysicalMaterial({color:0x161719,metalness:0.48,roughness:0.22,
        clearcoat:1,clearcoatRoughness:0.13,envMapIntensity:1.32});
      model.traverse(object=>{
        if (object.isMesh && object.material.name==='body') object.material=paint;
      });
      model.rotation.y=-Math.PI/2;
      model.position.y=0.0785;
      makeDraft(model);
      addAlumniPlate(model);
      car.add(model);
      modelReady=true;
      loading.hidden=true;
      select(index);
    } catch (error) {
      loading.textContent='The vehicle model could not be loaded. The development stages are still available.';
      console.warn('The Mustang model could not be loaded.',error);
    } finally {
      asset.remove();
    }
  }

  const duration=[3900,4200,4500,4700,7600];
  const angles=[0,0,0.66,0,-1.08];
  let inspection=0;
  const testOverlay=document.querySelector(".auto-test-overlay");
  let index=0;
  let elapsed=0;
  let spin=0;
  let lastTime;
  let frame;
  function effectsPaused() {
    return motion.matches || document.body.dataset.effects==='paused';
  }
  function select(next) {
    index=next;
    if (index>=2) prepareModel();
    elapsed=0;
    spin=0;
    const [label,title,copy,view]=stages[index];
    const hasModel=modelReady && index>=2;
    document.querySelector('#auto-index').textContent=`0${index+1} / ${label.toUpperCase()}`;
    document.querySelector('#auto-title').textContent=title;
    document.querySelector('#auto-copy').textContent=copy;
    document.querySelector('#auto-view').textContent=`0${index+1} / ${view}`;
    stage.classList.toggle('auto-stage-model',hasModel);
    testOverlay.hidden=!hasModel || index!==3;
    drawing.toggleAttribute('hidden',hasModel);
    canvas.hidden=!modelReady;
    buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    if (modelReady) {
      if (index===2 || effectsPaused()) car.rotation.y=angles[index];
      if (effectsPaused()) inspection=Number(index===3);
      render();
    }
  }
  function render() {
    const width=stage.clientWidth;
    const height=stage.clientHeight;
    if (width!==canvas.clientWidth || height!==canvas.clientHeight || camera.aspect!==width/height) {
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);
    }
    if (index<2) {
      const aspect=width/height;
      const span=Math.max(3.15,2.85/aspect);
      draftCamera.left=-span;
      draftCamera.right=span;
      draftCamera.top=span/aspect;
      draftCamera.bottom=-span/aspect;
      draftCamera.position.set(0,index===1 ? 10 : 0.72,index===1 ? 0 : 10);
      draftCamera.up.set(0,index===1 ? 0 : 1,index===1 ? -1 : 0);
      draftCamera.lookAt(0,index===1 ? 0 : 0.72,0);
      draftCamera.updateProjectionMatrix();
      renderer.render(draftScene,draftCamera);
      return;
    }
    const distance=camera.aspect<1.7 ? 9.9 : 6.1;
    const pitch=T.MathUtils.lerp(0.24,1.32,inspection);
    camera.position.set(0,0.61+Math.sin(pitch)*distance,Math.cos(pitch)*distance);
    camera.lookAt(0,0.61,0);
    renderer.render(scene,camera);
  }
  function animate(now) {
    const dt=Math.min(now-(lastTime ?? now),50);
    lastTime=now;
    if (!effectsPaused()) {
      elapsed+=dt;
      if (elapsed>=duration[index]) select((index+1)%stages.length);
      if (modelReady && index>=2) {
        inspection+=(Number(index===3)-inspection)*(1-Math.exp(-dt/210));
        if (index===4) spin=Math.min(1,spin+dt/6800);
        const target=angles[index]+spin*Math.PI*2;
        const delta=Math.atan2(Math.sin(target-car.rotation.y),Math.cos(target-car.rotation.y));
        car.rotation.y+=delta*(1-Math.exp(-dt/340));
        render();
      }
    }
    frame=requestAnimationFrame(animate);
  }
  buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i)));
  new ResizeObserver(()=>{ if (modelReady) render(); }).observe(stage);
  new IntersectionObserver(([entry])=>{
    cancelAnimationFrame(frame);
    lastTime=undefined;
    if (entry.isIntersecting) {
      prepareModel();
      frame=requestAnimationFrame(animate);
    }
  },{rootMargin:"180px"}).observe(stage);
  controls.hidden=false;
  select(0);
})();
