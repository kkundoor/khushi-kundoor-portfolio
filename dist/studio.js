(() => {
  const syncNav = () => {
    document.querySelectorAll('nav a[href^="#"]').forEach(link => {
      if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  addEventListener('hashchange', syncNav);
  syncNav();

  const canvas = document.querySelector('#drive-map');
  const stage = canvas.parentElement;
  const controls = document.querySelector('.drive-controls');
  const markers = stage.querySelector('.road-markers');
  const panel = stage.querySelector('.road-panel');
  const T = window.THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({canvas, antialias: true});
  } catch {
    canvas.hidden = true;
    stage.querySelector('.road-fallback').hidden = false;
    document.querySelector('#drive-help').hidden = true;
    return;
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color(0xb6cfd0);
  const camera = new T.PerspectiveCamera(40,1,0.1,95);
  scene.fog = new T.Fog(0xc7d8a2,19,48);
  const cameraTarget = new T.Vector3();
  const cameraPosition = new T.Vector3();
  const sky = new T.HemisphereLight();
  scene.add(sky);
  const sun = new T.DirectionalLight(0xffecd9, 2.25);
  sun.position.set(-9, 10, 7);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left:-12, right:12, top:12, bottom:-12, far:35});
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.032;
  sun.shadow.radius = 3;
  scene.add(sun);

  const materials = new Map();
  function mesh(geometry, color, x, y, z, parent = scene) {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({color, roughness:0.88}));
    const item = new T.Mesh(geometry, materials.get(color));
    item.position.set(x, y, z);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  const box = (w,h,d,color,x,y,z,parent) => mesh(new T.BoxGeometry(w,h,d),color,x,y,z,parent);
  const ground = mesh(new T.PlaneGeometry(100,100),0xb1cd7e,0,0,0);
  ground.rotation.x = -Math.PI/2;
  ground.castShadow = false;

  let seed = 7625;
  function random() {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function paintedTexture(paint, repeats) {
    const paper = document.createElement('canvas');
    paper.width = paper.height = 128;
    const brush = paper.getContext('2d');
    paint(brush);
    const texture = new T.CanvasTexture(paper);
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(...repeats);
    texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  ground.material.map = paintedTexture(brush => {
    brush.fillStyle = '#f5f7ea';
    brush.fillRect(0,0,128,128);
    for (let i=0;i<520;i++) {
      brush.fillStyle = i%3 ? '#6b9f5b23' : '#fffde288';
      const x=random()*128, y=random()*128;
      brush.fillRect(x,y,1+random()*2,1+random()*4);
    }
  },[37,37]);

  // The lane sits inside a larger landscape so the world carries past the frame.
  function hill(x,z,width,height,depth,color) {
    const land = mesh(new T.SphereGeometry(1,32,16),color,x,-0.9,z);
    land.scale.set(width,height,depth);
    land.castShadow = false;
    return land;
  }
  hill(-13,-15,17,4.1,10,0x9db87d);
  hill(9,-21,18,5.9,12,0xa5bb81);
  hill(24,-12,15,3.3,10,0x9ab977);
  hill(-19,4,11,2.8,10,0x9fbe78);
  hill(18,0,8,1.8,9,0xa6bf78);

  // Shallow water, reeds, and little stepping stones beside the porch.
  const pond = new T.Group();
  const pondOffset = new T.Vector3();
  const upAxis = new T.Vector3(0,1,0);
  const pondX = -5.15, pondZ = 5.86;
  pond.position.set(pondX,0.012,pondZ);
  pond.rotation.y = 0.29;
  scene.add(pond);
  function poolLayer(rx,rz,y,color) {
    const layer=mesh(new T.CircleGeometry(1,48),color,0,y,0,pond);
    layer.rotation.x=-Math.PI/2;
    layer.scale.set(rx,rz,1);
    layer.castShadow=false;
    return layer;
  }
  poolLayer(2.19,1.44,0.021,0xcab88a);
  poolLayer(2.02,1.27,0.032,0x6acbd2);
  poolLayer(1.73,1.02,0.034,0x63bbcf);
  const waterLines = [];
  for (let i=0;i<12;i++) {
    const ripple=mesh(new T.PlaneGeometry(0.24+random()*0.32,0.028),
      0xc9e9ce,(random()-0.5)*2.75,0.041,(random()-0.5)*1.2,pond);
    ripple.rotation.x=-Math.PI/2;
    ripple.castShadow=false;
    waterLines.push(ripple);
  }
  const pebble = new T.SphereGeometry(1,12,8);
  // A distant cascade gives the lane a second layer of scenery.
  for (let i=0;i<14;i++) {
    const stone=mesh(pebble,i%3===0 ? 0xa59ca8 : 0xb9abb1,
      -7.8+i*0.67,1.12,-10.2+Math.sin(i*0.56)*0.56);
    stone.scale.set(0.64,1.37+Math.sin(i)*0.23,0.7);
    stone.rotation.z=Math.sin(i)*0.12;
    const turf=mesh(pebble,0x8db65d,-7.8+i*0.67,2.47,-10.36+Math.sin(i*0.56)*0.56);
    turf.scale.set(0.73,0.19,0.67);
  }
  const cascade=mesh(new T.PlaneGeometry(1.02,2.48),0x74d7ee,-2.23,1.23,-9.05);
  cascade.castShadow=false;
  for (let i=0;i<7;i++) {
    const streak=mesh(new T.PlaneGeometry(0.027+i%3*0.025,2.16),i%2 ? 0xaaedfa : 0x9ae3f5,
      -2.68+i*0.141,1.14+i%3*0.09,-9.032);
    streak.castShadow=false;
  }
  for (let i=0;i<5;i++) {
    const foam=mesh(pebble,0xb7edf0,-2.72+i*0.25,0.15,-8.97);
    foam.scale.set(0.22,0.13+i%2*0.07,0.28);
    foam.castShadow=false;
  }
  for (let i=0;i<22;i++) {
    const a=random()*Math.PI*2;
    const rock=mesh(pebble,i%2 ? 0xb4a58e : 0xc3b397,
      Math.cos(a)*2.14,0.065,Math.sin(a)*1.39,pond);
    rock.scale.set(0.12+random()*0.13,0.07+random()*0.10,0.1+random()*0.12);
  }
  for (const [x,z] of [[-1.5,-0.65],[0.95,1.06],[1.69,-0.38]]) {
    for (let i=0;i<5;i++) {
      const stalk=box(0.026,0.36+i*0.065,0.024,0x6e9457,x+i*0.082,0.21+i*0.031,z,pond);
      stalk.rotation.z=0.23-i*0.1;
      if (i%2===0) mesh(pebble,0xa57558,x+i*0.082,0.43+i*0.058,z,pond).scale.set(0.045,0.081,0.045);
    }
  }

  function path(points, width, color) {
    const curve = new T.CatmullRomCurve3(points.map(([x,z]) => new T.Vector3(x,0.029,z)));
    const vertices = [];
    const faces = [];
    for (let i=0; i<=44; i++) {
      const point = curve.getPoint(i/44);
      const tangent = curve.getTangent(i/44);
      for (const side of [-1,1]) vertices.push(point.x+side*tangent.z*width*(1+0.12*Math.sin(i*0.55)),point.y,point.z-side*tangent.x*width*(1+0.12*Math.sin(i*0.55)));
      const n = i*2;
      if (i) faces.push(n-2,n,n-1,n-1,n,n+1);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    const trail = mesh(geometry,color,0,0,0);
    trail.castShadow = false;
    trail.material.side = T.DoubleSide;
  }
  path([[-3.1,15],[-1.4,9.4],[0.1,6.0],[0.15,4.65],[0.3,3.4],[1.42,2.72],[2.95,2.38],[3.25,1.24]],0.75,0xe2b884);
  path([[0.28,3.43],[-0.65,2.23],[-0.95,0.35],[-1.07,-1.5],[-2.1,-2.75],[-4.2,-4.5],[-6.2,-6.5],[-6.4,-10.5]],0.54,0xe2b884);

  const crowns = [];
  const leaf = new T.SphereGeometry(1,14,10);
  const crownShape = new T.SphereGeometry(1,38,24);
  const crownPositions = crownShape.getAttribute('position');
  const crownColors = [];
  const crownColor = new T.Color();
  for (let i=0;i<crownPositions.count;i++) {
    const x=crownPositions.getX(i), y=crownPositions.getY(i), z=crownPositions.getZ(i);
    const lobes=1+Math.sin(x*6+y*3)*Math.sin(z*6-y*2)*0.115+Math.cos((x+z)*7)*0.035;
    crownPositions.setXYZ(i,x*lobes,y*lobes,z*lobes);
    crownColor.setHex(0x4c9164).lerp(new T.Color(0x9ec878),
      T.MathUtils.clamp(0.46+y*0.36+Math.sin(x*8+z*6)*0.08,0,1));
    crownColors.push(crownColor.r,crownColor.g,crownColor.b);
  }
  crownShape.setAttribute('color',new T.Float32BufferAttribute(crownColors,3));
  crownShape.computeVertexNormals();
  function tree(x,z,size) {
    const trunk = mesh(new T.CylinderGeometry(0.11,0.19,1.56,6),0x774d34,x,0.77*size,z);
    trunk.scale.setScalar(size);
    const crown = new T.Group();
    crown.position.set(x,1.27*size,z);
    crown.scale.setScalar(size);
    scene.add(crown);
    const foliage = mesh(crownShape,0xffffff,0,0.68,0,crown);
    foliage.material.vertexColors = true;
    foliage.scale.set(1.17,1,1.02);
    foliage.rotation.y = random()*Math.PI*2;
    for (const [dx,y,dz] of [[-0.63,0.49,0.76],[0.11,0.32,0.91],[0.68,0.67,0.68]]) {
      if (random() < 0.24) continue;
      const fruit=mesh(leaf,0xec925c,dx,y,dz,crown);
      fruit.scale.set(0.105,0.109,0.102);
      const sprig=mesh(leaf,0x89a453,dx+0.036,y+0.09,dz,crown);
      sprig.scale.set(0.057,0.023,0.027);
      sprig.rotation.z=0.56;
    }
    crowns.push(crown);
  }
  [[-6.7,-2.35,1.22],[-4.65,-3.92,1.13],[-2.9,-4.8,0.78],[0.5,-4.9,0.85],
    [6.8,-4.4,1.1],[8.2,-2.4,1.16],[9.7,0.1,1.19],[-8.55,0.8,1.23],[-8.2,3.9,0.93],[-7.7,-7.2,1.3],[-5,-8.5,1.17],[-0.1,-8.5,1.24],[4.9,-8.2,1.21],[10,-6.5,1.3]].forEach(args => tree(...args));

  // Gabled cottage with a covered porch and flower boxes.
  const trim = 0xffecd0;
  const siding = 0xffebce;
  const roof = 0xa47bd3;
  const windowGlow = new T.MeshStandardMaterial({color:0x86c9e1,emissive:0xffa63c,emissiveIntensity:0});
  function windowAt(x,y,z,w,h) {
    box(w+0.13,h+0.13,0.1,trim,x,y,z);
    const pane = new T.Mesh(new T.BoxGeometry(w,h,0.042),windowGlow);
    pane.position.set(x,y,z+0.065);
    scene.add(pane);
    box(0.048,h,0.058,trim,x,y,z+0.097);
    box(w,0.048,0.058,trim,x,y,z+0.097);
  }
  const shingleShape = new T.Shape();
  shingleShape.moveTo(-0.2,-0.3);
  shingleShape.lineTo(0.2,-0.3);
  shingleShape.lineTo(0.2,0.15);
  shingleShape.quadraticCurveTo(0.2,0.29,0,0.29);
  shingleShape.quadraticCurveTo(-0.2,0.29,-0.2,0.15);
  shingleShape.closePath();
  const shingle = new T.ExtrudeGeometry(shingleShape,{
    depth:0.038,bevelThickness:0.025,bevelSize:0.024,bevelSegments:2,curveSegments:6
  });
  function gable(x,y,z,w,d,rise) {
    const shape = new T.Shape();
    shape.moveTo(-w/2,0);
    shape.lineTo(w/2,0);
    shape.lineTo(0,rise);
    shape.closePath();
    mesh(new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false}),siding,x,y,z-d/2);
    const run = w/2+0.18;
    const slope = Math.atan2(rise,run);
    for (const side of [-1,1]) {
      const pitch = box(Math.hypot(run,rise)+0.11,0.13,d+0.32,roof,x+side*run/2,y+rise/2+0.08,z);
      pitch.rotation.z = -side*slope;
      for (let row=0;row<6;row++) for (let column=0;column<9;column++) {
        const xLocal=(row-2.5)*0.44;
        const zLocal=(column-4)*0.36+(row%2 ? 0.06 : -0.06);
        const tile=mesh(shingle,[0xa776d4,0xb784df,0xa67ad9,0xc08be4][(row+column)%4],
          xLocal,0.08+0.005*(side === 1 ? 5-row : row),zLocal,pitch);
        tile.rotation.x=-Math.PI/2;
        tile.rotateZ(-side*Math.PI/2);
        tile.scale.set(0.83,0.94,0.95);
        tile.castShadow=false;
      }
      const fascia = box(Math.hypot(run,rise)+0.13,0.09,0.09,trim,x+side*run/2,y+rise/2+0.08,z+d/2+0.18);
      fascia.rotation.z = pitch.rotation.z;
    }
  }
  box(4.16,0.3,3.07,0xa49583,3.34,0.15,-1.48);
  box(4.02,2.22,2.93,siding,3.34,1.4,-1.48);
  gable(3.34,2.52,-1.48,4.02,2.93,1.52);
  box(0.45,1.38,0.53,0xbc624a,4.82,3.16,-2.13);
  box(0.57,0.12,0.66,0xdb7960,4.82,3.9,-2.13);
  for (const y of [2.96,3.19,3.43,3.66]) box(0.46,0.033,0.54,0xe09873,4.82,y,-2.13);
  for (const x of [2,4.7]) {
    windowAt(x,1.3,0.02,0.57,0.77);
    box(0.74,0.18,0.27,0xb65e48,x,0.89,0.17);
    for (let i=0;i<6;i++) mesh(leaf,i%2 ? 0xff669b : 0xffca3c,x-0.29+i*0.11,1.02,0.22).scale.setScalar(0.093);
  }
  const atticFrame = mesh(new T.CylinderGeometry(0.31,0.31,0.1,32),trim,3.34,2.96,0.04);
  atticFrame.rotation.x=Math.PI/2;
  const atticPane = new T.Mesh(new T.CircleGeometry(0.238,32),windowGlow);
  atticPane.position.set(3.34,2.96,0.097);
  scene.add(atticPane);
  box(0.035,0.44,0.042,trim,3.34,2.96,0.122);
  box(0.44,0.035,0.042,trim,3.34,2.96,0.122);
  function arch(width,height) {
    const outline = new T.Shape();
    const r=width/2;
    outline.moveTo(-r,0);
    outline.lineTo(r,0);
    outline.lineTo(r,height-r);
    outline.absarc(0,height-r,r,0,Math.PI,false);
    outline.lineTo(-r,0);
    return new T.ExtrudeGeometry(outline,{depth:0.075,bevelEnabled:true,
      bevelSize:0.043,bevelThickness:0.035,bevelSegments:3,curveSegments:16});
  }
  mesh(arch(1.2,1.78),0xffe4bf,3.34,0.34,0.015);
  mesh(arch(0.91,1.58),0xe7a04b,3.34,0.35,0.119);
  for (const offset of [-0.31,-0.15,0.15,0.31]) {
    box(0.013,1.04,0.012,0xc78b48,3.34+offset,0.89,0.233);
  }
  const doorWindow=mesh(new T.CylinderGeometry(0.258,0.258,0.062,32),0x62b9bc,3.34,1.51,0.244);
  doorWindow.rotation.x=Math.PI/2;
  box(0.041,0.48,0.031,0xf1b967,3.34,1.51,0.282);
  box(0.48,0.041,0.031,0xf1b967,3.34,1.51,0.282);
  mesh(leaf,0xffc447,3.67,0.97,0.247).scale.setScalar(0.065);
  box(4.45,0.24,1.28,0xb6835a,3.34,0.22,0.66);
  for (let i=0;i<13;i++) {
    box(0.014,0.012,1.23,0xa36c43,1.31+i*0.337,0.346,0.66);
  }
  const porchRoof = box(4.52,0.15,0.79,roof,3.34,2.12,0.42);
  porchRoof.rotation.x = 0.16;
  box(4.5,0.13,0.12,trim,3.34,2.06,0.81);
  for (const x of [1.22,2.48,4.18,5.46]) {
    box(0.11,1.62,0.11,trim,x,1.12,1.15);
    box(0.2,0.13,0.2,trim,x,0.4,1.15);
  }
  for (let i=0;i<13;i++) {
    const x=1.27+i*0.344;
    const scallop=mesh(leaf,i%2 ? 0xe9a6a1 : 0xf9e7c4,x,2.014,0.883);
    scallop.scale.set(0.185,0.118,0.045);
  }
  const porchBunting = [[2.5,1.77],[2.83,1.66],[3.16,1.60],[3.49,1.60],[3.82,1.66],[4.15,1.77]];
  const cloth=[0xe5a166,0xe096a3,0xa493c2,0xa5bb8e,0xf0ca74];
  for (let i=0;i<porchBunting.length-1;i++) {
    const [x,y]=porchBunting[i], [nx,ny]=porchBunting[i+1];
    const cord=box(Math.hypot(nx-x,ny-y),0.016,0.02,0x80644e,(x+nx)/2,(y+ny)/2,1.195);
    cord.rotation.z=Math.atan2(ny-y,nx-x);
    const flag=mesh(new T.ConeGeometry(0.122,0.195,3),cloth[i],(x+nx)/2,(y+ny)/2-0.084,1.195);
    flag.rotation.z=Math.PI;
  }
  for (let i=0;i<3;i++) box(1.25,0.1,0.27,0xbb8b65,3.34,0.27-i*0.09,1.32+i*0.22);
  for (let row=0;row<2;row++) for (let i=0;i<12;i++) {
    const tile=mesh(shingle,i%3 ? 0xae7bdb : 0xbd89e3,(i-5.5)*0.357,0.08,(row-0.5)*0.32,porchRoof);
    tile.rotation.x=-Math.PI/2;
    tile.rotateZ(Math.PI);
    tile.scale.set(0.86,0.86,0.8);
    tile.castShadow=false;
  }

  const porchLight = new T.PointLight(0xffb958,0,7,1.8);
  porchLight.position.set(3.35,1.6,1.27);
  scene.add(porchLight);

  const mailbox = new T.Group();
  mailbox.position.set(1.46,0,4.35);
  scene.add(mailbox);
  box(0.12,0.9,0.12,0xf5e2c0,0,0.45,0,mailbox);
  box(0.52,0.36,0.62,0xad81cf,0,0.99,0,mailbox);
  const mailboxTop = mesh(new T.CylinderGeometry(0.26,0.26,0.62,24,1,false,0,Math.PI),
    0xc498e9,0,1.17,0,mailbox);
  mailboxTop.rotation.order = 'ZYX';
  mailboxTop.rotation.x = Math.PI/2;
  mailboxTop.rotation.z = Math.PI/2;
  box(0.34,0.038,0.03,0xffe7c1,0,1.03,0.326,mailbox);
  box(0.055,0.38,0.055,0xf4679a,0.29,1.22,-0.16,mailbox);
  box(0.055,0.13,0.21,0xf4679a,0.29,1.41,-0.08,mailbox);

  mesh(leaf,0xffefd6,0,0.97,0.345,mailbox).scale.set(0.087,0.065,0.016);
  for (const side of [-1,1]) {
    const ear=mesh(leaf,0xffefd6,side*0.044,1.025,0.347,mailbox);
    ear.scale.set(0.024,0.055,0.013);
    ear.rotation.z=-side*0.4;
  }

  // Crop beds are left of the branching path, with a gate in the front fence.
  for (const [x,z] of [[-4.8,-1.37],[-4.83,0.73]]) {
    box(3.67,0.17,1.74,0x855137,x,0.095,z);
    for (let row=0;row<4;row++) {
      const rz = z-0.61+row*0.4;
      box(3.48,0.087,0.27,0xb37649,x,0.206,rz);
      for (let i=0;i<8;i++) {
        const rx = x-1.52+i*0.43;
        mesh(leaf,0x5c982f,rx,0.31,rz).scale.set(0.17,0.13,0.11);
        if (row%2===0) mesh(leaf,row===0 ? 0xf29233 : 0xf9c642,rx,0.385,rz).scale.setScalar(0.108);
      }
    }
  }
  for (const [x,z] of [[-6.56,1.82],[-6.19,1.96],[-5.89,1.78]]) {
    mesh(leaf,0xf08d29,x,0.2,z).scale.set(0.2,0.17,0.19);
    box(0.045,0.115,0.048,0x647d36,x,0.37,z);
  }

  const fenceSegments = [[-6.52,2.02,-6.66,-2.32],[-6.66,-2.32,-3.1,-3.16],
    [5.97,3.59,6.57,1.89],[6.57,1.89,6.69,-1.15],[1.0,4.83,2.75,4.63]];
  for (const [x,z,endX,endZ] of fenceSegments) {
    const dx=endX-x, dz=endZ-z;
    const length=Math.hypot(dx,dz);
    const count=Math.ceil(length/0.39);
    for (const y of [0.27,0.54]) {
      const rail=box(length,0.085,0.075,0xffeed8,x+dx/2,y,z+dz/2);
      rail.rotation.y=-Math.atan2(dz,dx);
    }
    for (let i=0;i<=count;i++) {
      const px=x+dx*i/count, pz=z+dz*i/count;
      box(0.105,0.68,0.11,0xfff5e3,px,0.34,pz);
      mesh(new T.ConeGeometry(0.085,0.14,4),0xfff5e3,px,0.75,pz).rotation.y=Math.PI/4;
    }
  }

  // Stone borders and porch pots give the garden beds a clear silhouette.
  for (const [x,z] of [[-4.54,2.38],[-2.52,2.42],[5.93,1.61],[6.4,2.48]]) {
    for (let i=0;i<7;i++) {
      const angle=0.3+i*0.52;
      const stone=mesh(leaf,i%2 ? 0x9b9785 : 0xafa48f,
        x+Math.cos(angle)*0.74,0.08,z+Math.sin(angle)*0.43);
      stone.scale.set(0.11+random()*0.11,0.075+random()*0.08,0.105);
      stone.rotation.y=random()*Math.PI;
    }
  }
  for (const [x,z,color] of [[1.42,1.05,0xbd634b],[5.13,1.05,0xa876b2],[4.85,1.21,0xcf774c]]) {
    mesh(new T.CylinderGeometry(0.19,0.14,0.25,8),color,x,0.46,z);
    mesh(leaf,0x5f9d49,x,0.64,z).scale.set(0.24,0.15,0.19);
    for (const dx of [-0.1,0.045,0.13]) {
      mesh(leaf,dx > 0 ? 0xf8c846 : 0xf66ea2,x+dx,0.75+random()*0.08,z).scale.setScalar(0.095);
    }
  }

  const blossomTree = new T.Group();
  blossomTree.position.set(-7.1,0,0.95);
  scene.add(blossomTree);
  mesh(new T.CylinderGeometry(0.21,0.33,2.25,12),0xa2714f,0,1.12,0,blossomTree);
  for (let i=0;i<25;i++) {
    const angle=i*2.399963;
    const ring=i<14 ? 1.01 : 0.54;
    const puff=mesh(leaf,[0xea86b0,0xf5a3c3,0xf2a5cb][i%3],
      Math.cos(angle)*ring,2.48+random()*0.49+(i>=14 ? 0.41 : 0),Math.sin(angle)*ring,blossomTree);
    puff.scale.set(0.53+random()*0.31,0.58,0.59+random()*0.23);
  }

  const blooms = [0xf55493,0xff8d3f,0xffcf35,0xa86be0];
  const flowerPatches = [[1.17,1.4],[5.52,1.65],[5.97,0.48],[0.1,2.27],[-2.08,2.42],
    [-4.24,2.73],[-6.09,2.74],[2.07,4.05],[-2.5,4.15],[6.36,2.38],[-2.3,-2.48],
    [-1.65,5.25],[2.77,5.46],[3.87,4.83],[5.24,4.26],[-2.4,6.0],[-3.3,4.85],[-1.8,6.85],[2.4,6.64],[3.55,6.38]];
  const flowerCount=flowerPatches.length*14;
  const flowers=new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({roughness:0.85}),flowerCount*5);
  const centers=new T.InstancedMesh(leaf,new T.MeshStandardMaterial({color:0xffca3c}),flowerCount);
  const greens=new T.InstancedMesh(leaf,new T.MeshStandardMaterial({color:0x579b47}),flowerCount*3);
  const pose=new T.Object3D();
  const tint=new T.Color();
  function plantPart(batch,index,x,y,z,sx,sy,sz,turn=0,tilt=0) {
    pose.position.set(x,y,z);
    pose.rotation.set(0,turn,tilt);
    pose.scale.set(sx,sy,sz);
    pose.updateMatrix();
    batch.setMatrixAt(index,pose.matrix);
  }
  flowerPatches.forEach(([x,z],patch) => {
    for (let i=0;i<14;i++) {
      const index=patch*14+i;
      const fx=x+(random()-0.5)*1.52, fz=z+(random()-0.5)*0.92;
      const h=0.18+random()*(patch>=11 ? 0.48 : 0.31);
      const size=(0.067+random()*0.054)*(patch>=11 ? 1.38 : 1);
      plantPart(greens,index*3,fx,h/2,fz,0.018,h/2,0.018);
      plantPart(greens,index*3+1,fx-0.05,h*0.41,fz,0.086,0.026,0.036,0,0.54);
      plantPart(greens,index*3+2,fx+0.052,h*0.61,fz,0.084,0.027,0.037,0,-0.48);
      plantPart(centers,index,fx,h+0.015,fz,size*0.51,size*0.42,size*0.51);
      const color=tint.setHex(blooms[(patch+(i%5===0 ? 1 : 0))%blooms.length]);
      for (let j=0;j<5;j++) {
        const a=j*Math.PI*0.4;
        plantPart(flowers,index*5+j,fx+Math.cos(a)*size*0.84,h,fz+Math.sin(a)*size*0.84,
          size*0.82,size*0.34,size*0.54,-a,0.16);
        flowers.setColorAt(index*5+j,color);
      }
    }
  });
  scene.add(greens,flowers,centers);

  const smoke = [];
  for (let i=0;i<5;i++) {
    const puff = new T.Mesh(new T.IcosahedronGeometry(0.19,0),
      new T.MeshStandardMaterial({color:0xffe8cf,transparent:true,depthWrite:false,opacity:0.34}));
    scene.add(puff);
    smoke.push(puff);
  }
  function animateScenery(time) {
    crowns.forEach((crown,i) => { crown.rotation.z = Math.sin(time*1.35+i)*0.043; });
    waterLines.forEach((ripple,i) => { ripple.scale.x=0.78+Math.sin(time*1.26+i)*0.22; });
    smoke.forEach((puff,i) => {
      const phase=(time*0.28+i/smoke.length)%1;
      puff.position.set(4.82+phase*0.7,3.96+phase*0.81,-2.13+Math.sin(phase*5)*0.19);
      puff.scale.setScalar(0.42+phase*1.35);
      puff.material.opacity=0.38*(1-phase);
    });
  }
  animateScenery(0);

  function rounded(geometry, color, x,y,z, sx,sy,sz, parent) {
    const item = mesh(geometry,color,x,y,z,parent);
    item.scale.set(sx,sy,sz);
    return item;
  }
  const sphere = new T.SphereGeometry(1,16,12);
  const ovalPart = (color,x,y,z,sx,sy,sz,parent) => rounded(sphere,color,x,y,z,sx,sy,sz,parent);

  // Original animal characters with the same chunky proportions as the scenery.
  function animal(kind) {
    const raccoon = kind === 'raccoon';
    const root = new T.Group();
    const fur = raccoon ? 0x96908b : 0xe2aa79;
    const dark = raccoon ? 0x3b3540 : 0x80513e;
    const cream = 0xffe6c7;
    const outfit = raccoon ? 0x719645 : 0xf2739d;
    ovalPart(outfit,0,0.59,0,0.235,0.31,0.18,root);
    ovalPart(raccoon ? 0xd3a66d : 0xffd38e,0,0.57,0.15,0.15,0.19,0.09,root);
    ovalPart(fur,0,1.02,-0.01,0.346,0.29,0.269,root);
    ovalPart(cream,0,0.937,-0.199,0.184,0.112,0.095,root);
    ovalPart(0x382635,0,0.99,-0.286,0.052,0.033,0.03,root);
    for (const side of [-1,1]) {
      const ear = ovalPart(fur,side*0.19,raccoon ? 1.23 : 1.39,0.023,
        raccoon ? 0.108 : 0.102,raccoon ? 0.11 : 0.245,0.082,root);
      ear.rotation.z = -side*(raccoon ? 0.25 : 0.45);
      const earInside = ovalPart(raccoon ? 0xbba6ac : 0xefadab,side*0.194,
        raccoon ? 1.245 : 1.41,-0.043,0.055,raccoon ? 0.058 : 0.175,0.025,root);
      earInside.rotation.z = ear.rotation.z;
      if (!raccoon) {
        const tip=ovalPart(fur,side*0.343,1.484,-0.02,0.104,0.141,0.086,root);
        tip.rotation.z=side*0.77;
        const innerTip=ovalPart(0xf0a0a6,side*0.326,1.487,-0.082,0.054,0.072,0.028,root);
        innerTip.rotation.z=tip.rotation.z;
      }
      if (raccoon) ovalPart(dark,side*0.139,1.056,-0.203,0.121,0.078,0.052,root).rotation.z=side*0.32;
      ovalPart(0x342631,side*0.136,1.064,-0.247,0.046,0.059,0.023,root);
      ovalPart(0xfff2df,side*0.122-0.008,1.078,-0.257,0.009,0.011,0.006,root);
      if (!raccoon) ovalPart(0xec9b96,side*0.18,0.987,-0.204,0.053,0.028,0.027,root);
    }
    const tail = new T.Group();
    tail.position.set(0.08,0.43,0.13);
    root.add(tail);
    if (raccoon) {
      for (let i=0;i<6;i++) ovalPart(i%2 ? dark : fur,i*0.052,i*0.052,i*0.064,
        0.125-i*0.01,0.106-i*0.007,0.098,tail);
    } else ovalPart(cream,0,0.03,0.074,0.104,0.098,0.10,tail);
    for (const side of [-1,1]) {
      ovalPart(0xf9cf6a,side*0.105,0.76,-0.16,0.035,0.035,0.018,root);
      if (raccoon) ovalPart(0xf5c74e,side*0.063,0.779,-0.191,0.065,0.055,0.031,root).rotation.z=side*0.54;
    }
    if (!raccoon) {
      ovalPart(0xf29bb0,0,0.57,-0.165,0.098,0.083,0.019,root);
      ovalPart(0xdc6377,0,0.578,-0.184,0.041,0.045,0.013,root);
      ovalPart(0x80a651,0,0.62,-0.184,0.032,0.013,0.013,root);
    }
    const arms = [];
    const legs = [];
    for (const side of [-1,1]) {
      const arm = new T.Group();
      arm.position.set(side*0.232,0.72,0);
      arm.rotation.z = side*0.13;
      root.add(arm);
      ovalPart(raccoon ? 0xeee0cf : 0xffeee0,0,-0.07,0,0.082,0.132,0.086,arm);
      ovalPart(fur,0,-0.178,0,0.073,0.072,0.073,arm);
      arms.push(arm);
      const leg = new T.Group();
      leg.position.set(side*0.105,0.38,0);
      root.add(leg);
      ovalPart(raccoon ? 0x719645 : 0xe86e94,0,-0.12,0,0.084,0.142,0.079,leg);
      ovalPart(raccoon ? dark : fur,0,-0.278,-0.039,0.101,0.089,0.131,leg);
      legs.push(leg);
    }
    return {root,arms,legs,tail};
  }

  const player = animal('rabbit');
  const {root:walker, arms, legs} = player;
  walker.scale.setScalar(1.43);
  scene.add(walker);
  const start = new T.Vector3(-0.23,0.018,4.53);
  walker.position.copy(start);
  walker.rotation.y = 3.54;

  const merchant = animal('raccoon');
  merchant.root.position.set(-3.04,0.02,2.68);
  merchant.root.rotation.y = 2.65;
  scene.add(merchant.root);

  const wagon = new T.Group();
  wagon.position.set(-4.58,0.015,2.79);
  wagon.rotation.y = 0.21;
  scene.add(wagon);
  box(2.02,0.22,0.98,0xb77c52,0,0.44,0,wagon);
  for (const z of [-0.44,0.44]) {
    box(2.02,0.25,0.09,0xe2a670,0,0.62,z,wagon);
    for (const x of [-0.78,0.78]) {
      const wheel = mesh(new T.CylinderGeometry(0.36,0.36,0.13,24),0x684f45,x,0.36,z+Math.sign(z)*0.13,wagon);
      wheel.rotation.x = Math.PI/2;
      ovalPart(0xe0a475,x,0.36,z+Math.sign(z)*0.207,0.09,0.09,0.032,wagon);
      box(0.06,0.99,0.06,0x996647,x,1.06,z,wagon);
    }
  }
  const canopyGeometry = new T.CylinderGeometry(0.54,0.54,2.1,24,1,false,0,Math.PI);
  for (let i=0;i<12;i++) {
    const stripe=mesh(canopyGeometry,i%2 ? 0xe7a29d : 0xf9e8b7,-0.967+i*0.176,1.51,0,wagon);
    stripe.scale.y=0.086;
    stripe.rotation.z=Math.PI/2;
  }
  for (let i=0;i<12;i++) {
    const x=-1.03+i*0.185;
    for (const z of [-0.5,0.5]) ovalPart(i%2 ? 0xf39b91 : 0xf9e8b7,x,1.52,z,0.098,0.118,0.035,wagon);
  }
  for (let i=0;i<7;i++) ovalPart(i%2 ? 0xf2a54d : 0xe87b67,-0.7+i*0.23,0.785,0.23,0.1,0.106,0.105,wagon);

  // Small props are sized to read from the path at walking distance.
  function paintedSign(words,width,height,x,y,z) {
    const sign = box(width,height,0.105,0xb97f5f,x,y,z);
    const face = document.createElement('canvas');
    face.width=512;
    face.height=192;
    const ink=face.getContext('2d');
    ink.fillStyle='#edcc9f';
    ink.fillRect(0,0,512,192);
    ink.strokeStyle=words === 'WORKSHOP' ? '#aa75cf' : '#a86d51';
    ink.lineWidth=words === 'WORKSHOP' ? 15 : 7;
    ink.strokeRect(16,16,480,160);
    ink.fillStyle='#674033';
    ink.textAlign='center';
    ink.textBaseline='middle';
    ink.font=words === 'WORKSHOP' ? 'bold 64px system-ui' : 'italic 61px Georgia';
    ink.fillText(words,256,98);
    const map = new T.CanvasTexture(face);
    map.colorSpace=T.SRGBColorSpace;
    const painted = new T.Mesh(new T.PlaneGeometry(width-0.035,height-0.035),
      new T.MeshStandardMaterial({map,roughness:0.95}));
    painted.position.set(x,y,z+0.055);
    scene.add(painted);
    return sign;
  }
  paintedSign('WORKSHOP',1.72,0.55,3.34,2.61,0.13);
  box(0.14,0.82,0.14,0x91634e,-4.62,0.41,3.93);
  paintedSign('today’s bakes',1.12,0.41,-4.62,0.86,3.95);

  function crock(x,z,color,scale) {
    const vessel = new T.Group();
    vessel.position.set(x,0.02,z);
    vessel.scale.setScalar(scale);
    scene.add(vessel);
    const profile = [[0.0,0.02],[0.16,0.02],[0.25,0.12],[0.26,0.32],[0.20,0.43],
      [0.16,0.47],[0.18,0.49],[0.18,0.54],[0.13,0.54]].map(([a,b])=>new T.Vector2(a,b));
    mesh(new T.LatheGeometry(profile,24),color,0,0,0,vessel);
    for (let i=0;i<5;i++) {
      const angle=i*2.4;
      const sprig=mesh(leaf,i%2 ? 0x698e56 : 0x8dab64,
        Math.cos(angle)*0.13,0.54+i*0.03,Math.sin(angle)*0.13,vessel);
      sprig.scale.set(0.067,0.18,0.045);
      sprig.rotation.z=Math.cos(angle)*0.65;
      const flower=mesh(leaf,i%2 ? 0xea9cb0 : 0xffcf71,
        Math.cos(angle)*0.19,0.73+i*0.031,Math.sin(angle)*0.19,vessel);
      flower.scale.set(0.084,0.065,0.086);
    }
  }
  crock(0.97,4.53,0xc4816c,0.75);
  crock(5.57,1.65,0xbd8f9f,0.95);
  crock(1.47,1.74,0xe0a57a,0.82);
  crock(-2.42,2.12,0x8ca7a1,0.7);

  const steppingStone = new T.CylinderGeometry(1,1,0.055,13);
  for (const [x,z,s] of [[0.48,5.07,0.34],[0.39,4.61,0.30],[0.55,4.07,0.31],
    [0.85,3.6,0.33],[1.29,3.16,0.33],[1.79,2.78,0.31],[2.32,2.54,0.32],[2.83,2.37,0.33]]) {
    const stone=mesh(steppingStone,0xd1ab8c,x,0.036,z);
    stone.scale.set(s,1,s*0.69);
    stone.rotation.y=random()*3;
  }

  // The hand bell and baked goods give Pippin's cart a working counter.
  const bread = [0xe4a460,0xc58153,0xf3bc76];
  for (let i=0;i<5;i++) {
    const x=-0.72+i*0.31;
    ovalPart(bread[i%3],x,0.83,0.39,0.132,0.112,0.078,wagon);
    for (let j=0;j<3;j++) {
      const cut=ovalPart(0xf5cf92,x-0.059+j*0.052,0.913,0.437,0.013,0.025,0.009,wagon);
      cut.rotation.z=-0.45;
    }
  }
  mesh(new T.LatheGeometry([[0,0],[0.135,0],[0.098,0.052],[0.065,0.13],[0,0.15]]
    .map(([a,b])=>new T.Vector2(a,b)),20),0xca9c5b,0.88,0.74,0.42,wagon);
  ovalPart(0x735549,0.88,0.9,0.42,0.029,0.033,0.03,wagon);

  const frontLantern = new T.Group();
  frontLantern.position.set(4.05,1.52,0.19);
  scene.add(frontLantern);
  box(0.055,0.065,0.21,0x765244,0,0.17,-0.05,frontLantern);
  box(0.19,0.05,0.16,0x765244,0,0.085,0.05,frontLantern);
  box(0.19,0.05,0.16,0x765244,0,-0.083,0.05,frontLantern);
  const lanternPane = new T.Mesh(new T.BoxGeometry(0.143,0.13,0.123),
    new T.MeshStandardMaterial({color:0xffd58b,emissive:0xff9b46,emissiveIntensity:0.46}));
  lanternPane.position.z=0.05;
  frontLantern.add(lanternPane);

  const bees = [];
  for (let i=0;i<4;i++) {
    const bee = new T.Group();
    const body = ovalPart(0xffc645,0,0,0,0.09,0.08,0.13,bee);
    body.castShadow = false;
    ovalPart(0x583d38,0,0,0.034,0.091,0.082,0.033,bee).castShadow=false;
    const wings = [-1,1].map(side => ovalPart(0xfff6dc,side*0.076,0.081,0,0.091,0.019,0.051,bee));
    scene.add(bee);
    bees.push({bee,wings});
  }
  const birds = [];
  for (let i=0;i<3;i++) {
    const bird = new T.Group();
    ovalPart(0xf9edda,0,0,0,0.09,0.072,0.18,bird).castShadow=false;
    const wings = [-1,1].map(side => {
      const pivot=new T.Group();
      bird.add(pivot);
      ovalPart(0xfff3db,side*0.15,0,0.025,0.17,0.034,0.091,pivot).castShadow=false;
      return pivot;
    });
    scene.add(bird);
    birds.push({bird,wings});
  }

  function animateWildlife(time) {
    merchant.root.rotation.z = Math.sin(time*1.7)*0.025;
    merchant.tail.rotation.y = Math.sin(time*2)*0.22;
    merchant.arms[0].rotation.x = -0.16+Math.sin(time*2.7)*0.19;
    for (const [i,{bee,wings}] of bees.entries()) {
      const a=time*(1.4+i*0.09)+i*2.3;
      const x=i<2 ? -1.86 : 5.28;
      bee.position.set(x+Math.cos(a)*0.63,0.69+Math.sin(a*2)*0.19,1.99+Math.sin(a)*0.46);
      bee.rotation.y=-a;
      wings[0].rotation.z = Math.sin(time*42+i)*0.87;
      wings[1].rotation.z = -wings[0].rotation.z;
    }
    for (const [i,{bird,wings}] of birds.entries()) {
      const a=time*0.29+i*0.2;
      bird.position.set(Math.cos(a)*6.9,4.3+i*0.23+Math.sin(a*3)*0.21,-1.2+Math.sin(a)*2.24);
      bird.rotation.y=Math.atan2(Math.sin(a)*6.9,-Math.cos(a)*2.24);
      wings[0].rotation.z = Math.sin(time*9+i*0.35)*0.63;
      wings[1].rotation.z = -wings[0].rotation.z;
    }
  }
  animateWildlife(0);

  const fireworksButton = document.querySelector('#farm-fireworks');
  const fireworksStatus = document.querySelector('#fireworks-status');
  const sparkle = new T.SphereGeometry(1,7,5);
  const fireworkColors = [0xff739f,0xffbb67,0xffe486,0xc4a2ff,0xfdf5d8].map(color =>
    new T.MeshBasicMaterial({color}));
  let volley;
  function clearFireworks() {
    if (!volley) return;
    scene.remove(volley.group);
    volley = undefined;
  }
  function launchFireworks() {
    clearFireworks();
    const group = new T.Group();
    scene.add(group);
    const rockets = [-3.6,0.3,3.7].map((x,index) => {
      const origin = new T.Vector3(x,4.3+index%2*0.39,-3.65);
      const rocket = new T.Mesh(sparkle,fireworkColors[index]);
      rocket.scale.setScalar(0.09);
      group.add(rocket);
      const sparks = Array.from({length:36},(_,i) => {
        const spark = new T.Mesh(sparkle,fireworkColors[(index+i%3)%fireworkColors.length]);
        group.add(spark);
        const angle = i*2.399963;
        const y = 1-(i+0.5)/18;
        const r = Math.sqrt(1-y*y);
        const velocity = new T.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r).multiplyScalar(1.45+random()*0.8);
        return {spark,velocity};
      });
      return {origin,rocket,sparks,delay:index*0.36};
    });
    volley = {group,rockets,elapsed:0};
    fireworksStatus.textContent='Fireworks launched over the farm.';
    updateFireworks(0);
  }
  function updateFireworks(dt) {
    if (!volley) return;
    volley.elapsed += dt;
    const still = reducedMotion.matches;
    for (const {origin,rocket,sparks,delay} of volley.rockets) {
      const age = volley.elapsed-delay;
      rocket.visible = !still && age >= 0 && age < 0.63;
      rocket.position.copy(origin);
      rocket.position.y -= Math.max(0,1-age/0.63)*3.7;
      const burst = age-0.63;
      for (const {spark,velocity} of sparks) {
        spark.visible = still || (burst >= 0 && burst < 1.28);
        if (!spark.visible) continue;
        const expansion = still ? 0.54 : Math.max(0,burst);
        spark.position.copy(origin).addScaledVector(velocity,expansion);
        spark.position.y -= expansion*expansion*0.66;
        spark.scale.setScalar(still ? 0.055 : 0.073*(1-burst/1.5));
      }
    }
    if (volley.elapsed > 2.67) clearFireworks();
  }
  fireworksButton.addEventListener('click',launchFireworks);

  const stops = [
    {id:'projects',x:3.34,z:1.99,pinZ:-1.02,height:3.82,label:'01 / WORKSHOP',title:'workshop',
      copy:'See the design decisions and field testing behind Place Memory.',href:'#projects',action:'SEE PROJECTS'},
    {id:'contact',x:1.46,z:4.35,pinZ:4.35,height:1.67,label:'02 / CONTACT',title:'mailbox',
      copy:'Have a project or a role in mind? Send me a note.',href:document.querySelector('a[href^="mailto:"]').href,action:'EMAIL ME'},
    {id:'merchant',x:-3.04,z:2.68,pinZ:2.68,height:1.65,label:'03 / MARKET',title:'pippin’s produce',
      copy:'Fresh peach buns, still warm! The bees keep coming back for the window boxes.'}
  ];

  const cloudGeometry = new T.SphereGeometry(1,20,12);
  const cloudMaterial = new T.MeshBasicMaterial({color:0xf4f7e9,fog:false});
  const clouds = new T.Group();
  scene.add(clouds);
  for (const [x,y,z,size] of [[-12,7,-22,1.65],[1.6,7.7,-25,1.65],[15,9.4,-29,2.2]]) {
    for (const [dx,dy,sx,sy] of [[-1,0,1.16,0.24],[0,0.25,1.2,0.43],[0.95,-0.02,1.06,0.23]]) {
      const cloud = new T.Mesh(cloudGeometry,cloudMaterial);
      cloud.position.set(x+dx*size,y+dy*size,z);
      cloud.scale.set(sx*size,sy*size,size*0.35);
      clouds.add(cloud);
    }
  }

  const farmClock = stage.querySelector('.farm-clock');
  const timeInDetroit = new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Detroit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  function syncDaylight() {
    const localTime = timeInDetroit.format(new Date());
    const [hour,minute] = localTime.split(':').map(Number);
    const localHour = hour+minute/60;
    const daylight = Math.min(T.MathUtils.smoothstep(localHour,6.5,7.5),
      1-T.MathUtils.smoothstep(localHour,18.5,19.5));
    scene.background.setHex(0x263a60).lerp(new T.Color(0x78d0ed),daylight);
    scene.fog.color.copy(scene.background);
    cloudMaterial.color.setHex(0x384f73).lerp(new T.Color(0xf4f7e9),daylight);
    ground.material.color.setHex(0x729176).lerp(new T.Color(0x9ed358),daylight);
    sky.color.setHex(0x9ebaff).lerp(new T.Color(0xfff1db),daylight);
    sky.groundColor.setHex(0x8383bd).lerp(new T.Color(0xa2b971),daylight);
    sky.intensity = 1.21+0.84*daylight;
    sun.color.setHex(0xa2bbff).lerp(new T.Color(0xffe3bd),daylight);
    sun.intensity = 0.33+1.88*daylight;
    windowGlow.emissiveIntensity = (1-daylight)*1.15;
    porchLight.intensity = 0.28+(1-daylight)*5.1;
    lanternPane.material.emissiveIntensity = 0.35+(1-daylight)*1.05;
    farmClock.textContent = `DETROIT · ${localTime} · ${daylight >= 0.5 ? 'DAY' : 'NIGHT'}`;
  }
  syncDaylight();
  setInterval(syncDaylight,15000);
  const pinPosition = new T.Vector3();
  function placePins() {
    for (const stop of stops) {
      pinPosition.set(stop.x,stop.height,stop.pinZ).project(camera);
      stop.button.hidden = Math.abs(pinPosition.x)>0.87 || pinPosition.y>0.84 || pinPosition.y < -0.9;
      stop.button.style.left = `${(pinPosition.x+1)*50}%`;
      stop.button.style.top = `${(1-pinPosition.y)*50}%`;
    }
  }
  function showStop(stop, focus = false) {
    for (const candidate of stops) candidate.button.setAttribute('aria-expanded', String(candidate === stop));
    panel.querySelector('#road-panel-label').textContent = stop.label;
    panel.querySelector('#road-panel-title').textContent = stop.title;
    panel.querySelector('#road-panel-copy').textContent = stop.copy;
    const link = panel.querySelector('#road-panel-link');
    link.hidden = !stop.href;
    if (stop.href) link.href = stop.href;
    link.textContent = stop.action ?? '';
    panel.hidden = false;
    if (focus) panel.querySelector('.road-close').focus();
  }
  function closeStop(restoreFocus = false) {
    const active = stops.find(stop => stop.button.getAttribute('aria-expanded') === 'true');
    panel.hidden = true;
    for (const stop of stops) stop.button.setAttribute('aria-expanded','false');
    if (restoreFocus) (active && !active.button.hidden ? active.button : canvas).focus();
  }
  for (const stop of stops) {
    stop.button = stage.querySelector(`[data-stop="${stop.id}"]`);
    stop.button.setAttribute('aria-expanded','false');
    stop.button.addEventListener('click',() => showStop(stop,true));
  }
  panel.querySelector('.road-close').addEventListener('click',() => closeStop(true));
  panel.addEventListener('keydown',event => {
    if (event.key === 'Escape') closeStop(true);
  });
  panel.querySelector('#road-panel-link').addEventListener('click',() => closeStop());

  const directions = {ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
  const keys = new Set();
  const pointers = new Map();
  const input = direction => [...keys].some(key => directions[key] === direction) ||
    [...pointers.values()].includes(direction);
  for (const target of [canvas, controls]) {
    target.addEventListener('keydown',event => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (!Object.hasOwn(directions,key) || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      keys.add(key);
    });
    target.addEventListener('blur',() => keys.clear(),true);
  }
  addEventListener('keyup',event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  addEventListener('blur',() => { keys.clear(); pointers.clear(); });
  for (const button of controls.querySelectorAll('[data-drive]')) {
    button.addEventListener('pointerdown',event => {
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId,button.dataset.drive);
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) {
      button.addEventListener(type,event => pointers.delete(event.pointerId));
    }
    button.addEventListener('click',event => {
      if (event.detail === 0) {
        const direction = button.dataset.drive;
        move(Number(direction === 'right')-Number(direction === 'left'),
          Number(direction === 'down')-Number(direction === 'up'),0.38);
      }
    });
  }

  let lastStop;
  document.querySelector('#drive-reset').addEventListener('click',() => {
    walker.position.copy(start);
    walker.rotation.y = 3.54;
    lastStop = undefined;
    clearFireworks();
    closeStop();
    canvas.focus();
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = document.querySelector('#drive-motion');
  let paused = reducedMotion.matches;
  function syncMotion() {
    motion.textContent = paused ? 'PLAY SCENERY' : 'PAUSE SCENERY';
  }
  motion.addEventListener('click',() => { paused = !paused; syncMotion(); });
  reducedMotion.addEventListener('change',event => { paused = event.matches; syncMotion(); });
  syncMotion();

  function move(x,z,step) {
    const length = Math.hypot(x,z);
    if (!length || step <= 0) return false;
    const px = walker.position.x + x / length * step;
    const pz = walker.position.z + z / length * step;
    walker.rotation.y = Math.atan2(-x,-z);
    if (px < -7.9 || px > 7.8 || pz < -6.4 || pz > 6.5) return false;
    const inWorkshop = px > 1.08 && px < 5.62 && pz > -3.13 && pz < 1.4;
    const inBeds = px > -6.72 && px < -2.88 && pz > -2.31 && pz < 1.69;
    const inFence = fenceSegments.some(([fx,fz,ex,ez]) => {
      const dx=ex-fx, dz=ez-fz;
      const t=T.MathUtils.clamp(((px-fx)*dx+(pz-fz)*dz)/(dx*dx+dz*dz),0,1);
      return Math.hypot(px-fx-t*dx,pz-fz-t*dz)<0.19;
    });
    const inWagon = Math.abs(px+4.58)<1.15 && Math.abs(pz-2.79)<0.61;
    const nearMerchant = Math.hypot(px+3.04,pz-2.68)<0.47;
    pondOffset.set(px-pondX,0,pz-pondZ).applyAxisAngle(upAxis,-pond.rotation.y);
    const inPond = (pondOffset.x/2.18)**2+(pondOffset.z/1.42)**2<1;
    if (inWorkshop || inBeds || inFence || inWagon || nearMerchant || inPond) return false;
    walker.position.set(px,start.y,pz);
    const stop = stops.find(item => Math.hypot(item.x-px,item.z-pz)<0.86);
    if (stop && stop !== lastStop) showStop(stop);
    lastStop = stop;
    return true;
  }

  function frameVillage(smoothing) {
    const wide = T.MathUtils.clamp(camera.aspect,1,1.8);
    const followX = T.MathUtils.clamp(walker.position.x*0.58,-3.45,3.75);
    const followZ = T.MathUtils.clamp((walker.position.z-start.z)*0.56,-4.6,1.25);
    const retreat = wide < 1.5 ? (1.5-wide)*7 : 0;
    cameraPosition.set(0.66+followX,3.55+retreat*0.5,10.35+followZ+retreat);
    cameraTarget.set(0.14+followX,1.53,0.15+followZ);
    camera.position.lerp(cameraPosition,smoothing);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
    placePins();
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    frameVillage(1);
    renderer.render(scene,camera);
  }

  let frame = 0;
  let time = 0;
  let stride = 0;
  let previous;
  function draw(now) {
    const dt = Math.min((now-(previous ?? now))/1000,0.035);
    previous = now;
    const walking = move(Number(input('right'))-Number(input('left')),
      Number(input('down'))-Number(input('up')),dt*3.05);
    if (walking) stride += dt*13;
    const swing = walking && !reducedMotion.matches ? Math.sin(stride)*0.59 : 0;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing*0.64;
    arms[1].rotation.x = swing*0.64;
    walker.position.y = start.y + (walking ? Math.abs(swing)*0.075 : 0);
    if (!paused && document.body.dataset.effects !== 'paused') {
      time += dt;
      animateScenery(time);
      animateWildlife(time);
    }
    updateFireworks(dt);
    frameVillage(reducedMotion.matches ? 1 : 1-Math.exp(-dt*5.4));
    renderer.render(scene,camera);
    frame = requestAnimationFrame(draw);
  }
  fireworksButton.hidden = false;
  markers.hidden = false;
  controls.hidden = false;
  resize();
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(frame);
    previous = undefined;
    if (entry.isIntersecting) frame = requestAnimationFrame(draw);
  }).observe(stage);
})();
