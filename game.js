import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Game state
const gameState = {
    player: {
        position: { x: 0, y: 1, z: 0 },
        rotation: 0,
        inventory: [],
        nearbyObjects: [],
        keys: 0, // Track number of keys collected
        isMoving: false, // Track if player is moving for animations
        moveDirection: { x: 0, z: 0 }, // Track movement direction for character rotation
        characterRotation: 0 // Target rotation for character model
    },
    objects: [],
    doors: [],
    floatingKeys: [], // Track floating key objects for animation
    animations: {
        mixer: null,
        actions: {},
        current: null
    }
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a7d3a });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Player setup
const playerGroup = new THREE.Group();
let characterModel = null;
let useCharacterModel = false;

// Create fallback capsule player
const capsuleGeometry = new THREE.CapsuleGeometry(0.5, 1, 8, 16);
const capsuleMaterial = new THREE.MeshStandardMaterial({ color: 0x4a90e2 });
const playerMesh = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
playerMesh.castShadow = true;
playerMesh.position.y = 1;
playerGroup.add(playerMesh);

// Player direction indicator
const arrowGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
arrow.rotation.x = Math.PI / 2;
arrow.position.set(0, 1, -0.8);
playerGroup.add(arrow);

scene.add(playerGroup);

// Load character model from Mixamo FBX files
const fbxLoader = new FBXLoader();

// Load the character model (Y Bot with T-pose)
fbxLoader.load(
    '/Y Bot.fbx',
    (fbx) => {
        characterModel = fbx;

        // Scale down the Mixamo character (they're usually quite large)
        characterModel.scale.set(0.01, 0.01, 0.01);

        // Position on the ground - adjust Y to compensate for model height
        characterModel.position.set(0, -1, 0);

        // Enable shadows
        characterModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // Hide capsule and arrow, show character
        playerMesh.visible = false;
        arrow.visible = false;
        playerGroup.add(characterModel);
        useCharacterModel = true;

        // Setup animation mixer
        gameState.animations.mixer = new THREE.AnimationMixer(characterModel);

        console.log('Character model loaded!');

        // Load animations
        loadIdleAnimation();
        loadWalkAnimation();
    },
    (progress) => {
        console.log('Loading character model:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
    },
    (error) => {
        console.error('Could not load character model, using capsule fallback:', error);
        useCharacterModel = false;
    }
);

// Load idle animation
function loadIdleAnimation() {
    fbxLoader.load(
        '/Idle.fbx',
        (fbx) => {
            if (fbx.animations && fbx.animations.length > 0) {
                const idleClip = fbx.animations[0];
                idleClip.name = 'Idle';

                // Apply the idle animation to our character model
                const idleAction = gameState.animations.mixer.clipAction(idleClip);
                gameState.animations.actions['Idle'] = idleAction;
                idleAction.play();
                gameState.animations.current = 'Idle';

                console.log('Idle animation loaded!');
            }
        },
        (progress) => {
            console.log('Loading idle animation:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
            console.error('Could not load idle animation:', error);
        }
    );
}

// Load walking animation
function loadWalkAnimation() {
    fbxLoader.load(
        '/Walking.fbx',
        (fbx) => {
            if (fbx.animations && fbx.animations.length > 0) {
                const walkClip = fbx.animations[0];
                walkClip.name = 'Walk';

                // Apply the walk animation to our character model
                const walkAction = gameState.animations.mixer.clipAction(walkClip);

                // Slow down the animation to match character movement speed
                // Adjust this value to match your movement speed (lower = slower)
                walkAction.timeScale = 0.6;

                gameState.animations.actions['Walk'] = walkAction;

                console.log('Walk animation loaded! Available animations:', Object.keys(gameState.animations.actions));
            }
        },
        (progress) => {
            console.log('Loading walk animation:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
            console.error('Could not load walk animation:', error);
        }
    );
}

// Create interactive cubes
const cubeTypes = [
    { color: 0xff6b6b, type: 'red', pickupable: true },
    { color: 0x4ecdc4, type: 'cyan', pickupable: true },
    { color: 0xffe66d, type: 'yellow', pickupable: false },
    { color: 0x95e1d3, type: 'green', pickupable: true }
];

function createCube(x, z, type) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: type.color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, 0.5, z);
    cube.castShadow = true;
    cube.receiveShadow = true;

    const cubeData = {
        mesh: cube,
        type: type.type,
        pickupable: type.pickupable,
        id: `cube_${x}_${z}_${type.type}`
    };

    scene.add(cube);
    gameState.objects.push(cubeData);

    return cube;
}

// Create floating key cubes
function createKey(x, z) {
    const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffd700, // Gold color
        emissive: 0xffd700,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
    });
    const key = new THREE.Mesh(geometry, material);
    key.position.set(x, 1.5, z); // Start at 1.5 height
    key.castShadow = true;
    key.receiveShadow = true;

    const keyData = {
        mesh: key,
        type: 'key',
        pickupable: true,
        id: `key_${x}_${z}`,
        floatOffset: Math.random() * Math.PI * 2, // Random start phase
        baseY: 1.5
    };

    scene.add(key);
    gameState.objects.push(keyData);
    gameState.floatingKeys.push(keyData);

    return key;
}

// Create doors
function createDoor(x, z, rotation = 0) {
    const doorGroup = new THREE.Group();

    // Door frame
    const frameGeometry = new THREE.BoxGeometry(0.2, 3, 2.2);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown

    const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    leftFrame.position.set(-1.1, 1.5, 0);
    leftFrame.castShadow = true;
    doorGroup.add(leftFrame);

    const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    rightFrame.position.set(1.1, 1.5, 0);
    rightFrame.castShadow = true;
    doorGroup.add(rightFrame);

    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.3, 2.2),
        frameMaterial
    );
    topFrame.position.set(0, 3, 0);
    topFrame.castShadow = true;
    doorGroup.add(topFrame);

    // Door itself
    const doorGeometry = new THREE.BoxGeometry(2, 2.8, 0.2);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        metalness: 0.3,
        roughness: 0.7
    });
    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    doorMesh.position.set(0, 1.5, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    doorGroup.add(doorMesh);

    // Lock indicator (changes color when unlocked)
    const lockGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const lockMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    const lock = new THREE.Mesh(lockGeometry, lockMaterial);
    lock.position.set(0.7, 1.5, 0.15);
    doorGroup.add(lock);

    doorGroup.position.set(x, 0, z);
    doorGroup.rotation.y = rotation;
    scene.add(doorGroup);

    const doorData = {
        mesh: doorGroup,
        doorMesh: doorMesh,
        lock: lock,
        type: 'door',
        pickupable: false,
        locked: true,
        opening: false,
        openProgress: 0,
        id: `door_${x}_${z}`
    };

    gameState.objects.push(doorData);
    gameState.doors.push(doorData);

    return doorGroup;
}

// Place cubes around the scene
createCube(5, 5, cubeTypes[0]);
createCube(-5, 5, cubeTypes[1]);
createCube(5, -5, cubeTypes[2]);
createCube(-5, -5, cubeTypes[3]);
createCube(0, 8, cubeTypes[0]);
createCube(8, 0, cubeTypes[1]);

// Place floating keys
createKey(3, 3);
createKey(-3, -3);
createKey(6, -6);

// Place doors
createDoor(10, 0, Math.PI / 2); // Door on the right
createDoor(-10, 0, Math.PI / 2); // Door on the left
createDoor(0, 10, 0); // Door at the back

// Camera setup
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Input handling
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    arrowup: false,
    arrowdown: false,
    arrowleft: false,
    arrowright: false,
    e: false,
    q: false
};

const mouse = {
    x: 0,
    y: 0,
    isDown: false
};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;

        // Handle single press actions
        if (key === 'e') {
            interact();
        }
        if (key === 'q') {
            pickup();
        }
    }
});

window.addEventListener('mousemove', (e) => {
    if (mouse.isDown) {
        mouse.x = (e.movementX || 0) * 0.002;
        mouse.y = (e.movementY || 0) * 0.002;
    }
});

window.addEventListener('mousedown', () => {
    mouse.isDown = true;
    if (renderer.domElement.requestPointerLock) {
        renderer.domElement.requestPointerLock();
    }
});

window.addEventListener('mouseup', () => {
    mouse.isDown = false;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Touch controls for mobile
const touch = {
    camera: {
        active: false,
        startX: 0,
        startY: 0,
        identifier: null
    },
    joystick: {
        active: false,
        x: 0,
        y: 0,
        identifier: null
    }
};

// Touch event for camera rotation
let cameraRotationTouch = null;

renderer.domElement.addEventListener('touchstart', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touchEvent = e.changedTouches[i];
        // Only use touches on the upper part of the screen for camera
        if (touchEvent.clientY < window.innerHeight - 250) {
            if (!cameraRotationTouch) {
                cameraRotationTouch = {
                    identifier: touchEvent.identifier,
                    lastX: touchEvent.clientX,
                    lastY: touchEvent.clientY
                };
            }
        }
    }
});

renderer.domElement.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touchEvent = e.changedTouches[i];
        if (cameraRotationTouch && touchEvent.identifier === cameraRotationTouch.identifier) {
            const deltaX = touchEvent.clientX - cameraRotationTouch.lastX;
            const deltaY = touchEvent.clientY - cameraRotationTouch.lastY;

            gameState.player.rotation -= deltaX * 0.005;

            cameraRotationTouch.lastX = touchEvent.clientX;
            cameraRotationTouch.lastY = touchEvent.clientY;
        }
    }
}, { passive: false });

renderer.domElement.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touchEvent = e.changedTouches[i];
        if (cameraRotationTouch && touchEvent.identifier === cameraRotationTouch.identifier) {
            cameraRotationTouch = null;
        }
    }
});

renderer.domElement.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touchEvent = e.changedTouches[i];
        if (cameraRotationTouch && touchEvent.identifier === cameraRotationTouch.identifier) {
            cameraRotationTouch = null;
        }
    }
});

// Joystick handling
const joystickContainer = document.getElementById('joystick-container');
const joystickStick = document.getElementById('joystick-stick');
const joystickBase = document.getElementById('joystick-base');

let joystickTouch = null;
const joystickMaxDistance = 35; // pixels from center

if (joystickContainer) {
    joystickContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!joystickTouch && e.touches.length > 0) {
            joystickTouch = e.touches[0].identifier;
            updateJoystick(e.touches[0]);
        }
    }, { passive: false });

    joystickContainer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === joystickTouch) {
                updateJoystick(e.touches[i]);
                break;
            }
        }
    }, { passive: false });

    joystickContainer.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouch) {
                joystickTouch = null;
                touch.joystick.active = false;
                touch.joystick.x = 0;
                touch.joystick.y = 0;
                joystickStick.style.transform = 'translate(0px, 0px)';
                break;
            }
        }
    }, { passive: false });

    joystickContainer.addEventListener('touchcancel', (e) => {
        joystickTouch = null;
        touch.joystick.active = false;
        touch.joystick.x = 0;
        touch.joystick.y = 0;
        joystickStick.style.transform = 'translate(0px, 0px)';
    }, { passive: false });
}

function updateJoystick(touchEvent) {
    const rect = joystickContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = touchEvent.clientX - centerX;
    let deltaY = touchEvent.clientY - centerY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > joystickMaxDistance) {
        const angle = Math.atan2(deltaY, deltaX);
        deltaX = Math.cos(angle) * joystickMaxDistance;
        deltaY = Math.sin(angle) * joystickMaxDistance;
    }

    touch.joystick.active = true;
    touch.joystick.x = deltaX / joystickMaxDistance;
    touch.joystick.y = -deltaY / joystickMaxDistance; // Invert Y for natural forward/back

    joystickStick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
}

// Action buttons
const interactBtn = document.querySelector('.action-btn.interact');
const pickupBtn = document.querySelector('.action-btn.pickup');

if (interactBtn) {
    interactBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        interact();
    }, { passive: false });
}

if (pickupBtn) {
    pickupBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pickup();
    }, { passive: false });
}

// Game functions
function movePlayer(direction) {
    const speed = 0.1;
    const rad = gameState.player.rotation;

    switch(direction) {
        case 'forward':
            gameState.player.position.x -= Math.sin(rad) * speed;
            gameState.player.position.z -= Math.cos(rad) * speed;
            break;
        case 'backward':
            gameState.player.position.x += Math.sin(rad) * speed;
            gameState.player.position.z += Math.cos(rad) * speed;
            break;
        case 'left':
            gameState.player.position.x -= Math.cos(rad) * speed;
            gameState.player.position.z += Math.sin(rad) * speed;
            break;
        case 'right':
            gameState.player.position.x += Math.cos(rad) * speed;
            gameState.player.position.z -= Math.sin(rad) * speed;
            break;
    }

    updateStatus(`Moved ${direction}`);
}

function rotatePlayer(direction) {
    const rotSpeed = 0.03;
    if (direction === 'left') {
        gameState.player.rotation += rotSpeed;
    } else if (direction === 'right') {
        gameState.player.rotation -= rotSpeed;
    }
}

// Animation control
function playAnimation(animationName) {
    if (!gameState.animations.mixer || !gameState.animations.actions[animationName]) {
        return;
    }

    // If already playing this animation, do nothing
    if (gameState.animations.current === animationName) {
        return;
    }

    const newAction = gameState.animations.actions[animationName];
    const oldAction = gameState.animations.current ? gameState.animations.actions[gameState.animations.current] : null;

    if (oldAction) {
        oldAction.fadeOut(0.3);
    }

    newAction.reset().fadeIn(0.3).play();
    gameState.animations.current = animationName;
}

function updatePlayerAnimation(isMoving) {
    if (!gameState.animations.mixer) return;

    // Find walk and idle animations
    const walkNames = ['Walk', 'walk', 'Walking', 'walking', 'Run', 'run'];
    const idleNames = ['Idle', 'idle', 'T-Pose', 'TPose'];

    if (isMoving) {
        // Try to play walk animation
        for (const name of walkNames) {
            if (gameState.animations.actions[name]) {
                playAnimation(name);
                return;
            }
        }
    } else {
        // Try to play idle animation
        for (const name of idleNames) {
            if (gameState.animations.actions[name]) {
                playAnimation(name);
                return;
            }
        }
    }
}

function pickup() {
    const nearby = findNearbyObjects();

    if (nearby.length === 0) {
        updateStatus('No objects nearby to pickup');
        return;
    }

    const pickupable = nearby.find(obj => obj.pickupable);

    if (pickupable) {
        // Special handling for keys
        if (pickupable.type === 'key') {
            gameState.player.keys++;
            updateKeyCount();
            scene.remove(pickupable.mesh);
            gameState.objects = gameState.objects.filter(obj => obj.id !== pickupable.id);
            gameState.floatingKeys = gameState.floatingKeys.filter(obj => obj.id !== pickupable.id);
            updateStatus(`Picked up key! Keys: ${gameState.player.keys}`);
        } else {
            gameState.player.inventory.push(pickupable);
            scene.remove(pickupable.mesh);
            gameState.objects = gameState.objects.filter(obj => obj.id !== pickupable.id);
            updateStatus(`Picked up ${pickupable.type} cube`);
        }
    } else {
        updateStatus('No pickupable objects nearby');
    }
}

function interact() {
    const nearby = findNearbyObjects();

    if (nearby.length === 0) {
        updateStatus('Nothing to interact with');
        return;
    }

    const obj = nearby[0];

    // Special handling for doors
    if (obj.type === 'door') {
        if (obj.locked) {
            if (gameState.player.keys > 0) {
                // Unlock and open the door
                gameState.player.keys--;
                updateKeyCount();
                obj.locked = false;
                obj.opening = true;

                // Change lock color to green
                obj.lock.material.color.setHex(0x00ff00);
                obj.lock.material.emissive.setHex(0x00ff00);

                updateStatus(`Door unlocked! Keys remaining: ${gameState.player.keys}`);
            } else {
                updateStatus('Door is locked! Need a key.');
            }
        } else {
            updateStatus('Door is already unlocked!');
        }
        return;
    }

    // Default interaction for other objects
    updateStatus(`Interacting with ${obj.type}`);

    // Visual feedback
    if (obj.mesh.material && obj.mesh.material.emissive) {
        obj.mesh.material.emissive.setHex(0x444444);
        setTimeout(() => {
            if (obj.mesh.material) {
                obj.mesh.material.emissive.setHex(0x000000);
            }
        }, 200);
    }
}

function findNearbyObjects() {
    const interactionDistance = 2;
    const nearby = [];

    for (const obj of gameState.objects) {
        const dx = obj.mesh.position.x - gameState.player.position.x;
        const dz = obj.mesh.position.z - gameState.player.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < interactionDistance) {
            nearby.push(obj);
        }
    }

    gameState.player.nearbyObjects = nearby;
    return nearby;
}

function updateStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = `Status: ${message}`;
    }
}

function updateKeyCount() {
    const keyCountEl = document.getElementById('key-count');
    if (keyCountEl) {
        keyCountEl.textContent = gameState.player.keys;
    }
}

// Game loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Track if player is moving for animations
    let isMoving = false;

    // Reset movement direction
    gameState.player.moveDirection.x = 0;
    gameState.player.moveDirection.z = 0;

    // Handle movement
    const rad = gameState.player.rotation;
    const speed = 0.1;

    if (keys.w || keys.arrowup) {
        gameState.player.position.x -= Math.sin(rad) * speed;
        gameState.player.position.z -= Math.cos(rad) * speed;
        gameState.player.moveDirection.x -= Math.sin(rad);
        gameState.player.moveDirection.z -= Math.cos(rad);
        isMoving = true;
    }
    if (keys.s || keys.arrowdown) {
        gameState.player.position.x += Math.sin(rad) * speed;
        gameState.player.position.z += Math.cos(rad) * speed;
        gameState.player.moveDirection.x += Math.sin(rad);
        gameState.player.moveDirection.z += Math.cos(rad);
        isMoving = true;
    }
    if (keys.a) {
        gameState.player.position.x -= Math.cos(rad) * speed;
        gameState.player.position.z += Math.sin(rad) * speed;
        gameState.player.moveDirection.x -= Math.cos(rad);
        gameState.player.moveDirection.z += Math.sin(rad);
        isMoving = true;
    }
    if (keys.d) {
        gameState.player.position.x += Math.cos(rad) * speed;
        gameState.player.position.z -= Math.sin(rad) * speed;
        gameState.player.moveDirection.x += Math.cos(rad);
        gameState.player.moveDirection.z -= Math.sin(rad);
        isMoving = true;
    }
    if (keys.arrowleft) rotatePlayer('left');
    if (keys.arrowright) rotatePlayer('right');

    // Mouse rotation
    if (mouse.isDown) {
        gameState.player.rotation -= mouse.x;
        mouse.x = 0;
        mouse.y = 0;
    }

    // Handle joystick input (mobile)
    if (touch.joystick.active) {
        // Forward/backward based on joystick Y
        if (Math.abs(touch.joystick.y) > 0.1) {
            gameState.player.position.x -= Math.sin(rad) * speed * touch.joystick.y;
            gameState.player.position.z -= Math.cos(rad) * speed * touch.joystick.y;
            gameState.player.moveDirection.x -= Math.sin(rad) * touch.joystick.y;
            gameState.player.moveDirection.z -= Math.cos(rad) * touch.joystick.y;
            isMoving = true;
        }

        // Left/right based on joystick X
        if (Math.abs(touch.joystick.x) > 0.1) {
            gameState.player.position.x += Math.cos(rad) * speed * touch.joystick.x;
            gameState.player.position.z -= Math.sin(rad) * speed * touch.joystick.x;
            gameState.player.moveDirection.x += Math.cos(rad) * touch.joystick.x;
            gameState.player.moveDirection.z -= Math.sin(rad) * touch.joystick.x;
            isMoving = true;
        }
    }

    // Update character rotation to face movement direction
    if (isMoving && characterModel) {
        const targetRotation = Math.atan2(gameState.player.moveDirection.x, gameState.player.moveDirection.z);
        gameState.player.characterRotation = targetRotation;

        // Smoothly interpolate character rotation
        const currentRotation = characterModel.rotation.y;
        let rotationDiff = targetRotation - currentRotation;

        // Normalize angle difference to [-PI, PI]
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

        // Apply smooth rotation (lerp)
        characterModel.rotation.y += rotationDiff * 0.15;
    }

    // Update character animations
    updatePlayerAnimation(isMoving);
    if (gameState.animations.mixer) {
        gameState.animations.mixer.update(delta);
    }

    // Update player position and rotation
    playerGroup.position.set(
        gameState.player.position.x,
        gameState.player.position.y,
        gameState.player.position.z
    );
    playerGroup.rotation.y = gameState.player.rotation;

    // Camera follows player
    const cameraDistance = 8;
    const cameraHeight = 5;
    camera.position.x = gameState.player.position.x + Math.sin(gameState.player.rotation) * cameraDistance;
    camera.position.y = gameState.player.position.y + cameraHeight;
    camera.position.z = gameState.player.position.z + Math.cos(gameState.player.rotation) * cameraDistance;
    camera.lookAt(playerGroup.position);

    // Animate floating keys
    const time = Date.now() * 0.001; // Convert to seconds
    for (const keyObj of gameState.floatingKeys) {
        // Float up and down
        const floatAmount = Math.sin(time * 2 + keyObj.floatOffset) * 0.3;
        keyObj.mesh.position.y = keyObj.baseY + floatAmount;

        // Rotate and sway
        keyObj.mesh.rotation.y = time * 0.5 + keyObj.floatOffset;
        keyObj.mesh.rotation.x = Math.sin(time * 1.5 + keyObj.floatOffset) * 0.2;
        keyObj.mesh.rotation.z = Math.cos(time * 1.3 + keyObj.floatOffset) * 0.2;
    }

    // Animate door opening
    for (const door of gameState.doors) {
        if (door.opening && door.openProgress < 1) {
            door.openProgress += 0.02; // Opening speed

            if (door.openProgress >= 1) {
                door.openProgress = 1;
            }

            // Slide door upward
            door.doorMesh.position.y = 1.5 + (door.openProgress * 3);
            // Also fade out the door
            door.doorMesh.material.opacity = 1 - door.openProgress;
            door.doorMesh.material.transparent = true;
        }
    }

    // Check for nearby objects
    findNearbyObjects();

    renderer.render(scene, camera);
}

animate();

// Export game API for MCP integration (future use)
window.gameAPI = {
    moveLeft: () => movePlayer('left'),
    moveRight: () => movePlayer('right'),
    moveForward: () => movePlayer('forward'),
    moveBackward: () => movePlayer('backward'),
    pickup: pickup,
    interact: interact,
    getState: () => ({
        player: {
            position: { ...gameState.player.position },
            rotation: gameState.player.rotation,
            keys: gameState.player.keys,
            inventory: gameState.player.inventory.map(i => ({ type: i.type, id: i.id })),
            nearbyObjects: gameState.player.nearbyObjects.map(o => ({
                type: o.type,
                id: o.id,
                pickupable: o.pickupable
            }))
        },
        objectCount: gameState.objects.length,
        doors: gameState.doors.map(d => ({
            id: d.id,
            locked: d.locked,
            opening: d.opening,
            openProgress: d.openProgress
        }))
    })
};

console.log('Game initialized! API available at window.gameAPI');
