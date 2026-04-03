/**
 * ═══════════════════════════════════════════════════════
 * textures.js - Generador de texturas procedurales
 *
 * Genera texturas con Canvas 2D para no necesitar
 * archivos externos de imagen. Cada textura se
 * crea dibujando patrones en un <canvas> y luego
 * se convierte en THREE.CanvasTexture.
 *
 * Para añadir texturas reales: sustituir
 * THREE.TextureLoader().load('ruta/imagen.png')
 * ═══════════════════════════════════════════════════════
 */

const TextureGen = (() => {

  /** Crea un canvas con las dimensiones dadas */
  function makeCanvas(w = 256, h = 256) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // ────────────────────────────────────────────────
  // TEXTURA: SUELO (cemento / asfalto)
  // ────────────────────────────────────────────────
  function createFloor() {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');

    // Fondo base gris oscuro
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, 512, 512);

    // Cuadrícula de losas
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    const tile = 64;
    for (let x = 0; x <= 512; x += tile) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 0; y <= 512; y += tile) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }

    // Ruido / manchas
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      const rr = Math.random() * 3 + 1;
      const a  = Math.random() * 0.08;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  // ────────────────────────────────────────────────
  // TEXTURA: PARED (ladrillo / concreto)
  // ────────────────────────────────────────────────
  function createWall() {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');

    // Fondo base
    ctx.fillStyle = '#4a3f35';
    ctx.fillRect(0, 0, 512, 512);

    // Ladrillos
    const bw = 80, bh = 32;
    let row = 0;
    for (let y = 0; y < 512; y += bh + 4) {
      const offsetX = (row % 2 === 0) ? 0 : bw / 2;
      for (let x = -bw + offsetX; x < 512 + bw; x += bw + 4) {
        // Variación de color por ladrillo
        const bright = 0.85 + Math.random() * 0.3;
        const r = Math.floor(74 * bright);
        const g = Math.floor(63 * bright);
        const b = Math.floor(53 * bright);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, bw, bh);
      }
      row++;
    }

    // Juntas
    row = 0;
    ctx.strokeStyle = '#2a1f15';
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += bh + 4) {
      const offsetX = (row % 2 === 0) ? 0 : bw / 2;
      for (let x = -bw + offsetX; x < 512 + bw; x += bw + 4) {
        ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      }
      row++;
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  // ────────────────────────────────────────────────
  // TEXTURA: TECHO (metal / paneles)
  // ────────────────────────────────────────────────
  function createCeiling() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#1a1f22';
    ctx.fillRect(0, 0, 256, 256);

    // Paneles metálicos
    const pw = 64, ph = 64;
    for (let y = 0; y < 256; y += ph) {
      for (let x = 0; x < 256; x += pw) {
        const bright = 0.9 + Math.random() * 0.2;
        const v = Math.floor(30 * bright);
        ctx.fillStyle = `rgb(${v},${v+5},${v+8})`;
        ctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
      }
    }

    // Líneas de paneles
    ctx.strokeStyle = '#0a0d0f';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += pw) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += ph) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  // ────────────────────────────────────────────────
  // TEXTURA: ENEMIGO (piel / uniforme)
  // ────────────────────────────────────────────────
  function createEnemySkin() {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');

    // Cuerpo - uniforme militar oscuro
    ctx.fillStyle = '#2d3a1e';
    ctx.fillRect(0, 0, 128, 128);

    // Patrón camuflaje simple
    const spots = [
      '#1a2210', '#3a4a25', '#4a5530', '#232d15'
    ];
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const w = Math.random() * 20 + 5;
      const h = Math.random() * 15 + 5;
      ctx.fillStyle = spots[Math.floor(Math.random() * spots.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cara / cabeza (rojo-anaranjado)
    ctx.fillStyle = '#c47a55';
    ctx.fillRect(48, 8, 32, 28);

    return new THREE.CanvasTexture(c);
  }

  // ────────────────────────────────────────────────
  // TEXTURA: ARMA (metal)
  // ────────────────────────────────────────────────
  function createWeapon() {
    const c = makeCanvas(256, 128);
    const ctx = c.getContext('2d');

    // Metal oscuro
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#2a2a2a');
    grad.addColorStop(0.5, '#444');
    grad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Detalles del cañón
    ctx.fillStyle = '#111';
    ctx.fillRect(10, 55, 180, 18);

    // Brillo
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, 256, 3);

    return new THREE.CanvasTexture(c);
  }

  // ────────────────────────────────────────────────
  // API PÚBLICA
  // ────────────────────────────────────────────────
  return {
    floor:   createFloor,
    wall:    createWall,
    ceiling: createCeiling,
    enemy:   createEnemySkin,
    weapon:  createWeapon,
  };

})();
