import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// CONFIGURACIÓN OPTIMIZADA
const CONFIG = {
    galaxy: { rotationSpeed: 0.12, centerExclusionRadius: 45 },
    elementExclusionRadius: 55, 
    blackHole: { radius: 12, segments: 64, color1: '#0d0004', color2: '#2a000c' },
    
    accretionRing: {
        innerRadius: 17, outerRadius: 35, segments: 128,
        centerColor: '#FF1744',
        midColor: '#FF0B3A',
        edgeColor: '#F78FB3',
        emissiveIntensity: 0.95,
    },
    particles: {
        // Reducidos los contadores masivos para maximizar fluidez
        coreStars: { count: 8000, radius: 125, maxHeight: 60, size: 0.28 },
        sphericalHalo: { count: 6000, radiusXZ: 115, radiusY: 60, size: 0.22, minDistFromCenter: 26 },
        backgroundStars: { count: 2500, radius: 550, size: 0.24 },
        
        texts: {
            count: 30, width: 45, height: 20,
            minRadius: null, maxRadius: 120,
            content:[
                "Siempre contigo", "Eres mi calma", "Me haces feliz", "Tu sonrisa, mi debilidad", "Soy feliz a tu lado",
                "Qué bonito coincidir", "Mi lugar favorito, eres tu", "Contigo todo mejora, me haces tan feliz ",
                "Tu luz me inspira", "Eres increíble", "Gracias por existir, cariño", "Te quiero", "Te adoro", "Mi princesa",
                "Mi corazón te elige", "Qué suerte tenerte", "Eres mi paz, mi luz", "Amo estar a tu lado", "Mi persona favorita"
            ],
            colors:[
                { fill: '#FF1744', shadow: '#FF0B3A' },
                { fill: '#FFB7C5', shadow: '#F78FB3' },
                { fill: '#FF6B81', shadow: '#D63031' }
            ]
        },
        emojis: {
            count: 35, size: 12,
            minRadius: null, maxRadius: 120,
            content:[ '💖', '💘', '💞', '💕', '❤️', '💐', '🌸', '🌹', '🌺', '💌' ],
            colors:[
                { fill: '#FF1744', shadow: '#FF0B3A' },
                { fill: '#FFB7C5', shadow: '#F78FB3' },
                { fill: '#E84118', shadow: '#C23616' }
            ]
        }
    },
    loveCards: {
        images:[ 'assets/card.png', 'assets/card.png', 'assets/card.png', 'assets/card.png' ], 
        phrases:[
            "Admiro la forma en que haces bonito hasta los días simples.",
            "Tu presencia tiene algo único: todo se siente más cálido contigo.",
            "Este detalle es para recordarte lo especial que eres para mí.",
            "Quería bajarte las estrellas pero no pude ya que en tus ojos bellos encuentro cada una de ellas.", 
            "Tú eres como las estrellas que iluminan la noche, pero tú iluminas mi vida.",
            "Me gustas tanto, me encantas mi amor, te quiero mucho. Gracias por todo."
        ]
    },
    shootingStars: { enabled: true, spawnProbability: 0.99, speed: 2.50 },
    lighting: {
        ambientLight: { color: '#2419ee', intensity: 0.25 },
        pointLight: { color: '#085cee', intensity: 3.99, distance: 380 }
    },
    bloomEffect: { threshold: 0.6, strength: 0.5, radius: 0.5 },
    cameraControls: { minDistance: 30, maxDistance: 250 }
};

let scene, camera, renderer, controls, galaxyGroup, clock, sphereMaterial, composer;
let loveTexts = [], loveImages = [], shootingStars = [];
let occupiedPositions = [];
let raycaster, mouse;
let currentCardIndex = 0;

let starHeadGeometry, starTailGeometry, starHeadMaterial;

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('galaxy-canvas'), antialias: true });
    
    // PixelRatio limitado a 1 para optimizar el rendimiento en móviles
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.setSize(window.innerWidth, window.innerHeight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = CONFIG.cameraControls.minDistance;
    controls.maxDistance = CONFIG.cameraControls.maxDistance;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = CONFIG.bloomEffect.threshold;
    bloomPass.strength = CONFIG.bloomEffect.strength;
    bloomPass.radius = CONFIG.bloomEffect.radius;
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const { ambientLight, pointLight } = CONFIG.lighting;
    scene.add(new THREE.AmbientLight(ambientLight.color, ambientLight.intensity));
    const mainLight = new THREE.PointLight(pointLight.color, pointLight.intensity, pointLight.distance);
    mainLight.position.set(0, 0, 0);
    scene.add(mainLight);
    
    galaxyGroup = new THREE.Group();
    scene.add(galaxyGroup);

    init3DShootingStarAssets();
    createBlackHole();
    createCoreStars();
    createSphericalHalo();
    createBackgroundStars();
    createLoveElements();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    
    renderer.domElement.addEventListener('touchstart', (e) => {
        if(e.touches.length === 1) {
            onCanvasClick(e.touches[0]);
        }
    });

    onWindowResize();
    animate();
}

function init3DShootingStarAssets() {
    starHeadGeometry = new THREE.SphereGeometry(1.2, 16, 16);
    starHeadMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0
    });

    starTailGeometry = new THREE.ConeGeometry(1.1, 35, 12);
    starTailGeometry.rotateX(-Math.PI / 2);
    starTailGeometry.translate(0, 0, -17.5);
}

function createBlackHole() {
    const bhConfig = CONFIG.blackHole;
    const ringConfig = CONFIG.accretionRing;
    sphereMaterial = new THREE.ShaderMaterial({
        uniforms: { 
            uTime: { value: 0.0 }, 
            uColor1: { value: new THREE.Color(bhConfig.color1) }, 
            uColor2: { value: new THREE.Color(bhConfig.color2) } 
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform float uTime; 
            uniform vec3 uColor1; 
            uniform vec3 uColor2; 
            varying vec2 vUv; 
            float noise(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); } 
            void main() { 
                float n = noise(vUv * 6.0 + uTime * 0.15); 
                vec3 mixedColor = mix(uColor1, uColor2, n); 
                gl_FragColor = vec4(mixedColor, 1.0); 
            }
        `
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(bhConfig.radius, bhConfig.segments, bhConfig.segments), sphereMaterial));
    
    const ringGeometry = new THREE.RingGeometry(ringConfig.innerRadius, ringConfig.outerRadius, ringConfig.segments);
    const ringMaterial = new THREE.ShaderMaterial({
        uniforms: { 
            innerRadius: { value: ringConfig.innerRadius }, 
            outerRadius: { value: ringConfig.outerRadius }, 
            centerColor: { value: new THREE.Color(ringConfig.centerColor) }, 
            midColor: { value: new THREE.Color(ringConfig.midColor) }, 
            edgeColor: { value: new THREE.Color(ringConfig.edgeColor) }, 
            emissiveIntensity: { value: ringConfig.emissiveIntensity } 
        },
        vertexShader: `varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform float innerRadius; 
            uniform float outerRadius; 
            uniform vec3 centerColor; 
            uniform vec3 midColor; 
            uniform vec3 edgeColor; 
            uniform float emissiveIntensity; 
            varying vec3 vPosition; 
            void main() { 
                float distance = length(vPosition.xy); 
                float normalizedDistance = clamp((distance - innerRadius) / (outerRadius - innerRadius), 0.0, 1.0); 
                vec3 finalColor; 
                if (normalizedDistance < 0.45) { 
                    finalColor = mix(centerColor, midColor, normalizedDistance * 2.22); 
                } else { 
                    finalColor = mix(midColor, edgeColor, (normalizedDistance - 0.45) * 1.81); 
                } 
                float glowFactor = 1.0 - smoothstep(0.0, 1.0, normalizedDistance); 
                vec3 emissiveColor = finalColor * emissiveIntensity * glowFactor; 
                gl_FragColor = vec4(finalColor + emissiveColor, 0.95); 
            }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending
    });
    
    const loveRing = new THREE.Mesh(ringGeometry, ringMaterial);
    loveRing.rotation.x = Math.PI / 2;
    scene.add(loveRing);
}

function createCoreStars() {
    const coreConfig = CONFIG.particles.coreStars;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(coreConfig.count * 3);
    const colors = new Float32Array(coreConfig.count * 3);
    const color = new THREE.Color();
    
    const palette = [
        new THREE.Color('#FF1744'),
        new THREE.Color('#FF0B3A'),
        new THREE.Color('#FFB7C5'),
        new THREE.Color('#F78FB3'),
        new THREE.Color('#D63031'),
        new THREE.Color('#9B59B6')
    ];

    for (let i = 0; i < coreConfig.count; i++) {
        const distance = CONFIG.accretionRing.outerRadius + Math.random() * (coreConfig.radius - CONFIG.accretionRing.outerRadius);
        const angle = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * coreConfig.maxHeight * Math.pow(1 - (distance / coreConfig.radius), 1.5);
        positions.set([Math.cos(angle) * distance, y, Math.sin(angle) * distance], i * 3);
        
        const baseColor = palette[Math.floor(Math.random() * palette.length)];
        color.copy(baseColor);
        color.r = Math.min(1.0, color.r + (Math.random() - 0.5) * 0.1);
        color.g = Math.min(1.0, color.g + (Math.random() - 0.5) * 0.1);
        color.b = Math.min(1.0, color.b + (Math.random() - 0.5) * 0.1);

        colors.set([color.r, color.g, color.b], i * 3);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: coreConfig.size, blending: THREE.AdditiveBlending, vertexColors: true, transparent: true, opacity: 0.95 });
    galaxyGroup.add(new THREE.Points(geometry, material));
}

function createSphericalHalo() {
    const haloConfig = CONFIG.particles.sphericalHalo;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(haloConfig.count * 3);
    const colors = new Float32Array(haloConfig.count * 3);
    const color = new THREE.Color();

    const haloPalette = [
        new THREE.Color('#FF0B3A'),
        new THREE.Color('#FFB7C5'),
        new THREE.Color('#F78FB3'),
        new THREE.Color('#8E44AD')
    ];

    let filled = 0;
    while (filled < haloConfig.count) {
        const rx = (Math.random() * 2 - 1);
        const ry = (Math.random() * 2 - 1);
        const rz = (Math.random() * 2 - 1);

        if (rx * rx + ry * ry + rz * rz > 1.0) continue;

        const x = rx * haloConfig.radiusXZ;
        const y = ry * haloConfig.radiusY;
        const z = rz * haloConfig.radiusXZ;

        const distFromCenter = Math.sqrt(x * x + y * y + z * z);
        if (distFromCenter < haloConfig.minDistFromCenter) continue;

        const rNorm = distFromCenter / Math.max(haloConfig.radiusXZ, haloConfig.radiusY);
        if (Math.random() > Math.pow(1.0 - rNorm * 0.7, 1.2)) continue;

        positions.set([x, y, z], filled * 3);

        const pickedColor = haloPalette[Math.floor(Math.random() * haloPalette.length)];
        color.copy(pickedColor);
        colors.set([color.r, color.g, color.b], filled * 3);

        filled++;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: haloConfig.size,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        transparent: true,
        opacity: 0.75
    });

    galaxyGroup.add(new THREE.Points(geometry, material));
}

function createLoveElements() {
    const textConfig = CONFIG.particles.texts;
    const emojiConfig = CONFIG.particles.emojis;

    for (let i = 0; i < textConfig.count; i++) {
        const colorData = textConfig.colors[i % textConfig.colors.length];
        const texture = createTextTexture(textConfig.content[i % textConfig.content.length], colorData);
        const material = new THREE.MeshPhongMaterial({ map: texture, transparent: true, alphaTest: 0.1, emissive: colorData.fill, emissiveIntensity: 1.35 });
        const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(textConfig.width, textConfig.height), material);
        setElementOrbitPosition(textMesh, textConfig.minRadius, textConfig.maxRadius);
        galaxyGroup.add(textMesh); loveTexts.push(textMesh);
    }

    for (let i = 0; i < emojiConfig.count; i++) {
        const colorData = emojiConfig.colors[i % emojiConfig.colors.length];
        const emoji = emojiConfig.content[i % emojiConfig.content.length];
        const texture = createEmojiTexture(emoji, colorData);
        
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const emojiSprite = new THREE.Sprite(material);
        emojiSprite.scale.set(emojiConfig.size, emojiConfig.size, 1);
        
        setElementOrbitPosition(emojiSprite, emojiConfig.minRadius, emojiConfig.maxRadius);
        galaxyGroup.add(emojiSprite); 
        loveImages.push(emojiSprite);
    }
}

function createBackgroundStars() {
    const bgConfig = CONFIG.particles.backgroundStars;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(bgConfig.count * 3);
    const colors = new Float32Array(bgConfig.count * 3);
    const color = new THREE.Color();
    
    for (let i = 0; i < bgConfig.count; i++) {
        const r = bgConfig.radius;
        positions.set([(Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * 2 * r], i * 3);
        
        if (Math.random() > 0.4) {
            color.setHex(0xffffff);
        } else if (Math.random() > 0.5) {
            color.setHex(0xffb7c5);
        } else {
            color.setHex(0xff1744);
        }
        colors.set([color.r, color.g, color.b], i * 3);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ size: bgConfig.size, vertexColors: true, transparent: true, opacity: 0.65 });
    scene.add(new THREE.Points(geometry, material));
}

function createShootingStar3D() {
    const group = new THREE.Group();
    
    const startX = THREE.MathUtils.randFloatSpread(850);
    const startY = THREE.MathUtils.randFloat(90, 260);
    const startZ = THREE.MathUtils.randFloatSpread(450);
    group.position.set(startX, startY, startZ);

    const vx = (Math.random() < 0.5 ? -1 : 1) * CONFIG.shootingStars.speed * (0.8 + Math.random() * 0.4);
    const vy = -CONFIG.shootingStars.speed * (0.65 + Math.random() * 0.3);
    const vz = THREE.MathUtils.randFloatSpread(0.9);
    const moveDir = new THREE.Vector3(vx, vy, vz);

    const starColors = [0xff1744, 0xff0b3a, 0xffb7c5, 0xff6b81, 0xffffff];
    const chosenColorHex = starColors[Math.floor(Math.random() * starColors.length)];

    const head = new THREE.Mesh(starHeadGeometry, starHeadMaterial.clone());
    head.material.color.setHex(0xffffff);
    group.add(head);

    const tailMat = new THREE.MeshBasicMaterial({
        color: chosenColorHex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const tail = new THREE.Mesh(starTailGeometry, tailMat);
    group.add(tail);

    const targetPos = group.position.clone().add(moveDir);
    group.lookAt(targetPos);

    const particleCount = 12;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount; p++) {
        const spread = (p / particleCount) * 25;
        particlePositions[p * 3] = (Math.random() - 0.5) * 1.5;
        particlePositions[p * 3 + 1] = (Math.random() - 0.5) * 1.5;
        particlePositions[p * 3 + 2] = -spread;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
        color: chosenColorHex,
        size: 0.9,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    const sparkParticles = new THREE.Points(particleGeo, particleMat);
    group.add(sparkParticles);

    group.userData = {
        velocity: moveDir,
        life: 0,
        maxLife: THREE.MathUtils.randInt(60, 95),
        colorHex: chosenColorHex
    };

    shootingStars.push(group);
    scene.add(group);
}

function setElementOrbitPosition(element, minRadius, maxRadius) {
    const safeMinRadius = minRadius || CONFIG.elementExclusionRadius;
    const safeMaxRadius = maxRadius || CONFIG.particles.coreStars.radius;
    const minSeparation = 18; const maxAttempts = 50;
    let validPosition = false; let attempts = 0;
    let finalPosition = { x: 0, y: 0, z: 0 };
    while (!validPosition && attempts < maxAttempts) {
        attempts++;
        const radius = safeMinRadius + Math.random() * (safeMaxRadius - safeMinRadius);
        const theta = Math.random() * Math.PI * 2;
        const maxVerticalOffset = 15;
        const y = (Math.random() - 0.5) * maxVerticalOffset;
        const x = radius * Math.cos(theta); const z = radius * Math.sin(theta);
        validPosition = true;
        for (let pos of occupiedPositions) {
            const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2) + Math.pow(z - pos.z, 2));
            if (distance < minSeparation) { validPosition = false; break; }
        }
        if (validPosition) finalPosition = { x, y, z };
    }
    element.position.set(finalPosition.x, finalPosition.y, finalPosition.z);
    occupiedPositions.push(finalPosition);
}

function createTextTexture(text, color) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
    const context = canvas.getContext('2d');
    context.font = '64px "Patrick Hand", cursive'; context.fillStyle = color.fill;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.shadowColor = color.shadow; context.shadowBlur = 4;
    const words = text.split(' '); let lines = []; let currentLine = words[0];
    const maxWidth = canvas.width - 80, lineHeight = 80;
    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        if (context.measureText(testLine).width > maxWidth && currentLine.length > 0) { lines.push(currentLine); currentLine = words[i]; }
        else { currentLine = testLine; }
    }
    lines.push(currentLine);
    const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => context.fillText(line, canvas.width / 2, startY + index * lineHeight));
    return new THREE.CanvasTexture(canvas);
}

function createEmojiTexture(emoji, colorData) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '160px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.shadowColor = colorData.shadow; ctx.shadowBlur = 18; ctx.fillStyle = colorData.fill;
    ctx.fillText(emoji, canvas.width / 2, canvas.height / 2 + 8);

    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.colorSpace = THREE.SRGBColorSpace;
    newTexture.generateMipmaps = false;
    newTexture.minFilter = THREE.LinearFilter;
    newTexture.magFilter = THREE.LinearFilter;
    return newTexture;
}

function onWindowResize() {
    const width = window.innerWidth, height = window.innerHeight;
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.position.set(0, 35, width < 768 ? 150 : 120);
    camera.updateProjectionMatrix();
}

function onCanvasClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(loveImages);
    if (intersects.length > 0) {
        showLoveCard();
    }
}

function showLoveCard() {
    const overlay = document.getElementById('love-card-overlay');
    const card = document.getElementById('love-card');
    const text = document.getElementById('love-card-text');
    const cardConfig = CONFIG.loveCards;
    card.style.backgroundImage = `url('${cardConfig.images[currentCardIndex]}')`;
    text.textContent = cardConfig.phrases[currentCardIndex];
    overlay.style.display = 'flex';
    currentCardIndex = (currentCardIndex + 1) % cardConfig.images.length;
}

function hideLoveCard() {
    document.getElementById('love-card-overlay').style.display = 'none';
}

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    galaxyGroup.rotation.y = elapsedTime * CONFIG.galaxy.rotationSpeed;
    if (sphereMaterial) sphereMaterial.uniforms.uTime.value = elapsedTime;

    loveTexts.forEach(t => t.lookAt(camera.position));
    
    if (CONFIG.shootingStars.enabled) {
        if (Math.random() < CONFIG.shootingStars.spawnProbability) {
            createShootingStar3D();
        }
    }
    
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const star = shootingStars[i];
        star.position.add(star.userData.velocity);
        star.userData.life++;
        
        const lifeRatio = star.userData.life / star.userData.maxLife;
        const fade = Math.sin(lifeRatio * Math.PI);

        star.children.forEach(child => {
            if (child.material && child.material.transparent) {
                child.material.opacity = fade * (child.isPoints ? 0.9 : 0.85);
            }
        });

        if (star.userData.life >= star.userData.maxLife) {
            scene.remove(star);
            star.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            shootingStars.splice(i, 1);
        }
    }
    
    controls.update();
    composer.render();
}

init();

// MANEJO DE INTERACCIÓN Y REPRODUCCIÓN
document.getElementById('entry-button').addEventListener('click', () => {
    const music = document.getElementById('background-music');
    music.src = 'https://raw.githubusercontent.com/kevinj2628/org/main/Reik%20-%20Sabes%20(Letra%20%20Lyrics).mp3';
    music.load();
    music.play().catch(e => console.error('Error al reproducir música:', e));

    document.getElementById('entry-modal').style.display = 'none';
    document.getElementById('music-toggle').style.display = 'flex';
});

const musicToggle = document.getElementById('music-toggle');
const musicLabel = document.getElementById('music-label');
musicToggle.addEventListener('click', () => {
    const music = document.getElementById('background-music');
    if (music.paused) {
        music.play().then(() => { musicLabel.textContent = 'PAUSAR MÚSICA'; })
            .catch(() => { musicLabel.textContent = 'ACTIVAR MÚSICA'; });
    } else {
        music.pause();
        musicLabel.textContent = 'ACTIVAR MÚSICA';
    }
});

document.getElementById('love-card-overlay').addEventListener('click', hideLoveCard);