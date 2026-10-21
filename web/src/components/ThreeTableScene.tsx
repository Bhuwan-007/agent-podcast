import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { AgentConfig, TopicConfig } from '../types/protocol'
import type { ActiveThread } from '../hooks/useGatewayWs'

interface ThreeTableSceneProps {
  topic: TopicConfig
  activeSpeakerId: string | null
  addressedAgentId: string | null
  activeThread: ActiveThread | null
  isUserSpeaking: boolean
  isUserProcessing?: boolean
  onSelectAgent: (agentId: string | null) => void
  onHoverAgent?: (agentId: string | null) => void
}

// GLSL Noise implementation for voice-reactive avatar displacement
const glslNoise = `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1); p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float f = 0.0, amp = 0.5;
    for(int i=0; i<4; i++) { f += amp * noise(p); p *= 2.0; amp *= 0.5; }
    return f;
  }
`

export const ThreeTableScene: React.FC<ThreeTableSceneProps> = ({
  topic,
  activeSpeakerId,
  addressedAgentId,
  activeThread,
  isUserSpeaking,
  isUserProcessing = false,
  onSelectAgent,
  onHoverAgent,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)

  // Keep latest props in refs for animation loop
  const propsRef = useRef({
    activeSpeakerId,
    addressedAgentId,
    activeThread,
    isUserSpeaking,
    isUserProcessing,
    agents: topic.agents,
  })

  useEffect(() => {
    propsRef.current = {
      activeSpeakerId,
      addressedAgentId,
      activeThread,
      isUserSpeaking,
      isUserProcessing,
      agents: topic.agents,
    }
  }, [activeSpeakerId, addressedAgentId, activeThread, isUserSpeaking, isUserProcessing, topic.agents])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // Scene setup with warm room background matching --room: #17120F
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x17120f)
    scene.fog = new THREE.FogExp2(0x17120f, 0.009)

    const width = container.clientWidth || 800
    const height = container.clientHeight || 650
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    container.appendChild(renderer.domElement)

    // Lighting: Studio Room Setup
    const ambientLight = new THREE.AmbientLight(0xecdcc2, 0.42)
    scene.add(ambientLight)

    const overheadLight = new THREE.DirectionalLight(0xffeedd, 0.8)
    overheadLight.position.set(0, 45, 12)
    overheadLight.castShadow = true
    overheadLight.shadow.mapSize.width = 1024
    overheadLight.shadow.mapSize.height = 1024
    overheadLight.shadow.bias = -0.0005
    scene.add(overheadLight)

    // Dynamic warm spotlight that tracks the speaking chair
    const spotlight = new THREE.SpotLight(0xffe2aa, 4.2, 75, Math.PI / 4.5, 0.45, 1.2)
    spotlight.position.set(0, 36, 0)
    spotlight.castShadow = true
    spotlight.shadow.mapSize.width = 1024
    spotlight.shadow.mapSize.height = 1024
    scene.add(spotlight)
    const spotTarget = new THREE.Object3D()
    scene.add(spotTarget)
    spotlight.target = spotTarget

    // Studio Floor
    const floorGeo = new THREE.PlaneGeometry(180, 180)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x110c09,
      roughness: 0.95,
      metalness: 0.05,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -4
    floor.receiveShadow = true
    scene.add(floor)

    // Warm Atmospheric Dust Particles (reflecting studio spotlight)
    const particleCount = 200
    const particleGeo = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 50
      particlePositions[i * 3 + 1] = Math.random() * 25
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 50
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: 0xffe2aa,
      size: 0.25,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // Table Group
    const tableGroup = new THREE.Group()
    scene.add(tableGroup)

    // Table Top (Wood Cylinder with rich walnut finish)
    const tableRadius = 16
    const tableTopGeo = new THREE.CylinderGeometry(tableRadius, tableRadius + 0.4, 1.2, 64)
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x5a3f2e, // --wood
      roughness: 0.72,
      metalness: 0.08,
    })
    const tableTop = new THREE.Mesh(tableTopGeo, tableMat)
    tableTop.position.y = 0
    tableTop.receiveShadow = true
    tableGroup.add(tableTop)

    // Table Rim
    const rimGeo = new THREE.TorusGeometry(tableRadius + 0.3, 0.45, 16, 64)
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x3c2a1f,
      roughness: 0.8,
    })
    const rim = new THREE.Mesh(rimGeo, rimMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.5
    tableGroup.add(rim)

    // Table Center Inlay (Dark felt / leather inlay)
    const inlayGeo = new THREE.CylinderGeometry(7.5, 7.5, 1.25, 64)
    const inlayMat = new THREE.MeshStandardMaterial({
      color: 0x2a1f19, // --inlay
      roughness: 0.88,
    })
    const inlay = new THREE.Mesh(inlayGeo, inlayMat)
    inlay.position.y = 0.02
    tableGroup.add(inlay)

    // Inlay Brass Ring
    const brassRingGeo = new THREE.TorusGeometry(7.6, 0.12, 16, 64)
    const brassRingMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a4b, // brass
      roughness: 0.28,
      metalness: 0.75,
    })
    const brassRing = new THREE.Mesh(brassRingGeo, brassRingMat)
    brassRing.rotation.x = Math.PI / 2
    brassRing.position.y = 0.65
    tableGroup.add(brassRing)

    // Central Topic Inscription Plaque
    const plaqueGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.06, 32)
    const plaqueMat = new THREE.MeshStandardMaterial({
      color: 0x33251c,
      roughness: 0.6,
      metalness: 0.4,
    })
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat)
    plaque.position.y = 0.66
    tableGroup.add(plaque)

    // Central Pedestal Base
    const pedestalGeo = new THREE.CylinderGeometry(3.5, 5, 4, 32)
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x221712,
      roughness: 0.9,
    })
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat)
    pedestal.position.y = -2
    tableGroup.add(pedestal)

    // Chairs & Voice-Avatar Setup
    const chairSeatRadius = 21.5
    interface ChairEntry {
      id: string
      group: THREE.Group
      seatMesh: THREE.Mesh
      cushionMesh: THREE.Mesh
      avatarMesh?: THREE.Mesh
      avatarUniforms?: {
        time: { value: number }
        voiceIntensity: { value: number }
        baseColor: { value: THREE.Color }
        activeColor: { value: THREE.Color }
      }
      haloMesh?: THREE.Mesh
      basePosition: THREE.Vector3
      leanDirection: THREE.Vector3
      isUser?: boolean
    }
    const chairMeshes: ChairEntry[] = []
    const interactableObjects: THREE.Object3D[] = []

    // Expert seat angles: 3 experts across top 200° (215°, 270°, 325°)
    const angles = [
      (215 * Math.PI) / 180,
      (270 * Math.PI) / 180,
      (325 * Math.PI) / 180,
    ]

    const seatColors = [0x9c4a47, 0xb8975a, 0x7b5c82]
    const seatColorHex = ['#9C4A47', '#B8975A', '#7B5C82']
    const activeGlowColors = [0xee6660, 0xf0c878, 0xbb88cc]

    // Helper: Create Canvas Nameplate Texture
    function createNameplateTexture(name: string, role: string, colorHex: string) {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Brass / aged paper background
        ctx.fillStyle = '#EADFC8'
        ctx.fillRect(0, 0, 512, 256)

        // Border line in expert color
        ctx.strokeStyle = colorHex
        ctx.lineWidth = 10
        ctx.strokeRect(16, 16, 480, 224)

        // Status indicator dot
        ctx.fillStyle = colorHex
        ctx.beginPath()
        ctx.arc(60, 80, 16, 0, Math.PI * 2)
        ctx.fill()

        // Name
        ctx.font = 'bold 58px system-ui, sans-serif'
        ctx.fillStyle = '#1C1612'
        ctx.fillText(name.toUpperCase(), 95, 96)

        // Role
        ctx.font = '32px system-ui, sans-serif'
        ctx.fillStyle = '#5A3F2E'
        ctx.fillText(role.toUpperCase(), 60, 175)
      }
      const tex = new THREE.CanvasTexture(canvas)
      tex.needsUpdate = true
      return tex
    }

    // Create 3 Expert Chairs with 3D Voice Avatars
    topic.agents.slice(0, 3).forEach((agent, i) => {
      const angle = angles[i]
      const chairX = Math.cos(angle) * chairSeatRadius
      const chairZ = Math.sin(angle) * chairSeatRadius
      const basePos = new THREE.Vector3(chairX, 0, chairZ)

      const chairGrp = new THREE.Group()
      chairGrp.position.copy(basePos)
      chairGrp.lookAt(0, 0, 0) // Face table center
      scene.add(chairGrp)

      // Chair backrest arc in expert's color
      const backrestGeo = new THREE.CylinderGeometry(2.4, 2.4, 3.5, 16, 1, true, -Math.PI / 2, Math.PI)
      const backrestMat = new THREE.MeshStandardMaterial({
        color: seatColors[i],
        roughness: 0.65,
        side: THREE.DoubleSide,
      })
      const backrest = new THREE.Mesh(backrestGeo, backrestMat)
      backrest.position.set(0, 2.2, 1.2)
      backrest.rotation.y = Math.PI
      chairGrp.add(backrest)

      // Cushion with distinct geometric shape (Circle Alex, Square Sam, Diamond Maya)
      let cushionGeo: THREE.BufferGeometry
      if (i === 0) {
        cushionGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.6, 32)
      } else if (i === 1) {
        cushionGeo = new THREE.BoxGeometry(3.6, 0.6, 3.6)
      } else {
        cushionGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.6, 4)
        cushionGeo.rotateY(Math.PI / 4)
      }

      const cushionMat = new THREE.MeshStandardMaterial({
        color: seatColors[i],
        roughness: 0.7,
      })
      const cushion = new THREE.Mesh(cushionGeo, cushionMat)
      cushion.position.set(0, 0.3, 0)
      chairGrp.add(cushion)

      // Chair legs
      const legGeo = new THREE.CylinderGeometry(0.2, 0.15, 3.8, 8)
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 0.8 })
      const legPositions = [
        [-1.4, -1.6, -1.4],
        [1.4, -1.6, -1.4],
        [-1.4, -1.6, 1.4],
        [1.4, -1.6, 1.4],
      ]
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, legMat)
        leg.position.set(lx, ly, lz)
        chairGrp.add(leg)
      })

      // 3D Stylized Voice Avatar (Ethereal acoustic orb sitting in chair)
      const avatarUniforms = {
        time: { value: 0 },
        voiceIntensity: { value: 0 },
        baseColor: { value: new THREE.Color(seatColors[i]) },
        activeColor: { value: new THREE.Color(activeGlowColors[i]) },
      }

      const avatarMat = new THREE.ShaderMaterial({
        uniforms: avatarUniforms,
        vertexShader: `
          ${glslNoise}
          uniform float time;
          uniform float voiceIntensity;
          varying vec3 vNormal;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            
            // Audio reactive displacement ripple
            float ripple = fbm(position * 2.5 + time * 3.5) * voiceIntensity * 0.45;
            float pulse = sin(time * 2.0) * 0.06;
            vec3 newPos = position + normal * (ripple + pulse);
            vPosition = newPos;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform float voiceIntensity;
          uniform vec3 baseColor;
          uniform vec3 activeColor;
          varying vec3 vNormal;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;
          varying vec3 vPosition;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            float fresnel = 1.0 - max(0.0, dot(normalize(vWorldNormal), viewDir));
            fresnel = pow(fresnel, 2.2);
            
            float wave = sin(vPosition.y * 10.0 + time * 4.0) * 0.5 + 0.5;
            vec3 col = mix(baseColor, activeColor, voiceIntensity * 0.8 + wave * 0.2 * voiceIntensity);
            col += activeColor * fresnel * (0.8 + voiceIntensity * 1.5);
            col += vec3(0.08, 0.06, 0.04);
            gl_FragColor = vec4(col, 0.96);
          }
        `,
        transparent: true,
      })

      const avatarGeo = new THREE.SphereGeometry(1.3, 48, 48)
      const avatarMesh = new THREE.Mesh(avatarGeo, avatarMat)
      avatarMesh.position.set(0, 2.6, 0.2)
      chairGrp.add(avatarMesh)

      // Thin brass acoustic ring around the avatar orb
      const haloGeo = new THREE.TorusGeometry(1.65, 0.05, 12, 48)
      const haloMat = new THREE.MeshStandardMaterial({
        color: 0xeadfc8,
        metalness: 0.8,
        roughness: 0.2,
      })
      const haloMesh = new THREE.Mesh(haloGeo, haloMat)
      haloMesh.position.set(0, 2.6, 0.2)
      haloMesh.rotation.x = Math.PI / 3
      chairGrp.add(haloMesh)

      // Name Plate on Table
      const standAngle = angle
      const standX = Math.cos(standAngle) * (tableRadius - 3.2)
      const standZ = Math.sin(standAngle) * (tableRadius - 3.2)
      const plateTex = createNameplateTexture(agent.display_name, agent.role, seatColorHex[i])
      const plateMat = new THREE.MeshStandardMaterial({
        map: plateTex,
        roughness: 0.8,
      })
      const plateGeo = new THREE.BoxGeometry(4.2, 2.1, 0.15)
      const plateMesh = new THREE.Mesh(plateGeo, plateMat)
      plateMesh.position.set(standX, 1.35, standZ)
      plateMesh.lookAt(chairX, 1.35, chairZ)
      plateMesh.userData = { agentId: agent.agent_id }
      tableGroup.add(plateMesh)
      interactableObjects.push(plateMesh)

      // Direction towards table center for lean
      const leanDir = new THREE.Vector3(0, 0, 0).sub(basePos).normalize()

      chairMeshes.push({
        id: agent.agent_id,
        group: chairGrp,
        seatMesh: backrest,
        cushionMesh: cushion,
        avatarMesh,
        avatarUniforms,
        haloMesh,
        basePosition: basePos.clone(),
        leanDirection: leanDir,
      })
    })

    // 4. Your Chair at 6 o'clock (90°)
    const youAngle = (90 * Math.PI) / 180
    const youX = Math.cos(youAngle) * chairSeatRadius
    const youZ = Math.sin(youAngle) * chairSeatRadius
    const youBasePos = new THREE.Vector3(youX, 0, youZ)

    const youChairGrp = new THREE.Group()
    youChairGrp.position.copy(youBasePos)
    youChairGrp.lookAt(0, 0, 0)
    scene.add(youChairGrp)

    const youBackrestGeo = new THREE.CylinderGeometry(2.4, 2.4, 3.5, 16, 1, true, -Math.PI / 2, Math.PI)
    const youBackrestMat = new THREE.MeshStandardMaterial({
      color: 0xeadfc8, // Ivory paper
      roughness: 0.7,
      side: THREE.DoubleSide,
    })
    const youBackrest = new THREE.Mesh(youBackrestGeo, youBackrestMat)
    youBackrest.position.set(0, 2.2, 1.2)
    youBackrest.rotation.y = Math.PI
    youChairGrp.add(youBackrest)

    const youCushionGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.6, 32)
    const youCushion = new THREE.Mesh(youCushionGeo, youBackrestMat)
    youCushion.position.set(0, 0.3, 0)
    youChairGrp.add(youCushion)

    // User Presence Avatar (Acoustic Sphere)
    const userAvatarUniforms = {
      time: { value: 0 },
      voiceIntensity: { value: 0 },
      baseColor: { value: new THREE.Color(0xeadfc8) },
      activeColor: { value: new THREE.Color(0x55dd88) },
    }
    const userAvatarMat = new THREE.ShaderMaterial({
      uniforms: userAvatarUniforms,
      vertexShader: `
        ${glslNoise}
        uniform float time;
        uniform float voiceIntensity;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          
          float ripple = fbm(position * 2.0 + time * 3.0) * voiceIntensity * 0.45;
          vec3 newPos = position + normal * ripple;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float voiceIntensity;
        uniform vec3 baseColor;
        uniform vec3 activeColor;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = 1.0 - max(0.0, dot(normalize(vWorldNormal), viewDir));
          fresnel = pow(fresnel, 2.0);
          vec3 col = mix(baseColor, activeColor, voiceIntensity * 0.9);
          col += activeColor * fresnel * (0.6 + voiceIntensity * 1.5);
          gl_FragColor = vec4(col, 0.95);
        }
      `,
      transparent: true,
    })
    const userAvatar = new THREE.Mesh(new THREE.SphereGeometry(1.2, 48, 48), userAvatarMat)
    userAvatar.position.set(0, 2.5, 0.2)
    youChairGrp.add(userAvatar)

    // Desk mic on table in front of user
    const micBaseGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.3, 16)
    const micBaseMat = new THREE.MeshStandardMaterial({ color: 0x2a1f19, metalness: 0.7 })
    const micBase = new THREE.Mesh(micBaseGeo, micBaseMat)
    micBase.position.set(youX * 0.65, 0.8, youZ * 0.65)
    tableGroup.add(micBase)

    const micStemGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8)
    const micStem = new THREE.Mesh(micStemGeo, brassRingMat)
    micStem.position.set(youX * 0.65, 1.6, youZ * 0.65)
    micStem.rotation.x = 0.25
    tableGroup.add(micStem)

    // Glowing mic head (indicates user speaking / listening)
    const micHeadGeo = new THREE.SphereGeometry(0.35, 16, 16)
    const micHeadMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a4b,
      emissive: 0x000000,
      roughness: 0.3,
    })
    const micHead = new THREE.Mesh(micHeadGeo, micHeadMat)
    micHead.position.set(youX * 0.65, 2.4, youZ * 0.65 - 0.2)
    tableGroup.add(micHead)

    // User nameplate on table
    const youTex = createNameplateTexture('YOU', 'HOST / PULL CHAIR', '#EADFC8')
    const youPlateMat = new THREE.MeshStandardMaterial({ map: youTex, roughness: 0.8 })
    const youPlate = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.1, 0.15), youPlateMat)
    youPlate.position.set(youX * 0.78, 1.35, youZ * 0.78)
    youPlate.lookAt(youX, 1.35, youZ)
    youPlate.userData = { agentId: 'human' }
    tableGroup.add(youPlate)
    interactableObjects.push(youPlate)

    const youLeanDir = new THREE.Vector3(0, 0, 0).sub(youBasePos).normalize()
    chairMeshes.push({
      id: 'human',
      group: youChairGrp,
      seatMesh: youBackrest,
      cushionMesh: youCushion,
      avatarMesh: userAvatar,
      avatarUniforms: userAvatarUniforms,
      basePosition: youBasePos.clone(),
      leanDirection: youLeanDir,
      isUser: true,
    })

    // Dynamic 3D Thread Curve for A2A
    let threadCurveMesh: THREE.Line | null = null

    // Camera targeting vectors
    const camTargetPos = new THREE.Vector3(0, 38, 34)
    const camTargetLook = new THREE.Vector3(0, 0.5, 0)
    const currentLookAt = new THREE.Vector3(0, 0.5, 0)

    // User manual drag/orbit physics
    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    let prevMouseX = 0
    let prevMouseY = 0
    let orbitTheta = 0
    let orbitPhi = Math.PI / 3.2

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      dragStartX = e.clientX
      dragStartY = e.clientY
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - prevMouseX
      const deltaY = e.clientY - prevMouseY
      prevMouseX = e.clientX
      prevMouseY = e.clientY

      orbitTheta -= deltaX * 0.004
      orbitPhi = Math.max(0.25, Math.min(Math.PI / 2.15, orbitPhi - deltaY * 0.004))
    }

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false

      // Check if this was a click (not a drag)
      if (Math.abs(e.clientX - dragStartX) < 6 && Math.abs(e.clientY - dragStartY) < 6) {
        const rect = renderer.domElement.getBoundingClientRect()
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1
        const rc = new THREE.Raycaster()
        rc.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera)

        const hits = rc.intersectObjects(interactableObjects)
        if (hits.length > 0) {
          const agId = hits[0].object.userData.agentId
          if (agId) {
            onSelectAgent(agId === 'human' ? null : agId)
          }
        }
      }
    }

    const dom = renderer.domElement
    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Clock and animation loop
    const clock = new THREE.Clock()
    let reqId: number

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      const currentProps = propsRef.current
      const isSpeakingHuman = currentProps.isUserSpeaking
      const activeSpk = currentProps.activeSpeakerId

      // Update particle positions (slow ambient drifting)
      particles.rotation.y = time * 0.02

      // Determine Camera Focus Target based on VOICE / active speaker
      let focusTargetPos = new THREE.Vector3(0, 36, 32)
      let focusLookAt = new THREE.Vector3(0, 0.5, 0)
      let targetSpotPos = new THREE.Vector3(0, 0, 0)
      let targetSpotIntensity = 1.6
      let targetFov = 42

      if (isSpeakingHuman) {
        // Voice focus on You (Host) at 6 o'clock
        focusTargetPos.set(0, 13.5, 12)
        focusLookAt.set(0, 2.2, 21.5)
        targetSpotPos.set(0, 1, 20)
        targetSpotIntensity = 4.8
        targetFov = 34 // Intimate framing

        // Mic LED glows green
        micHeadMat.emissive.setHex(0x55dd88)
      } else if (activeSpk) {
        const chair = chairMeshes.find(
          (c) =>
            c.id === activeSpk ||
            c.id.toLowerCase() === activeSpk?.toLowerCase() ||
            (c.id === 'ai_engineer' && (activeSpk === 'alex' || activeSpk === 'engineer')) ||
            (c.id === 'software_developer' && (activeSpk === 'sam' || activeSpk === 'developer')) ||
            (c.id === 'oss_maintainer' && (activeSpk === 'maya' || activeSpk === 'maintainer'))
        )
        if (chair) {
          const cp = chair.basePosition

          // Studio Broadcast Crane: Camera glides along outer host perimeter arc
          if (chair.id === 'ai_engineer') {
            // Alex on northwest: Camera sits on right-host arc, angling gently across table
            focusTargetPos.set(7.5, 13.5, 25)
            focusLookAt.set(-17.6, 2.6, -12.3)
          } else if (chair.id === 'software_developer') {
            // Sam on north center: Camera sits center host arc, looking straight down table
            focusTargetPos.set(0, 12.5, 26)
            focusLookAt.set(0, 2.6, -21.5)
          } else if (chair.id === 'oss_maintainer') {
            // Maya on northeast: Camera sits on left-host arc, angling gently across table
            focusTargetPos.set(-7.5, 13.5, 25)
            focusLookAt.set(17.6, 2.6, -12.3)
          } else {
            focusTargetPos.set(-cp.x * 0.4, 13.5, 24)
            focusLookAt.set(cp.x, 2.6, cp.z)
          }

          targetSpotPos.set(cp.x, 1, cp.z)
          targetSpotIntensity = 4.8
          targetFov = 32 // Intimate cinematic broadcast framing
        }
        micHeadMat.emissive.setHex(0x000000)
      } else {
        // Table Overview when room is listening / waiting
        focusTargetPos.set(0, 36, 32)
        focusLookAt.set(0, 0.5, 0)
        targetSpotPos.set(0, 0, 0)
        targetSpotIntensity = 1.6
        targetFov = 42
        micHeadMat.emissive.setHex(0x000000)
      }

      // Silky Smooth Dynamic FOV Easing
      camera.fov += (targetFov - camera.fov) * 0.028
      camera.updateProjectionMatrix()

      // Smooth Follow-Spotlight Glide
      spotTarget.position.lerp(targetSpotPos, 0.035)
      spotlight.intensity += (targetSpotIntensity - spotlight.intensity) * 0.04

      // Silky Smooth Camera Glide (Critically damped broadcast crane easing)
      camTargetPos.lerp(focusTargetPos, 0.032)
      camTargetLook.lerp(focusLookAt, 0.035)

      // Apply camera position: pure voice focus unless manual drag is actively used
      if (isDragging || Math.abs(orbitTheta) > 0.05 || Math.abs(orbitPhi - Math.PI / 3.2) > 0.1) {
        const lookAt = camTargetLook
        const dist = camTargetPos.distanceTo(lookAt)
        const finalX = lookAt.x + Math.sin(orbitPhi) * Math.sin(orbitTheta) * dist
        const finalY = lookAt.y + Math.cos(orbitPhi) * dist
        const finalZ = lookAt.z + Math.sin(orbitPhi) * Math.cos(orbitTheta) * dist
        camera.position.lerp(new THREE.Vector3(finalX, finalY, finalZ), 0.05)
      } else {
        camera.position.copy(camTargetPos)
      }

      currentLookAt.copy(camTargetLook)
      camera.lookAt(currentLookAt)

      // Animate Chairs leaning in & voice-avatar rippling
      chairMeshes.forEach((chair) => {
        const isThisSpeaking =
          (chair.isUser && isSpeakingHuman) ||
          (!chair.isUser &&
            (activeSpk === chair.id ||
              (chair.id === 'ai_engineer' && (activeSpk === 'alex' || activeSpk === 'engineer')) ||
              (chair.id === 'software_developer' && (activeSpk === 'sam' || activeSpk === 'developer')) ||
              (chair.id === 'oss_maintainer' && (activeSpk === 'maya' || activeSpk === 'maintainer'))))

        // Chair leaning physics
        const targetPos = chair.basePosition.clone()
        if (isThisSpeaking) {
          targetPos.add(chair.leanDirection.clone().multiplyScalar(3.2)) // 3.2 units towards table center
        }
        chair.group.position.lerp(targetPos, delta * 5)

        // Update shader uniforms
        if (chair.avatarUniforms) {
          chair.avatarUniforms.time.value = time
          const curIntensity = chair.avatarUniforms.voiceIntensity.value
          const targetIntensity = isThisSpeaking ? 1.0 : 0.0
          chair.avatarUniforms.voiceIntensity.value += (targetIntensity - curIntensity) * 0.12
        }

        // Rotate halo rings (faster when speaking)
        if (chair.haloMesh) {
          const rotSpeed = isThisSpeaking ? 3.0 : 0.6
          chair.haloMesh.rotation.z += delta * rotSpeed
        }
      })

      // Animate A2A Thread Arc if active
      if (currentProps.activeThread) {
        const fromChair = chairMeshes.find((c) => c.id === currentProps.activeThread?.from)
        const toChair = chairMeshes.find((c) => c.id === currentProps.activeThread?.to)

        if (fromChair && toChair) {
          if (!threadCurveMesh) {
            const curve = new THREE.QuadraticBezierCurve3(
              fromChair.basePosition.clone().add(new THREE.Vector3(0, 2.6, 0)),
              new THREE.Vector3(0, 9.5, 0), // Arc peak high above table
              toChair.basePosition.clone().add(new THREE.Vector3(0, 2.6, 0))
            )
            const pts = curve.getPoints(40)
            const threadGeo = new THREE.BufferGeometry().setFromPoints(pts)
            const threadMat = new THREE.LineDashedMaterial({
              color: 0x8a6a4b,
              linewidth: 2,
              dashSize: 1.2,
              gapSize: 0.6,
            })
            threadCurveMesh = new THREE.Line(threadGeo, threadMat)
            threadCurveMesh.computeLineDistances()
            scene.add(threadCurveMesh)
          }
        }
      } else if (threadCurveMesh) {
        scene.remove(threadCurveMesh)
        threadCurveMesh = null
      }

      renderer.render(scene, camera)
    }

    animate()

    // Handle Resize
    const onResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(reqId)
      dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('resize', onResize)
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [topic, onSelectAgent])

  return (
    <div className="three-table-wrap" ref={mountRef}>
      <style>{`
        .three-table-wrap {
          width: 100%;
          height: 100%;
          min-height: 540px;
          height: 560px;
          position: relative;
          border-radius: var(--radius-card, 4px);
          overflow: hidden;
          background: #17120F;
          cursor: crosshair;
        }
        .three-table-wrap canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  )
}
