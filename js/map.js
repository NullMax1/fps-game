/**
 * ═══════════════════════════════════════════════════════
 * map.js - Constructor del Mapa
 *
 * Crea el escenario del juego en Three.js:
 *  - Suelo, paredes exteriores, techo
 *  - Obstáculos interiores (cajones, pilares)
 *  - Iluminación (ambiente + direccional + puntos de luz)
 *  - Lista de colisionables para el jugador
 *
 * ¿Cómo crear un nuevo mapa?
 *  1. Modificar la función buildArena() o crear buildCity()
 *  2. Cambiar las texturas en TextureGen
 *  3. Ajustar MAP_SIZE y WALL_HEIGHT
 * ═══════════════════════════════════════════════════════
 */

const GameMap = (() => {

  const MAP_SIZE   = 40;  // radio del mapa (de -40 a +40)
  const WALL_HEIGHT = 5;
  const WALL_THICK  = 1;

  let scene        = null;
  let collidables  = [];  // lista de AABB para colisión con jugador

  // ────────────────────────────────────────────────
  // ILUMINACIÓN
  // ────────────────────────────────────────────────
  function setupLighting() {
    // Luz ambiente (iluminación base, sin sombras)
    const ambient = new THREE.AmbientLight(0x334455, 0.6);
    scene.add(ambient);

    // Luz direccional principal (simula el sol)
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near    = 0.5;
    sun.shadow.camera.far     = 100;
    sun.shadow.camera.left    = -MAP_SIZE;
    sun.shadow.camera.right   =  MAP_SIZE;
    sun.shadow.camera.top     =  MAP_SIZE;
    sun.shadow.camera.bottom  = -MAP_SIZE;
    scene.add(sun);

    // Puntos de luz naranja para atmósfera industrial
    const lampPositions = [
      {x:  15, y: 4.5, z:  15, color: 0xff9955, intensity: 1.2},
      {x: -15, y: 4.5, z:  15, color: 0xff9955, intensity: 1.2},
      {x:  15, y: 4.5, z: -15, color: 0xff9955, intensity: 1.2},
      {x: -15, y: 4.5, z: -15, color: 0xff9955, intensity: 1.2},
      {x:   0, y: 4.5, z:   0, color: 0xffffff, intensity: 0.8},
    ];

    for (const lp of lampPositions) {
      const light = new THREE.PointLight(lp.color, lp.intensity, 25);
      light.position.set(lp.x, lp.y, lp.z);
      light.castShadow = false; // desactivado para performance
      scene.add(light);

      // Objeto visible de la lámpara (esfera pequeña)
      const bulbGeo = new THREE.SphereGeometry(0.1, 6, 6);
      const bulbMat = new THREE.MeshBasicMaterial({ color: lp.color });
      const bulb    = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(lp.x, lp.y, lp.z);
      scene.add(bulb);
    }

    // Niebla de atmósfera
    scene.fog = new THREE.Fog(0x0a0f14, 20, 65);
    scene.background = new THREE.Color(0x0a0f14);
  }

  // ────────────────────────────────────────────────
  // SUELO
  // ────────────────────────────────────────────────
  function buildFloor() {
    const geo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const mat = new THREE.MeshStandardMaterial({
      map:        TextureGen.floor(),
      roughness:  0.9,
      metalness:  0.1,
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  // ────────────────────────────────────────────────
  // TECHO (opcional — puede omitirse para juegos abiertos)
  // ────────────────────────────────────────────────
  function buildCeiling() {
    const geo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const mat = new THREE.MeshStandardMaterial({
      map:       TextureGen.ceiling(),
      roughness: 0.8,
    });
    const ceiling = new THREE.Mesh(geo, mat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    scene.add(ceiling);
  }

  // ────────────────────────────────────────────────
  // PAREDES EXTERIORES
  // ────────────────────────────────────────────────
  function buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      map:        TextureGen.wall(),
      roughness:  0.85,
      metalness:  0.05,
    });

    const wallDefs = [
      // Norte
      { w: MAP_SIZE * 2 + WALL_THICK, h: WALL_HEIGHT, d: WALL_THICK,
        x: 0,          y: WALL_HEIGHT / 2, z: -MAP_SIZE,
        colMinX: -MAP_SIZE, colMaxX: MAP_SIZE, colMinZ: -MAP_SIZE - WALL_THICK, colMaxZ: -MAP_SIZE },
      // Sur
      { w: MAP_SIZE * 2 + WALL_THICK, h: WALL_HEIGHT, d: WALL_THICK,
        x: 0,          y: WALL_HEIGHT / 2, z:  MAP_SIZE,
        colMinX: -MAP_SIZE, colMaxX: MAP_SIZE, colMinZ: MAP_SIZE, colMaxZ: MAP_SIZE + WALL_THICK },
      // Este
      { w: WALL_THICK, h: WALL_HEIGHT, d: MAP_SIZE * 2,
        x:  MAP_SIZE,  y: WALL_HEIGHT / 2, z: 0,
        colMinX: MAP_SIZE, colMaxX: MAP_SIZE + WALL_THICK, colMinZ: -MAP_SIZE, colMaxZ: MAP_SIZE },
      // Oeste
      { w: WALL_THICK, h: WALL_HEIGHT, d: MAP_SIZE * 2,
        x: -MAP_SIZE,  y: WALL_HEIGHT / 2, z: 0,
        colMinX: -MAP_SIZE - WALL_THICK, colMaxX: -MAP_SIZE, colMinZ: -MAP_SIZE, colMaxZ: MAP_SIZE },
    ];

    for (const def of wallDefs) {
      const geo  = new THREE.BoxGeometry(def.w, def.h, def.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(def.x, def.y, def.z);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Colisión AABB
      collidables.push({
        minX: def.colMinX, maxX: def.colMaxX,
        minZ: def.colMinZ, maxZ: def.colMaxZ,
      });
    }
  }

  // ────────────────────────────────────────────────
  // OBSTÁCULOS INTERIORES (cajones, pilares, cajas)
  // ────────────────────────────────────────────────
  function buildObstacles() {
    const wallMat = new THREE.MeshStandardMaterial({
      map:       TextureGen.wall(),
      roughness: 0.9,
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      color:    0x3a3a40,
      roughness: 0.95,
    });

    // Definición de obstáculos: { x, z, w, h, d }
    const obstacles = [
      // Pilares esquinas
      { x:  10, z:  10, w: 2.5, h: 5, d: 2.5, mat: 'wall' },
      { x: -10, z:  10, w: 2.5, h: 5, d: 2.5, mat: 'wall' },
      { x:  10, z: -10, w: 2.5, h: 5, d: 2.5, mat: 'wall' },
      { x: -10, z: -10, w: 2.5, h: 5, d: 2.5, mat: 'wall' },

      // Cajas medianas (cover)
      { x:  6,  z:  0,  w: 2, h: 1.8, d: 2, mat: 'concrete' },
      { x: -6,  z:  0,  w: 2, h: 1.8, d: 2, mat: 'concrete' },
      { x:  0,  z:  6,  w: 4, h: 1.2, d: 1.5, mat: 'concrete' },
      { x:  0,  z: -6,  w: 4, h: 1.2, d: 1.5, mat: 'concrete' },

      // Muros laterales (cobertura media)
      { x:  20, z:  5,  w: 1, h: 2.5, d: 8, mat: 'wall' },
      { x: -20, z: -5,  w: 1, h: 2.5, d: 8, mat: 'wall' },
      { x:  5,  z:  20, w: 8, h: 2.5, d: 1, mat: 'wall' },
      { x: -5,  z: -20, w: 8, h: 2.5, d: 1, mat: 'wall' },

      // Muro central
      { x:  0, z:  0, w: 6, h: 3, d: 0.8, mat: 'wall' },

      // Tambores / barriles (cilindros)
      // (aproximados como cajas para la colisión)
      { x:  3,  z:  3, w: 0.9, h: 1.5, d: 0.9, mat: 'concrete', isCylinder: true },
      { x: -3,  z:  3, w: 0.9, h: 1.5, d: 0.9, mat: 'concrete', isCylinder: true },
      { x:  3,  z: -3, w: 0.9, h: 1.5, d: 0.9, mat: 'concrete', isCylinder: true },
    ];

    for (const obs of obstacles) {
      const mat = obs.mat === 'wall' ? wallMat : concreteMat;
      let mesh;

      if (obs.isCylinder) {
        const geo = new THREE.CylinderGeometry(obs.w / 2, obs.w / 2, obs.h, 12);
        mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color: 0x553322, roughness: 0.9,
        }));
      } else {
        const geo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
        mesh = new THREE.Mesh(geo, mat);
      }

      mesh.position.set(obs.x, obs.h / 2, obs.z);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // AABB de colisión
      const hw = (obs.w / 2);
      const hd = (obs.d / 2);
      collidables.push({
        minX: obs.x - hw, maxX: obs.x + hw,
        minZ: obs.z - hd, maxZ: obs.z + hd,
      });
    }
  }

  // ────────────────────────────────────────────────
  // DETALLES VISUALES (no colisionables)
  // ────────────────────────────────────────────────
  function buildDetails() {
    // Marcas en el suelo (líneas de zona de combate)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.3 });

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const geo   = new THREE.PlaneGeometry(0.15, 8);
      const mesh  = new THREE.Mesh(geo, lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = angle;
      mesh.position.y = 0.01;
      scene.add(mesh);
    }

    // Círculo central
    const circleGeo = new THREE.RingGeometry(3, 3.2, 32);
    const circle    = new THREE.Mesh(circleGeo, lineMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.01;
    scene.add(circle);
  }

  // ────────────────────────────────────────────────
  // INICIALIZACIÓN PRINCIPAL
  // ────────────────────────────────────────────────
  function build(threeScene) {
    scene       = threeScene;
    collidables = [];

    setupLighting();
    buildFloor();
    buildCeiling();
    buildWalls();
    buildObstacles();
    buildDetails();

    console.log('[GameMap] Mapa construido. Colisionables:', collidables.length);
    return collidables;
  }

  function getBounds() {
    return { minX: -MAP_SIZE, maxX: MAP_SIZE, minZ: -MAP_SIZE, maxZ: MAP_SIZE };
  }

  // API pública
  return {
    build,
    getBounds,
    getCollidables: () => collidables,
    MAP_SIZE,
    WALL_HEIGHT,
  };

})();
