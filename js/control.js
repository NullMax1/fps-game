/**
 * ═══════════════════════════════════════════════════════
 * controls.js - Sistema de controles (teclado, ratón y táctil)
 *
 * Maneja:
 *  - Keyboard: WASD, Space, Shift, R
 *  - Mouse: Pointer Lock + movimiento de cámara
 *  - Touch: Dos joysticks virtuales + botones de acción
 * ═══════════════════════════════════════════════════════
 */

const Controls = (() => {

  // ── Estado de entradas ──
  const keys = {
    forward:  false,
    backward: false,
    left:     false,
    right:    false,
    jump:     false,
    sprint:   false,
    shoot:    false,
    reload:   false,
  };

  // ── Datos del ratón / look joystick ──
  const mouse = {
    dx: 0,   // delta X acumulado por frame
    dy: 0,   // delta Y acumulado por frame
    sensitivity: 0.002,       // sensibilidad PC
    touchSensitivity: 0.004,  // sensibilidad táctil
  };

  // ── Datos joystick de movimiento (izquierdo) ──
  const moveJoy = {
    active: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
    dx: 0, dy: 0,
    identifier: -1,
    radius: 45,
  };

  // ── Datos joystick de visión (derecho) ──
  const lookJoy = {
    active: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
    identifier: -1,
    radius: 45,
  };

  let pointerLocked = false;
  let isMobile = false;

  // ────────────────────────────────────────────────
  // DETECCIÓN DE DISPOSITIVO
  // ────────────────────────────────────────────────
  function detectMobile() {
    isMobile = /Mobi|Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent)
      || window.matchMedia('(hover: none)').matches;
    return isMobile;
  }

  // ────────────────────────────────────────────────
  // TECLADO
  // ────────────────────────────────────────────────
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.forward  = true; break;
        case 'KeyS': case 'ArrowDown':  keys.backward = true; break;
        case 'KeyA': case 'ArrowLeft':  keys.left     = true; break;
        case 'KeyD': case 'ArrowRight': keys.right    = true; break;
        case 'Space':                   keys.jump     = true; e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': keys.sprint = true; break;
        case 'KeyR':                    keys.reload   = true; break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.forward  = false; break;
        case 'KeyS': case 'ArrowDown':  keys.backward = false; break;
        case 'KeyA': case 'ArrowLeft':  keys.left     = false; break;
        case 'KeyD': case 'ArrowRight': keys.right    = false; break;
        case 'Space':                   keys.jump     = false; break;
        case 'ShiftLeft': case 'ShiftRight': keys.sprint = false; break;
        case 'KeyR':                    keys.reload   = false; break;
      }
    });
  }

  // ────────────────────────────────────────────────
  // RATÓN + POINTER LOCK
  // ────────────────────────────────────────────────
  function initMouse(canvas) {
    // Click en canvas → solicitar pointer lock
    canvas.addEventListener('click', () => {
      if (!pointerLocked && !isMobile) {
        canvas.requestPointerLock();
      }
    });

    // Disparar con clic izquierdo
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && pointerLocked) keys.shoot = true;
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) keys.shoot = false;
    });

    // Cambio de estado del pointer lock
    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === canvas;
      document.body.classList.toggle('pointer-locked', pointerLocked);
    });

    // Movimiento del ratón → acumula deltas
    document.addEventListener('mousemove', (e) => {
      if (pointerLocked) {
        mouse.dx += e.movementX;
        mouse.dy += e.movementY;
      }
    });
  }

  // ────────────────────────────────────────────────
  // JOYSTICKS TÁCTILES
  // ────────────────────────────────────────────────
  function initTouchJoysticks() {
    const leftZone  = document.getElementById('joystick-left-zone');
    const rightZone = document.getElementById('joystick-right-zone');
    const leftBase  = document.getElementById('joystick-left-base');
    const rightBase = document.getElementById('joystick-right-base');
    const leftKnob  = document.getElementById('joystick-left-knob');
    const rightKnob = document.getElementById('joystick-right-knob');

    if (!leftZone) return;

    // ── Joystick Izquierdo (Movimiento) ──
    leftZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect  = leftZone.getBoundingClientRect();
      moveJoy.active     = true;
      moveJoy.identifier = touch.identifier;
      moveJoy.startX     = touch.clientX - rect.left;
      moveJoy.startY     = touch.clientY - rect.top;
      moveJoy.currentX   = moveJoy.startX;
      moveJoy.currentY   = moveJoy.startY;
      leftZone.classList.add('active');

      // Posicionar la base donde tocó el usuario
      leftBase.style.left = (moveJoy.startX - 55) + 'px';
      leftBase.style.bottom = (rect.height - moveJoy.startY - 55) + 'px';
    }, { passive: false });

    leftZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier !== moveJoy.identifier) continue;
        const rect = leftZone.getBoundingClientRect();
        moveJoy.currentX = touch.clientX - rect.left;
        moveJoy.currentY = touch.clientY - rect.top;

        let dx = moveJoy.currentX - moveJoy.startX;
        let dy = moveJoy.currentY - moveJoy.startY;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > moveJoy.radius) {
          dx = (dx / dist) * moveJoy.radius;
          dy = (dy / dist) * moveJoy.radius;
        }

        moveJoy.dx = dx / moveJoy.radius;
        moveJoy.dy = dy / moveJoy.radius;

        // Mover el knob visualmente
        leftKnob.style.transform = `translate(${dx}px, ${dy}px)`;

        // Actualizar teclas virtuales de movimiento
        keys.forward  = moveJoy.dy < -0.2;
        keys.backward = moveJoy.dy >  0.2;
        keys.left     = moveJoy.dx < -0.2;
        keys.right    = moveJoy.dx >  0.2;
      }
    }, { passive: false });

    const endLeft = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== moveJoy.identifier) continue;
        moveJoy.active = false;
        moveJoy.dx = moveJoy.dy = 0;
        leftKnob.style.transform = '';
        leftZone.classList.remove('active');
        keys.forward = keys.backward = keys.left = keys.right = false;
      }
    };
    leftZone.addEventListener('touchend',    endLeft, { passive: false });
    leftZone.addEventListener('touchcancel', endLeft, { passive: false });

    // ── Joystick Derecho (Mirar / Look) ──
    rightZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect  = rightZone.getBoundingClientRect();
      lookJoy.active     = true;
      lookJoy.identifier = touch.identifier;
      lookJoy.startX     = touch.clientX - rect.left;
      lookJoy.startY     = touch.clientY - rect.top;
      lookJoy.currentX   = lookJoy.startX;
      lookJoy.currentY   = lookJoy.startY;
      rightZone.classList.add('active');
      rightBase.style.right  = (rect.width - lookJoy.startX - 55) + 'px';
      rightBase.style.bottom = (rect.height - lookJoy.startY - 55) + 'px';
    }, { passive: false });

    rightZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier !== lookJoy.identifier) continue;
        const rect = rightZone.getBoundingClientRect();
        lookJoy.currentX = touch.clientX - rect.left;
        lookJoy.currentY = touch.clientY - rect.top;

        const dx = lookJoy.currentX - lookJoy.startX;
        const dy = lookJoy.currentY - lookJoy.startY;

        // Acumular deltas de visión táctil
        mouse.dx += dx * mouse.touchSensitivity * 10;
        mouse.dy += dy * mouse.touchSensitivity * 10;

        // Actualizar posición de inicio para movimiento relativo continuo
        lookJoy.startX = lookJoy.currentX;
        lookJoy.startY = lookJoy.currentY;

        // Mover knob visualmente (limitado)
        const dist = Math.sqrt(dx*dx + dy*dy);
        const clampDx = (dx / Math.max(dist, 1)) * Math.min(dist, lookJoy.radius);
        const clampDy = (dy / Math.max(dist, 1)) * Math.min(dist, lookJoy.radius);
        rightKnob.style.transform = `translate(${clampDx}px, ${clampDy}px)`;
      }
    }, { passive: false });

    const endRight = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== lookJoy.identifier) continue;
        lookJoy.active = false;
        rightKnob.style.transform = '';
        rightZone.classList.remove('active');
      }
    };
    rightZone.addEventListener('touchend',    endRight, { passive: false });
    rightZone.addEventListener('touchcancel', endRight, { passive: false });
  }

  // ────────────────────────────────────────────────
  // BOTONES DE ACCIÓN TÁCTILES
  // ────────────────────────────────────────────────
  function initActionButtons(callbacks) {
    const shoot  = document.getElementById('btn-shoot');
    const jump   = document.getElementById('btn-jump');
    const reload = document.getElementById('btn-reload');
    const sprint = document.getElementById('btn-sprint');

    if (!shoot) return;

    // Disparar (disparo continuo mientras está presionado)
    shoot.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.shoot = true;  }, { passive: false });
    shoot.addEventListener('touchend',    (e) => { e.preventDefault(); keys.shoot = false; }, { passive: false });
    shoot.addEventListener('touchcancel', (e) => { e.preventDefault(); keys.shoot = false; }, { passive: false });

    // Saltar
    jump.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.jump = true;  }, { passive: false });
    jump.addEventListener('touchend',    (e) => { e.preventDefault(); keys.jump = false; }, { passive: false });
    jump.addEventListener('touchcancel', (e) => { e.preventDefault(); keys.jump = false; }, { passive: false });

    // Recargar
    reload.addEventListener('touchstart', (e) => { e.preventDefault(); keys.reload = true;  setTimeout(() => { keys.reload = false; }, 100); }, { passive: false });

    // Sprint
    sprint.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.sprint = true;  }, { passive: false });
    sprint.addEventListener('touchend',    (e) => { e.preventDefault(); keys.sprint = false; }, { passive: false });
    sprint.addEventListener('touchcancel', (e) => { e.preventDefault(); keys.sprint = false; }, { passive: false });
  }

  // ────────────────────────────────────────────────
  // CONSUMIR DELTAS DE RATÓN (llamar cada frame)
  // ────────────────────────────────────────────────
  function consumeMouseDelta() {
    const dx = mouse.dx;
    const dy = mouse.dy;
    mouse.dx = 0;
    mouse.dy = 0;
    return { dx, dy };
  }

  // ────────────────────────────────────────────────
  // INICIALIZACIÓN PRINCIPAL
  // ────────────────────────────────────────────────
  function init(canvas) {
    detectMobile();
    initKeyboard();
    initMouse(canvas);
    initTouchJoysticks();
    initActionButtons();
    console.log('[Controls] Inicializado. Móvil:', isMobile);
  }

  // API pública
  return {
    init,
    keys,
    mouse,
    moveJoy,
    lookJoy,
    consumeMouseDelta,
    isPointerLocked: () => pointerLocked,
    isMobile: () => isMobile,
    sensitivity: (v) => { if (v !== undefined) mouse.sensitivity = v; return mouse.sensitivity; },
  };

})();
