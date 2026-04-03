/**
 * ═══════════════════════════════════════════════════════
 * game.js - Motor Principal del Juego
 *
 * Orquesta todos los sistemas:
 *  - Inicializa Three.js (renderer, escena, cámara)
 *  - Game loop con requestAnimationFrame
 *  - Gestión de estados (MENU, PLAYING, DEAD)
 *  - Comunicación entre módulos
 *  - Resize del canvas
 *
 * FLUJO DE EJECUCIÓN:
 *   1. DOMContentLoaded → UI.init()
 *   2. Botón JUGAR → Game.start()
 *   3. Game.start() → initThreeJS() + initSystems() + gameLoop()
 *   4. gameLoop() → update() + render() en cada frame
 * ═══════════════════════════════════════════════════════
 */

const Game = (() => {

  // ── Estado global del juego ──
  const STATES = { MENU: 'MENU', PLAYING: 'PLAYING', DEAD: 'DEAD' };
  let state = STATES.MENU;

  // ── Three.js ──
  let renderer = null;
  let scene    = null;
  let camera   = null;

  // ── Tiempo ──
  let lastTime  = 0;
  let rafHandle = null;

  // ── Disparos: gestión semi-auto ──
  let prevShootKey = false;

  // ────────────────────────────────────────────────
  // INICIALIZAR THREE.JS
  // ────────────────────────────────────────────────
  function initThreeJS() {
    const canvas = document.getElementById('game-canvas');

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:   false, // desactivado para performance en móvil
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // max 2x para rendimiento
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.BasicShadowMap; // más rápido que PCFSoft
    renderer.outputEncoding    = THREE.sRGBEncoding;

    // Escena
    scene = new THREE.Scene();

    // Cámara en primera persona
    camera = new THREE.PerspectiveCamera(
      75,                                         // fov
      window.innerWidth / window.innerHeight,     // aspect
      0.05,                                       // near
      150                                         // far
    );

    // Resize responsivo
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    console.log('[Game] Three.js inicializado');
  }

  // ────────────────────────────────────────────────
  // INICIALIZAR TODOS LOS SISTEMAS
  // ────────────────────────────────────────────────
  function initSystems() {
    // 1. Controles (teclado/mouse/táctil)
    Controls.init(renderer.domElement);

    // 2. Mapa → retorna la lista de colisionables
    const collidables = GameMap.build(scene);

    // 3. Jugador → necesita la cámara y los límites del mapa
    Player.init(camera, GameMap.getBounds());

    // 4. Arma → necesita escena, cámara
    Weapon.init(scene, camera);

    // 5. Enemigos → necesita la escena
    EnemyManager.init(scene);

    // 6. HUD inicial
    UI.updateHealth(Player.getHealth(), Player.MAX_HEALTH);
    UI.updateAmmo(30, 90, 'AK-47');
    UI.updateScore(0);

    console.log('[Game] Todos los sistemas inicializados');
  }

  // ────────────────────────────────────────────────
  // GAME LOOP PRINCIPAL
  // ────────────────────────────────────────────────
  function gameLoop(timestamp) {
    if (state !== STATES.PLAYING) return;
    rafHandle = requestAnimationFrame(gameLoop);

    // Calcular delta time (máximo 0.1s para evitar saltos grandes)
    const delta  = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // ── UPDATE ──
    update(delta);

    // ── RENDER ──
    renderer.render(scene, camera);
  }

  // ────────────────────────────────────────────────
  // UPDATE FRAME
  // ────────────────────────────────────────────────
  function update(delta) {
    // 1. Jugador (movimiento, cámara, salud)
    Player.update(delta);

    // 2. Colisiones jugador-mapa
    Player.checkWallCollisions(GameMap.getCollidables());

    // 3. Disparo: detectar flanco de subida para semi-auto
    const shootNow = Controls.keys.shoot;
    const shootJustPressed = shootNow && !prevShootKey; // para semi-auto

    // 4. Arma (retroceso, recarga, disparo)
    Weapon.update(
      delta,
      EnemyManager.getEnemies(),
      shootNow  // el arma internamente comprueba si es auto o semi
    );
    prevShootKey = shootNow;

    // 5. Tecla R → recargar
    if (Controls.keys.reload) {
      Weapon.startReload();
      Controls.keys.reload = false; // consumir para no recargar infinitamente
    }

    // 6. Enemigos (IA, ataques, animaciones)
    EnemyManager.update(delta);
  }

  // ────────────────────────────────────────────────
  // INICIAR JUEGO
  // ────────────────────────────────────────────────
  function start() {
    if (state === STATES.PLAYING) return;

    // Si ya había una partida, resetear sistemas
    if (renderer) {
      EnemyManager.reset();
      Player.init(camera, GameMap.getBounds());
      Weapon.equip('ak47');
      UI.updateScore(0);
    } else {
      // Primera vez: inicializar todo Three.js
      initThreeJS();
      initSystems();
    }

    state = STATES.PLAYING;
    lastTime = performance.now();
    UI.showGameScreen();
    rafHandle = requestAnimationFrame(gameLoop);
    console.log('[Game] Juego iniciado');
  }

  // ────────────────────────────────────────────────
  // GAME OVER (llamado por Player cuando muere)
  // ────────────────────────────────────────────────
  function onPlayerDead() {
    if (state !== STATES.PLAYING) return;
    state = STATES.DEAD;
    cancelAnimationFrame(rafHandle);
    const kills = EnemyManager.getKillCount();
    UI.showGameOver(kills);
    console.log('[Game] Game Over. Kills:', kills);
  }

  // ────────────────────────────────────────────────
  // PANTALLA COMPLETA
  // ────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('[Game] Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // ────────────────────────────────────────────────
  // BOTONES DE UI
  // ────────────────────────────────────────────────
  function bindButtons() {
    document.getElementById('btn-start')?.addEventListener('click', () => {
      start();
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      toggleFullscreen();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      start();
    });
  }

  // ────────────────────────────────────────────────
  // ARRANQUE DE LA APLICACIÓN
  // ────────────────────────────────────────────────
  function bootstrap() {
    UI.init();
    UI.showStartScreen();
    bindButtons();
    console.log('[Game] Listo. Esperando al jugador...');
  }

  // Arrancar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // API pública (usada por otros módulos)
  return {
    start,
    onPlayerDead,
    toggleFullscreen,
    getState: () => state,
    STATES,
  };

})();
