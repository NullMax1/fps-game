/**
 * ═══════════════════════════════════════════════════════
 * weapon.js - Sistema de Armas
 *
 * Contiene:
 *  - Definición de armas (AK-47, Pistola)
 *  - Modelo 3D simple del arma visible en HUD
 *  - Sistema de disparo por Raycasting (sin balas físicas)
 *  - Sistema de munición y recarga
 *  - Animaciones básicas de retroceso (recoil)
 *
 * ¿Cómo agregar una nueva arma?
 *  1. Añadir entrada en WEAPON_DEFINITIONS
 *  2. Llamar Weapon.equip('nombreArma')
 * ═══════════════════════════════════════════════════════
 */

const Weapon = (() => {

  // ────────────────────────────────────────────────
  // DEFINICIÓN DE ARMAS
  // ────────────────────────────────────────────────
  const WEAPON_DEFINITIONS = {
    ak47: {
      name:       'AK-47',
      damage:     25,       // daño por bala
      fireRate:   0.1,      // segundos entre disparos (600 rpm)
      reloadTime: 2.2,      // segundos para recargar
      magSize:    30,       // balas por cargador
      reserveMax: 90,       // balas de reserva
      spread:     0.02,     // dispersión (0 = perfecto)
      auto:       true,     // disparo automático
      recoil:     0.015,    // fuerza de retroceso visual
    },
    pistol: {
      name:       'Pistola',
      damage:     35,
      fireRate:   0.4,
      reloadTime: 1.5,
      magSize:    12,
      reserveMax: 48,
      spread:     0.01,
      auto:       false,
      recoil:     0.008,
    },
  };

  // ── Estado del arma actual ──
  let currentDef  = null;
  let ammoInMag   = 0;
  let ammoReserve = 0;
  let fireTimer   = 0;      // tiempo hasta el próximo disparo
  let isReloading = false;
  let reloadTimer = 0;
  let recoilY     = 0;      // desplazamiento vertical por retroceso

  // Three.js
  let scene       = null;
  let camera      = null;
  let weaponMesh  = null;   // modelo 3D del arma
  let weaponGroup = null;   // contenedor con posición relativa a cámara
  let raycaster   = null;

  // Callback para comunicar hits de bala
  let onHitCallback = null;

  // ────────────────────────────────────────────────
  // CREAR MODELO 3D DEL ARMA
  // El arma se dibuja como un conjunto de geometrías simples
  // pegada a la cámara (view model)
  // ────────────────────────────────────────────────
  function buildWeaponModel() {
    if (weaponGroup) {
      camera.remove(weaponGroup);
      weaponGroup = null;
    }

    weaponGroup = new THREE.Group();
    const weaponTex = TextureGen.weapon();
    const mat = new THREE.MeshStandardMaterial({
      map:       weaponTex,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Cuerpo principal
    const bodyGeo = new THREE.BoxGeometry(0.12, 0.10, 0.5);
    const body    = new THREE.Mesh(bodyGeo, mat);
    weaponGroup.add(body);

    // Cañón
    const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.35, 8);
    const barrel    = new THREE.Mesh(barrelGeo, mat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.4);
    weaponGroup.add(barrel);

    // Mira delantera
    const sightGeo = new THREE.BoxGeometry(0.015, 0.03, 0.015);
    const sight    = new THREE.Mesh(sightGeo, new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
    sight.position.set(0, 0.07, -0.45);
    weaponGroup.add(sight);

    // Cargador
    const magGeo = new THREE.BoxGeometry(0.07, 0.15, 0.08);
    const mag    = new THREE.Mesh(magGeo, mat);
    mag.position.set(0, -0.12, -0.05);
    weaponGroup.add(mag);

    // Posición del arma en la vista (abajo a la derecha de la pantalla)
    weaponGroup.position.set(0.22, -0.22, -0.4);
    weaponGroup.rotation.y = -0.08;

    // Añadir el grupo al camera para que se mueva con ella
    camera.add(weaponGroup);
  }

  // ────────────────────────────────────────────────
  // EQUIPAR ARMA
  // ────────────────────────────────────────────────
  function equip(weaponKey) {
    const def = WEAPON_DEFINITIONS[weaponKey];
    if (!def) { console.warn('[Weapon] Arma no encontrada:', weaponKey); return; }

    currentDef  = def;
    ammoInMag   = def.magSize;
    ammoReserve = def.reserveMax;
    isReloading = false;
    fireTimer   = 0;

    buildWeaponModel();
    UI.updateAmmo(ammoInMag, ammoReserve, def.name);
    console.log('[Weapon] Equipado:', def.name);
  }

  // ────────────────────────────────────────────────
  // DISPARO - Raycasting
  // ────────────────────────────────────────────────
  function shoot(enemies) {
    if (!currentDef || isReloading || fireTimer > 0) return;
    if (ammoInMag <= 0) {
      // Sin balas → recargar automáticamente
      startReload();
      return;
    }

    // Si no es automática, solo dispara en el evento, no en hold
    // (esto lo maneja game.js comprobando Controls.keys.shoot solo una vez)

    // Gastar bala
    ammoInMag--;
    fireTimer = currentDef.fireRate;

    // Aplicar retroceso visual
    recoilY = currentDef.recoil * 8;

    // Mostrar flash de arma
    showMuzzleFlash();

    // Raycast desde el centro de la pantalla
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);

    // Spread (dispersión)
    if (currentDef.spread > 0) {
      raycaster.ray.direction.x += (Math.random() - 0.5) * currentDef.spread;
      raycaster.ray.direction.y += (Math.random() - 0.5) * currentDef.spread;
      raycaster.ray.direction.normalize();
    }

    // Verificar intersecciones con enemigos
    const enemyMeshes = enemies.map(e => e.mesh).filter(Boolean);
    const hits = raycaster.intersectObjects(enemyMeshes, true);

    if (hits.length > 0) {
      const hit = hits[0];
      // Encontrar qué enemigo fue golpeado
      for (const enemy of enemies) {
        if (enemy.mesh && (hit.object === enemy.mesh || enemy.mesh.getObjectById(hit.object.id))) {
          enemy.takeDamage(currentDef.damage);
          UI.showHitMarker();
          if (onHitCallback) onHitCallback(hit.point);
          break;
        }
      }
    }

    UI.updateAmmo(ammoInMag, ammoReserve, currentDef.name);
  }

  // ────────────────────────────────────────────────
  // RECARGA
  // ────────────────────────────────────────────────
  function startReload() {
    if (!currentDef || isReloading) return;
    if (ammoReserve <= 0) return;
    if (ammoInMag === currentDef.magSize) return; // ya lleno

    isReloading = true;
    reloadTimer = currentDef.reloadTime;
    UI.showReloading(true);
  }

  function finishReload() {
    const needed   = currentDef.magSize - ammoInMag;
    const taken    = Math.min(needed, ammoReserve);
    ammoInMag   += taken;
    ammoReserve -= taken;
    isReloading  = false;
    UI.showReloading(false);
    UI.updateAmmo(ammoInMag, ammoReserve, currentDef.name);
  }

  // ────────────────────────────────────────────────
  // FLASH DE BOCA (muzzle flash)
  // ────────────────────────────────────────────────
  let muzzleLight = null;

  function createMuzzleLight() {
    muzzleLight = new THREE.PointLight(0xffaa33, 0, 3);
    muzzleLight.position.set(0, 0.02, -0.65);
    if (weaponGroup) weaponGroup.add(muzzleLight);
  }

  function showMuzzleFlash() {
    if (!muzzleLight) return;
    muzzleLight.intensity = 3;
    setTimeout(() => { if (muzzleLight) muzzleLight.intensity = 0; }, 60);
  }

  // ────────────────────────────────────────────────
  // UPDATE (llamar cada frame)
  // ────────────────────────────────────────────────
  function update(delta, enemies, shootPressed) {
    if (!currentDef) return;

    // Countdown del fire rate
    if (fireTimer > 0) fireTimer -= delta;

    // Animación de retroceso
    if (recoilY > 0) {
      if (weaponGroup) {
        weaponGroup.position.y = -0.22 + recoilY;
        weaponGroup.position.z = -0.4 + recoilY * 2;
      }
      recoilY = Math.max(0, recoilY - delta * 0.3);
    } else {
      if (weaponGroup) {
        // Volver a posición original suavemente
        weaponGroup.position.y += (-0.22 - weaponGroup.position.y) * 0.3;
        weaponGroup.position.z += (-0.4  - weaponGroup.position.z) * 0.3;
      }
    }

    // Lógica de recarga
    if (isReloading) {
      reloadTimer -= delta;
      if (reloadTimer <= 0) finishReload();
      return; // no disparar mientras recarga
    }

    // Disparar (auto o semi-auto)
    if (shootPressed) {
      shoot(enemies);
    }
  }

  // ────────────────────────────────────────────────
  // INICIALIZACIÓN
  // ────────────────────────────────────────────────
  function init(threeScene, threeCamera, hitCallback) {
    scene          = threeScene;
    camera         = threeCamera;
    onHitCallback  = hitCallback;
    raycaster      = new THREE.Raycaster();
    raycaster.near = 0.1;
    raycaster.far  = 100;

    equip('ak47');  // arma por defecto al iniciar
    createMuzzleLight();
    console.log('[Weapon] Sistema inicializado');
  }

  // API pública
  return {
    init,
    update,
    equip,
    shoot,
    startReload,
    getAmmo:      () => ({ inMag: ammoInMag, reserve: ammoReserve }),
    isReloading:  () => isReloading,
    DEFINITIONS:  WEAPON_DEFINITIONS,
  };

})();
