// Hello!
// Yes some of it is vibecoded i dont like js dont judge me

(function() {
  'use strict';

  const FIXED_X_DEG = 90;
  const FIXED_Y_DEG = 0;
  const FIXED_Z_DEG = 0;
  const EMBED_MM = 0.20;
  var PITCH_X = document.getElementById('pitchxNum').value;
  var PITCH_Y = document.getElementById('pitchyNum').value;
  var HALF_X  = document.getElementById('halfxNum').value;
  const MAX_PEGS_TOTAL = 8000;

  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overlayMsg = document.getElementById('overlayMsg');
  const overlaySub = document.getElementById('overlaySub');
  const errorOverlay = document.getElementById('errorOverlay');
  const errorText = document.getElementById('errorText');
  document.getElementById('closeError').addEventListener('click', () => errorOverlay.style.display = 'none');

  const previewEl = document.getElementById('preview');
  const dropHint = document.getElementById('dropHint');
  const objectFileEl = document.getElementById('objectFile');
  const fileNameLabel = document.getElementById('fileNameLabel');
  const clearFacesBtn = document.getElementById('clearFaces');
  const fitViewBtn = document.getElementById('fitView');

  const facesPill = document.getElementById('facesPill');
  const pegsPill = document.getElementById('pegsPill');
  const dimsPill = document.getElementById('dimsPill');
  const countPill = document.getElementById('countPill');

  const unitSelect = document.getElementById('unitSelect');
  const hNum = document.getElementById('hNum');
  const hRange = document.getElementById('hRange');
  const vNum = document.getElementById('vNum');
  const vRange = document.getElementById('vRange');
  const hLabel = document.getElementById('hLabel');
  const vLabel = document.getElementById('vLabel');
  const padLabel = document.getElementById('padLabel');
  const row0OffsetEl = document.getElementById('row0Offset');

  const padNum = document.getElementById('padNum');
  const padRange = document.getElementById('padRange');

  const offXRange = document.getElementById('offXRange');
  const offXNum = document.getElementById('offXNum');
  const offYRange = document.getElementById('offYRange');
  const offYNum = document.getElementById('offYNum');
  const resetOffsetBtn = document.getElementById('resetOffset');

  const autoLayoutBtn = document.getElementById('autoLayout');

  const pegOptionBtns = Array.from(document.querySelectorAll('.pegOption'));

  const toggleRemovalBtn = document.getElementById('toggleRemoval');
  const resetRemovalBtn = document.getElementById('resetRemoval');
  const removalTag = document.getElementById('removalTag');

  const HOOK_FILES = {
    snug: '/Snug.STEP',
    normal: '/Normal.STEP',
    loose: '/Loose.STEP'
  };

  let currentPegType = 'normal';

  const downloadBtn = document.getElementById('download');
  const exportFormatEl = document.getElementById('exportFormat');
  const host = document.getElementById('canvasHost');

  const xMinus = document.getElementById('xMinus');
  const xPlus = document.getElementById('xPlus');
  const yMinus = document.getElementById('yMinus');
  const yPlus = document.getElementById('yPlus');
  const zMinus = document.getElementById('zMinus');
  const zPlus = document.getElementById('zPlus');
  const xRange = document.getElementById('xRange');
  const yRange = document.getElementById('yRange');
  const zRange = document.getElementById('zRange');
  const xNum = document.getElementById('xNum');
  const yNum = document.getElementById('yNum');
  const zNum = document.getElementById('zNum');
  const resetOri = document.getElementById('resetOri');

  let occt = null;
  let objectStepText = '';
  let objectStepParts = null;
  let objectMaxId = 0;
  let objectMmPerUnit = 1;
  let objectFileName = '';

  let pegStepText = '';
  let pegStepParts = null;
  let pegMaxId = 0;
  let pegMmPerUnit = 1;

  let scene, camera, renderer, controls, raycaster;
  let objectGroup, pegGroup, gridGroup;
  let objectMeshes = [];
  let faces = [];
  let selectedFaceIds = new Set();
  let planarFaceCount = 0;
  let previewShift = new THREE.Vector3(0,0,0);
  const selectedFaceSigns = new Map();

  let pegGeometry = null;
  let pegMaterial = null;
  let pegMaterialTrans = null;

  let pegBasis = {
    height: new THREE.Vector3(0,1,0),
    side:   new THREE.Vector3(1,0,0),
    minAlongHeight: 0
  };

  const pegEulerDeg = { x: 0, y: 0, z: 0 };
  let currentInstances = [];
  let isRemovalMode = false;
  let hoveredInstanceId = -1; 
  let hoveredIsRemoved = false; 

  function showLoading(msg, sub) {
    overlayMsg.textContent = msg || 'Loading…';
    overlaySub.textContent = sub || '';
    overlay.style.display = 'flex';
  }
  function hideLoading() { overlay.style.display = 'none'; }
  function showError(err) {
    console.error(err);
    errorText.textContent = String(err && (err.stack || err.message || err) || 'Unknown error');
    errorOverlay.style.display = 'flex';
  }

  function snapTo(value, step) {
    return Math.floor(value / step + 1e-9) * step;
  }
  function rowPhase(rowIndex, row0IsHalf) {
    const base = row0IsHalf ? 1 : 0;
    return base ^ (rowIndex & 1);
  }
  
  function computePegPositions(spanXmm, spanYmm, row0IsHalf) {
    const sx = snapTo(spanXmm, HALF_X);
    const sy = snapTo(spanYmm, PITCH_Y);

    const halfStepsX = Math.max(0, Math.round(sx / HALF_X));
    const stepsY = Math.max(0, Math.round(sy / PITCH_Y));

    const raw = [];
    
    for (let r = 0; r <= stepsY; r++) {
      const rp = rowPhase(r, row0IsHalf);
      const y = r * PITCH_Y;

      for (let i = 0; i <= halfStepsX; i++) {
        if ( (i & 1) !== rp ) continue;
        raw.push({ x: i * HALF_X, y });
      }
    }
    if (raw.length === 0) {
      const rp = rowPhase(0, row0IsHalf);
      raw.push({ x: rp * HALF_X, y: 0 });
    }

    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (const p of raw) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const positions = raw.map(p => ({ x: p.x - cx, y: p.y - cy }));
    return { sx, sy, positions, shift: {x: cx, y: cy} };
  }

  function updateLimits() {
    const unit = unitSelect.value;
    hNum.min = 0; hRange.min = 0;
    vNum.min = 0; vRange.min = 0;

    if(unit === 'mm') {
      hNum.max = 600; hRange.max = 600; hNum.step = 0.1; hRange.step = 0.1;
      vNum.max = 600; vRange.max = 600; vNum.step = 0.1; vRange.step = 0.1;
      hNum.min = 1; hRange.min = 1;
      vNum.min = 1; vRange.min = 1;
      hLabel.textContent = 'Horizontal span (mm)';
      vLabel.textContent = 'Vertical span (mm)';
    } else if (unit === 'peg') {
      hNum.min = 1; hRange.min = 1;
      vNum.min = 1; vRange.min = 1;
      hNum.max = 40; hRange.max = 40;
      hNum.step = 0.5; hRange.step = 0.5;
      vNum.max = 40; vRange.max = 40;
      vNum.step = 1; vRange.step = 1;
      hLabel.textContent = 'Horizontal pegs';
      vLabel.textContent = 'Vertical pegs';
    } else if (unit === 'in') {
      hNum.max = 24; hRange.max = 24; hNum.step = 0.01; hRange.step = 0.01;
      vNum.max = 24; vRange.max = 24; vNum.step = 0.01; vRange.step = 0.01;
      hNum.min = 0.1; hRange.min = 0.1;
      vNum.min = 0.1; vRange.min = 0.1;
      hLabel.textContent = 'Horizontal span (in)';
      vLabel.textContent = 'Vertical span (in)';
    }

    if(Number(hNum.value) > Number(hNum.max)) { hNum.value = hNum.max; hRange.value = hNum.max; }
    if(Number(vNum.value) > Number(vNum.max)) { vNum.value = vNum.max; vRange.value = vNum.max; }
    if(Number(hNum.value) < Number(hNum.min)) { hNum.value = hNum.min; hRange.value = hNum.min; }
    if(Number(vNum.value) < Number(vNum.min)) { vNum.value = vNum.min; vRange.value = vNum.min; }

    if (padNum && padRange && padLabel) {
      if (unit === 'in') {
        padLabel.textContent = 'Padding (in)';
        padNum.min = 0; padRange.min = 0;
        padNum.max = 2; padRange.max = 2;
        padNum.step = 0.001; padRange.step = 0.001;
      } else {
        padLabel.textContent = 'Padding (mm)';
        padNum.min = 0; padRange.min = 0;
        padNum.max = 50; padRange.max = 50;
        padNum.step = 0.1; padRange.step = 0.1;
      }
    
      const pv = Number(padNum.value);
      if (!isFinite(pv)) { padNum.value = 0; padRange.value = 0; }
      else {
        if (pv > Number(padNum.max)) { padNum.value = padNum.max; }
        if (pv < Number(padNum.min)) { padNum.value = padNum.min; }
        padRange.value = padNum.value;
      }
    }
  }

  function getMmValues() {
    const unit = unitSelect.value;
    const hVal = Number(hNum.value || 0);
    const vVal = Number(vNum.value || 0);

    if (unit === 'mm') return { x: hVal, y: vVal };
    if (unit === 'peg') {
      const px = Math.max(0, hVal - 1) * PITCH_X;
      const py = Math.max(0, vVal - 1) * PITCH_Y;
      return { x: px, y: py };
    }
    if (unit === 'in') return { x: hVal * 25.4, y: vVal * 25.4 };
    return { x: 0, y: 0 };
  }

  function getPaddingMm(unitOverride) {
    const unit = unitOverride || unitSelect.value;
    const v = Number(padNum && padNum.value || 0);
    if (!isFinite(v) || v < 0) return 0;
    return unit === 'in' ? (v * 25.4) : v;
  }

  function setPaddingUiFromMm(mm) {
    if (!padNum || !padRange) return;
    const unit = unitSelect.value;
    let ui = unit === 'in' ? (mm / 25.4) : mm;
    if (!isFinite(ui)) ui = 0;
  
    const min = Number(padNum.min || 0);
    const max = Number(padNum.max || ui);
    ui = Math.max(min, Math.min(max, ui));
  
    const step = Number(padNum.step || 0);
    if (step > 0) ui = Math.round(ui / step) * step;
  
    padNum.value = String(ui);
    padRange.value = String(ui);
  }

  function effectivePadMmForFace(face, requestedPadMm) {
    if (!face || !face.bounds) return requestedPadMm;
  
    const isDefaultFive = Math.abs(requestedPadMm - 5) < 0.25;
    if (!isDefaultFive) return requestedPadMm;
  
    const w = face.bounds.maxU - face.bounds.minU;
    const h = face.bounds.maxV - face.bounds.minV;
  
    if (w < 15 || h < 15) return 0;
  
    return requestedPadMm;
  }
  
  function bindSync(numEl, rangeEl, onChange) {
    rangeEl.addEventListener('input', () => { numEl.value = rangeEl.value; onChange(); });
    numEl.addEventListener('input', onChange);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsText(file);
    });
  }

  function readFileAsArrayBuffer(file, onProgress) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      if (onProgress) r.onprogress = onProgress;
      r.readAsArrayBuffer(file);
    });
  }

  function splitStep(stepText) {
    const dataIdx = stepText.indexOf('DATA;');
    if (dataIdx < 0) throw new Error('No DATA; section found');
    const endIdx = stepText.lastIndexOf('ENDSEC;');
    if (endIdx < 0) throw new Error('No ENDSEC; found');
    const header = stepText.slice(0, dataIdx + 5) + "\n";
    const data = stepText.slice(dataIdx + 5, endIdx).trim();
    const footer = stepText.slice(endIdx).trim() + "\n";
    return { header, data, footer };
  }

  function maxEntityId(dataText) {
    let maxId = 0;
    const re = /#(\d+)\s*=/g;
    let m;
    while ((m = re.exec(dataText)) !== null) {
      const id = parseInt(m[1], 10);
      if (id > maxId) maxId = id;
    }
    return maxId;
  }

  function detectMmPerUnit(stepText) {
    const t = stepText.toUpperCase();
    if (t.includes("SI_UNIT(.MILLI.,.METRE.)")) return 1;
    if (t.includes("SI_UNIT(.CENTI.,.METRE.)")) return 10;
    if (t.includes("SI_UNIT(.DECI.,.METRE.)")) return 100;
    if (t.match(/SI_UNIT\(\s*\$\s*,\s*\.METRE\.\s*\)/)) return 1000;
    if (t.includes("CONVERSION_BASED_UNIT") && t.includes("INCH")) return 25.4;
    if (t.includes("CONVERSION_BASED_UNIT") && t.includes("FOOT")) return 304.8;
    return 1;
  }

  function fmt(n) {
    let s = Number(n).toFixed(9);
    s = s.replace(/\.?0+$/,'');
    if (s === '-0') s = '0';
    return s;
  }

  function mulR3(R, v) {
    return [
      R[0][0]*v[0] + R[0][1]*v[1] + R[0][2]*v[2],
      R[1][0]*v[0] + R[1][1]*v[1] + R[1][2]*v[2],
      R[2][0]*v[0] + R[2][1]*v[1] + R[2][2]*v[2],
    ];
  }

  function normalize3(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    if (l < 1e-12) return v;
    return [v[0]/l, v[1]/l, v[2]/l];
  }

  function transformPegDataBlock(dataText, R, tObjUnits, scalePegToObj, idOffset) {
    const lines = dataText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const cpRe  = /(CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*)([-\d+.Ee]+)\s*,\s*([-\d+.Ee]+)\s*,\s*([-\d+.Ee]+)(\s*\)\s*\)\s*;)/i;
    const dirRe = /(DIRECTION\s*\(\s*'[^']*'\s*,\s*\(\s*)([-\d+.Ee]+)\s*,\s*([-\d+.Ee]+)\s*,\s*([-\d+.Ee]+)(\s*\)\s*\)\s*;)/i;

    const outLines = lines.map(line => {
      let s = line;
      let m = s.match(cpRe);
      if (m) {
        const pPeg = [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
        const pRot = mulR3(R, pPeg);
        const pScaled = [pRot[0]*scalePegToObj, pRot[1]*scalePegToObj, pRot[2]*scalePegToObj];
        const p = [pScaled[0] + tObjUnits[0], pScaled[1] + tObjUnits[1], pScaled[2] + tObjUnits[2]];
        s = s.replace(cpRe, `${m[1]}${fmt(p[0])},${fmt(p[1])},${fmt(p[2])}${m[5]}`);
      }
      m = s.match(dirRe);
      if (m) {
        const dPeg = [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
        const dRot = normalize3(mulR3(R, dPeg));
        s = s.replace(dirRe, `${m[1]}${fmt(dRot[0])},${fmt(dRot[1])},${fmt(dRot[2])}${m[5]}`);
      }
      s = s.replace(/#(\d+)/g, (_, n) => `#${parseInt(n,10) + idOffset}`);
      return s;
    });
    return outLines.join("\n");
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function geometryTriangleCount(geom) {
    if (!geom) return 0;
    const idx = geom.index;
    if (idx && idx.count) return Math.floor(idx.count / 3);
    const pos = geom.getAttribute('position');
    if (!pos) return 0;
    return Math.floor(pos.count / 3);
  }

  function writeGeometryAsBinaryStl(dv, offset, geom, m4) {
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return offset;
    const pos = posAttr.array;
    const idx = geom.index ? geom.index.array : null;
    const e = m4.elements;

    function tx(i) {
      const x = pos[i], y = pos[i+1], z = pos[i+2];
      return [
        e[0]*x + e[4]*y + e[8]*z + e[12],
        e[1]*x + e[5]*y + e[9]*z + e[13],
        e[2]*x + e[6]*y + e[10]*z + e[14]
      ];
    }

    const triCount = geometryTriangleCount(geom);
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx[t*3+0]*3 : t*9+0;
      const i1 = idx ? idx[t*3+1]*3 : t*9+3;
      const i2 = idx ? idx[t*3+2]*3 : t*9+6;

      const v0 = tx(i0);
      const v1 = tx(i1);
      const v2 = tx(i2);

      const ux = v1[0] - v0[0], uy = v1[1] - v0[1], uz = v1[2] - v0[2];
      const vx = v2[0] - v0[0], vy = v2[1] - v0[1], vz = v2[2] - v0[2];
      let nx = uy*vz - uz*vy;
      let ny = uz*vx - ux*vz;
      let nz = ux*vy - uy*vx;
      const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      dv.setFloat32(offset, nx, true); offset += 4;
      dv.setFloat32(offset, ny, true); offset += 4;
      dv.setFloat32(offset, nz, true); offset += 4;

      dv.setFloat32(offset, v0[0], true); offset += 4;
      dv.setFloat32(offset, v0[1], true); offset += 4;
      dv.setFloat32(offset, v0[2], true); offset += 4;
      dv.setFloat32(offset, v1[0], true); offset += 4;
      dv.setFloat32(offset, v1[1], true); offset += 4;
      dv.setFloat32(offset, v1[2], true); offset += 4;
      dv.setFloat32(offset, v2[0], true); offset += 4;
      dv.setFloat32(offset, v2[1], true); offset += 4;
      dv.setFloat32(offset, v2[2], true); offset += 4;

      dv.setUint16(offset, 0, true); offset += 2;
    }

    return offset;
  }

  function buildBinaryStlBlob(instances) {
    const objMeshes = objectMeshes;
    const pegCount = instances.length;
    const pegTris = geometryTriangleCount(pegGeometry);

    let triCount = 0;
    for (const m of objMeshes) triCount += geometryTriangleCount(m.geometry);
    triCount += pegTris * pegCount;

    if (!triCount) throw new Error('Nothing to export.');
    if (triCount > 5_000_000) throw new Error('Too many triangles for STL export (' + triCount + ').');

    const buf = new ArrayBuffer(84 + triCount * 50);
    const dv = new DataView(buf);

    const headerStr = 'Skadis Pegboard Export';
    const headerBytes = new TextEncoder().encode(headerStr);
    for (let i = 0; i < Math.min(80, headerBytes.length); i++) dv.setUint8(i, headerBytes[i]);

    dv.setUint32(80, triCount, true);
    let offset = 84;

    const shiftM4 = new THREE.Matrix4().makeTranslation(previewShift.x, previewShift.y, previewShift.z);

    for (const m of objMeshes) {
      const m4 = shiftM4.clone().multiply(m.matrixWorld);
      offset = writeGeometryAsBinaryStl(dv, offset, m.geometry, m4);
    }

    const qManual = manualRotationQuaternion();
    for (const inst of instances) {
      const face = inst.face;
      const nPlace = inst.nPlace;
      const qAuto = basePegQuaternion(face.u, nPlace);
      const q = qAuto.clone().multiply(qManual);
      const minAlong = computeMinAlongNormalLocal(pegGeometry, q, nPlace);
      const seat = (-minAlong) - EMBED_MM;
      const tMm = inst.base.clone().add(previewShift).add(nPlace.clone().multiplyScalar(seat));
      const m4 = new THREE.Matrix4().makeRotationFromQuaternion(q);
      m4.setPosition(tMm);
      offset = writeGeometryAsBinaryStl(dv, offset, pegGeometry, m4);
    }

    return new Blob([buf], { type: 'model/stl' });
  }

  function initThree() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, 1, 0.2, 500000);
    camera.up.set(0,0,1);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.physicallyCorrectLights = true;
    renderer.setClearColor(0x000000, 0);

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    host.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.7;
    controls.panSpeed = 0.85;
    controls.zoomSpeed = 0.9;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };

    raycaster = new THREE.Raycaster();

    const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x1b2233, 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(600, 250, 700);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-650, -150, 500);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.35);
    rim.position.set(0, 900, 250);
    scene.add(rim);

    objectGroup = new THREE.Group();
    pegGroup = new THREE.Group();
    gridGroup = new THREE.Group();
    scene.add(objectGroup);
    scene.add(pegGroup);
    scene.add(gridGroup);

    renderer.domElement.addEventListener('pointerdown', onPick);
    renderer.domElement.addEventListener('pointermove', onMouseMove);

    (function animate() {
      requestAnimationFrame(animate);
      resizeRendererToDisplaySize();
      controls.update();
      renderer.render(scene, camera);
    })();
  }

  function resizeRendererToDisplaySize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    const need = (renderer.domElement.width !== Math.floor(w * pr)) || (renderer.domElement.height !== Math.floor(h * pr));
    if (!need) return;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function clearScene() {
    for (const m of objectMeshes) {
      if (m.geometry) m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach(x => x.dispose && x.dispose());
      else m.material && m.material.dispose && m.material.dispose();
      objectGroup.remove(m);
    }
    objectMeshes = [];
    faces = [];
    selectedFaceIds.clear();
    selectedFaceSigns.clear();
    planarFaceCount = 0;
    currentInstances = [];
    clearPegGroup();
    
    while (gridGroup.children.length) {
      const c = gridGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    gridGroup.clear();

    previewShift.set(0,0,0);
    updateDropHint();
	    updateExportUi();
  }

  function clearPegGroup() {
    while (pegGroup.children.length) {
      const c = pegGroup.children.pop();
      if (c.geometry && c.geometry.dispose) c.geometry.dispose();
      if (c.material && c.material.dispose) c.material.dispose();
    }
  }

  function buildThreeMesh(geometryMesh) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(geometryMesh.attributes.position.array, 3));
    if (geometryMesh.attributes.normal) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(geometryMesh.attributes.normal.array, 3));
    else geometry.computeVertexNormals();
    geometry.setIndex(Array.from(geometryMesh.index.array));

    const defaultColor = geometryMesh.color
      ? new THREE.Color(geometryMesh.color[0], geometryMesh.color[1], geometryMesh.color[2])
      : new THREE.Color(0x0158AC);

    const materials = [];
    const baseMat = new THREE.MeshStandardMaterial({ color: defaultColor, roughness: 0.78, metalness: 0.08 });
    baseMat.userData = { baseColor: baseMat.color.clone() };
    materials.push(baseMat);

    if (geometryMesh.brep_faces && geometryMesh.brep_faces.length > 0) {
      for (const bf of geometryMesh.brep_faces) {
        const c = bf.color ? new THREE.Color(bf.color[0], bf.color[1], bf.color[2]) : new THREE.Color(0x0158AC);
        const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0.08 });
        mat.userData = { baseColor: mat.color.clone() };
        materials.push(mat);
      }
      const triCount = geometryMesh.index.array.length / 3;
      let tri = 0;
      let fgi = 0;
      while (tri < triCount) {
        const firstTri = tri;
        let lastTri, mi;
        if (fgi >= geometryMesh.brep_faces.length) {
          lastTri = triCount;
          mi = 0;
        } else if (tri < geometryMesh.brep_faces[fgi].first) {
          lastTri = geometryMesh.brep_faces[fgi].first;
          mi = 0;
        } else {
          lastTri = geometryMesh.brep_faces[fgi].last + 1;
          mi = fgi + 1;
          fgi++;
        }
        geometry.addGroup(firstTri * 3, (lastTri - firstTri) * 3, mi);
        tri = lastTri;
      }
    }
    const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);
    mesh.userData = { geometryMesh, materials };
    return mesh;
  }

  function recenterPreviewGeometry() {
    const box = new THREE.Box3().setFromObject(objectGroup);
    if (!isFinite(box.min.x)) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    previewShift.copy(center);
    for (const mesh of objectMeshes) {
      mesh.geometry.translate(-center.x, -center.y, -center.z);
    }
  }

  function analyzePlanarFaces(meshObj, meshIdx) {
    const gm = meshObj.userData.geometryMesh;
    const bf = gm.brep_faces || [];
    const posAttr = meshObj.geometry.getAttribute('position');
    const idxAttr = meshObj.geometry.index;
    const pos = posAttr.array;
    const idx = idxAttr.array;
    const TRI_COS_TOL = Math.cos(3 * Math.PI / 180);
    const DIST_TOL = 0.20;

    for (let f = 0; f < bf.length; f++) {
      const firstTri = bf[f].first;
      const lastTri  = bf[f].last;
      let nSum = new THREE.Vector3();
      let centroid = new THREE.Vector3();
      let vCount = 0;

      for (let t = firstTri; t <= lastTri; t++) {
        const i0 = idx[t*3+0], i1 = idx[t*3+1], i2 = idx[t*3+2];
        const p0 = new THREE.Vector3(pos[i0*3+0], pos[i0*3+1], pos[i0*3+2]);
        const p1 = new THREE.Vector3(pos[i1*3+0], pos[i1*3+1], pos[i1*3+2]);
        const p2 = new THREE.Vector3(pos[i2*3+0], pos[i2*3+1], pos[i2*3+2]);
        const n = p1.clone().sub(p0).cross(p2.clone().sub(p0));
        nSum.add(n);
        centroid.add(p0).add(p1).add(p2);
        vCount += 3;
      }
      if (!vCount) continue;
      centroid.multiplyScalar(1 / vCount);
      const n = nSum.clone();
      if (n.lengthSq() < 1e-12) continue;
      n.normalize();

      let minDot = 1;
      for (let t = firstTri; t <= lastTri; t++) {
        const i0 = idx[t*3+0], i1 = idx[t*3+1], i2 = idx[t*3+2];
        const p0 = new THREE.Vector3(pos[i0*3+0], pos[i0*3+1], pos[i0*3+2]);
        const p1 = new THREE.Vector3(pos[i1*3+0], pos[i1*3+1], pos[i1*3+2]);
        const p2 = new THREE.Vector3(pos[i2*3+0], pos[i2*3+1], pos[i2*3+2]);
        const tn = p1.clone().sub(p0).cross(p2.clone().sub(p0));
        if (tn.lengthSq() < 1e-12) continue;
        tn.normalize();
        minDot = Math.min(minDot, Math.abs(tn.dot(n)));
      }

      let maxDist = 0;
      for (let t = firstTri; t <= lastTri; t++) {
        const i0 = idx[t*3+0], i1 = idx[t*3+1], i2 = idx[t*3+2];
        for (const ii of [i0,i1,i2]) {
          const p = new THREE.Vector3(pos[ii*3+0], pos[ii*3+1], pos[ii*3+2]);
          const d = Math.abs(n.dot(p.clone().sub(centroid)));
          if (d > maxDist) maxDist = d;
        }
      }
      const planar = (minDot >= TRI_COS_TOL) && (maxDist <= DIST_TOL);

      let u = new THREE.Vector3(1,0,0);
      let proj = u.clone().sub(n.clone().multiplyScalar(u.dot(n)));
      if (proj.lengthSq() < 1e-8) {
        u.set(0,1,0);
        proj = u.clone().sub(n.clone().multiplyScalar(u.dot(n)));
      }
      u = proj.normalize();
      const v = new THREE.Vector3().crossVectors(n, u).normalize();

      let minU=Infinity, maxU=-Infinity, minV=Infinity, maxV=-Infinity;
      for (let t = firstTri; t <= lastTri; t++) {
        const i0 = idx[t*3+0], i1 = idx[t*3+1], i2 = idx[t*3+2];
        for (const ii of [i0,i1,i2]) {
          const p = new THREE.Vector3(pos[ii*3+0], pos[ii*3+1], pos[ii*3+2]);
          const d = p.clone().sub(centroid);
          const uu = d.dot(u);
          const vv = d.dot(v);
          minU = Math.min(minU, uu); maxU = Math.max(maxU, uu);
          minV = Math.min(minV, vv); maxV = Math.max(maxV, vv);
        }
      }
      const faceId = meshIdx + ':' + f;
      faces.push({ faceId, meshObj, meshIdx, faceIndex: f, materialIndex: f + 1, planar, centroid, n, u, v, bounds: { minU, maxU, minV, maxV } });
      if (planar) {
        planarFaceCount++;
        const mat = meshObj.userData.materials[f + 1];
        if (mat) {
          mat.emissive = new THREE.Color(0x0d2230);
          mat.emissiveIntensity = 0.40;
        }
      }
    }
  }

  function faceFromIntersection(intersection) {
    const meshObj = intersection.object;
    const gm = meshObj.userData.geometryMesh;
    if (!gm || !gm.brep_faces || !gm.brep_faces.length) return null;
    const triIndex = intersection.faceIndex;
    if (triIndex == null) return null;
    const f = gm.brep_faces;
    let lo=0, hi=f.length-1;
    while (lo <= hi) {
      const mid = (lo+hi)>>1;
      const a = f[mid].first;
      const b = f[mid].last;
      if (triIndex < a) hi = mid-1;
      else if (triIndex > b) lo = mid+1;
      else return { meshObj, faceIndex: mid };
    }
    return null;
  }

  function getWorldHitNormal(hit) {
    if (!hit.face || !hit.face.normal) return null;
    const n = hit.face.normal.clone();
    const nm = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    return n.applyMatrix3(nm).normalize();
  }

  function onMouseMove(ev) {
    if (!isRemovalMode) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera({ x, y }, camera);
    
    const hits = raycaster.intersectObjects(pegGroup.children, true);
    let found = false;
    if (hits.length > 0) {
      const hit = hits[0];
      const instMesh = hit.object;
      const instId = hit.instanceId;
      if (instMesh.userData.isPeg && instId !== undefined) {
         const actualIndex = instMesh.userData.indices[instId];
         if (actualIndex !== undefined) {
           found = true;
           if (hoveredInstanceId !== actualIndex) {
             hoveredInstanceId = actualIndex;
             hoveredIsRemoved = instMesh.userData.isRemovedMesh;
             renderPegs(); 
           }
         }
      }
    }
    if (!found && hoveredInstanceId !== -1) {
      hoveredInstanceId = -1;
      renderPegs();
    }
  }

  function onPick(ev) {
    PITCH_X = document.getElementById('pitchxNum').value;
    PITCH_Y = document.getElementById('pitchyNum').value;
    HALF_X  = document.getElementById('halfxNum').value;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera({ x, y }, camera);

    if (isRemovalMode) {
      const hits = raycaster.intersectObjects(pegGroup.children, true);
      if (hits.length > 0) {
        const hit = hits[0];
        const instMesh = hit.object;
        const instId = hit.instanceId;
        if (instMesh.userData.isPeg && instId !== undefined) {
          const actualIndex = instMesh.userData.indices[instId];
          if (actualIndex !== undefined) {
             currentInstances[actualIndex].removed = !currentInstances[actualIndex].removed;
             renderPegs();
          }
        }
      }
      return;
    }

    if (!objectMeshes.length) return;
    const hits = raycaster.intersectObjects(objectMeshes, true);
    if (!hits.length) return;

    const hit = hits[0];
    const fi = faceFromIntersection(hit);
    if (!fi) return;

    const meshIdx = objectMeshes.indexOf(fi.meshObj);
    const faceId = meshIdx + ':' + fi.faceIndex;
    const rec = faces.find(f => f.faceId === faceId);
    if (!rec || !rec.planar) return;

    const mat = fi.meshObj.userData.materials[fi.faceIndex + 1];
    if (!mat) return;

    const hitN = getWorldHitNormal(hit);
    let sign = 1;
    if (hitN) sign = (hitN.dot(rec.n) >= 0) ? 1 : -1;

    if (selectedFaceIds.has(faceId)) {
      selectedFaceIds.delete(faceId);
      selectedFaceSigns.delete(faceId);
      mat.color.copy(mat.userData.baseColor);
      mat.emissiveIntensity = 0.40;
    } else {
      selectedFaceIds.add(faceId);
      selectedFaceSigns.set(faceId, sign);
      mat.color.set(0x66d9ff);
      mat.emissive = new THREE.Color(0x113344);
      mat.emissiveIntensity = 0.85;
      
      doAutoLayout(rec);
    }

    updatePegInstances();
    updateBadges();
  }

  function updateBadges() {
    facesPill.textContent = planarFaceCount + ' planar / ' + selectedFaceIds.size + ' selected';
  }

  function getExportFormat() {
    return exportFormatEl ? String(exportFormatEl.value || 'step') : 'step';
  }

  function getActivePegCount() {
    let c = 0;
    for (const inst of currentInstances) {
      if (inst && !inst.removed) c++;
    }
    return c;
  }

  function updateDownloadLabel() {
    if (!downloadBtn) return;
    const fmt = getExportFormat();
    downloadBtn.textContent = (fmt === 'stl') ? 'Download STL' : 'Download STEP';
  }

  function updateDownloadEnabled() {
    if (!downloadBtn) return;
    const fmt = getExportFormat();
    const activeCount = getActivePegCount();
    let ok = false;
    if (fmt === 'stl') {
      ok = (objectMeshes.length > 0 && !!pegGeometry && activeCount > 0);
    } else {
      ok = (!!objectStepParts && !!pegStepParts && activeCount > 0);
    }
    downloadBtn.disabled = !ok;
  }

  function updateExportUi() {
    if (exportFormatEl) {
      const hasObject = objectMeshes.length > 0;
      const stepAllowed = (!hasObject) || !!objectStepParts;
      const stepOpt = exportFormatEl.querySelector('option[value="step"]');
      if (stepOpt) stepOpt.disabled = !stepAllowed;

      if (hasObject && !stepAllowed && exportFormatEl.value === 'step') {
        exportFormatEl.value = 'stl';
      }
    }
    updateDownloadLabel();
    updateDownloadEnabled();
  }

  function buildPegGeometryFromStepResult(result) {
    const geoms = [];
    for (const m of result.meshes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
      if (m.attributes.normal) g.setAttribute("normal", new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
      g.setIndex(Array.from(m.index.array));
      geoms.push(g);
    }
    if (!geoms.length) return null;
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geoms, true);
    merged.computeBoundingBox();
    for (const g of geoms) g.dispose();
    return merged;
  }

  function computePegBasisFromGeometry(geom) {
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const ext = [ bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z ];
    const axes = [ new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1) ];
    const pos = geom.getAttribute('position').array;

    function axisStats(axis) {
      let minProj = Infinity, maxProj = -Infinity;
      for (let i = 0; i < pos.length; i += 3) {
        const d = pos[i]*axis.x + pos[i+1]*axis.y + pos[i+2]*axis.z;
        if (d < minProj) minProj = d;
        if (d > maxProj) maxProj = d;
      }
      const span = Math.max(1e-6, maxProj - minProj);
      const eps = Math.min(1.0, span * 0.03);
      let nearMin = 0, nearMax = 0;
      for (let i = 0; i < pos.length; i += 3) {
        const d = pos[i]*axis.x + pos[i+1]*axis.y + pos[i+2]*axis.z;
        if (d <= minProj + eps) nearMin++;
        if (d >= maxProj - eps) nearMax++;
      }
      const score = Math.abs(nearMin - nearMax) * span;
      return { minProj, maxProj, span, nearMin, nearMax, score };
    }

    let bestIdx = 0;
    let best = axisStats(axes[0]);
    for (let i = 1; i < 3; i++) {
      const st = axisStats(axes[i]);
      if (st.score > best.score) { best = st; bestIdx = i; }
    }
    if (best.score < 1e-6) {
      bestIdx = (ext[1] > ext[0]) ? 1 : 0;
      if (ext[2] > ext[bestIdx]) bestIdx = 2;
      best = axisStats(axes[bestIdx]);
    }

    let sideIdx = (bestIdx === 0) ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      if (i === bestIdx) continue;
      if (ext[i] > ext[sideIdx]) sideIdx = i;
    }

    let height = axes[bestIdx].clone();
    let side = axes[sideIdx].clone();

    if (best.nearMax > best.nearMin) {
      height.multiplyScalar(-1);
      best = axisStats(height);
    }
    side.sub(height.clone().multiplyScalar(side.dot(height))).normalize();
    if (side.lengthSq() < 1e-10) side = new THREE.Vector3(1,0,0);

    return { height, side, minAlongHeight: best.minProj };
  }

  function basePegQuaternion(faceU, faceN) {
    const height = pegBasis.height.clone().normalize();
    const side   = pegBasis.side.clone().normalize();
    const q1 = new THREE.Quaternion().setFromUnitVectors(height, faceN);
    let sideW = side.clone().applyQuaternion(q1);
    let sideProj = sideW.clone().sub(faceN.clone().multiplyScalar(sideW.dot(faceN)));
    if (sideProj.lengthSq() < 1e-10) sideProj = faceU.clone();
    sideProj.normalize();
    const desired = faceU.clone().normalize();
    const cross = sideProj.clone().cross(desired);
    const angle = Math.atan2(faceN.dot(cross), sideProj.dot(desired));
    const q2 = new THREE.Quaternion().setFromAxisAngle(faceN, angle);
    return q2.multiply(q1);
  }

  function manualRotationQuaternion() {
    const toRad = THREE.MathUtils.degToRad;
    const ex = toRad(pegEulerDeg.x + FIXED_X_DEG);
    const ey = toRad(pegEulerDeg.y + FIXED_Y_DEG);
    const ez = toRad(pegEulerDeg.z + FIXED_Z_DEG);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), ex);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), ey);
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), ez);
    return qz.multiply(qy).multiply(qx);
  }

  function computeMinAlongNormalLocal(geom, qWorld, normalWorld) {
    const inv = qWorld.clone().invert();
    const nLocal = normalWorld.clone().applyQuaternion(inv).normalize();
    const pos = geom.getAttribute('position').array;
    let min = Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      const d = pos[i]*nLocal.x + pos[i+1]*nLocal.y + pos[i+2]*nLocal.z;
      if (d < min) min = d;
    }
    return min;
  }

  function updatePegInstances() {
    calculatePegPositions();
    renderPegs();
    renderGrid();
  }

  function calculatePegPositions() {
    currentInstances = [];
    const selected = Array.from(selectedFaceIds)
      .map(id => faces.find(f => f.faceId === id))
      .filter(Boolean);
  
    if (!selected.length || !pegGeometry) return;
  
    const padMmRequested = getPaddingMm();
  
    const mm = getMmValues();
    const sx = snapTo(mm.x, HALF_X);
    const sy = snapTo(mm.y, PITCH_Y);
    const row0IsHalf = row0OffsetEl && row0OffsetEl.value === 'half';
    const grid = computePegPositions(sx, sy, row0IsHalf);
  
    const offsetX = parseFloat(offXNum.value) || 0;
    const offsetY = parseFloat(offYNum.value) || 0;
  
    const pegCountX = (Math.floor((sx / PITCH_X) * 2)) / 2 + 1;
    const pegCountY = Math.round(sy / PITCH_Y) + 1;
    dimsPill.textContent = pegCountX + ' × ' + pegCountY + ' pegs';
  
    for (const face of selected) {
      const sign = selectedFaceSigns.get(face.faceId) || 1;
      const nPlace = face.n.clone().multiplyScalar(sign);

      const padMm = effectivePadMmForFace(face, padMmRequested);
  
      const minU = face.bounds.minU + padMm;
      const maxU = face.bounds.maxU - padMm;
      const minV = face.bounds.minV + padMm;
      const maxV = face.bounds.maxV - padMm;
      if (minU > maxU || minV > maxV) continue;
  
      for (const p of grid.positions) {
        if (currentInstances.length >= MAX_PEGS_TOTAL) break;
  
        const finalX = p.x + offsetX;
        const finalY = p.y + offsetY;
  
        if (finalX < minU || finalX > maxU) continue;
        if (finalY < minV || finalY > maxV) continue;
  
        const base = face.centroid.clone()
          .add(face.u.clone().multiplyScalar(finalX))
          .add(face.v.clone().multiplyScalar(finalY));
  
        currentInstances.push({ face, base, nPlace, removed: false });
      }
    }
  }
  

  function createInstancedMesh(subset, indices, isRemovedMesh) {
    if (subset.length === 0) return null;
    
    const materialToUse = isRemovedMesh ? pegMaterialTrans : pegMaterial;
    const mesh = new THREE.InstancedMesh(pegGeometry, materialToUse, subset.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.isPeg = true;
    mesh.userData.indices = indices; 
    mesh.userData.isRemovedMesh = isRemovedMesh;

    const m4 = new THREE.Matrix4();
    const qManual = manualRotationQuaternion();
    const white = new THREE.Color(1,1,1);
    const highlight = new THREE.Color(0xaaeeff);

    for (let i = 0; i < subset.length; i++) {
      const item = subset[i];
      const actualIndex = indices[i];
      const face = item.face;
      const nPlace = item.nPlace;

      const qAuto = basePegQuaternion(face.u, nPlace);
      const q = qAuto.clone().multiply(qManual);
      const minAlong = computeMinAlongNormalLocal(pegGeometry, q, nPlace);
      const seat = (-minAlong) - EMBED_MM;
      const pos = item.base.clone().add(nPlace.clone().multiplyScalar(seat));

      m4.makeRotationFromQuaternion(q);
      m4.setPosition(pos);
      mesh.setMatrixAt(i, m4);

      if (isRemovalMode) {
         if (actualIndex === hoveredInstanceId) {
           mesh.setColorAt(i, highlight);
         } else {
           mesh.setColorAt(i, white);
         }
      }
    }
    
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  function renderPegs() {
    clearPegGroup();
    
    const instances = currentInstances;
    if (!instances.length) {
      pegsPill.textContent = '0 pegs';
      countPill.textContent = '-';
      downloadBtn.disabled = true;
      return;
    }

    if (!pegMaterial) {
      pegMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x2d3440),
        roughness: 0.45,
        metalness: 0.06,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
      pegMaterialTrans = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xff4444),
        roughness: 0.45,
        metalness: 0.06,
        transparent: true,
        opacity: 0.5,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
    }

    const activeSubset = [];
    const activeIndices = [];
    const removedSubset = [];
    const removedIndices = [];

    let activeCount = 0;
    for(let i=0; i<instances.length; i++) {
      if (!instances[i].removed) {
        activeSubset.push(instances[i]);
        activeIndices.push(i);
        activeCount++;
      } else if (isRemovalMode) {
        removedSubset.push(instances[i]);
        removedIndices.push(i);
      }
    }

    const activeMesh = createInstancedMesh(activeSubset, activeIndices, false);
    if (activeMesh) pegGroup.add(activeMesh);

    if (isRemovalMode) {
      const removedMesh = createInstancedMesh(removedSubset, removedIndices, true);
      if (removedMesh) pegGroup.add(removedMesh);
    }
    
    pegsPill.textContent = activeCount + ' pegs';
    countPill.textContent = (activeCount / Math.max(1, selectedFaceIds.size)).toFixed(0) + ' avg/face';
	    updateDownloadEnabled();
  }
  
  function renderGrid() {
    while (gridGroup.children.length) {
      const c = gridGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  
    if (selectedFaceIds.size === 0) return;
  
    const padMmRequested = getPaddingMm();
    const offsetX = parseFloat(offXNum.value) || 0;
    const offsetY = parseFloat(offYNum.value) || 0;
  
    const mm = getMmValues();
    const sx = snapTo(mm.x, HALF_X);
    const sy = snapTo(mm.y, PITCH_Y);
    const row0IsHalf = row0OffsetEl && row0OffsetEl.value === 'half';
    const gridInfo = computePegPositions(sx, sy, row0IsHalf);
    const cx = gridInfo.shift.x;
    const cy = gridInfo.shift.y;
  
    const eps = 0.26;
  
    for (const fid of selectedFaceIds) {
      const face = faces.find(f => f.faceId === fid);
      if (!face) continue;
  
      const sign = selectedFaceSigns.get(fid) || 1;
      const b = face.bounds;

      const padMm = effectivePadMmForFace(face, padMmRequested);
  
      const minU = b.minU + padMm;
      const maxU = b.maxU - padMm;
      const minV = b.minV + padMm;
      const maxV = b.maxV - padMm;
      if (minU > maxU || minV > maxV) continue;
  
      const lift = face.n.clone().multiplyScalar(sign * eps);
  
      const map = new Map();
      const nodes = [];
  
      for (const p of gridInfo.positions) {
        const x = p.x + offsetX;
        const y = p.y + offsetY;
  
        if (x < minU || x > maxU) continue;
        if (y < minV || y > maxV) continue;
  
        const rawX = p.x + cx;
        const rawY = p.y + cy;
        const i = Math.round(rawX / HALF_X);
        const r = Math.round(rawY / PITCH_Y);
        const key = r + ',' + i;
  
        if (map.has(key)) continue;
  
        const pt = new THREE.Vector3(
          face.centroid.x + face.u.x * x + face.v.x * y + lift.x,
          face.centroid.y + face.u.y * x + face.v.y * y + lift.y,
          face.centroid.z + face.u.z * x + face.v.z * y + lift.z
        );
  
        map.set(key, pt);
        nodes.push({ r, i, key });
  
        if (nodes.length >= MAX_PEGS_TOTAL) break;
      }
  
      if (!nodes.length) continue;
  
      const segPts = [];
      const pushSeg = (a, b) => { segPts.push(a, b); };
  
      for (let idx = 0; idx < nodes.length; idx++) {
        const { r, i, key } = nodes[idx];
        const p0 = map.get(key);
        if (!p0) continue;
  
        const kR = r + ',' + (i + 2);
        const pR = map.get(kR);
        if (pR) pushSeg(p0, pR);
  
        const kUR = (r + 1) + ',' + (i + 1);
        const pUR = map.get(kUR);
        if (pUR) pushSeg(p0, pUR);
  
        const kUL = (r + 1) + ',' + (i - 1);
        const pUL = map.get(kUL);
        if (pUL) pushSeg(p0, pUL);
  
        if (segPts.length / 2 > MAX_PEGS_TOTAL * 4) break;
      }
  
      if (!segPts.length) continue;
  
      const mat = new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
        depthTest: true
      });
  
      const geo = new THREE.BufferGeometry().setFromPoints(segPts);
      const lines = new THREE.LineSegments(geo, mat);
      lines.renderOrder = 10;
      gridGroup.add(lines);
    }
  }
  
  
  
  function doAutoLayout(face) {
    if (!face) {
      if (selectedFaceIds.size === 0) return;
      const lastId = Array.from(selectedFaceIds).pop();
      face = faces.find(f => f.faceId === lastId);
      if (!face) return;
    }
  
    const w = face.bounds.maxU - face.bounds.minU;
    const h = face.bounds.maxV - face.bounds.minV;
  
    let padMm = getPaddingMm();
    if (Math.abs(padMm - 5) < 0.25 && (w < 15 || h < 15)) padMm = 0;
  
    if (
      Math.abs(padMm - 5) < 0.25 &&
      ((face.bounds.minU + padMm) > (face.bounds.maxU - padMm) ||
       (face.bounds.minV + padMm) > (face.bounds.maxV - padMm))
    ) {
      padMm = 0;
    }
  
    unitSelect.value = 'mm';
    updateLimits();
    lastUnit = 'mm';
  
    setPaddingUiFromMm(padMm);
  
    hNum.value = parseFloat(w.toFixed(2));
    hRange.value = hNum.value;
  
    vNum.value = parseFloat(h.toFixed(2));
    vRange.value = vNum.value;
  
    offXNum.value = 0; offXRange.value = 0;
    offYNum.value = 0; offYRange.value = 0;
  
    updatePegInstances();
  }
  
  
  autoLayoutBtn.addEventListener('click', () => doAutoLayout(null));

  function fitView() {
    const box = new THREE.Box3().setFromObject(objectGroup);
    if (!isFinite(box.min.x)) return;
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const radius = Math.max(1e-3, sphere.radius);
    const center = sphere.center.clone();
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = (radius / Math.sin(fov / 2)) * 1.20;
    const dir = new THREE.Vector3(1, 1, 0.85).normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    camera.near = Math.max(0.1, dist / 400);
    camera.far  = Math.max(5000, dist * 60);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }

  async function loadOcct() {
    if (occt) return occt;
    showLoading('Initializing STEP importer…', 'Loading WebAssembly…');
    occt = await occtimportjs();
    return occt;
  }

  async function loadPegStepFromText(txt, pegLabel) {
    const oc = await loadOcct();
    pegStepText = txt;
    pegStepParts = splitStep(pegStepText);
    pegMaxId = maxEntityId(pegStepParts.data);
    pegMmPerUnit = detectMmPerUnit(pegStepText);
    const bin = new TextEncoder().encode(txt);
    const params = {
      linearUnit: "millimeter",
      linearDeflectionType: "bounding_box_ratio",
      linearDeflection: 0.001,
      angularDeflection: 0.5
    };
    const result = oc.ReadStepFile(bin, params);
    if (!result || !result.success) throw new Error('Failed to import peg STEP.');
    if (pegGeometry && pegGeometry.dispose) pegGeometry.dispose();
    pegGeometry = buildPegGeometryFromStepResult(result);
    pegBasis = computePegBasisFromGeometry(pegGeometry);
    pegMaterial = null;
    hideLoading();
    statusEl.textContent = pegLabel ? ('Peg master loaded: ' + pegLabel + '.') : 'Peg master loaded.';
    updatePegInstances();
	    updateExportUi();
  }

  function normalizePegType(v) {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'snug') return 'snug';
    if (s === 'loose') return 'loose';
    return 'normal';
  }

  function titlePeg(type) {
    const t = normalizePegType(type);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function setPegUi(type) {
    const t = normalizePegType(type);
    currentPegType = t;
    for (const b of pegOptionBtns) {
      const isSel = (b.dataset.peg === t);
      b.classList.toggle('selected', isSel);
      b.setAttribute('aria-pressed', isSel ? 'true' : 'false');
    }
  }

  async function loadPegMaster(type) {
    const t = normalizePegType(type);
    const file = HOOK_FILES[t] || HOOK_FILES.normal;
    showLoading('Loading ' + file + '…', 'Peg master model');
    const res = await fetch(file, { cache: 'no-store' });
    if (!res.ok) {
      hideLoading();
      throw new Error('Missing ' + file + ' (peg model).');
    }
    const txt = await res.text();
    await loadPegStepFromText(txt, titlePeg(t));
  }

  async function setPegType(type) {
    const next = normalizePegType(type);
    if (next === currentPegType) return;
    const prev = currentPegType;
    setPegUi(next);
    try {
      await loadPegMaster(next);
      hoveredInstanceId = -1;
      hoveredIsRemoved = false;
      renderPegs();
    } catch(e) {
      setPegUi(prev);
      showError(e);
    }
  }

  async function loadObjectStep(file) {
    objectFileName = file.name;
    const oc = await loadOcct();

    showLoading('Reading object STEP…', file.name);

    const [bin, txt] = await Promise.all([
      (new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(new Uint8Array(r.result));
        r.onerror = reject;
        r.onprogress = (e) => { if (e.lengthComputable) overlaySub.textContent = file.name + ' — ' + Math.round((e.loaded / e.total)*100) + '%'; };
        r.readAsArrayBuffer(file);
      })),
      readFileAsText(file)
    ]);

    showLoading('Parsing STEP…', 'Triangulating…');
    objectStepText = txt;
    objectStepParts = splitStep(objectStepText);
    objectMaxId = maxEntityId(objectStepParts.data);
    objectMmPerUnit = detectMmPerUnit(objectStepText);
    const params = {
      linearUnit: "millimeter",
      linearDeflectionType: "bounding_box_ratio",
      linearDeflection: 0.001,
      angularDeflection: 0.5
    };
    const result = oc.ReadStepFile(bin, params);
    if (!result || !result.success) throw new Error('Failed to import object STEP.');
    clearScene();
    showLoading('Building preview…', 'Creating meshes…');
    for (const m of result.meshes) {
      const meshObj = buildThreeMesh(m);
      objectMeshes.push(meshObj);
      objectGroup.add(meshObj);
    }
    recenterPreviewGeometry();
    planarFaceCount = 0;
    faces = [];
    for (let i = 0; i < objectMeshes.length; i++) {
      analyzePlanarFaces(objectMeshes[i], i);
    }
    selectedFaceIds.clear();
    selectedFaceSigns.clear();
    updateBadges();
    clearFacesBtn.disabled = false;
    fitViewBtn.disabled = false;
    fitView();
    hideLoading();
    statusEl.textContent = 'Object loaded. Click planar faces.';
    updateDropHint();
    updatePegInstances();
	    updateExportUi();
  }

  function stlLooksBinary(arrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength < 84) return false;
    const dv = new DataView(arrayBuffer);
    const triCount = dv.getUint32(80, true);
    const expected = 84 + triCount * 50;
    if (expected === arrayBuffer.byteLength) return true;
    return false;
  }

  function parseStlToTriangles(arrayBuffer) {
    if (stlLooksBinary(arrayBuffer)) {
      const dv = new DataView(arrayBuffer);
      const triCount = dv.getUint32(80, true);
      const positions = new Float32Array(triCount * 9);
      const normals = new Float32Array(triCount * 9);
      let off = 84;
      for (let t = 0; t < triCount; t++) {
        const nx = dv.getFloat32(off, true); off += 4;
        const ny = dv.getFloat32(off, true); off += 4;
        const nz = dv.getFloat32(off, true); off += 4;
        for (let v = 0; v < 3; v++) {
          const px = dv.getFloat32(off, true); off += 4;
          const py = dv.getFloat32(off, true); off += 4;
          const pz = dv.getFloat32(off, true); off += 4;
          const base = t * 9 + v * 3;
          positions[base + 0] = px;
          positions[base + 1] = py;
          positions[base + 2] = pz;
          normals[base + 0] = nx;
          normals[base + 1] = ny;
          normals[base + 2] = nz;
        }
        off += 2;
      }
      return { positions, normals, triCount };
    }

    const txt = new TextDecoder().decode(new Uint8Array(arrayBuffer));
    const positions = [];
    const normals = [];
    const reFacet = /facet\s+normal\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)[\s\S]*?outer\s+loop[\s\S]*?vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)[\s\S]*?vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)[\s\S]*?vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)[\s\S]*?endloop[\s\S]*?endfacet/g;
    let m;
    while ((m = reFacet.exec(txt)) !== null) {
      const nx = parseFloat(m[1]), ny = parseFloat(m[2]), nz = parseFloat(m[3]);
      const v = [
        parseFloat(m[4]), parseFloat(m[5]), parseFloat(m[6]),
        parseFloat(m[7]), parseFloat(m[8]), parseFloat(m[9]),
        parseFloat(m[10]), parseFloat(m[11]), parseFloat(m[12])
      ];
      positions.push(...v);
      normals.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
    }
    const triCount = Math.floor(positions.length / 9);
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), triCount };
  }

  function canonicalizeNormal(nx, ny, nz) {
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    if (ax >= ay && ax >= az) {
      if (nx < 0) { nx = -nx; ny = -ny; nz = -nz; }
    } else if (ay >= ax && ay >= az) {
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    } else {
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    }
    return [nx, ny, nz];
  }

  function buildGeometryMeshFromStlTriangles(positions, normals) {
    const triCount = Math.floor(positions.length / 9);
    if (!triCount) throw new Error('STL has no triangles.');

    const NORMAL_BIN = 0.05;
    const DIST_TOL = 0.20;
    const groups = new Map();
    const areas = new Float64Array(triCount);
    let totalArea = 0;

    for (let t = 0; t < triCount; t++) {
      const b = t * 9;
      const x0 = positions[b+0], y0 = positions[b+1], z0 = positions[b+2];
      const x1 = positions[b+3], y1 = positions[b+4], z1 = positions[b+5];
      const x2 = positions[b+6], y2 = positions[b+7], z2 = positions[b+8];

      const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
      const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
      const cx = uy*vz - uz*vy;
      const cy = uz*vx - ux*vz;
      const cz = ux*vy - uy*vx;
      const len = Math.sqrt(cx*cx + cy*cy + cz*cz);
      const area = 0.5 * len;
      areas[t] = area;
      totalArea += area;
      if (len < 1e-12) continue;

      let nx = cx / len, ny = cy / len, nz = cz / len;
      [nx, ny, nz] = canonicalizeNormal(nx, ny, nz);

      const cxm = (x0 + x1 + x2) / 3;
      const cym = (y0 + y1 + y2) / 3;
      const czm = (z0 + z1 + z2) / 3;
      const d = nx*cxm + ny*cym + nz*czm;

      const nxq = Math.round(nx / NORMAL_BIN);
      const nyq = Math.round(ny / NORMAL_BIN);
      const nzq = Math.round(nz / NORMAL_BIN);
      const dq = Math.round(d / DIST_TOL);
      const key = nxq + ',' + nyq + ',' + nzq + ':' + dq;

      let g = groups.get(key);
      if (!g) {
        g = { tris: [], area: 0 };
        groups.set(key, g);
      }
      g.tris.push(t);
      g.area += area;
    }

    const list = Array.from(groups.values()).sort((a,b) => b.area - a.area);
    const minArea = Math.max(25, totalArea * 0.001);
    const MAX_FACES = 250;
    const keptGroups = [];
    for (const g of list) {
      if (keptGroups.length >= MAX_FACES) break;
      if (g.area >= minArea && g.tris.length >= 8) keptGroups.push(g);
    }

    const keptMask = new Uint8Array(triCount);
    for (const g of keptGroups) {
      for (const t of g.tris) keptMask[t] = 1;
    }

    const keptTriTotal = keptGroups.reduce((s,g) => s + g.tris.length, 0);
    const outTriCount = triCount;
    const outPos = new Float32Array(outTriCount * 9);
    const outNor = new Float32Array(outTriCount * 9);
    const brep_faces = [];

    let triWrite = 0;
    for (let gi = 0; gi < keptGroups.length; gi++) {
      const g = keptGroups[gi];
      const first = triWrite;
      for (const t of g.tris) {
        const src = t * 9;
        const dst = triWrite * 9;
        outPos.set(positions.subarray(src, src + 9), dst);
        outNor.set(normals.subarray(src, src + 9), dst);
        triWrite++;
      }
      const last = triWrite - 1;
      if (last >= first) brep_faces.push({ first, last, color: [0.01, 0.35, 0.67] });
    }

    for (let t = 0; t < triCount; t++) {
      if (keptMask[t]) continue;
      const src = t * 9;
      const dst = triWrite * 9;
      outPos.set(positions.subarray(src, src + 9), dst);
      outNor.set(normals.subarray(src, src + 9), dst);
      triWrite++;
    }

    const vertCount = outTriCount * 3;
    const index = new Uint32Array(vertCount);
    for (let i = 0; i < vertCount; i++) index[i] = i;

    return {
      attributes: { position: { array: outPos }, normal: { array: outNor } },
      index: { array: index },
      brep_faces,
      color: [0.01, 0.35, 0.67]
    };
  }

  async function loadObjectStl(file) {
    objectFileName = file.name;
    showLoading('Reading object STL…', file.name);
    const buf = await readFileAsArrayBuffer(file, (e) => {
      if (e.lengthComputable) overlaySub.textContent = file.name + ' — ' + Math.round((e.loaded / e.total)*100) + '%';
    });

    showLoading('Parsing STL…', 'Finding planar faces…');
    objectStepText = '';
    objectStepParts = null;
    objectMaxId = 0;
    objectMmPerUnit = 1;

    const tris = parseStlToTriangles(buf);
    const geometryMesh = buildGeometryMeshFromStlTriangles(tris.positions, tris.normals);

    clearScene();
    showLoading('Building preview…', 'Creating mesh…');

    const meshObj = buildThreeMesh(geometryMesh);
    objectMeshes.push(meshObj);
    objectGroup.add(meshObj);

    recenterPreviewGeometry();
    planarFaceCount = 0;
    faces = [];
    analyzePlanarFaces(meshObj, 0);
    selectedFaceIds.clear();
    selectedFaceSigns.clear();
    updateBadges();
    clearFacesBtn.disabled = false;
    fitViewBtn.disabled = false;
    fitView();
    hideLoading();
    statusEl.textContent = 'Object loaded. Click planar faces.';
    updateDropHint();
    updatePegInstances();
    updateExportUi();
  }

  function updateDropHint() {
    dropHint.style.display = objectMeshes.length ? 'none' : 'flex';
  }

  function updateFileInputLabel(file) {
    if (file) {
      fileNameLabel.textContent = file.name;
      fileNameLabel.style.color = "var(--text)";
    } else {
	      fileNameLabel.textContent = "Select Object (.step/.stl)…";
      fileNameLabel.style.color = "var(--muted)";
    }
  }

  function tryLoadFromFileList(fileList) {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    const name = (file.name || '').toLowerCase();
    const isStep = name.endsWith('.step') || name.endsWith('.stp');
    const isStl = name.endsWith('.stl');
    if (!isStep && !isStl) return;
    
    updateFileInputLabel(file);

    statusEl.textContent = 'Loading object…';
    const p = isStl ? loadObjectStl(file) : loadObjectStep(file);
    Promise.resolve(p).catch(e => {
      hideLoading();
      statusEl.textContent = 'Error.';
      showError(e);
      updateDropHint();
    });
  }

  function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
  ['dragenter','dragover','dragleave','drop'].forEach(evt => {
    previewEl.addEventListener(evt, preventDefaults, false);
  });

  previewEl.addEventListener('dragenter', () => {
    dropHint.classList.add('dragover');
    dropHint.style.display = 'flex';
  });
  previewEl.addEventListener('dragover', () => {
    dropHint.classList.add('dragover');
    dropHint.style.display = 'flex';
  });
  previewEl.addEventListener('dragleave', (e) => {
    dropHint.classList.remove('dragover');
    updateDropHint();
  });
  previewEl.addEventListener('drop', (e) => {
    dropHint.classList.remove('dragover');
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      tryLoadFromFileList(dt.files);
    } else {
      updateDropHint();
    }
  });
  
  document.getElementById('fileInputGroup').addEventListener('click', (e) => {
    if (e.target === objectFileEl) return;
    objectFileEl.click();
  });
  

  dropHint.addEventListener('click', (e) => {
    e.stopPropagation();
    objectFileEl.click();
  });

  function clampDeg(v) {
    v = Number(v);
    if (!isFinite(v)) v = 0;
    if (v > 180) v = 180;
    if (v < -180) v = -180;
    return v;
  }

  function syncOriUI() {
    xRange.value = String(pegEulerDeg.x); xNum.value = String(pegEulerDeg.x);
    yRange.value = String(pegEulerDeg.y); yNum.value = String(pegEulerDeg.y);
    zRange.value = String(pegEulerDeg.z); zNum.value = String(pegEulerDeg.z);
  }

  function setAxis(axis, val) {
    pegEulerDeg[axis] = clampDeg(val);
    syncOriUI();
    updatePegInstances();
  }

  function bumpAxis(axis, delta) {
    setAxis(axis, pegEulerDeg[axis] + delta);
  }

  xMinus.addEventListener('click', () => bumpAxis('x', -90));
  xPlus.addEventListener('click',  () => bumpAxis('x', +90));
  yMinus.addEventListener('click', () => bumpAxis('y', -90));
  yPlus.addEventListener('click',  () => bumpAxis('y', +90));
  zMinus.addEventListener('click', () => bumpAxis('z', -90));
  zPlus.addEventListener('click',  () => bumpAxis('z', +90));

  xRange.addEventListener('input', () => setAxis('x', xRange.value));
  yRange.addEventListener('input', () => setAxis('y', yRange.value));
  zRange.addEventListener('input', () => setAxis('z', zRange.value));

  xNum.addEventListener('input', () => setAxis('x', xNum.value));
  yNum.addEventListener('input', () => setAxis('y', yNum.value));
  zNum.addEventListener('input', () => setAxis('z', zNum.value));

  resetOri.addEventListener('click', () => {
    pegEulerDeg.x = 0; pegEulerDeg.y = 0; pegEulerDeg.z = 0;
    syncOriUI();
    updatePegInstances();
  });

  let lastUnit = unitSelect.value;

  unitSelect.addEventListener('change', () => {
    const prevUnit = lastUnit;
    const nextUnit = unitSelect.value;

    if (prevUnit === nextUnit) return;

    let currentMmX = 0;
    let currentMmY = 0;
    const rawH = parseFloat(hNum.value) || 0;
    const rawV = parseFloat(vNum.value) || 0;

    if (prevUnit === 'mm') {
      currentMmX = rawH;
      currentMmY = rawV;
    } else if (prevUnit === 'in') {
      currentMmX = rawH * 25.4;
      currentMmY = rawV * 25.4;
    } else if (prevUnit === 'peg') {
      currentMmX = Math.max(0, rawH - 1) * PITCH_X;
      currentMmY = Math.max(0, rawV - 1) * PITCH_Y;
    }

    const padMm = getPaddingMm(prevUnit);

    updateLimits();

    let newH = 0;
    let newV = 0;

    if (nextUnit === 'mm') {
      newH = currentMmX;
      newV = currentMmY;
    } else if (nextUnit === 'in') {
      newH = currentMmX / 25.4;
      newV = currentMmY / 25.4;
    } else if (nextUnit === 'peg') {
      newH = (currentMmX / PITCH_X) + 1;
      newV = (currentMmY / PITCH_Y) + 1;
    }

    const clampAndStep = (val, el) => {
      let v = parseFloat(val);
      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      const step = parseFloat(el.step);

      if (!isFinite(v)) v = min;

      if (step > 0) {
        v = Math.round(v / step) * step;
      }

      if (v < min) v = min;
      if (v > max) v = max;

      return parseFloat(v.toFixed(3));
    };

    hNum.value = String(clampAndStep(newH, hNum));
    hRange.value = hNum.value;
    vNum.value = String(clampAndStep(newV, vNum));
    vRange.value = vNum.value;

    setPaddingUiFromMm(padMm);

    updatePegInstances();
    lastUnit = nextUnit;
  });

  for (const b of pegOptionBtns) {
    b.addEventListener('click', () => setPegType(b.dataset.peg));
  }

  bindSync(hNum, hRange, updatePegInstances);
  bindSync(vNum, vRange, updatePegInstances);
  if (row0OffsetEl) row0OffsetEl.addEventListener('change', updatePegInstances);

  bindSync(padNum, padRange, updatePegInstances);

  bindSync(offXNum, offXRange, updatePegInstances);
  bindSync(offYNum, offYRange, updatePegInstances);

  resetOffsetBtn.addEventListener('click', () => {
    offXNum.value = 0; offXRange.value = 0;
    offYNum.value = 0; offYRange.value = 0;
    updatePegInstances();
  });

  toggleRemovalBtn.addEventListener('click', () => {
    isRemovalMode = !isRemovalMode;

    if (isRemovalMode) {
      toggleRemovalBtn.classList.add('active');
      toggleRemovalBtn.innerText = "Exit Removal Mode";
      previewEl.classList.add('removal-mode');
      removalTag.style.display = 'block';

    } else {
      toggleRemovalBtn.classList.remove('active');
      toggleRemovalBtn.innerText = "Peg removal";
      previewEl.classList.remove('removal-mode');
      removalTag.style.display = 'none';
      hoveredInstanceId = -1;
    }

    renderPegs();
  });

  resetRemovalBtn.addEventListener('click', () => {
    currentInstances.forEach(i => i.removed = false);
    renderPegs();
  });

  clearFacesBtn.addEventListener('click', () => {
    for (const id of selectedFaceIds) {
      const rec = faces.find(f => f.faceId === id);
      if (!rec) continue;
      const mat = rec.meshObj.userData.materials[rec.materialIndex];
      if (mat) {
        mat.color.copy(mat.userData.baseColor);
        mat.emissiveIntensity = 0.40;
      }
    }

    selectedFaceIds.clear();
    selectedFaceSigns.clear();
    updatePegInstances();
    updateBadges();
  });

  fitViewBtn.addEventListener('click', fitView);

  if (exportFormatEl) {
    exportFormatEl.addEventListener('change', () => {
      updateDownloadLabel();
      updateDownloadEnabled();
    });
  }

  objectFileEl.addEventListener('change', async () => {
    const f = objectFileEl.files && objectFileEl.files[0];

    if (!f) return;
    updateFileInputLabel(f);

    try {
      statusEl.textContent = 'Loading object…';
      const name = String(f.name || '').toLowerCase();
      if (name.endsWith('.stl')) await loadObjectStl(f);
      else await loadObjectStep(f);

    } catch(e) {
      hideLoading();
      statusEl.textContent = 'Error.';
      showError(e);
    }
  });

  downloadBtn.addEventListener('click', () => {
    try {
      const instances = currentInstances.filter(i => !i.removed);
      if (!instances.length) throw new Error('No pegs to export.');

      const baseName = objectFileName
        ? objectFileName.replace(/\.[^.]+$/, '')
        : 'object';

      const fmt = getExportFormat();

      if (fmt === 'stl') {
        if (!objectMeshes.length || !pegGeometry) throw new Error('Nothing to export as STL.');

        const blob = buildBinaryStlBlob(instances);
        downloadBlob(blob, baseName + '_with_skadis_pegs_' + instances.length + '.stl');

        return;
      }

      if (!objectStepParts || !pegStepParts) throw new Error('STEP export requires a STEP object.');

      const objHeader = objectStepParts.header;
      const objData = objectStepParts.data;
      const objFooter = objectStepParts.footer;

      const scalePegToObj = pegMmPerUnit / objectMmPerUnit;
      const stride = pegMaxId + 500;
      const baseOffset = objectMaxId + 1;

      const qManual = manualRotationQuaternion();
      const blocks = [];

      for (let i = 0; i < instances.length; i++) {
        const face = instances[i].face;
        const baseMm = instances[i].base.clone().add(previewShift);
        const nPlace = instances[i].nPlace;
        const qAuto = basePegQuaternion(face.u, nPlace);
        const q = qAuto.clone().multiply(qManual);
        const minAlong = computeMinAlongNormalLocal(pegGeometry, q, nPlace);
        const seat = (-minAlong) - EMBED_MM;
        const tMm = baseMm.clone().add(nPlace.clone().multiplyScalar(seat));
        const tObj = [tMm.x / objectMmPerUnit, tMm.y / objectMmPerUnit, tMm.z / objectMmPerUnit];
        const rm4 = new THREE.Matrix4().makeRotationFromQuaternion(q);
        const e = rm4.elements;
        const R = [
          [e[0], e[4], e[8]],
          [e[1], e[5], e[9]],
          [e[2], e[6], e[10]],
        ];
        const idOffset = baseOffset + i * stride;

        blocks.push(transformPegDataBlock(pegStepParts.data, R, tObj, scalePegToObj, idOffset));
      }

      const merged = objHeader + "\n" + objData + "\n" + blocks.join("\n") + "\n" + objFooter;
      const blob = new Blob([merged], { type: 'model/step' });

      downloadBlob(blob, baseName + '_with_skadis_pegs_' + instances.length + '.step');
    } catch(e) {
      alert(e.message || String(e));
    }
  });

  function applyUrlState() {
    const initialPadMm = getPaddingMm('mm');
    const params = new URLSearchParams(window.location.search);

    if (params.has('unit')) unitSelect.value = params.get('unit');

    updateLimits();
    setPaddingUiFromMm(initialPadMm);

    if (params.has('h')) { hNum.value = params.get('h'); hRange.value = params.get('h'); }
    if (params.has('v')) { vNum.value = params.get('v'); vRange.value = params.get('v'); }
    if (params.has('offset') && row0OffsetEl) row0OffsetEl.value = params.get('offset');

    const peg = params.get('peg');
    setPegUi(peg);
    lastUnit = unitSelect.value;
  }

  try {
    initThree();
    applyUrlState();
    syncOriUI();
    updateBadges();
    updateDropHint();
	  updateExportUi();

	  statusEl.textContent = 'Ready. Drop a STEP or STL onto the preview, or use file input.';
    loadPegMaster(currentPegType).catch(showError);
    
  } catch(e) {
    showError(e);
  }
})();
