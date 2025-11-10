import * as THREE from 'three';

// Game state
const gameState = {
    player: {
        position: { x: 0, y: 1, z: 0 },
        rotation: 0,
        inventory: [],
        nearbyObjects: []
    },
    objects: []
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

// Player capsule
const playerGroup = new THREE.Group();
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

// Place cubes around the scene
createCube(5, 5, cubeTypes[0]);
createCube(-5, 5, cubeTypes[1]);
createCube(5, -5, cubeTypes[2]);
createCube(-5, -5, cubeTypes[3]);
createCube(0, 8, cubeTypes[0]);
createCube(8, 0, cubeTypes[1]);
createCube(-8, 0, cubeTypes[2]);
createCube(0, -8, cubeTypes[3]);

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

function pickup() {
    const nearby = findNearbyObjects();

    if (nearby.length === 0) {
        updateStatus('No objects nearby to pickup');
        return;
    }

    const pickupable = nearby.find(obj => obj.pickupable);

    if (pickupable) {
        gameState.player.inventory.push(pickupable);
        scene.remove(pickupable.mesh);
        gameState.objects = gameState.objects.filter(obj => obj.id !== pickupable.id);
        updateStatus(`Picked up ${pickupable.type} cube`);
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
    updateStatus(`Interacting with ${obj.type} cube`);

    // Visual feedback
    obj.mesh.material.emissive.setHex(0x444444);
    setTimeout(() => {
        if (obj.mesh.material) {
            obj.mesh.material.emissive.setHex(0x000000);
        }
    }, 200);
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

// Game loop
function animate() {
    requestAnimationFrame(animate);

    // Handle movement
    if (keys.w || keys.arrowup) movePlayer('forward');
    if (keys.s || keys.arrowdown) movePlayer('backward');
    if (keys.a) movePlayer('left');
    if (keys.d) movePlayer('right');
    if (keys.arrowleft) rotatePlayer('left');
    if (keys.arrowright) rotatePlayer('right');

    // Mouse rotation
    if (mouse.isDown) {
        gameState.player.rotation -= mouse.x;
        mouse.x = 0;
        mouse.y = 0;
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
            inventory: gameState.player.inventory.map(i => ({ type: i.type, id: i.id })),
            nearbyObjects: gameState.player.nearbyObjects.map(o => ({
                type: o.type,
                id: o.id,
                pickupable: o.pickupable
            }))
        },
        objectCount: gameState.objects.length
    })
};

console.log('Game initialized! API available at window.gameAPI');
