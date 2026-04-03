/**
 * ═══════════════════════════════════════════════════════
 * player.js - Sistema del Jugador
 *
 * Responsabilidades:
 *  - Cámara en primera persona (yaw + pitch)
 *  - Movimiento con física básica (gravedad, salto)
 *  - Sprint
 *  - Sistema de vida (health)
 *  - Colisión con el mapa
 * ═══════════════════════════════════════════════════════
 */

const Player = (() => {

  // ── Constantes de física ──
  const WALK_SPEED   = 8;
  const SPRINT_SPEED = 14;
  const JUMP_FORCE   = 7;
  const GRAVITY      = 20;
  const MAX_HEALTH   = 100;
  const PLAYER_HEIGHT = 1.7;   // altura de la cámara sobre el suelo
  const EYE_BOB_SPEED = 8;     // velocidad del bob al caminar
  const EYE_BOB_AMP   = 0.04;  // amplitud del bob

  // ── Estado interno ──
  let camera = null;
  let health = MAX_HEALTH;
  let isAlive = true;
  let isDead   = false;

  // Física del jugador
  const vel = { x: 0, y: 0, z: 0 };   // velocidad actual
  let onGround = false;
  let bobTimer = 0;                     // timer para el head-bob

  // Rotación de cámara
  let yaw   = 0;  // horizontal (izquierda/derecha)
  let pitch = 0;  // vertical   (arriba/abajo)
  const MAX_PITCH = Math.PI / 2.2;  // límite para no girar 360° vertical

  // Límites del mapa (para colisión simple)
  let mapBounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };

  // Posición respawn
  const SPAWN = { x: 0, y: PLAYER_HEIGHT, z: 0 };

  // ────────────────────────────────────────────────
  // INICIALIZACIÓN
  // ────────────────────────────────────────────────
  function init(threeCamera, bounds) {
    camera = threeCamera;
    if (bounds) mapBounds = bounds;

    // Posición inicial
    camera.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
    health   = MAX_HEALTH;
    isAlive  = true;
    isDead   = false;
    yaw = pitch = 0;
    vel.x = vel.y = vel.z = 0;
    onGround = false;

    console.log('[Player] Inicializado en', SPAWN);
  }

  // ────────────────────────────────────────────────
  // UPDATE (llamar en el game loop, cada frame)
  // delta = tiempo en segundos desde el último frame
  // ────────────────────────────────────────────────
  function update(delta) {
    if (!camera || !isAlive) return;

    // 1. Leer entradas de controles
    const k = Controls.keys;
    const { dx, dy } = Controls.consumeMouseDelta();

    // 2. Rotar cámara con ratón / joystick derecho
    yaw   -= dx * Controls.mouse.sensitivity;
    pitch -= dy * Controls.mouse.sensitivity;
    pitch  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

    // Aplicar rotación
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // 3. Calcular dirección de movimiento según donde mira el jugador
    const speed = k.sprint ? SPRINT_SPEED : WALK_SPEED;
    const moveX = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const moveZ = (k.backward ? 1 : 0) - (k.forward ? 1 : 0);

    // Transformar movimiento según la orientación horizontal del jugador
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    vel.x = (cosY * moveX - sinY * moveZ) * speed;
    vel.z = (sinY * moveX + cosY * moveZ) * speed;

    // 4. Gravedad y salto
    if (!onGround) {
      vel.y -= GRAVITY * delta;
    }

    if (k.jump && onGround) {
      vel.y   = JUMP_FORCE;
      onGround = false;
    }

    // 5. Mover posición
    camera.position.x += vel.x * delta;
    camera.position.y += vel.y * delta;
    camera.position.z += vel.z * delta;

    // 6. Colisión con suelo
    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      vel.y   = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    // 7. Colisión con bordes del mapa
    const margin = 1.0;
    camera.position.x = Math.max(mapBounds.minX + margin,
                          Math.min(mapBounds.maxX - margin, camera.position.x));
    camera.position.z = Math.max(mapBounds.minZ + margin,
                          Math.min(mapBounds.maxZ - margin, camera.position.z));

    // 8. Head-bob (balanceo de cabeza al caminar)
    const isMoving = k.forward || k.backward || k.left || k.right;
    if (isMoving && onGround) {
      bobTimer += delta * EYE_BOB_SPEED * (k.sprint ? 1.5 : 1);
      const bobY = Math.sin(bobTimer) * EYE_BOB_AMP;
      camera.position.y += bobY;
    } else {
      // Suavizar al detenerse
      bobTimer *= 0.9;
    }
  }

  // ────────────────────────────────────────────────
  // SISTEMA DE VIDA
  // ────────────────────────────────────────────────
  function takeDamage(amount) {
    if (!isAlive) return;
    health -= amount;
    health = Math.max(0, health);
    UI.updateHealth(health, MAX_HEALTH);

    // Flash de daño
    UI.showDamageFlash();

    if (health <= 0) {
      die();
    }
  }

  function heal(amount) {
    health = Math.min(MAX_HEALTH, health + amount);
    UI.updateHealth(health, MAX_HEALTH);
  }

  function die() {
    isAlive = false;
    isDead  = true;
    // Bajar cámara como si cayera
    if (camera) {
      camera.rotation.z = Math.PI / 2 * 0.3; // ladearse al morir
    }
    // Notificar al juego
    setTimeout(() => { Game.onPlayerDead(); }, 1200);
  }

  // ────────────────────────────────────────────────
  // COLISIÓN CON PAREDES (cajas AABB)
  // collidables: array de { minX, maxX, minZ, maxZ }
  // ────────────────────────────────────────────────
  function checkWallCollisions(collidables) {
    if (!camera) return;
    const px = camera.position.x;
    const pz = camera.position.z;
    const r  = 0.5; // radio del jugador

    for (const box of collidables) {
      // Expandir el AABB por el radio del jugador
      const eMinX = box.minX - r;
      const eMaxX = box.maxX + r;
      const eMinZ = box.minZ - r;
      const eMaxZ = box.maxZ + r;

      if (px > eMinX && px < eMaxX && pz > eMinZ && pz < eMaxZ) {
        // Calcular la dirección de escape más corta
        const dLeft  = px - eMinX;
        const dRight = eMaxX - px;
        const dUp    = pz - eMinZ;
        const dDown  = eMaxZ - pz;
        const minDist = Math.min(dLeft, dRight, dUp, dDown);

        if (minDist === dLeft)  camera.position.x = eMinX;
        else if (minDist === dRight) camera.position.x = eMaxX;
        else if (minDist === dUp)    camera.position.z = eMinZ;
        else                         camera.position.z = eMaxZ;
      }
    }
  }

  // ────────────────────────────────────────────────
  // GETTERS
  // ────────────────────────────────────────────────
  function getPosition()  { return camera ? camera.position : { x: 0, y: 0, z: 0 }; }
  function getDirection() {
    if (!camera) return new THREE.Vector3(0, 0, -1);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir;
  }
  function getHealth()  { return health; }
  function getIsAlive() { return isAlive; }
  function getYaw()     { return yaw; }

  // API pública
  return {
    init,
    update,
    takeDamage,
    heal,
    checkWallCollisions,
    getPosition,
    getDirection,
    getHealth,
    getIsAlive,
    getYaw,
    MAX_HEALTH,
  };

})();
