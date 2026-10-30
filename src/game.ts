import * as THREE from 'three';
import { CHARACTERS } from './characters.ts';
import { sound } from './sound.ts';
import {
  ActivePerks,
  AVAILABLE_PERKS,
  CharacterDef,
  CharacterId,
  CollectibleItem,
  DroppedPerkItem,
  EnemyItem,
  GameState,
  HazardItem,
  PerkType,
  PlatformBlock,
} from './types.ts';
import {
  createArchitectEnemyModel,
  createAgvRobotModel,
  createAisleArrow,
  createBathtubModel,
  createBhpDigitalScoreboard,
  createBimberBottleMolotov,
  createMolotovFirePuddle,
  createCoffeeVendingMachineModel,
  createCarraraCollectible,
  createCharacterModel,
  createCustomerEnemyModel,
  createDeliveryVan,
  createDroppedPerkCrate,
  createEliteGuardEnemyModel,
  createEspressoCollectible,
  createFinishGate,
  createForkliftModel,
  createGoldenCutterCollectible,
  createGoldenThroneEasterEgg,
  createGroutCollectible,
  createHandlowiecEnemyModel,
  createHighBayCatwalk,
  createHighBayLamp,
  createIndustrialSteamVent,
  createInspectorEnemyModel,
  createMagnetCollectible,
  createMonterEnemyModel,
  createNeonShowroomSign,
  createPenaltyNoticeProjectile,
  createPiorunDronModel,
  createSecretFolderEasterEgg,
  createTilePallet,
  createVintageCoffeeCornerEasterEgg,
  createVolumetricLightBeam,
  createWalczakBossModel,
  createWarehouseRack,
  createKurierEnemyModel,
  createItalianVendorEnemyModel,
  createSztaplarEnemyModel,
  createSprayGraffitiDecal,
  createCrimeSceneBodyOutlineDecal,
  createKrolLetoBossModel,
  createDisplayPodium,
  createGlassPartition,
  createShowroomPlant,
  createTrackSpotlights,
  createExplosiveBarrelModel,
  createLargeTileModel,
  createLootCrateModel,
  createPanRomanEnemyModel,
  createSanitarywareProjectile,
  createSerwisanciEnemyModel,
  createSparkZapProjectile,
  createBosmanKrakowBossModel,
  createOdprawaClipboardProjectile,
  getFloorTexture,
  getShowroomMarbleFloorTexture,
  getShowroomWallTexture,
  getTerminalGraniteFloorTexture,
  getHazardStripeTexture,
  getMaxFlizLogoTexture,
  getWallTexture,
  createKfcBucketCollectible,
  createZombieWorkerEnemyModel,
  createGlueSpillTrapModel,
  createLaserCutterTrapModel,
  createSteamGeyserTrapModel,
  createHydraulicPressTrapModel,
} from './warehouseAssets.ts';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface SurvivalUpgradeOption {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface SurvivalSnapshot {
  elapsedSeconds: number;
  wave: number;
  kills: number;
  level: number;
  xp: number;
  xpToNext: number;
  aliveEnemies: number;
}

export interface GameCallbacks {
  onScoreUpdate: (score: number, collectedVip: number, totalVip: number) => void;
  onHpUpdate: (hp: number, maxHp: number) => void;
  onAbilityCooldown: (progress: number, ready: boolean) => void;
  onSpeechBubble: (text: string) => void;
  onLevelComplete: (levelId: number, score: number, timeStr: string) => void;
  onGameOver: (reason: string) => void;
  onBossUpdate?: (name: string, hp: number, maxHp: number, visible: boolean, phase?: number) => void;
  onPerksUpdate?: (perks: ActivePerks) => void;
  onFloatingText?: (text: string, x: number, y: number, z: number, type?: 'points' | 'vip' | 'easter-egg' | 'damage' | 'perk' | 'combo' | 'enemy_shout', metadata?: any) => void;
  onPerkDropBanner?: (name: string, icon: string, desc: string, color: string) => void;
  onSurvivalUpdate?: (snapshot: SurvivalSnapshot) => void;
  onSurvivalLevelUp?: (options: SurvivalUpgradeOption[]) => void;
}

export class MaxFlizGameEngine {
  public static readonly ENEMY_QUOTES: Record<string, string[]> = {
    customer: [
      "Gdzie moja faktura proforma?! Czekam od rana!",
      "Ta fuga miała być popielata, a jest mysia!",
      "Żądam natychmiastowej rozmowy z kierownikiem!",
      "Panie, w Castoramie mieli to 30% taniej!",
      "Dlaczego ten gres jest krzywy o pół milimetra?!",
      "Kierownik Walczak obiecał mi rabat 40% na płytki!",
      "Kto mi zapłaci za przestój ekipy kafelkarzy?!",
    ],
    architect: [
      "Ten beż jest zbyt chłodny o 2 Kelvin!",
      "Czy to na pewno oryginalny spiek kwarcowy z Bolonii?!",
      "Kto pozwolił na fugę 2mm?! Tylko bezfugowo i z mikro-fazą!",
      "Mój projekt penthouse'u w Sopocie legnie w gruzach!",
      "Ostrożnie z tym 샘plem! To limitowana edycja z Mediolanu!",
      "Zmieńcie to oświetlenie, gres traci swoją organiczną duszę!",
    ],
    pan_roman: [
      "Panowie spieszę się, na pace mam 8 wanien wolnostojących!",
      "Gdzie mam zrzucić te kible?! Byle nie na deszczu!",
      "Rudy z DPD znowu zajął moją rampę rozładunkową!",
      "Panie kierowniku, pieczątka na WZ-tce i mnie nie ma!",
      "Uwaga na paleciak, hamulce skończyły się w 2018 roku!",
      "Rzucam umywalką, łap pan albo będzie po premii!",
    ],
    kurier: [
      "Awizo zostawione w gaśnicy BHP na trzecim piętrze!",
      "Dostawa Johnny Walker Express dla prezesa!",
      "Mam 40 paczek i 12 minut do końca zmiany!",
      "Podpisz pan cokolwiek palcem po brudnym ekranie!",
      "Paczka lekko obita, ale w środku na bank nic nie pękło!",
      "Paczkomat był pełny, więc rzuciłem pod drzwi rampy!",
    ],
    serwisant: [
      "Kto wcisnął grzałkę w wannie bez wlanej wody?!",
      "Tu jest zwarcie na pompie hydromasażu, zaraz wywali korki!",
      "Nie dotykaj tej fazy, to kabel zasilający od prezesa!",
      "Gdzie jest schemat bezpieczników z sektora B?!",
      "Trzymaj probówkę, jak zaiskrzy to znaczy że działa!",
    ],
    sztaplar_szalony: [
      "Z drogi, paleciak nie ma ABS-u ani litości!",
      "Drift na mokrym gresie Calacatta to moja jedyna pasja!",
      "Kto zostawił puste kartony w alei głównej?!",
      "Paleta 800 kilo leci z góry, klakson zepsuty!",
      "Kierownik mówił 'ostrożnie', ale ja mam normę do wyrobienia!",
    ],
    inspector: [
      "Protokół BHP: brak atestowanego kasku i gilotyna bez osłony!",
      "Zaraz wstrzymam wydawanie towaru na cały długi weekend!",
      "Gdzie jest certyfikat CE na te wanny z masażem bąbelkowym?!",
      "Mandat 5000 zł za brak żółtych linii ostrzegawczych!",
      "Widzę tu rażące naruszenie przepisów przeciwpożarowych!",
    ],
    handlowiec: [
      "Tylko dzisiaj: rabat inwestycyjny 35% na armaturę!",
      "Mam klienta na 1200 metrów kwadratowych mozaiki!",
      "Kierownik zgodzi się na darmowy transport z wniesieniem!",
      "Podpiszmy aneks, dorzucę zapas fugi epoksydowej gratis!",
      "Ten marmur sprzedaje się sam, proszę brać zanim zdrożeje!",
    ],
    monter: [
      "Wiesław, podaj poziomicę, tu jest centymetr spadku na metrze!",
      "Klej dwuskładnikowy już wiąże w wiadrze, ruszajcie się!",
      "Za taką stawkę za metr to ja mogę co najwyżej fugować!",
      "Kto kładł te płytki pod prąd słojów drewna?!",
      "Dociągnij ten syfon, bo znowu zaleje showroom na dole!",
    ],
    agv_robot: [
      "BEEP-BOOP: Wykryto przeszkodę biologiczną w alei B4.",
      "SYSTEM: Kurs kolizyjny z wanną akrylową. Manewr omijania nieudany.",
      "BATERIA: 98%. Przewożę 16 misek wiszących bezkołnierzowych.",
      "OSTRZEŻENIE: Algorytm autonomiczny żąda podwyżki w watogodzinach.",
    ],
    piorun_dron: [
      "SKAN KODU KRESKOWEGO: Błąd sumy kontrolnej!",
      "ALERT DRONA: Wykryto operatora bez uprawnień UDT kat. II!",
      "PROMIENIOWANIE WI-FI: Sygnał z centrali Max-Fliz 100%.",
      "RADAR LASEROWY: Paleta krzywo ustawiona o 3 stopnie!",
    ],
    elite_walczak_guard: [
      "Wstęp do Sektora VIP tylko z przepustką dyrektorską!",
      "Chronimy ostatnią paletę Calacatta Gold przed spekulantami!",
      "Stój! Walczak nie przyjmuje już żadnych reklamacji!",
      "Tylko przez mój trup dotkniesz tej armatury z 24k złota!",
    ],
    bosman_krakow: [
      "Odprawa 3-miesięczna czeka na każdego marudera!",
      "W Krakowie na centrali nikt tak flegmatycznie palet nie nosił!",
      "Podpisuj rozwiązanie umowy za porozumieniem stron!",
      "Rzucam teczką personalną, unikaj jak potrafisz!",
      "Na mój pokład wchodzą tylko ludzie z certyfikatem UDT!",
    ],
    walczak: [
      "Ja tu byłem kierownikiem zanim wybudowano ten salon!",
      "Na mojej zmianie nie ma przerw na papierosa ani kawę!",
      "Karę umowną 50 000 zł wyślę ci poleconym za potwierdzeniem!",
      "Szczekaczka Walczaka zagłuszy twoje żałosne prośby o premię!",
      "TRYB SZAŁU: Cały magazyn zostaje na bezpłatne nadgodziny!",
      "Zafuguję cię w tym regale wysokiego składowania!",
    ],
    krol_leto: [
      "Jam jest Król-Leto, Pan na Spiekach i Władca Wszystkich Salonów!",
      "Twoja umowa na czas określony właśnie dobiegła końca!",
      "Na kolana przed majestatem włoskiego gresu 120x280!",
      "Dyscyplinarka ze skutkiem natychmiastowym bez prawa do odprawy!",
      "Zostaniesz zafugowany w postumencie ekspozycyjnym na wieczność!",
      "Żaden magazynier nie opuści tego terminala żywy!",
    ],
    zombie_pracownik: [
      "KFC?! Dawid przywiózł kubełek! Z drogi!",
      "STRIIIaaPSY... czuję gorącą panierkę z pięciu alejek!",
      "Trzecia zmiana bez obiadu... oddawaj skrzydełka!",
      "Kubełek jest MÓJ! Nie dzielę się frytkami!",
      "Móóózg... znaczy KURCZAAAK z dostawy Dawida!",
    ],
  };

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public container: HTMLElement;
  public threeRenderer: THREE.WebGLRenderer | null = null;

  private state: GameState = 'title';
  private currentCharacterId: CharacterId = 'marcin';
  private charDef: CharacterDef;
  private coffeeMachines: { mesh: THREE.Group; x: number; y: number; z: number; cooldown: number }[] = [];

  public getGameState(): GameState {
    return this.state;
  }

  // Player state
  private playerPos = new THREE.Vector3(0, 1, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerRot = 0;
  private isGrounded = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private hp = 3;
  private maxHp = 3;
  private score = 0;
  private comboStreak = 0;
  private comboTimer = 0;
  private collectedVipCount = 0;
  private totalVipCount = 0;
  private invulnerableTimer = 0;
  private abilityTimer = 0;
  private abilityActiveDuration = 0;
  private attackCooldownTimer = 0;
  private attackSwingTimer = 0;
  private walkCycle = 0;
  private speechBubbleTimer = 0;
  private levelStartTime = 0;
  private cameraShake = 0;
  private screenShakeDuration = 0;
  private screenShakeIntensity = 0;
  private screenShakeTimer = 0;
  private cameraMode: 'tpp' | 'close' | 'iso' = 'iso';
  private camZoomFactor = 1.0;
  private minimapZoomScale = 3.5;
  private minimapVisible = true;
  private minimapFrameCounter = 0;
  private finishGatePos = new THREE.Vector3(30, 0, 0);
  private smoothCamY = 0.5;
  // Tactical Elevated camera default (~45° isometric/tactical perspective like Hades/Brawl Stars)
  private currentCamOffset = new THREE.Vector3(0.0, 16.5, 13.5);
  private currentLookAt = new THREE.Vector3(0, 1.2, 0);
  private bossCamZoom = 1.0;
  private finishWarningTimer = 0;
  private dodgeCooldownTimer = 0;
  private hitStopTimer = 0;
  private targetRing!: THREE.Mesh;
  private bloomPulseTimer = 0;
  private levelBounds = { minX: -35, maxX: 35, minZ: -15, maxZ: 15 };
  private envMapInitialized = false;
  private attackComboStep = 0;
  private timedEventCooldown = 20.0;
  private timedEventIndex = 0;
  private doublePointsTimer = 0;
  private glueSlowTimer = 0;
  private marcinWoTPenaltyTimer = 0;
  private outlineMaterial: THREE.ShaderMaterial | null = null;
  private dofBlurPassMesh: THREE.Mesh | null = null;
  private dofBlurMaterial: THREE.ShaderMaterial | null = null;
  private bulldozerHitCooldowns = new Map<string, number>();
  private globalEnemyShoutCooldown = 0;
  // Re-evaluate the nearest enemies in short slices instead of allocating/sorting every rendered frame.
  private waveDirectorCooldown = 0;
  private activeChaserIds = new Set<string>();
  private threatTier = 0;

  // Survival Shift is an independent mode. Campaign state and progression remain unchanged.
  private gameMode: 'campaign' | 'survival' = 'campaign';
  private survivalElapsed = 0;
  private survivalSpawnTimer = 0;
  private survivalCleanupTimer = 4;
  private survivalUiTimer = 0;
  private survivalWave = 1;
  private survivalKills = 0;
  private survivalLevel = 1;
  private survivalXp = 0;
  private survivalXpToNext = 6;
  private survivalBossWave = 0;
  private survivalDamageMultiplier = 1;
  private survivalAttackRateMultiplier = 1;
  private survivalMoveMultiplier = 1;
  private survivalMagnetMultiplier = 1;
  private survivalPendingOptions: SurvivalUpgradeOption[] = [];
  private survivalXpGems: { mesh: THREE.Mesh; value: number; life: number; phase: number }[] = [];

  public getPacingFactor(): number {
    if (this.state !== 'playing' || this.levelStartTime <= 0) return this.gameMode === 'survival' ? 0.78 : 0.50;
    const elapsedSec = (performance.now() - this.levelStartTime) / 1000;
    if (this.gameMode === 'survival') return Math.min(1.0, 0.78 + (elapsedSec / 180) * 0.22);
    // Starts at 0.50 (50% speed) and linearly scales up to 1.0 (100% speed) over 150 seconds (Vampire Survivors style pacing)
    return Math.min(1.0, 0.50 + (elapsedSec / 150) * 0.50);
  }

  public triggerBloomPulse(durationSec = 0.3) {
    this.bloomPulseTimer = durationSec;
  }

  public zoomInCamera() {
    this.camZoomFactor = Math.max(0.4, this.camZoomFactor - 0.15);
  }

  public zoomOutCamera() {
    this.camZoomFactor = Math.min(2.8, this.camZoomFactor + 0.15);
  }

  public setCamZoomFactor(val: number) {
    this.camZoomFactor = THREE.MathUtils.clamp(val, 0.4, 2.2);
  }

  public getCamZoomFactor(): number {
    return this.camZoomFactor;
  }

  public toggleCameraMode(): 'tpp' | 'close' | 'iso' {
    if (this.cameraMode === 'tpp') {
      this.cameraMode = 'close';
    } else if (this.cameraMode === 'close') {
      this.cameraMode = 'iso';
    } else {
      this.cameraMode = 'tpp';
    }
    return this.cameraMode;
  }

  public zoomInMinimap() {
    this.minimapZoomScale = Math.min(7.5, this.minimapZoomScale + 0.8);
  }

  public zoomOutMinimap() {
    this.minimapZoomScale = Math.max(1.8, this.minimapZoomScale - 0.8);
  }

  public toggleMinimap() {
    this.minimapVisible = !this.minimapVisible;
    const elem = document.getElementById('minimap-container');
    if (elem) {
      if (this.minimapVisible) elem.classList.remove('collapsed');
      else elem.classList.add('collapsed');
    }
  }

  public setLevelVisible(visible: boolean) {
    this.levelRoot.visible = visible;
    if (this.targetRing) this.targetRing.visible = visible;
  }

  public triggerScreenShake(intensity: number, durationSec: number = 0.5) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeDuration = durationSec;
    this.screenShakeTimer = durationSec;
    this.cameraShake = Math.max(this.cameraShake, intensity * 0.6);
  }

  public triggerHitStop(durationSec = 0.04) {
    this.hitStopTimer = Math.max(this.hitStopTimer, durationSec);
  }
  private marcinReclamationTimer = 0;
  private grzesiekCrushTimer = 0;
  private grzesiekCrushPulse = 0;
  private mateuszPassiveCount = 0;
  private mateuszLagTimer = 0;

  // Active Perks & Jump Modifiers
  private activePerks: ActivePerks = {
    doubleJump: 0,
    shield: false,
    magnet: 0,
    speedBoost: 0,
    kfcBerserk: 0,
    bulldozer: 0,
  };
  private hasDoubleJumped = false;

  // 3D Player Meshes
  private playerGroup: THREE.Group | null = null;
  private leftLeg: THREE.Mesh | null = null;
  private rightLeg: THREE.Mesh | null = null;
  private leftArm: THREE.Mesh | null = null;
  private rightArm: THREE.Mesh | null = null;
  private playerHead: THREE.Mesh | null = null;
  private playerBody: THREE.Mesh | null = null;

  // Level geometry & entities
  private currentLevelId = 1;
  private levelRoot = new THREE.Group();
  private platforms: PlatformBlock[] = [];
  private collectibles: CollectibleItem[] = [];
  private droppedPerks: DroppedPerkItem[] = [];
  private hazards: HazardItem[] = [];
  private explosiveBarrels: {
    id: string;
    x: number;
    y: number;
    z: number;
    mesh: THREE.Group;
    fuseTimer: number;
    exploded: boolean;
  }[] = [];
  private enemies: EnemyItem[] = [];
  private enemyProjectiles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; isDyscyplinarka?: boolean }[] = [];
  private particles: {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];
  private projectiles: {
    mesh: THREE.Object3D;
    vel: THREE.Vector3;
    life: number;
    maxLife?: number;
    damage?: number;
    pierce?: number;
    ricochet?: boolean;
    boomerang?: boolean;
    returning?: boolean;
    homing?: boolean;
    aoeRadius?: number;
    stunDuration?: number;
    slowOnHit?: boolean;
    igniteOnHit?: boolean;
    collectItems?: boolean;
    spinSpeed?: number;
    hitIds?: Set<string>;
  }[] = [];
  private specialEffects: {
    mesh: THREE.Mesh | THREE.Group;
    life: number;
    maxLife: number;
    grow: number;
    spin: number;
    update?: (dt: number, progress: number) => void;
  }[] = [];
  private bimberMolotovs: {
    mesh: THREE.Group;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
    flameLight?: THREE.PointLight;
    flameMesh?: THREE.Mesh;
  }[] = [];
  private bimberFirePuddles: {
    group: THREE.Group;
    x: number;
    y: number;
    z: number;
    radius: number;
    duration: number;
    maxDuration: number;
    tickTimer: number;
    flames: THREE.Mesh[];
    light: THREE.PointLight;
  }[] = [];
  private fallingTiles: {
    id: string;
    x: number;
    y: number;
    z: number;
    targetY: number;
    fallSpeed: number;
    state: 'warning' | 'falling' | 'shattered';
    warningTimer: number;
    mesh: THREE.Group;
    warningRing: THREE.Mesh;
  }[] = [];
  private lootCrates: { mesh: THREE.Group; x: number; y: number; z: number }[] = [];
  private fallingTileSpawnTimer = 0;
  private randomSpawnTimer = 0;

  // Input state
  private keys: Record<string, boolean> = {};
  private virtualJoystick = { x: 0, y: 0 };
  private callbacks: GameCallbacks;

  // Lighting
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private ambientLight!: THREE.AmbientLight;
  private rimLight!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, container: HTMLElement, callbacks: GameCallbacks) {
    this.scene = scene;
    this.camera = camera;
    this.container = container;
    this.callbacks = callbacks;
    this.charDef = CHARACTERS[this.currentCharacterId];

    this.camera.far = 160;
    this.scene.background = new THREE.Color(0x07131d);
    this.scene.add(this.levelRoot);

    // Enhanced Hero Tactical Ground Ring (Podwyższony wskaźnik taktyczny pod stopami)
    const ringGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.82, 32),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    outerRing.rotation.x = -Math.PI / 2;

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.35, 24),
      new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;

    // Directional chevron indicator pointing in hero's facing orientation
    const chevronGeo = new THREE.ConeGeometry(0.18, 0.36, 3);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const chevron = new THREE.Mesh(chevronGeo, chevronMat);
    chevron.rotation.x = Math.PI / 2;
    chevron.rotation.z = Math.PI;
    chevron.position.set(0, 0.01, 0.92);
    chevron.name = 'chevron';

    ringGroup.add(outerRing, innerRing, chevron);
    this.targetRing = ringGroup as any;
    this.scene.add(this.targetRing);

    this.setupLighting();
    this.setupInput();
    // loadLevel(1) removed from constructor to prevent blocking main thread on boot
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xcfe8ff, 0.8);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xbfe6ff, 0x101827, 1.5);
    this.scene.add(this.hemiLight);

    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    this.dirLight = new THREE.DirectionalLight(0xfff4d6, 3.5);
    this.dirLight.position.set(16, 26, 14);
    this.dirLight.castShadow = true;
    
    // Performance optimization: 512px shadow map on mobile for stable 60 FPS, 1024px on desktop
    const shadowMapSize = isMobile ? 512 : 1024;
    this.dirLight.shadow.mapSize.width = shadowMapSize;
    this.dirLight.shadow.mapSize.height = shadowMapSize;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = isMobile ? 50 : 65;
    const d = isMobile ? 16 : 22;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = isMobile ? -0.0008 : -0.0004;
    (this.dirLight.shadow as any).normalBias = 0.02;
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0x60a5fa, 1.1);
    this.rimLight.position.set(-16, 10, -14);
    this.scene.add(this.rimLight);

    this.scene.fog = new THREE.Fog(0x091827, 20, 85);

    // Depth-of-Field Background Blur Shader Overlay attached to Camera
    const dofMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScreenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec2 uScreenSize;
        uniform float uTime;

        void main() {
          // Soft Depth-of-Field tilt-shift background blur shader
          // Gently softens upper/lower distant warehouse clutter beyond combat focus zone
          float distFromFocusCenter = abs(vUv.y - 0.44);
          float blurFactor = smoothstep(0.24, 0.48, distFromFocusCenter);

          // Subtle atmospheric depth blur color mask
          vec3 depthColor = vec3(0.02, 0.05, 0.10);
          float alpha = blurFactor * 0.18;

          gl_FragColor = vec4(depthColor, alpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.dofBlurMaterial = dofMat;

    const dofPlaneGeo = new THREE.PlaneGeometry(2, 2);
    const dofMesh = new THREE.Mesh(dofPlaneGeo, dofMat);
    dofMesh.frustumCulled = false;
    dofMesh.renderOrder = 998;
    this.dofBlurPassMesh = dofMesh;
    this.camera.add(dofMesh);
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        this.jumpBufferTimer = 0.16;
        e.preventDefault();
      }
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.triggerAbility();
      }
      if (e.code === 'KeyF' || e.code === 'KeyJ' || e.code === 'KeyX' || e.code === 'Numpad0') {
        this.triggerAttack();
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.togglePause();
      }
      if (e.code === 'KeyC' || e.code === 'KeyV') {
        this.toggleCameraMode();
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        this.zoomInCamera();
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        this.zoomOutCamera();
      }
      if (e.code === 'KeyN') {
        this.toggleMinimap();
      }
      if (e.code === 'KeyT') {
        if (this.state === 'playing') {
          this.triggerTimedWarehouseEvent();
        }
      }
    });

    this.container?.addEventListener('wheel', (e: WheelEvent) => {
      if (this.state === 'playing') {
        e.preventDefault();
        if (e.deltaY > 0) {
          this.zoomOutCamera();
        } else {
          this.zoomInCamera();
        }
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') {
        if (this.playerVel.y > 2.0) {
          this.playerVel.y *= 0.52;
        }
      }
    });

    const canvasContainer = document.getElementById('game-canvas-container');
    canvasContainer?.addEventListener('pointerdown', (e) => {
      if (this.state === 'playing' && e.button === 0) {
        const target = e.target as HTMLElement | null;
        if (target && (target.closest('.hud-layer') || target.closest('.touch-layer') || target.closest('.game-modal') || target.closest('.game-screen'))) {
          return;
        }
        this.triggerAttack();
      }
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.virtualJoystick = { x: 0, y: 0 };
    });
  }

  public setVirtualInput(x: number, y: number) {
    this.virtualJoystick.x = x;
    this.virtualJoystick.y = y;
  }

  public selectCharacter(id: CharacterId) {
    this.currentCharacterId = id;
    this.charDef = CHARACTERS[id];
    this.rebuildPlayerMesh();
    this.sayRandomVoiceLine();
  }

  public getCharacterDef(): CharacterDef {
    return this.charDef;
  }

  public getCameraMode(): 'tpp' | 'close' | 'iso' {
    return this.cameraMode;
  }

  public isPaused(): boolean {
    return this.state === 'paused';
  }

  public setCamera(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public setScene(scene: THREE.Scene) {
    this.scene = scene;
    if (!this.scene.children.includes(this.levelRoot)) {
      this.scene.add(this.levelRoot);
    }
  }

  private rebuildPlayerMesh() {
    if (this.playerGroup) {
      this.levelRoot.remove(this.playerGroup);
    }
    const built = createCharacterModel(this.charDef);
    this.playerGroup = built.group;
    this.leftLeg = built.leftLeg;
    this.rightLeg = built.rightLeg;
    this.leftArm = built.leftArm;
    this.rightArm = built.rightArm;
    this.playerHead = built.head;
    this.playerBody = built.body;

    // STENCIL BUFFER OUTLINE SHADER FOR HIGH VISIBILITY
    // 1. Configure stencil writing on player primary geometry
    this.playerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = child.material.clone();
        child.material.stencilWrite = true;
        child.material.stencilRef = 1;
        child.material.stencilFunc = THREE.AlwaysStencilFunc;
        child.material.stencilZPass = THREE.ReplaceStencilOp;
      }
    });

    // 2. Create inverted normal stencil outline material & shell
    const outlineMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x38bdf8) },
        uOutlineThickness: { value: 0.038 },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uOutlineThickness;
        void main() {
          vec3 extruded = position + normal * uOutlineThickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(extruded, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        void main() {
          float pulse = 0.82 + 0.18 * sin(uTime * 6.0);
          gl_FragColor = vec4(uColor * pulse, 0.95);
        }
      `,
      side: THREE.BackSide,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
      transparent: true,
      depthWrite: false,
    });
    this.outlineMaterial = outlineMat;

    const outlineShell = new THREE.Group();
    outlineShell.name = 'characterOutlineShell';
    this.playerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const oMesh = new THREE.Mesh(child.geometry, outlineMat);
        oMesh.position.copy(child.position);
        oMesh.rotation.copy(child.rotation);
        oMesh.scale.copy(child.scale);
        outlineShell.add(oMesh);
      }
    });
    this.playerGroup.add(outlineShell);

    this.playerGroup.position.copy(this.playerPos);
    this.levelRoot.add(this.playerGroup);
  }

  public startTitle() {
    this.gameMode = 'campaign';
    this.maxHp = 3;
    this.state = 'title';
    this.hp = this.maxHp;
    this.score = 0;
    this.collectedVipCount = 0;
    this.abilityTimer = 0;
    this.activePerks = {
      doubleJump: 0,
      shield: false,
      magnet: 0,
      speedBoost: 0,
    };
    this.marcinReclamationTimer = 0;
    this.grzesiekCrushTimer = 0;
    this.grzesiekCrushPulse = 0;
    this.callbacks.onPerksUpdate?.(this.activePerks);
    this.callbacks.onSpeechBubble('');
    this.rebuildPlayerMesh();
    this.playerPos.set(0, 0.5, 0);
    this.callbacks.onBossUpdate?.('', 0, 0, false);
    this.setLevelVisible(true);
    
    // Build initial level for title visual if not already built
    if (this.platforms.length === 0) {
      this.loadLevel(1);
    }
  }

  public startGame(levelId = 1) {
    this.gameMode = 'campaign';
    this.state = 'playing';
    this.maxHp = 3;
    this.hp = this.maxHp;
    this.score = 0;
    this.comboStreak = 0;
    this.collectedVipCount = 0;
    this.abilityTimer = 0;
    this.levelStartTime = performance.now();
    this.waveDirectorCooldown = 0;
    this.activeChaserIds.clear();
    this.threatTier = 0;
    this.survivalElapsed = 0;
    this.survivalSpawnTimer = 0;
    this.survivalCleanupTimer = 4;
    this.survivalUiTimer = 0;
    this.survivalWave = 1;
    this.survivalKills = 0;
    this.survivalLevel = 1;
    this.survivalXp = 0;
    this.survivalXpToNext = 6;
    this.survivalBossWave = 0;
    this.survivalDamageMultiplier = 1;
    this.survivalAttackRateMultiplier = 1;
    this.survivalMoveMultiplier = 1;
    this.survivalMagnetMultiplier = 1;
    this.survivalPendingOptions = [];
    this.marcinReclamationTimer = 0;
    this.grzesiekCrushTimer = 0;
    this.grzesiekCrushPulse = 0;
    this.playerVel.set(0, 0, 0);
    this.screenShakeTimer = 0;
    this.screenShakeIntensity = 0;
    this.cameraShake = 0;
    if (this.container) {
      this.container.style.transform = '';
    }
    this.invulnerableTimer = 0;
    this.hitStopTimer = 0;
    this.virtualJoystick = { x: 0, y: 0 };
    this.keys = {};
    this.activePerks = {
      doubleJump: 0,
      shield: false,
      magnet: 0,
      speedBoost: 0,
      kfcBerserk: 0,
      bulldozer: 0,
    };
    this.timedEventCooldown = 16.0;
    this.doublePointsTimer = 0;
    this.glueSlowTimer = 0;
    this.attackComboStep = 0;
    this.bulldozerHitCooldowns.clear();
    this.cameraMode = 'iso';
    this.applyAutoCameraScaleForViewport();

    this.callbacks.onPerksUpdate?.(this.activePerks);
    this.callbacks.onSpeechBubble('');
    this.loadLevel(levelId);
    this.callbacks.onHpUpdate(this.hp, this.maxHp);
    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
    this.sayRandomVoiceLine();
  }

  public startSurvival() {
    // Build the existing warehouse environment, then replace campaign encounters with a managed arena.
    this.startGame(1);
    this.gameMode = 'survival';
    this.levelBounds = { minX: -31, maxX: 31, minZ: -13.5, maxZ: 13.5 };
    this.currentActiveSector = 1;
    this.currentLevelId = 1;
    this.playerPos.set(0, 0.5, 0);
    this.playerVel.set(0, 0, 0);
    if (this.playerGroup) this.playerGroup.position.copy(this.playerPos);
    this.smoothCamY = this.playerPos.y;
    this.currentLookAt.set(this.playerPos.x, this.playerPos.y + 0.85, this.playerPos.z);

    for (const enemy of this.enemies) this.disposeEnemyModel(enemy);
    this.enemies = [];
    for (const hazard of this.hazards) {
      if (hazard.mesh) this.levelRoot.remove(hazard.mesh);
      if (hazard.warningMesh) this.levelRoot.remove(hazard.warningMesh);
    }
    this.hazards = [];
    for (const barrel of this.explosiveBarrels) {
      if (barrel.mesh) this.levelRoot.remove(barrel.mesh);
    }
    this.explosiveBarrels = [];
    for (const tile of this.fallingTiles) {
      this.levelRoot.remove(tile.mesh);
      this.levelRoot.remove(tile.warningRing);
    }
    this.fallingTiles = [];
    this.fallingTileSpawnTimer = 0;
    this.randomSpawnTimer = 6;

    this.callbacks.onBossUpdate?.('', 0, 0, false);
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    this.emitFloatingToast('SURVIVAL SHIFT — PRZETRWAJ ZMIANĘ!', this.playerPos.x, this.playerPos.y + 1.8, this.playerPos.z, 'combo');
  }

  public getGameMode(): 'campaign' | 'survival' {
    return this.gameMode;
  }

  public getSurvivalSnapshot(): SurvivalSnapshot {
    return {
      elapsedSeconds: Math.floor(this.survivalElapsed),
      wave: this.survivalWave,
      kills: this.survivalKills,
      level: this.survivalLevel,
      xp: this.survivalXp,
      xpToNext: this.survivalXpToNext,
      aliveEnemies: this.enemies.reduce((count, enemy) => count + (enemy.state === 'defeated' ? 0 : 1), 0),
    };
  }

  public chooseSurvivalUpgrade(id: string): boolean {
    if (this.gameMode !== 'survival' || this.state !== 'levelup') return false;
    const choice = this.survivalPendingOptions.find((option) => option.id === id);
    if (!choice) return false;

    switch (choice.id) {
      case 'damage':
        this.survivalDamageMultiplier *= 1.20;
        break;
      case 'rapid':
        this.survivalAttackRateMultiplier *= 0.88;
        break;
      case 'boots':
        this.survivalMoveMultiplier *= 1.10;
        break;
      case 'magnet':
        this.survivalMagnetMultiplier *= 1.65;
        break;
      case 'reinforced':
        this.maxHp += 1;
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.callbacks.onHpUpdate(this.hp, this.maxHp);
        break;
      case 'medkit':
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.activePerks.shield = true;
        this.callbacks.onHpUpdate(this.hp, this.maxHp);
        this.callbacks.onPerksUpdate?.(this.activePerks);
        break;
    }

    this.survivalPendingOptions = [];
    this.state = 'playing';
    this.emitFloatingToast('ULEPSZENIE: ' + choice.title, this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'perk');
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());

    if (this.survivalXp >= this.survivalXpToNext) {
      this.beginSurvivalLevelUp();
    }
    return true;
  }

  public togglePause() {
    if (this.gameMode === 'survival' && this.state === 'levelup') return;
    if (this.state === 'playing') {
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'playing';
    }
  }

  private disposeEnemyModel(enemy: EnemyItem) {
    const mesh = enemy.mesh as THREE.Object3D | undefined;
    if (!mesh) return;
    this.levelRoot.remove(mesh);

    // Release per-enemy GPU geometry/material resources after the entity is gone.
    // Textures are intentionally not disposed here because asset textures may be shared.
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    mesh.traverse((object) => {
      const renderable = object as THREE.Mesh;
      if (renderable.geometry) geometries.add(renderable.geometry);
      const material = renderable.material;
      if (Array.isArray(material)) material.forEach((item) => materials.add(item));
      else if (material) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private clearLevel() {
    for (const enemy of this.enemies) this.disposeEnemyModel(enemy);
    while (this.levelRoot.children.length > 0) {
      this.levelRoot.remove(this.levelRoot.children[0]);
    }
    this.platforms = [];
    this.collectibles = [];
    this.droppedPerks = [];
    this.lootCrates = [];
    this.coffeeMachines = [];
    this.fallingTiles = [];
    this.fallingTileSpawnTimer = 0;
    this.randomSpawnTimer = 0;
    this.bulldozerHitCooldowns.clear();
    for (const gem of this.survivalXpGems) {
      this.levelRoot.remove(gem.mesh);
      gem.mesh.geometry.dispose();
      const material = gem.mesh.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    }
    this.survivalXpGems = [];
    this.hazards = [];
    this.explosiveBarrels = [];
    this.enemies = [];
    this.activeChaserIds.clear();
    this.waveDirectorCooldown = 0;
    this.threatTier = 0;
    this.enemyProjectiles = [];
    this.particles = [];
    this.projectiles = [];
    this.specialEffects = [];
    this.bimberMolotovs = [];
    this.bimberFirePuddles = [];
    this.totalVipCount = 0;
    this.collectedVipCount = 0;
    this.marcinReclamationTimer = 0;
    this.grzesiekCrushTimer = 0;
    this.grzesiekCrushPulse = 0;
  }

  private currentActiveSector = 1;

  public loadLevel(levelId: number) {
    this.currentLevelId = levelId;
    this.currentActiveSector = levelId;
    this.clearLevel();
    this.rebuildPlayerMesh();

    // Unified Mega-Map Layout: Sektor A (-36..+36) -> Sektor B (+36..+116) -> Sektor C (+116..+206)
    this.scene.background = new THREE.Color(0x07131d);
    this.levelBounds = { minX: -36, maxX: 206, minZ: -16, maxZ: 16 };
    
    this.buildLevel1();
    this.buildLevel2(76);
    this.buildLevel3(161);

    // Spawn player at chosen starting sector checkpoint on the unified map
    if (levelId === 2) {
      this.playerPos.set(41, 0.5, 0);
    } else if (levelId === 3) {
      this.playerPos.set(121, 0.5, 0);
    } else {
      this.playerPos.set(-32, 0.5, 0);
    }
    this.playerVel.set(0, 0, 0);
    if (this.playerGroup) {
      this.playerGroup.position.copy(this.playerPos);
    }

    this.smoothCamY = this.playerPos.y;
    this.currentLookAt.set(this.playerPos.x, this.playerPos.y + 0.85, this.playerPos.z);
    this.finishWarningTimer = 0;

    this.callbacks.onBossUpdate?.('', 0, 0, false);
    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
  }

  private addJumpPad(x: number, y: number, z: number, launchForce = 17.5) {
    const padGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.18, 16), baseMat);
    
    const ringGeo = new THREE.RingGeometry(0.4, 0.8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.095;

    const springMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 })
    );
    springMesh.position.y = 0.12;

    const arrowMesh = createAisleArrow(1.2);
    arrowMesh.position.y = 0.105;
    arrowMesh.rotation.y = Math.PI;

    padGroup.add(baseMesh, ringMesh, springMesh, arrowMesh);
    padGroup.position.set(x, y, z);
    this.levelRoot.add(padGroup);

    this.platforms.push({
      x,
      y: y + 0.1,
      z,
      width: 1.7,
      height: 0.2,
      depth: 1.7,
      type: 'jump_pad',
      bounce: launchForce,
      mesh: padGroup,
    });
  }

  private addSpeedPad(x: number, y: number, z: number) {
    const padGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.3 });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 3.2), baseMat);

    const stripeMat = new THREE.MeshBasicMaterial({ map: getHazardStripeTexture(), transparent: true, opacity: 0.95 });
    const stripeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.0), stripeMat);
    stripeMesh.rotation.x = -Math.PI / 2;
    stripeMesh.position.y = 0.045;

    padGroup.add(baseMesh, stripeMesh);
    padGroup.position.set(x, y, z);
    this.levelRoot.add(padGroup);

    this.platforms.push({
      x,
      y: y + 0.04,
      z,
      width: 1.6,
      height: 0.08,
      depth: 3.2,
      type: 'speed_pad',
      mesh: padGroup,
    });
  }

  private addExplosiveBarrel(id: string, x: number, y: number, z: number) {
    const mesh = createExplosiveBarrelModel();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);

    this.explosiveBarrels.push({
      id,
      x,
      y,
      z,
      mesh,
      fuseTimer: -1,
      exploded: false,
    });

    this.platforms.push({
      x,
      y: y + 0.55,
      z,
      width: 0.85,
      height: 1.1,
      depth: 0.85,
      type: 'shelf',
      mesh,
    });
  }

  private addGroutItem(id: string, x: number, y: number, z: number, points = 50) {
    const mesh = createGroutCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'grout',
      name: 'Puszka Fugi Max-Fliz',
      x,
      y,
      z,
      mesh,
      collected: false,
      points,
    });
  }

  private addVipItem(id: string, x: number, y: number, z: number, name: string, points = 300) {
    const mesh = createCarraraCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.totalVipCount++;
    this.collectibles.push({
      id,
      type: 'vip_item',
      name,
      x,
      y,
      z,
      mesh,
      collected: false,
      points,
    });
  }

  private addEspressoItem(id: string, x: number, y: number, z: number) {
    const mesh = createEspressoCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'espresso',
      name: 'Espresso z Showroomu (+Prędkość)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 100,
    });
  }

  private addMagnetItem(id: string, x: number, y: number, z: number) {
    const mesh = createMagnetCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'magnet',
      name: 'Skaner Radiowy (+Magnes)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 120,
    });
  }

  public applyAutoCameraScaleForViewport() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const aspect = w / Math.max(1, h);
    if (aspect < 0.65) {
      // Tall portrait smartphone
      this.camZoomFactor = 1.24;
    } else if (aspect < 1.0) {
      // Standard portrait phone / tablet
      this.camZoomFactor = 1.15;
    } else if (w < 920) {
      // Mobile landscape
      this.camZoomFactor = 1.02;
    } else {
      // Desktop / widescreen
      this.camZoomFactor = 1.0;
    }
  }

  private addGoldenCutterItem(id: string, x: number, y: number, z: number) {
    const mesh = createGoldenCutterCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'golden_cutter',
      name: 'Złota Gilotyna do Gresu (+Podwójny Skok)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 150,
    });
  }

  private addKfcBucketItem(id: string, x: number, y: number, z: number) {
    const mesh = createKfcBucketCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'kfc_bucket',
      name: 'Kubełek KFC od Dawida (+2 Kawy & Furia KFC!)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 220,
    });
  }

  private addZombieWorkerEnemy(id: string, x: number, minZ: number, maxZ: number, name = 'Głodny Magazynier-Zombie (Węszy KFC)') {
    const built = createZombieWorkerEnemyModel();
    built.group.position.set(x, 0.4, minZ);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'zombie_pracownik',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minZ,
      startX: minZ,
      endX: maxZ,
      speed: 4.1,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0.5,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: Math.random() * 6,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addGlueSpillTrap(id: string, x: number, z: number, radius = 1.9) {
    const mesh = createGlueSpillTrapModel(radius);
    mesh.position.set(x, 0, z);
    this.levelRoot.add(mesh);
    this.hazards.push({
      id,
      type: 'glue_spill',
      mesh,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed: 0,
      width: radius * 2,
      length: radius * 2,
      dir: 1,
      active: true,
    });
  }

  private addLaserCutterTrap(id: string, x: number, z: number, width = 3.8, speed = 2.6) {
    const built = createLaserCutterTrapModel(width);
    built.group.position.set(x, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'laser_cutter',
      mesh: built.group,
      movingPart: built.bladeCarriage,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed,
      width: 0.85,
      length: width,
      dir: 1,
      active: true,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private addSteamGeyserTrap(id: string, x: number, z: number, period = 4.2) {
    const built = createSteamGeyserTrapModel();
    built.group.position.set(x, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'steam_geyser',
      mesh: built.group,
      movingPart: built.steamColumn,
      warningMesh: built.warningRing,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed: period,
      width: 1.8,
      length: 1.8,
      dir: 1,
      active: true,
      timer: Math.random() * period,
    });
  }

  private addHydraulicPressTrap(id: string, x: number, z: number, speed = 3.2) {
    const built = createHydraulicPressTrapModel();
    built.group.position.set(x, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'hydraulic_press',
      mesh: built.group,
      movingPart: built.stamper,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed,
      width: 2.2,
      length: 2.2,
      dir: 1,
      active: true,
      timer: Math.random() * 3.0,
    });
  }

  private addEasterEgg(id: string, x: number, y: number, z: number, name: string, eggType: 'throne' | 'coffee' | 'folder', points = 500) {
    let group: THREE.Group;
    if (eggType === 'throne') {
      group = createGoldenThroneEasterEgg();
    } else if (eggType === 'coffee') {
      group = createVintageCoffeeCornerEasterEgg();
    } else {
      group = createSecretFolderEasterEgg();
    }
    group.position.set(x, y, z);
    this.levelRoot.add(group);

    this.collectibles.push({
      id,
      type: 'easter_egg',
      name,
      x,
      y,
      z,
      mesh: group,
      collected: false,
      points,
    });
  }

  private addForkliftHazard(id: string, startX: number, endX: number, z: number, speed: number, color = 0xf59e0b) {
    const built = createForkliftModel(color);
    built.group.position.set(startX, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'forklift',
      mesh: built.group,
      startX,
      startZ: z,
      endX,
      endZ: z,
      x: startX,
      y: 0,
      z,
      speed,
      width: 1.8,
      length: 2.8,
      dir: 1,
      active: true,
    });
  }

  private addCustomerEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createCustomerEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'customer',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 1.8,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addArchitectEnemy(id: string, x: number, maxX: number, z: number, name: string) {
    const built = createArchitectEnemyModel();
    built.group.position.set(x, 0.4, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'architect',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z,
      startX: x,
      endX: maxX,
      speed: 2.2,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addAgvRobotEnemy(id: string, minX: number, maxX: number, z: number, name: string) {
    const built = createAgvRobotModel();
    built.group.position.set(minX, 0.2, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'agv_robot',
      name,
      mesh: built.group,
      x: minX,
      y: 0.2,
      z,
      startX: minX,
      endX: maxX,
      speed: 2.6,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
    });
  }

  private addWalczakBossEnemy(id: string, x: number, z: number) {
    const built = createWalczakBossModel();
    built.group.position.set(x, 0.6, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'walczak',
      name: 'Były Kierownik Walczak',
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.6,
      z,
      startX: x - 14,
      endX: x + 14,
      speed: 3.2,
      dir: -1,
      hp: 10,
      maxHp: 10,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.5,
      bossPhase: 1,
    });
  }

  private addKrolLetoBossEnemy(id: string, x: number, z: number) {
    const built = createKrolLetoBossModel();
    built.group.position.set(x, 0.6, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'krol_leto',
      name: 'Król-Leto (Dyrektor Generalny)',
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.6,
      z,
      startX: x - 12,
      endX: x + 12,
      speed: 3.8,
      dir: -1,
      hp: 12,
      maxHp: 12,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.2,
      bossPhase: 1,
    });
  }

  private addInspectorEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createInspectorEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'inspector',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.0,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.5,
    });
  }

  private addHandlowiecEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createHandlowiecEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'handlowiec',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.8,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 3.0,
    });
  }

  private addMonterEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createMonterEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'monter',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.2,
      dir: 1,
      hp: 4,
      maxHp: 4,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.8,
    });
  }

  private addPanRomanEnemy(id: string, x: number, minX: number, maxX: number, name = 'Pan Roman z Dostawą') {
    const built = createPanRomanEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'pan_roman',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 3.2,
      dir: 1,
      hp: 4,
      maxHp: 4,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.0,
    });
  }

  private addSerwisanciEnemy(id: string, x: number, minX: number, maxX: number, name = 'Serwisant Max-Flixu') {
    const built = createSerwisanciEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'serwisant',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.6,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.4,
    });
  }

  private addBosmanKrakowBossEnemy(id: string, x: number, z: number) {
    const built = createBosmanKrakowBossModel();
    built.group.position.set(x, 0.6, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'bosman_krakow',
      name: 'Bosman z Krakowa (Mini-Boss)',
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.6,
      z,
      startX: x - 10,
      endX: x + 10,
      speed: 2.4,
      dir: -1,
      hp: 8,
      maxHp: 8,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.8,
    });
  }

  private addPiorunDronEnemy(id: string, startX: number, endX: number, z: number, y = 1.9, name = 'Piorun Dron Magazynowy AI') {
    const built = createPiorunDronModel();
    built.group.position.set(startX, y, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'piorun_dron',
      name,
      mesh: built.group,
      x: startX,
      y,
      z,
      startX,
      endX,
      speed: 3.5,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.rotors[0],
      legR: built.rotors[1],
      armL: built.rotors[2],
      armR: built.rotors[3],
    });
  }

  private addEliteGuardEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createEliteGuardEnemyModel();
    built.group.position.set(x, 0.5, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'elite_walczak_guard',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.5,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.4,
      dir: 1,
      hp: 5,
      maxHp: 5,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      shieldActive: true,
    });
  }

  private addKurierEnemy(id: string, x: number, minX: number, maxX: number, name = 'Rudy z DPD od Johnny Walker') {
    const built = createKurierEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'kurier',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 4.5,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addItalianVendorEnemy(id: string, x: number, minX: number, maxX: number, name = 'Włoski Dostawca Armatury z Mediolanu') {
    const built = createItalianVendorEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'przedstawiciel_włoski',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.6,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.5,
    });
  }

  private addSztaplarEnemy(id: string, x: number, minX: number, maxX: number, name = 'Szalony Operator Paleciaka B4') {
    const built = createSztaplarEnemyModel();
    built.group.position.set(x, 0.5, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'sztaplar_szalony',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.5,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 3.5,
      dir: 1,
      hp: 4,
      maxHp: 4,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private spawnLootCrate(x: number, y: number, z: number) {
    const mesh = createLootCrateModel();
    mesh.position.set(x, y + 0.25, z);
    this.levelRoot.add(mesh);
    this.lootCrates.push({ mesh, x, y: y + 0.25, z });
    this.platforms.push({ x, y: y + 0.5, z, width: 0.5, height: 0.5, depth: 0.5, type: 'pallet', mesh });
  }

  private updateLootCrates(dt: number) {
    for (let i = this.lootCrates.length - 1; i >= 0; i--) {
      const crate = this.lootCrates[i];
      crate.mesh.rotation.y += dt * 1.5;
      
      const dist = Math.hypot(crate.x - this.playerPos.x, crate.z - this.playerPos.z);
      if (dist < 1.0) {
        this.spawnDroppedPerk(crate.x, crate.y, crate.z);
        this.levelRoot.remove(crate.mesh);
        this.lootCrates.splice(i, 1);
      }
    }
  }

  public spawnDroppedPerk(x: number, y: number, z: number, forcedPerkId?: PerkType) {
    const perkDef = forcedPerkId
      ? AVAILABLE_PERKS.find((p) => p.id === forcedPerkId)!
      : AVAILABLE_PERKS[Math.floor(Math.random() * AVAILABLE_PERKS.length)];

    const id = `drop_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const mesh = createDroppedPerkCrate(perkDef.id, perkDef.color);
    mesh.position.set(x, y + 0.1, z);
    this.levelRoot.add(mesh);

    const dropped: DroppedPerkItem = {
      id,
      perkId: perkDef.id,
      name: perkDef.name,
      icon: perkDef.icon,
      color: perkDef.color,
      x,
      y: y + 0.1,
      z,
      initialY: y + 0.1,
      mesh,
      collected: false,
      life: 55, // 55 seconds to collect
      duration: perkDef.duration || 20,
    };

    this.droppedPerks.push(dropped);
    this.spawnParticleRing(x, y + 0.6, z, perkDef.color);
    this.emitFloatingToast(`📦 ZRZUT: ${perkDef.name}!`, x, y + 1.2, z, 'perk');
    sound.playPickup(1);
  }

  private updateDroppedPerks(dt: number) {
    const time = performance.now() * 0.003;

    for (let i = this.droppedPerks.length - 1; i >= 0; i--) {
      const perk = this.droppedPerks[i];
      if (perk.collected || !perk.mesh) continue;

      perk.life -= dt;
      if (perk.life <= 0) {
        this.levelRoot.remove(perk.mesh);
        this.droppedPerks.splice(i, 1);
        continue;
      }

      // Floating bob and spin
      perk.mesh.rotation.y += dt * 2.2;
      perk.mesh.position.y = perk.initialY + Math.sin(time + i * 1.5) * 0.18;

      // Magnetic pull to player
      const dist = Math.hypot(perk.x - this.playerPos.x, perk.z - this.playerPos.z);
      const dy = Math.abs(perk.y - (this.playerPos.y + 0.5));

      const magnetActive = this.activePerks.magnet > 0 || this.charDef.id === 'marcin';
      const magnetRadius = magnetActive ? 9.5 : 2.5;

      if (dist < magnetRadius) {
        const pullSpeed = (magnetActive ? 10.5 : 4.5) * dt;
        perk.x += ((this.playerPos.x - perk.x) / Math.max(0.1, dist)) * pullSpeed;
        perk.z += ((this.playerPos.z - perk.z) / Math.max(0.1, dist)) * pullSpeed;
        perk.y += ((this.playerPos.y + 0.6 - perk.y) / Math.max(0.1, dist)) * pullSpeed;
        perk.mesh.position.set(perk.x, perk.y, perk.z);
      }

      // Collect condition
      if (dist < 1.15 && dy < 1.4) {
        perk.collected = true;
        this.levelRoot.remove(perk.mesh);
        this.droppedPerks.splice(i, 1);

        this.activatePerk(perk.perkId, perk.duration);
        sound.playPickup(3);
        this.spawnParticleRing(perk.x, perk.y + 0.6, perk.z, perk.color);
        this.score += 250;
        this.emitFloatingToast(`⚡ ODBIÓR: ${perk.name}!`, perk.x, perk.y + 1.2, perk.z, 'perk');

        const def = AVAILABLE_PERKS.find((p) => p.id === perk.perkId);
        const hexColor = `#${perk.color.toString(16).padStart(6, '0')}`;
        this.callbacks.onPerkDropBanner?.(perk.name, perk.icon, def?.description || 'Aktywowano ulepszenie!', hexColor);
        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
      }
    }
  }

  private emitFloatingToast(
    text: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    type: 'points' | 'vip' | 'easter-egg' | 'damage' | 'perk' | 'combo' | 'enemy_shout' = 'points',
    metadata?: any
  ) {
    this.callbacks.onFloatingText?.(text, worldX, worldY, worldZ, type, metadata);
  }


  private buildLevel1() {
    // 1. Expanded Warehouse Floor (72x40, x: -36 to +36, z: -20 to +20)
    const floorTex1 = getFloorTexture().clone();
    floorTex1.needsUpdate = true;
    floorTex1.wrapS = THREE.RepeatWrapping;
    floorTex1.wrapT = THREE.RepeatWrapping;
    floorTex1.repeat.set(8, 4);
    const floorGeo = new THREE.PlaneGeometry(72, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex1,
      roughness: 0.24,
      metalness: 0.14,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.levelRoot.add(floor);
    this.platforms.push({ x: 0, y: 0, z: 0, width: 72, height: 0.2, depth: 40, type: 'floor' });

    // Back Wall pushed to z = -19.5 with industrial corrugated siding
    const wallTex1 = getWallTexture().clone();
    wallTex1.needsUpdate = true;
    wallTex1.wrapS = THREE.RepeatWrapping;
    wallTex1.wrapT = THREE.RepeatWrapping;
    wallTex1.repeat.set(9, 2);
    const wallGeo = new THREE.BoxGeometry(72, 9.5, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex1, roughness: 0.62, metalness: 0.18 });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 4.75, -19.5);
    this.levelRoot.add(backWall);

    // Glowing Neon Showroom & Logistics Overhead Banner
    const neonSign = createNeonShowroomSign('MAX-FLIZ • SEKTOR A: LOGISTYKA B4', '#38bdf8');
    neonSign.position.set(0, 6.8, -19.2);
    this.levelRoot.add(neonSign);

    // Overhead Digital Industrial LED Scoreboard
    const scoreboard1 = createBhpDigitalScoreboard('SEKTOR A: DNI BEZ POTŁUCZONEJ PŁYTKI: 0');
    scoreboard1.position.set(0, 6.8, -10.0);
    this.levelRoot.add(scoreboard1);

    // Volumetric Overhead High-Bay Lamps & Light Beams
    [-28, -14, 0, 14, 28].forEach((lx) => {
      const lamp = createHighBayLamp();
      lamp.position.set(lx, 7.2, 0);
      const beam = createVolumetricLightBeam();
      beam.position.set(lx, 7.2, 0);
      this.levelRoot.add(lamp, beam);
    });

    // Floor Pedestrian & Navigation Safety Arrows along main runway and south wing
    [-24, -16, -8, 0, 8, 16, 24, 32].forEach((ax) => {
      const arrow = createAisleArrow(1.5);
      arrow.position.set(ax, 0.015, -2.0);
      this.levelRoot.add(arrow);

      const arrowSouth = createAisleArrow(1.2);
      arrowSouth.position.set(ax, 0.015, 8.0);
      this.levelRoot.add(arrowSouth);
    });

    // Steam vents along the back wall
    [-26, -10, 8, 24].forEach((vx) => {
      const vent = createIndustrialSteamVent();
      vent.position.set(vx, 0, -18.8);
      this.levelRoot.add(vent);
    });

    // High Warehouse Racks — MOVED STRICTLY TO BACKGROUND (z = -12.5 and -8.5)
    // NEVER obscuring the foreground or the camera's sightline!
    const rack1 = createWarehouseRack(6.0, 4.2, 1.5);
    rack1.position.set(-18, 0, -12.5);
    const rack2 = createWarehouseRack(6.0, 4.2, 1.5);
    rack2.position.set(0, 0, -12.5);
    const rack3 = createWarehouseRack(6.0, 4.2, 1.5);
    rack3.position.set(18, 0, -12.5);
    const rackBack4 = createWarehouseRack(6.0, 4.2, 1.5);
    rackBack4.position.set(-8, 0, -8.0);
    const rackBack5 = createWarehouseRack(6.0, 4.2, 1.5);
    rackBack5.position.set(10, 0, -8.0);
    this.levelRoot.add(rack1, rack2, rack3, rackBack4, rackBack5);

    this.platforms.push({ x: -18, y: 1.4, z: -12.5, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: 0, y: 1.4, z: -12.5, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: 18, y: 1.4, z: -12.5, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: -8, y: 1.4, z: -8.0, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: 10, y: 1.4, z: -8.0, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });

    // Elevated Steel Catwalk Connecting Background Racks at y=3.4
    const catwalk1 = createHighBayCatwalk(12.0, 1.6);
    catwalk1.position.set(-9, 3.4, -12.5);
    const catwalk2 = createHighBayCatwalk(12.0, 1.6);
    catwalk2.position.set(9, 3.4, -12.5);
    this.levelRoot.add(catwalk1, catwalk2);
    this.platforms.push({ x: -9, y: 3.4, z: -12.5, width: 12.0, height: 0.15, depth: 1.6, type: 'scaffold' });
    this.platforms.push({ x: 9, y: 3.4, z: -12.5, width: 12.0, height: 0.15, depth: 1.6, type: 'scaffold' });

    // Multi-tier Pallet Platforms — Center & South Wing
    // Low profile in the foreground so the runway is 100% visible!
    const palletPositions = [
      { x: -30, z: -2.5, tier: 1 },
      { x: -26, z: 2.5, tier: 2 },
      { x: -22, z: -2.5, tier: 1 },
      { x: -18, z: 2.5, tier: 2 },
      { x: -14, z: -2.2, tier: 1 },
      { x: -10, z: 2.5, tier: 2 },
      { x: -6, z: -2.5, tier: 1 },
      { x: -2, z: 2.2, tier: 2 },
      { x: 2, z: -2.5, tier: 1 },
      { x: 6, z: 2.5, tier: 2 },
      { x: 10, z: -2.2, tier: 1 },
      { x: 14, z: 2.5, tier: 2 },
      { x: 18, z: -2.5, tier: 1 },
      { x: 22, z: 2.2, tier: 2 },
      { x: 26, z: -2.5, tier: 1 },
      // LATERAL SOUTH WING (z: 8 to 16)
      { x: -28, z: 12.0, tier: 1 },
      { x: -20, z: 9.5, tier: 2 },
      { x: -12, z: 13.5, tier: 1 },
      { x: -4, z: 10.0, tier: 2 },
      { x: 4, z: 14.0, tier: 1 },
      { x: 12, z: 10.5, tier: 2 },
      { x: 20, z: 13.0, tier: 1 },
      { x: 28, z: 9.5, tier: 2 },
    ];
    palletPositions.forEach((p, idx) => {
      const pallet = createTilePallet(p.tier);
      pallet.position.set(p.x, 0, p.z);
      this.levelRoot.add(pallet);
      const h = p.tier === 1 ? 0.6 : 0.95;
      this.platforms.push({ x: p.x, y: h / 2, z: p.z, width: 1.25, height: h, depth: 1.05, type: 'pallet' });
      this.addGroutItem(`grout_l1_${idx}`, p.x, h + 0.35, p.z, 50);
    });

    // Interactive Coffee Vending Machine in South Wing ("KAWIARKA B4 EXPRESS")
    const coffee1 = createCoffeeVendingMachineModel();
    coffee1.position.set(-16, 0, 15.5);
    this.levelRoot.add(coffee1);
    this.coffeeMachines.push({ mesh: coffee1, x: -16, y: 0, z: 15.5, cooldown: 0 });
    this.platforms.push({ x: -16, y: 0.9, z: 15.5, width: 0.85, height: 1.8, depth: 0.65, type: 'shelf' });

    // Interactive Jump Pads & Speed Boost Pads
    this.addJumpPad(-21, 0, -4.5, 17.5);
    this.addJumpPad(5, 0, 4.5, 17.0);
    this.addJumpPad(-8, 0, 14.0, 18.0); // Jump pad from south wing to catwalk!
    this.addSpeedPad(-12, 0, 0);
    this.addSpeedPad(12, 0, 0);
    this.addSpeedPad(0, 0, 11.0); // South corridor speed boost!
    this.addSpeedPad(34, 0, 0); // Boost pad right through the Sector A -> B transition gate!

    // Explosive Chemical Barrels (Beczki Kleju Pro Flex)
    this.addExplosiveBarrel('barrel_l1_1', -15, 0, -3.5);
    this.addExplosiveBarrel('barrel_l1_2', 15, 0, 3.5);
    this.addExplosiveBarrel('barrel_l1_3', -2, 0, 15.0);

    // VIP Collectibles
    this.addVipItem('vip_tile1', -18, 1.8, -12.5, 'Gres Hiszpański Calacatta Gold 120x60');
    this.addVipItem('vip_tile2', 0, 1.8, -12.5, 'Złota Mozaika Ceramiczna Max-Fliz');
    this.addVipItem('vip_tile3', 18, 1.8, -12.5, 'Klej do Wielkiego Formatu Pro Flex');
    this.addVipItem('vip_tile4', -9, 3.8, -12.5, 'Specyfikacja Projektowa dla Hotelu 5*');
    this.addVipItem('vip_tile5', 20, 1.4, 13.0, 'Złota Próbka Spieku z Mediolanu (Bok B4)');

    // Pre-placed World-Drop Perks & Extra Power-Ups in Sector A
    this.spawnDroppedPerk(-9, 3.8, -12.5, 'vibram_boots');
    this.spawnDroppedPerk(9, 3.8, -12.5, 'hardhat');
    this.spawnDroppedPerk(-20, 1.4, 9.5, 'order_magnet');
    this.spawnDroppedPerk(14, 0.5, 3.5, 'espresso_boost');
    this.spawnDroppedPerk(-2, 0.5, -5.5, 'kfc_bucket');
    this.spawnDroppedPerk(22, 0.5, 6.0, 'golden_paleciak');
    this.spawnDroppedPerk(-28, 0.5, 5.5, 'stretch_armor');

    // Bonus Collectibles, KFC Buckets & Espresso
    this.addEspressoItem('esp_l1_1', -20, 0.4, 3.5);
    this.addEspressoItem('esp_l1_2', 8, 0.4, -3.5);
    this.addKfcBucketItem('kfc_l1_1', -12, 0.45, 0);
    this.addKfcBucketItem('kfc_l1_2', 16, 0.45, 9.5);
    this.addGoldenCutterItem('cutter_l1_1', 14, 1.8, -12.5);
    this.addGoldenCutterItem('cutter_l1_2', -12, 1.2, 13.5);
    this.addMagnetItem('mag_l1_1', -6, 1.0, 2.5);

    // Easter Eggs
    this.addEasterEgg('egg_coffee_1', -24, 0.05, -15.5, 'Ukryty Kącik Kawowy Zdzicha', 'coffee', 400);
    this.addEasterEgg('egg_wz_1', 12, 1.85, 10.5, 'Zaginiona WZ-tka z 2012 Roku', 'folder', 450);
    
    // Loot Crates
    this.spawnLootCrate(-20, 0, 5);
    this.spawnLootCrate(15, 0, -5);
    this.spawnLootCrate(0, 3.4, -12.5);
    this.spawnLootCrate(16, 0, 14.5);
    this.spawnLootCrate(-24, 0, 12.0);

    // Forklift Hazards & New Interactive Warehouse Traps in Sector A
    this.addForkliftHazard('forklift_1', -24, 20, 0, 4.4, 0xf59e0b);
    this.addForkliftHazard('forklift_1_south', -20, 18, 11.5, 3.8, 0x0284c7);
    this.addGlueSpillTrap('glue_l1_1', -16, -1.2, 1.8);
    this.addGlueSpillTrap('glue_l1_2', 6, 4.5, 2.0);
    this.addLaserCutterTrap('laser_l1_1', -3, 0, 4.0, 2.6);
    this.addSteamGeyserTrap('steam_l1_1', 11, -1.5, 4.0);
    this.addHydraulicPressTrap('press_l1_1', 24, 0, 3.0);
    this.addZombieWorkerEnemy('zombie_l1_1', -11, -5, 5);
    this.addZombieWorkerEnemy('zombie_l1_2', 15, -5, 5);

    // Spray Graffiti & Crime Scene Chalk Outline Decals
    const arkadiusz1 = createSprayGraffitiDecal();
    arkadiusz1.position.set(-14, 0.035, -3.5);
    arkadiusz1.rotation.x = -Math.PI / 2;
    arkadiusz1.scale.set(1.4, 1.4, 1);
    this.levelRoot.add(arkadiusz1);

    const crime1 = createCrimeSceneBodyOutlineDecal('RUDY ŚMIERDZIUCH');
    crime1.position.set(-26, 0.035, 8.5);
    crime1.rotation.y = Math.PI / 4;
    crime1.scale.setScalar(3.2); 
    this.levelRoot.add(crime1);

    // Enemies in Sector A
    this.addCustomerEnemy('cust_1', -16, -6, 6, 'Klient z Reklamacją na Fugi');
    this.addCustomerEnemy('cust_2', 4, -6, 6, 'Pan Janusz (Gdzie moja faktura?!)');
    this.addCustomerEnemy('cust_3', -8, -6, 6, 'Awanturujący się Klient po Rabaty');
    this.addPanRomanEnemy('pan_roman_l1', -8, -6, 6, 'Pan Roman z Dostawą Sanitariatów');
    this.addSerwisanciEnemy('serwisant_l1', -15, -6, 6, 'Serwisant Max-Flixu');
    this.addBosmanKrakowBossEnemy('bosman_l1', 0, 0);
    this.addKurierEnemy('kurier_l1_1', -10, -6, 6, 'Rudy z DPD (Johnny Walker Express)');
    this.addItalianVendorEnemy('ital_l1_1', 8, -5, 5, 'Włoski Dostawca Armatury z Mediolanu');
    this.addSztaplarEnemy('sztaplar_l1_1', -2, -6, 6, 'Szalony Operator Paleciaka B4');
    this.addEliteGuardEnemy('guard_l1_1', -22, -4, 4, 'Strażnik Sektora A');
    this.addInspectorEnemy('insp_l1_1', 14, -5, 5, 'Audytor Terenowy');
    this.addHandlowiecEnemy('handl_l1_1', -4, -6, 6, 'Przedstawiciel z Teczką');
    this.addMonterEnemy('monter_l1_1', 18, -4, 4, 'Glazurnik Wiesław (Poziomica!)');
    this.addAgvRobotEnemy('agv_1', -4, 12, 2.8, 'Autonomiczny AGV ze zlewami');
    this.addAgvRobotEnemy('agv_2', 8, -12, -2.8, 'Szalony Sztaplar AGV B4');
    this.addPiorunDronEnemy('dron_1', -18, 16, 0, 2.2, 'Piorun Dron Skaner Kodów B4');
    this.addEliteGuardEnemy('guard_l1_2', 20, -5, 5, 'Warta Honorowa Calacatta');
    this.addHandlowiecEnemy('handl_l1_2', -12, -4, 4, 'Dyrektor Handlowy (Rabat 5%!)');

    // Enemies in South Wing
    this.addCustomerEnemy('cust_l1_south', -6, 8, 16, 'Klient z Projektantem (Bok B4)');
    this.addMonterEnemy('monter_l1_south', 10, 8, 16, 'Majster Kafelkarz');
    this.addAgvRobotEnemy('agv_l1_south', -18, 6, 12.0, 'AGV Paletowy Południe');

    // Accent Lighting
    const l1 = new THREE.PointLight(0x38bdf8, 18, 28);
    l1.position.set(-18, 5, 8);
    this.levelRoot.add(l1);
    const l2 = new THREE.PointLight(0xf59e0b, 15, 25);
    l2.position.set(12, 4, -8);
    this.levelRoot.add(l2);
    const l3 = new THREE.PointLight(0x10b981, 14, 24);
    l3.position.set(-4, 4, 14);
    this.levelRoot.add(l3);

    this.addPiorunDronEnemy('dron_2', -10, 22, -4, 2.4, 'Dron Inspekcyjny Sektora B');

    // Open Sector A -> Sector B Transition Archway
    const sectorGateAB = createFinishGate();
    sectorGateAB.position.set(35.5, 0, 0);
    this.levelRoot.add(sectorGateAB);
    const gateSignAB = createNeonShowroomSign('PRZEJŚCIE • SEKTOR B: SHOWROOM & SPA ➔', '#f59e0b');
    gateSignAB.position.set(35.5, 5.2, 0);
    gateSignAB.scale.setScalar(0.55);
    this.levelRoot.add(gateSignAB);
  }

  private buildLevel2(offsetX = 76) {
    // 1. High-Contrast Luxury Italian Nero Marquina & Gold Marble Floor (80x42, x: +36 to +116, z: -21 to +21)
    const floorTex2 = getShowroomMarbleFloorTexture().clone();
    floorTex2.needsUpdate = true;
    floorTex2.wrapS = THREE.RepeatWrapping;
    floorTex2.wrapT = THREE.RepeatWrapping;
    floorTex2.repeat.set(8, 4);
    const floorGeo = new THREE.PlaneGeometry(80, 42);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex2,
      roughness: 0.18,
      metalness: 0.22,
      color: 0xffffff,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(offsetX, 0, 0);
    floor.receiveShadow = true;
    this.levelRoot.add(floor);
    this.platforms.push({ x: offsetX, y: 0, z: 0, width: 80, height: 0.2, depth: 42, type: 'floor' });

    // Architectural Natural Oak Slat Showroom Wall with LED Cove Lighting (Pushed back to z = -20.5)
    const wallTex2 = getShowroomWallTexture().clone();
    wallTex2.needsUpdate = true;
    wallTex2.wrapS = THREE.RepeatWrapping;
    wallTex2.wrapT = THREE.RepeatWrapping;
    wallTex2.repeat.set(8, 2);
    const wallGeo = new THREE.BoxGeometry(80, 9.5, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex2,
      roughness: 0.32,
      metalness: 0.14,
      color: 0xffffff,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(offsetX, 4.75, -20.5);
    this.levelRoot.add(backWall);

    // Showroom Neon Sign
    const neonSign = createNeonShowroomSign('MAX-FLIZ SHOWROOM • SEKTOR B: WANNY & SPA', '#ec4899');
    neonSign.position.set(offsetX, 6.8, -20.2);
    this.levelRoot.add(neonSign);

    // Overhead Digital Scoreboard in Showroom
    const scoreboard2 = createBhpDigitalScoreboard('SHOWROOM: ZAKAZ KĄPIELI W EKSPOZYCJI VIP!');
    scoreboard2.position.set(offsetX, 7.0, -10.0);
    this.levelRoot.add(scoreboard2);

    // Ceiling Track Spotlights
    [-24, -8, 8, 24].forEach((tx) => {
      const track = createTrackSpotlights(8.0);
      track.position.set(offsetX + tx, 7.2, 0);
      this.levelRoot.add(track);
    });

    // Glass Partitions — PLACED EXCLUSIVELY ON NORTH SIDE (z = -9.5) so foreground is 100% open!
    [-26, -14, -2, 10, 22].forEach((px) => {
      const glassNorth = createGlassPartition(2.8, 2.4);
      glassNorth.position.set(offsetX + px, 0, -9.5);
      this.levelRoot.add(glassNorth);
    });

    // Ceramic Planters with Greenery along perimeter
    [-34, -26, -16, -6, 4, 14, 24, 32].forEach((px, idx) => {
      const plant = createShowroomPlant();
      plant.position.set(offsetX + px, 0, idx % 2 === 0 ? -16.5 : 17.5);
      this.levelRoot.add(plant);
    });

    // Super Bouncy Bathtubs placed on Luxury Podiums
    // Staggered open diagonal layout — NO FOREGROUND OBSTRUCTIONS!
    const tubPositions = [
      { x: -30, z: -6.0 },
      { x: -22, z: 3.5 },
      { x: -14, z: -5.5 },
      { x: -4, z: 4.0 },
      { x: 6, z: -6.0 },
      { x: 16, z: 3.5 },
      { x: 26, z: -5.5 },
      // LATERAL SOUTH VIP SPA & JACUZZI LOUNGE (z: 11 to 16)
      { x: -26, z: 13.0 },
      { x: -10, z: 14.5 },
      { x: 8, z: 12.5 },
      { x: 22, z: 14.0 },
    ];
    tubPositions.forEach((tp, idx) => {
      const worldX = offsetX + tp.x;
      const podium = createDisplayPodium(3.2, 2.0, 0.22);
      podium.position.set(worldX, 0, tp.z);
      this.levelRoot.add(podium);

      const tub = createBathtubModel();
      // Place bathtub cleanly atop the 0.234m podium top pad to eliminate any Z-fighting
      tub.position.set(worldX, 0.235, tp.z);
      this.levelRoot.add(tub);
      this.platforms.push({
        x: worldX,
        y: 0.74,
        z: tp.z,
        width: 2.4,
        height: 1.0,
        depth: 1.4,
        type: 'bathtub',
        bounce: 17.5,
      });
      // Avoid overlapping collectibles on South VIP bathtubs (indices 7, 8, 9 already have cutter_l2_1, vibram_boots, vip_bath4)
      if (idx !== 7 && idx !== 8 && idx !== 9) {
        this.addGroutItem(`grout_l2_${idx}`, worldX, 1.65, tp.z, 60);
      }
    });

    // Elevated Luxury Catwalks — STRICTLY ON NORTH SIDE (z = -12.5 to -8.0)
    // Never blocking the bathtubs, enemies, or player runway!
    const catwalks = [
      { x: -28, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: -14, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: 0, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: 14, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: 28, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
    ];
    catwalks.forEach((cw, idx) => {
      const worldX = offsetX + cw.x;
      const cwGroup = createHighBayCatwalk(cw.w, cw.d);
      cwGroup.position.set(worldX, cw.y, cw.z);
      this.levelRoot.add(cwGroup);
      this.platforms.push({ x: worldX, y: cw.y, z: cw.z, width: cw.w, height: 0.2, depth: cw.d, type: 'shelf' });
      this.addGroutItem(`grout_cw_${idx}`, worldX, cw.y + 0.4, cw.z, 80);
    });

    // Interactive Coffee Vending Machine in Showroom Lounge
    const coffee2 = createCoffeeVendingMachineModel();
    coffee2.position.set(offsetX - 18, 0, 16.5);
    this.levelRoot.add(coffee2);
    this.coffeeMachines.push({ mesh: coffee2, x: offsetX - 18, y: 0, z: 16.5, cooldown: 0 });
    this.platforms.push({ x: offsetX - 18, y: 0.9, z: 16.5, width: 0.85, height: 1.8, depth: 0.65, type: 'shelf' });

    // Interactive Jump Pads & Speed Pads in Showroom
    this.addJumpPad(offsetX - 14, 0, -3.5, 17.5);
    this.addJumpPad(offsetX + 8, 0, 3.5, 17.0);
    this.addJumpPad(offsetX - 2, 0, 12.0, 18.0); // South spa launchpad!
    this.addSpeedPad(offsetX - 4, 0, 0);
    this.addSpeedPad(offsetX + 14, 0, 0);
    this.addSpeedPad(offsetX, 0, 8.5); // South spa runner speedpad!
    this.addSpeedPad(offsetX + 38, 0, 0); // Boost pad through Sector B -> C transition gate!

    // Explosive Chemical Barrels
    this.addExplosiveBarrel('barrel_l2_1', offsetX - 10, 0, -4.0);
    this.addExplosiveBarrel('barrel_l2_2', offsetX + 10, 0, 4.0);
    this.addExplosiveBarrel('barrel_l2_3', offsetX + 18, 0, 15.0);

    // VIP Showroom Items
    this.addVipItem('vip_bath1', offsetX - 28, 3.9, -8.0, 'Złota Bateria Wolnostojąca Villeroy & Boch');
    this.addVipItem('vip_bath2', offsetX, 3.9, -8.0, 'Wanna Wolnostojąca z Hydromasażem Marmur Carrara');
    this.addVipItem('vip_bath3', offsetX + 28, 3.9, -8.0, 'Umywalka Nablatowa z Naturalnego Onyksu');
    this.addVipItem('vip_bath4', offsetX + 8, 1.6, 12.5, 'Kolekcja Armatury Złotej z Mediolanu (VIP SPA)');

    // Dropped Perks & Collectibles in World (Sector B)
    this.spawnDroppedPerk(offsetX - 14, 3.9, -8.0, 'espresso_boost');
    this.spawnDroppedPerk(offsetX + 14, 3.9, -8.0, 'order_magnet');
    this.spawnDroppedPerk(offsetX + 22, 0.5, -6, 'hardhat');
    this.spawnDroppedPerk(offsetX - 28, 3.9, -8.0, 'vibram_boots');
    this.spawnDroppedPerk(offsetX - 10, 1.65, 14.5, 'vibram_boots');
    this.spawnDroppedPerk(offsetX - 2, 0.5, -2.5, 'kfc_bucket');
    this.spawnDroppedPerk(offsetX + 12, 0.5, 6.5, 'golden_paleciak');
    this.spawnDroppedPerk(offsetX - 20, 0.5, 8.5, 'stretch_armor');

    this.addEspressoItem('esp_l2_1', offsetX - 22, 0.4, -2.0);
    this.addEspressoItem('esp_l2_2', offsetX + 18, 0.4, 2.0);
    this.addKfcBucketItem('kfc_l2_1', offsetX + 4, 0.45, -1.5);
    this.addKfcBucketItem('kfc_l2_2', offsetX - 14, 0.45, 9.5);
    this.addGoldenCutterItem('cutter_l2_1', offsetX - 26, 1.65, 13.0);
    this.addMagnetItem('mag_l2_1', offsetX + 12, 3.9, -8.0);

    // Showroom Hazards & Interactive Traps (Steam Geysers, Laser Cutters, Glue Spills)
    this.addSteamGeyserTrap('steam_l2_1', offsetX - 18, 0, 4.0);
    this.addSteamGeyserTrap('steam_l2_2', offsetX + 2, -1.5, 3.8);
    this.addSteamGeyserTrap('steam_l2_3', offsetX + 14, 9.0, 4.2);
    this.addLaserCutterTrap('laser_l2_1', offsetX - 8, 0, 4.2, 2.8);
    this.addGlueSpillTrap('glue_l2_1', offsetX + 10, 1.5, 2.1);
    this.addHydraulicPressTrap('press_l2_1', offsetX + 20, -2.0, 3.2);
    this.addZombieWorkerEnemy('zombie_l2_1', offsetX - 6, -5, 5);
    this.addZombieWorkerEnemy('zombie_l2_2', offsetX + 16, -5, 5);

    // Easter Eggs
    this.addEasterEgg('egg_throne_1', offsetX + 30, 0.05, -14.5, 'Złoty Tron Prezesa z 24k Złotem', 'throne', 600);
    this.addEasterEgg('egg_l2_coffee', offsetX - 32, 0.05, 15.5, 'Tajemna Kawiarka Ciśnieniowa z Mediolanu (Zapas Espresso)', 'coffee', 500);
    this.addEasterEgg('egg_l2_wz', offsetX + 6, 0.05, 16.0, 'Zagubiona Umowa z Włoską Fabryką Gresu na Wyłączność', 'folder', 550);

    // Decals - Visible against the dark marble!
    const spray2 = createSprayGraffitiDecal();
    spray2.position.set(offsetX, 0.035, -4.0);
    spray2.rotation.x = -Math.PI / 2;
    spray2.scale.setScalar(2.5);
    this.levelRoot.add(spray2);

    const crime2 = createCrimeSceneBodyOutlineDecal('RUDY ŚMIERDZIUCH');
    crime2.position.set(offsetX - 28, 0.035, 9.0);
    crime2.scale.setScalar(3.0);
    this.levelRoot.add(crime2);

    // Dense Enemies in Showroom
    this.addCustomerEnemy('cust_l2_1', offsetX - 22, -6, 6, 'Zdezorientowany Klient Szukający Syfonu');
    this.addCustomerEnemy('cust_l2_2', offsetX + 10, -6, 6, 'Klient z Projektantką Wnętrz');
    this.addPanRomanEnemy('pan_roman_l2', offsetX, -6, 6, 'Pan Roman z Dostawą Sanitariatów');
    this.addSerwisanciEnemy('serwisant_l2', offsetX + 5, -6, 6, 'Serwisant Max-Flixu');
    this.addBosmanKrakowBossEnemy('bosman_l2', offsetX + 20, 0);
    this.addKurierEnemy('kurier_l2_1', offsetX - 16, -6, 6, 'Rudy z DPD (Johnny Walker Express)');
    this.addItalianVendorEnemy('ital_l2_1', offsetX + 2, -6, 6, 'Przedstawiciel Fabryki z Bolonii');
    this.addSztaplarEnemy('sztaplar_l2_1', offsetX + 18, -6, 6, 'Kierowca Sztaplarki Showroomu');
    this.addArchitectEnemy('arch_l2_1', offsetX - 12, offsetX - 2, -4, 'Główny Projektant Wnętrz z Warszawy');
    this.addArchitectEnemy('arch_l2_2', offsetX + 6, offsetX + 16, 4, 'Krytyk Mieszanek Tynkarskich i Beżu');
    this.addInspectorEnemy('insp_l2_1', offsetX - 4, -6, 6, 'Inspektor BHP z PIP-u');
    this.addHandlowiecEnemy('handl_l2_1', offsetX + 14, -6, 6, 'Kierownik Sprzedaży Salonu');
    this.addMonterEnemy('monter_l2_1', offsetX - 14, -6, 6, 'Hydraulik z Kluczem Nastawnym');
    this.addPiorunDronEnemy('dron_l2_1', offsetX - 20, offsetX + 20, 0, 2.4, 'Dron Multimedialny Showroomu');
    this.addEliteGuardEnemy('guard_l2_1', offsetX - 30, -5, 5, 'Strażnik Calacatta Gold');
    this.addAgvRobotEnemy('agv_l2_1', offsetX, offsetX + 15, -8.0, 'AGV Salonowy (Lustra)');

    // South Spa Lounge Enemies
    this.addArchitectEnemy('arch_l2_south', offsetX - 16, offsetX - 4, 13.0, 'Architekt Luksusu Spa');
    this.addCustomerEnemy('cust_l2_south', offsetX + 12, 8, 17, 'Klientka VIP po Jacuzzi');

    // BOSS LEVEL 2: Król-Leto
    this.addKrolLetoBossEnemy('boss_krol_leto_l2', offsetX + 24, 0);

    // Loot Crates on Level 2
    this.spawnLootCrate(offsetX - 25, 0, 0);
    this.spawnLootCrate(offsetX + 15, 3.5, -8.0);
    this.spawnLootCrate(offsetX, 0, 8);
    this.spawnLootCrate(offsetX + 30, 0, -8);
    this.spawnLootCrate(offsetX - 15, 0, 14);
    this.spawnLootCrate(offsetX + 16, 0, 15);

    // Open Sector B -> Sector C Transition Archway
    const sectorGateBC = createFinishGate();
    sectorGateBC.position.set(offsetX + 39.5, 0, 0);
    this.levelRoot.add(sectorGateBC);
    const gateSignBC = createNeonShowroomSign('PRZEJŚCIE • SEKTOR C: TERMINAL PRZEŁADUNKOWY ➔', '#ef4444');
    gateSignBC.position.set(offsetX + 39.5, 5.2, 0);
    gateSignBC.scale.setScalar(0.55);
    this.levelRoot.add(gateSignBC);
  }

  private buildLevel3(offsetX = 161) {
    // 1. High-Bay Terminal Arena Floor (90x44, x: +116 to +206, z: -22 to +22)
    const floorTex3 = getTerminalGraniteFloorTexture().clone();
    floorTex3.needsUpdate = true;
    floorTex3.wrapS = THREE.RepeatWrapping;
    floorTex3.wrapT = THREE.RepeatWrapping;
    floorTex3.repeat.set(9, 4);
    const floorGeo = new THREE.PlaneGeometry(90, 44);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex3, roughness: 0.24, metalness: 0.22 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(offsetX, 0, 0);
    floor.receiveShadow = true;
    this.levelRoot.add(floor);
    this.platforms.push({ x: offsetX, y: 0, z: 0, width: 90, height: 0.2, depth: 44, type: 'floor' });

    // Terminal Back Wall (Pushed back to z = -21.5)
    const wallTex3 = getWallTexture().clone();
    wallTex3.needsUpdate = true;
    wallTex3.wrapS = THREE.RepeatWrapping;
    wallTex3.wrapT = THREE.RepeatWrapping;
    wallTex3.repeat.set(10, 2);
    const wallGeo = new THREE.BoxGeometry(90, 10.0, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex3, roughness: 0.58, metalness: 0.2 });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(offsetX, 5.0, -21.5);
    this.levelRoot.add(backWall);

    const neonSign = createNeonShowroomSign('MAX-FLIZ TERMINAL • SEKTOR C: STREFA ZAŁADUNKU VIP', '#f59e0b');
    neonSign.position.set(offsetX, 7.2, -21.2);
    this.levelRoot.add(neonSign);

    // Overhead Digital Scoreboard in Terminal
    const scoreboard3 = createBhpDigitalScoreboard('TERMINAL VIP: ODPRAWA KURIERÓW • BRAK TARYFY ULGOWEJ!');
    scoreboard3.position.set(offsetX + 10, 7.2, -10.0);
    this.levelRoot.add(scoreboard3);

    // High-Bay Terminal Racks — MOVED STRICTLY TO BACKGROUND (z = -14.0 and -10.5)
    // NEVER blocking the central arena or the delivery dock from the camera!
    [-26, -6, 14].forEach((rx, idx) => {
      const worldX = offsetX + rx;
      const rackBack = createWarehouseRack(6.5, 4.4, 1.6);
      rackBack.position.set(worldX, 0, -14.0);
      this.levelRoot.add(rackBack);
      this.platforms.push({ x: worldX, y: 1.4, z: -14.0, width: 6.5, height: 0.15, depth: 1.6, type: 'shelf' });

      const cw = createHighBayCatwalk(8.0, 1.8);
      cw.position.set(worldX, 3.6, -14.0);
      this.levelRoot.add(cw);
      this.platforms.push({ x: worldX, y: 3.6, z: -14.0, width: 8.0, height: 0.18, depth: 1.8, type: 'scaffold' });
    });

    // Pallet stepping stones in central corridor and south loading wing (z: -4 to +16)
    [-32, -18, -4, 10, 24].forEach((px, idx) => {
      const worldX = offsetX + px;
      const pz = idx % 2 === 0 ? -3.2 : 3.2;
      const pallet = createTilePallet(idx % 2 === 0 ? 2 : 1);
      pallet.position.set(worldX, 0, pz);
      this.levelRoot.add(pallet);
      const h = idx % 2 === 0 ? 0.95 : 0.6;
      this.platforms.push({ x: worldX, y: h / 2, z: pz, width: 1.25, height: h, depth: 1.05, type: 'pallet' });
      this.addGroutItem(`grout_l3_${idx}`, worldX, h + 0.35, pz, 75);
    });

    // South Wing (Terminal C-Bis: z = 8 to 17) Pallet Staging Area
    [-24, -10, 4, 18].forEach((px, idx) => {
      const worldX = offsetX + px;
      const pallet = createTilePallet(1, 'nero');
      pallet.position.set(worldX, 0, 12.5);
      this.levelRoot.add(pallet);
      this.platforms.push({ x: worldX, y: 0.3, z: 12.5, width: 1.25, height: 0.6, depth: 1.05, type: 'pallet' });
      this.addGroutItem(`grout_l3_south_${idx}`, worldX, 0.95, 12.5, 80);
    });

    // Interactive Coffee Vending Machine in Terminal
    const coffee3 = createCoffeeVendingMachineModel();
    coffee3.position.set(offsetX - 6, 0, 16.5);
    this.levelRoot.add(coffee3);
    this.coffeeMachines.push({ mesh: coffee3, x: offsetX - 6, y: 0, z: 16.5, cooldown: 0 });
    this.platforms.push({ x: offsetX - 6, y: 0.9, z: 16.5, width: 0.85, height: 1.8, depth: 0.65, type: 'shelf' });

    this.addJumpPad(offsetX - 28, 0, -5.0, 18.0);
    this.addJumpPad(offsetX + 4, 0, 5.0, 18.0);
    this.addJumpPad(offsetX - 14, 0, 13.0, 18.5); // South terminal shortcut launchpad!
    this.addSpeedPad(offsetX - 14, 0, 0);
    this.addSpeedPad(offsetX + 18, 0, 0);
    this.addSpeedPad(offsetX + 2, 0, 10.0); // South corridor speedpad!

    this.addExplosiveBarrel('barrel_l3_1', offsetX - 12, 0, -4.5);
    this.addExplosiveBarrel('barrel_l3_2', offsetX + 16, 0, 4.5);
    this.addExplosiveBarrel('barrel_l3_3', offsetX - 2, 0, 14.5);

    // VIP Collectibles in Sector C
    this.addVipItem('vip_term1', offsetX - 26, 4.0, -14.0, 'Paleta Eksportowa Spieków Kwarcowych 300x100');
    this.addVipItem('vip_term2', offsetX - 6, 4.0, -14.0, 'Złoty Zestaw Podtynkowy Penthouse VIP');
    this.addVipItem('vip_term3', offsetX + 14, 4.0, -14.0, 'Główny List Przewozowy Konwoju Max-Fliz');
    this.addVipItem('vip_term4', offsetX + 28, 1.2, 0, 'Kluczyki do Floty Dostawczej Prezesa');
    this.addVipItem('vip_term5', offsetX + 18, 1.2, 12.5, 'Pieczęć Notarialna Odbioru Towaru');

    // Strategic Perks & Extra Power-ups in Sector C
    this.spawnDroppedPerk(offsetX - 20, 0.5, 0, 'vibram_boots');
    this.spawnDroppedPerk(offsetX + 20, 0.5, 0, 'hardhat');
    this.spawnDroppedPerk(offsetX - 6, 4.0, -14.0, 'espresso_boost');
    this.spawnDroppedPerk(offsetX + 4, 0.5, 12.5, 'order_magnet');
    this.spawnDroppedPerk(offsetX - 10, 0.5, -2.5, 'kfc_bucket');
    this.spawnDroppedPerk(offsetX + 8, 0.5, -3.5, 'golden_paleciak');
    this.spawnDroppedPerk(offsetX + 22, 0.5, 7.0, 'stretch_armor');
    this.addKfcBucketItem('kfc_l3_1', offsetX - 2, 0.45, 0);
    this.addKfcBucketItem('kfc_l3_2', offsetX + 16, 0.45, -6.0);

    // Forklift Hazards & Heavy Industrial Traps in Sector C
    this.addForkliftHazard('forklift_3', offsetX - 34, offsetX + 26, 0, 5.2, 0xef4444);
    this.addForkliftHazard('forklift_3_south', offsetX - 24, offsetX + 20, 11.0, 4.0, 0xf59e0b);
    this.addHydraulicPressTrap('press_l3_1', offsetX - 22, 0, 3.4);
    this.addHydraulicPressTrap('press_l3_2', offsetX + 12, 0, 3.6);
    this.addLaserCutterTrap('laser_l3_1', offsetX - 8, 0, 4.4, 3.2);
    this.addSteamGeyserTrap('steam_l3_1', offsetX + 2, 2.5, 3.6);
    this.addGlueSpillTrap('glue_l3_1', offsetX + 20, -2.0, 2.2);
    this.addZombieWorkerEnemy('zombie_l3_1', offsetX - 16, -6, 6);
    this.addZombieWorkerEnemy('zombie_l3_2', offsetX + 6, -6, 6);

    // Bosses & Enemies in Sector C
    this.addWalczakBossEnemy('boss_walczak', offsetX + 30, -5);
    this.addKrolLetoBossEnemy('boss_krol_leto_l3', offsetX + 30, 5);
    this.addBosmanKrakowBossEnemy('bosman_l3', offsetX + 15, 0);
    
    this.addEliteGuardEnemy('guard_l3_1', offsetX, -8, 8, 'Elitarna Straż');
    this.addKurierEnemy('kurier_l3_1', offsetX - 25, -6, 6, 'Kurier Ekspresowy');
    this.addItalianVendorEnemy('ital_l3_1', offsetX - 15, -6, 6, 'Włoski Delegat');
    this.addSztaplarEnemy('sztaplar_l3_1', offsetX + 5, -6, 6, 'Operator Agresywny');
    this.addArchitectEnemy('arch_l3_1', offsetX - 10, offsetX + 10, 0, 'Główny Architekt');
    this.addCustomerEnemy('cust_l3_1', offsetX - 20, -5, 5, 'Klient VIP');
    this.addHandlowiecEnemy('handl_l3_1', offsetX + 10, -5, 5, 'Dyrektor Handlowy');
    this.addInspectorEnemy('insp_l3_1', offsetX - 30, -5, 5, 'Główny Inspektor');
    this.addMonterEnemy('monter_l3_1', offsetX + 20, -6, 6, 'Majster Budowy');
    this.addPiorunDronEnemy('dron_l3_1', offsetX - 20, offsetX + 20, 0, 2.5, 'Dron Bitewny');

    // South Wing Enemies
    this.addPanRomanEnemy('pan_roman_l3_south', offsetX - 12, 8, 17, 'Pan Roman na Rampie C');
    this.addKurierEnemy('kurier_l3_south', offsetX + 8, 8, 17, 'Kurier z Płytkami (Johnny Walker)');

    // Loot Crates
    this.spawnLootCrate(offsetX - 30, 0, 5);
    this.spawnLootCrate(offsetX, 0, 10);
    this.spawnLootCrate(offsetX + 30, 0, -10);
    this.spawnLootCrate(offsetX - 14, 0, 15);
    this.spawnLootCrate(offsetX + 12, 0, 14);

    // Final Finish Gate & Delivery Van at the end of Sector C (x = 201)
    const finishGate = createFinishGate();
    finishGate.position.set(offsetX + 40, 0, 0);
    this.finishGatePos.set(offsetX + 40, 0, 0);
    this.levelRoot.add(finishGate);

    const van = createDeliveryVan();
    van.position.set(offsetX + 41.8, 0, 0);
    van.rotation.y = -Math.PI / 2;
    this.levelRoot.add(van);
    this.platforms.push({ x: offsetX + 41.8, y: 0.8, z: 0, width: 3.5, height: 1.6, depth: 2.6, type: 'finish_truck' });
    
    // Lighting
    const l = new THREE.PointLight(0xef4444, 20, 40);
    l.position.set(offsetX + 25, 5, 0);
    this.levelRoot.add(l);
  }

  public update(dt: number) {
    this.updateLootCrates(dt);
    if (this.state !== 'playing' && this.state !== 'title') return;

    let effectiveDt = dt;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      effectiveDt = dt * 0.2;
    }
    const simDt = effectiveDt;

    this.updatePerkTimers(simDt);

    if (this.state === 'playing') {
      if (this.invulnerableTimer > 0) this.invulnerableTimer -= simDt;
      if (this.marcinReclamationTimer > 0) this.marcinReclamationTimer = Math.max(0, this.marcinReclamationTimer - simDt);
      if (this.grzesiekCrushTimer > 0) this.grzesiekCrushTimer = Math.max(0, this.grzesiekCrushTimer - simDt);
      if (this.grzesiekCrushPulse > 0) this.grzesiekCrushPulse = Math.max(0, this.grzesiekCrushPulse - simDt);
      if (this.mateuszLagTimer > 0) this.mateuszLagTimer = Math.max(0, this.mateuszLagTimer - simDt);
      if (this.finishWarningTimer > 0) this.finishWarningTimer = Math.max(0, this.finishWarningTimer - simDt);

      if (this.speechBubbleTimer > 0) {
        this.speechBubbleTimer -= simDt;
        if (this.speechBubbleTimer <= 0) {
          this.callbacks.onSpeechBubble('');
        }
      }

      if (this.comboTimer > 0) {
        this.comboTimer -= simDt;
        if (this.comboTimer <= 0) {
          this.comboStreak = 0;
        }
      }

      this.updatePlayerMovement(simDt);
      if (this.gameMode === 'survival') {
        this.updateSurvivalDirector(simDt);
      } else {
        this.updateSectorProgression();
      }
      this.updateCoffeeMachines(simDt);
      this.updateCollectibles(simDt);
      this.updateDroppedPerks(simDt);
      if (this.gameMode !== 'survival') {
        this.updateHazards(simDt);
        this.updateExplosiveBarrels(simDt);
        this.updateFallingTiles(simDt);
        this.updateTimedEvents(simDt);
      }
      this.updateRandomSpawners(simDt);
      this.updateEnemies(simDt);
      if (this.gameMode === 'survival') this.updateSurvivalAutoCombat();
      this.updateProjectiles(simDt);
      if (this.gameMode === 'survival') this.updateSurvivalXpGems(simDt);
      this.updateBimberMolotovs(simDt);
      this.updateBimberFirePuddles(simDt);
      this.updateSpecialEffects(simDt);
      this.updateParticles(simDt);
    }

    if (!this.envMapInitialized && this.threeRenderer && this.scene) {
      try {
        const pmrem = new THREE.PMREMGenerator(this.threeRenderer);
        pmrem.compileEquirectangularShader();
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environment = envTex;
        (this.scene as any).environmentIntensity = 0.55;
        pmrem.dispose();
        this.envMapInitialized = true;
      } catch (_e) {
        this.envMapInitialized = true;
      }
    }

    if (this.bloomPulseTimer > 0) {
      this.bloomPulseTimer -= dt;
      if (this.threeRenderer) {
        const exposure = 1.12 + Math.max(0, Math.sin(this.bloomPulseTimer * 10) * 0.5);
        this.threeRenderer.toneMappingExposure = exposure;
      }
    } else {
      if (this.threeRenderer) this.threeRenderer.toneMappingExposure = 1.12;
    }

    this.updateCamera(dt);
  }

  private updateSurvivalAutoCombat() {
    if (this.state !== 'playing' || this.gameMode !== 'survival' || this.attackCooldownTimer > 0) return;
    let target: EnemyItem | null = null;
    let nearest = 10.5;
    for (const enemy of this.enemies) {
      if (enemy.state === 'defeated' || !enemy.mesh) continue;
      const distance = Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z);
      if (distance < nearest) {
        nearest = distance;
        target = enemy;
      }
    }
    if (!target) return;

    // Aim the existing operator-specific weapon at the nearest threat. Manual attacks remain available.
    this.playerRot = Math.atan2(target.x - this.playerPos.x, target.z - this.playerPos.z);
    if (this.playerGroup) this.playerGroup.rotation.y = this.playerRot;
    this.triggerAttack();
  }

  private updateSurvivalDirector(dt: number) {
    this.survivalElapsed += dt;
    const nextWave = 1 + Math.floor(this.survivalElapsed / 32);
    if (nextWave > this.survivalWave) {
      this.survivalWave = nextWave;
      this.emitFloatingToast('FALA ' + this.survivalWave + ' — NOWA ZMIANA WCHODZI NA HALĘ!', this.playerPos.x, this.playerPos.y + 1.7, this.playerPos.z, 'combo');
      sound.playAlert();
    }

    if (this.survivalWave >= 5 && this.survivalWave % 5 === 0 && this.survivalBossWave !== this.survivalWave) {
      this.survivalBossWave = this.survivalWave;
      this.spawnSurvivalBoss(this.survivalWave);
    }

    this.survivalSpawnTimer -= dt;
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const enemyCap = isMobile ? 18 : 28;
    const aliveCount = this.enemies.reduce((count, enemy) => count + (enemy.state === 'defeated' ? 0 : 1), 0);

    if (this.survivalSpawnTimer <= 0 && aliveCount < enemyCap) {
      const groupSize = Math.min(
        isMobile ? 5 : 7,
        2 + Math.floor(this.survivalWave * 0.55),
        enemyCap - aliveCount
      );
      for (let i = 0; i < groupSize; i++) this.spawnSurvivalEnemy(this.survivalWave);
      this.survivalSpawnTimer = Math.max(2.8, 7.5 - this.survivalWave * 0.28);
    }

    this.survivalCleanupTimer -= dt;
    if (this.survivalCleanupTimer <= 0) {
      this.survivalCleanupTimer = 4.0;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (enemy.state === 'defeated') {
          this.disposeEnemyModel(enemy);
          this.enemies.splice(i, 1);
        }
      }
    }

    this.survivalUiTimer -= dt;
    if (this.survivalUiTimer <= 0) {
      this.survivalUiTimer = 0.25;
      this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    }
  }

  private getSurvivalSpawnPoint(): { x: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const radius = 13 + Math.random() * 3;
    const x = THREE.MathUtils.clamp(
      this.playerPos.x + Math.cos(angle) * radius,
      this.levelBounds.minX + 2.5,
      this.levelBounds.maxX - 2.5
    );
    const z = THREE.MathUtils.clamp(
      this.playerPos.z + Math.sin(angle) * radius,
      this.levelBounds.minZ + 1.5,
      this.levelBounds.maxZ - 1.5
    );
    return { x, z };
  }

  private spawnSurvivalEnemy(wave: number) {
    const { x, z } = this.getSurvivalSpawnPoint();
    const id = 'survival_enemy_' + Math.floor(performance.now()) + '_' + Math.floor(Math.random() * 100000);
    const minZ = THREE.MathUtils.clamp(z - 2.2, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    const maxZ = THREE.MathUtils.clamp(z + 2.2, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    const roll = Math.random();

    if (wave < 3 || roll < 0.25) {
      this.addZombieWorkerEnemy(id, x, minZ, maxZ, 'Zombie-Magazynier — głodny po nocnej zmianie');
    } else if (wave < 5 || roll < 0.46) {
      this.addKurierEnemy(id, x, minZ, maxZ, 'Kurier Ekspresowy — paczka bez awiza');
    } else if (roll < 0.65) {
      this.addMonterEnemy(id, x, minZ, maxZ, 'Monter Wiesław — poziomica w dłoni');
    } else if (roll < 0.80) {
      this.addInspectorEnemy(id, x, minZ, maxZ, 'Inspektor BHP — kontrola bez zapowiedzi');
    } else if (roll < 0.91) {
      this.addHandlowiecEnemy(id, x, minZ, maxZ, 'Handlowiec — oferta nie do odrzucenia');
    } else {
      this.addEliteGuardEnemy(id, x, minZ, maxZ, 'Elitarny strażnik sektora');
    }

    const enemy = this.enemies[this.enemies.length - 1];
    if (!enemy) return;
    enemy.z = z;
    enemy.startX = minZ;
    enemy.endX = maxZ;
    enemy.mesh.position.set(x, enemy.y, z);
    const scaling = 1 + Math.min(1.8, Math.max(0, wave - 1) * 0.075);
    enemy.maxHp = Math.max(1, Math.ceil(enemy.maxHp * scaling));
    enemy.hp = enemy.maxHp;
    enemy.speed *= 1 + Math.min(0.42, Math.max(0, wave - 1) * 0.018);
    enemy.shoutTimer = 1.0 + Math.random() * 3.0;
  }

  private spawnSurvivalBoss(wave: number) {
    const { x, z } = this.getSurvivalSpawnPoint();
    const id = 'survival_boss_' + wave + '_' + Math.floor(performance.now());
    if (wave % 10 === 0) {
      this.addKrolLetoBossEnemy(id, x, z);
    } else {
      this.addWalczakBossEnemy(id, x, z);
    }
    const boss = this.enemies[this.enemies.length - 1];
    if (boss) {
      boss.maxHp = 14 + wave * 1.6;
      boss.hp = boss.maxHp;
      boss.speed *= 1 + Math.min(0.5, wave * 0.012);
      boss.specialActionTimer = 2.0;
    }
    sound.playSirens();
    this.triggerScreenShake(0.7, 0.45);
    this.callbacks.onPerkDropBanner?.(
      wave % 10 === 0 ? 'KRÓL-LETO WRACA DO MAGAZYNU!' : 'WALCZAK WJEŻDŻA NA ZMIANĘ!',
      wave % 10 === 0 ? '👑' : '👔',
      'Boss fali ' + wave + ' — pokonaj go, aby zdobyć dodatkowe doświadczenie',
      '#ef4444'
    );
  }

  private spawnSurvivalXpGem(x: number, y: number, z: number, value: number) {
    const geometry = new THREE.OctahedronGeometry(0.20, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.5,
      metalness: 0.2,
      roughness: 0.28,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y + 0.8, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.levelRoot.add(mesh);
    this.survivalXpGems.push({ mesh, value, life: 32, phase: Math.random() * Math.PI * 2 });
  }

  private updateSurvivalXpGems(dt: number) {
    for (let i = this.survivalXpGems.length - 1; i >= 0; i--) {
      const gem = this.survivalXpGems[i];
      gem.life -= dt;
      gem.phase += dt * 2.8;
      gem.mesh.rotation.y += dt * 1.8;
      gem.mesh.position.y += Math.sin(gem.phase) * dt * 0.12;

      const dx = this.playerPos.x - gem.mesh.position.x;
      const dz = this.playerPos.z - gem.mesh.position.z;
      const distance = Math.hypot(dx, dz);
      const pickupRadius = 1.6 * this.survivalMagnetMultiplier +
        (this.activePerks.magnet > 0 ? 6.5 : 0);

      if (distance < pickupRadius) {
        const target = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.7, this.playerPos.z);
        gem.mesh.position.lerp(target, Math.min(1, dt * 7.5));
      }

      if (distance < 1.25) {
        this.survivalXp += gem.value;
        this.score += gem.value * 12;
        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
        sound.playPickup();
        this.levelRoot.remove(gem.mesh);
        gem.mesh.geometry.dispose();
        (gem.mesh.material as THREE.Material).dispose();
        this.survivalXpGems.splice(i, 1);
        this.emitFloatingToast('+' + gem.value + ' XP', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'perk');
        if (this.survivalXp >= this.survivalXpToNext && this.state === 'playing') {
          this.beginSurvivalLevelUp();
          break;
        }
      } else if (gem.life <= 0) {
        this.levelRoot.remove(gem.mesh);
        gem.mesh.geometry.dispose();
        (gem.mesh.material as THREE.Material).dispose();
        this.survivalXpGems.splice(i, 1);
      }
    }
  }

  private beginSurvivalLevelUp() {
    if (this.gameMode !== 'survival' || this.state !== 'playing') return;
    this.survivalXp -= this.survivalXpToNext;
    this.survivalLevel++;
    this.survivalXpToNext = Math.round(6 + this.survivalLevel * 2.7);
    const pool: SurvivalUpgradeOption[] = [
      { id: 'damage', icon: '🎯', title: 'WZMOCNIONA AMUNICJA', description: '+20% obrażeń wszystkich ataków operatora.' },
      { id: 'rapid', icon: '⚡', title: 'SZYBSZY ATAK', description: 'Skrócenie czasu między atakami o 12%.' },
      { id: 'boots', icon: '👟', title: 'BUTY SPRINTU', description: '+10% prędkości poruszania się.' },
      { id: 'magnet', icon: '🧲', title: 'MAGNES XP', description: 'Znacznie większy zasięg przyciągania kryształów XP.' },
      { id: 'reinforced', icon: '⛑️', title: 'WZMOCNIONY KASK', description: '+1 maksymalny punkt zdrowia i natychmiastowe uzupełnienie.' },
      { id: 'medkit', icon: '☕', title: 'ZESTAW RATUNKOWY', description: 'Odzyskaj 1 punkt zdrowia i aktywuj tarczę na jedno trafienie.' },
    ];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.survivalPendingOptions = pool.slice(0, 3);
    this.state = 'levelup';
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    this.callbacks.onSurvivalLevelUp?.([...this.survivalPendingOptions]);
    sound.playAbility(this.currentCharacterId);
  }

  private updateSectorProgression() {
    const px = this.playerPos.x;
    const newSector = px < 36 ? 1 : px < 116 ? 2 : 3;
    if (newSector !== this.currentActiveSector) {
      this.currentActiveSector = newSector;
      this.currentLevelId = newSector;
      const minimapTitle = document.querySelector('#minimap-container .minimap-title');
      if (newSector === 1) {
        if (minimapTitle) minimapTitle.textContent = 'SEKTOR A: MAGAZYN B4';
      } else if (newSector === 2) {
        if (minimapTitle) minimapTitle.textContent = 'SEKTOR B: SHOWROOM SPA';
        this.emitFloatingToast('WKROCZONO DO SEKTORA B: SHOWROOM & SPA!', px, this.playerPos.y + 1.5, this.playerPos.z, 'vip');
        this.callbacks.onPerkDropBanner?.('SEKTOR B: SHOWROOM & SPA', '🛁', 'Punkt kontrolny odblokowany! Wykorzystaj wanny jako trampoliny!', '#ec4899');
      } else if (newSector === 3) {
        if (minimapTitle) minimapTitle.textContent = 'SEKTOR C: TERMINAL VIP';
        this.emitFloatingToast('WKROCZONO DO SEKTORA C: TERMINAL PRZEŁADUNKOWY!', px, this.playerPos.y + 1.5, this.playerPos.z, 'combo');
        this.callbacks.onPerkDropBanner?.('SEKTOR C: TERMINAL PRZEŁADUNKOWY', '🚛', 'Ostatnia prosta do vana dostawczego! Pokonaj Zarząd!', '#f59e0b');
      }
    }

    // Dynamic proximity Boss HUD update
    let nearestBoss: EnemyItem | null = null;
    let nearestDist = 36;
    for (const e of this.enemies) {
      if (e.state === 'defeated') continue;
      if (e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow') {
        const d = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestBoss = e;
        }
      }
    }
    if (nearestBoss) {
      this.callbacks.onBossUpdate?.(nearestBoss.name, nearestBoss.hp, nearestBoss.maxHp, true, nearestBoss.bossPhase);
    } else {
      this.callbacks.onBossUpdate?.('', 0, 0, false);
    }
  }

  private updateCoffeeMachines(dt: number) {
    for (const cm of this.coffeeMachines) {
      if (cm.cooldown > 0) {
        cm.cooldown -= dt;
      }
      const dist = Math.hypot(cm.x - this.playerPos.x, cm.z - this.playerPos.z);
      if (dist < 1.25 && cm.cooldown <= 0) {
        cm.cooldown = 12.0; // 12 second cooldown per machine
        this.activatePerk('espresso_boost', 6);
        sound.playPerkPickup();
        this.emitFloatingToast('☕ POTRÓJNE ESPRESSO Z KAWIARKI B4!', cm.x, cm.y + 1.8, cm.z, 'perk');
        this.spawnParticleRing(cm.x, cm.y + 1.0, cm.z, 0x38bdf8);
        this.sayQuote('Aaaah! Mocna czarna kawa! Szybkość +35%!');
      }
    }
  }

  private updatePerkTimers(dt: number) {
    let changed = false;
    if (this.activePerks.doubleJump > 0) {
      this.activePerks.doubleJump = Math.max(0, this.activePerks.doubleJump - dt);
      changed = true;
    }
    if (this.activePerks.magnet > 0) {
      this.activePerks.magnet = Math.max(0, this.activePerks.magnet - dt);
      changed = true;
    }
    if (this.activePerks.speedBoost > 0) {
      this.activePerks.speedBoost = Math.max(0, this.activePerks.speedBoost - dt);
      changed = true;
    }
    if ((this.activePerks.kfcBerserk || 0) > 0) {
      this.activePerks.kfcBerserk = Math.max(0, (this.activePerks.kfcBerserk || 0) - dt);
      changed = true;
    }
    if ((this.activePerks.bulldozer || 0) > 0) {
      this.activePerks.bulldozer = Math.max(0, (this.activePerks.bulldozer || 0) - dt);
      changed = true;
    }
    if (this.doublePointsTimer > 0) {
      this.doublePointsTimer = Math.max(0, this.doublePointsTimer - dt);
    }
    if (this.glueSlowTimer > 0) {
      this.glueSlowTimer = Math.max(0, this.glueSlowTimer - dt);
    }
    if (changed) {
      this.callbacks.onPerksUpdate?.(this.activePerks);
    }
  }

  private updatePlayerMovement(dt: number) {
    let screenX = 0;
    let screenY = 0;

    if (this.keys['KeyD'] || this.keys['ArrowRight']) screenX += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) screenX -= 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) screenY += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) screenY -= 1;

    if (Math.abs(this.virtualJoystick.x) > 0.08 || Math.abs(this.virtualJoystick.y) > 0.08) {
      screenX = this.virtualJoystick.x;
      screenY = -this.virtualJoystick.y;
    }

    const camToPlayerX = this.playerPos.x - this.camera.position.x;
    const camToPlayerZ = this.playerPos.z - this.camera.position.z;
    const camFwdLen = Math.hypot(camToPlayerX, camToPlayerZ);
    const fwdX = camFwdLen > 0.001 ? camToPlayerX / camFwdLen : 0;
    const fwdZ = camFwdLen > 0.001 ? camToPlayerZ / camFwdLen : -1;
    const rightX = -fwdZ;
    const rightZ = fwdX;

    let inputX = rightX * screenX + fwdX * screenY;
    let inputZ = rightZ * screenX + fwdZ * screenY;

    const inputLen = Math.hypot(inputX, inputZ);
    if (inputLen > 1) {
      inputX /= inputLen;
      inputZ /= inputLen;
    }

    let speed = this.charDef.speed * this.getPacingFactor();
    if (this.gameMode === 'survival') speed *= this.survivalMoveMultiplier;
    if (this.marcinWoTPenaltyTimer > 0) {
      this.marcinWoTPenaltyTimer = Math.max(0, this.marcinWoTPenaltyTimer - dt);
      speed *= 0.70; // 30% speed penalty during Kierownik WoT event
    }
    if (this.charDef.id === 'mateusz' && this.invulnerableTimer > 0) {
      speed *= 1.45;
    }
    if (this.activePerks.speedBoost > 0) {
      speed *= 1.35;
      if (Math.random() < 0.25) {
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xec4899);
      }
    }
    if ((this.activePerks.kfcBerserk || 0) > 0) {
      speed *= 1.38;
      if (Math.random() < 0.3) {
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xef4444);
      }
    }
    if ((this.activePerks.bulldozer || 0) > 0) {
      speed *= 1.25;
      if (Math.random() < 0.3) {
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xfacc15);
      }
    }
    if (this.glueSlowTimer > 0 && (this.activePerks.kfcBerserk || 0) <= 0 && this.activePerks.speedBoost <= 0) {
      speed *= 0.48;
    }

    if (inputLen > 0.08) {
      const targetX = inputX * speed;
      const targetZ = inputZ * speed;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetX, 28, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetZ, 28, dt);
      this.playerVel.x = THREE.MathUtils.clamp(this.playerVel.x, -speed * 1.35, speed * 1.35);
      this.playerVel.z = THREE.MathUtils.clamp(this.playerVel.z, -speed * 1.35, speed * 1.35);
      this.playerRot = Math.atan2(inputX, inputZ);

      this.walkCycle += dt * 15;
      if (this.leftLeg && this.rightLeg && this.leftArm && this.rightArm) {
        this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.6;
        this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.6;
        this.leftArm.rotation.x = -Math.sin(this.walkCycle) * 0.6;
        this.rightArm.rotation.x = Math.sin(this.walkCycle) * 0.6;
      }
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 32, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 32, dt);
      if (this.leftLeg && this.rightLeg && this.leftArm && this.rightArm) {
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        this.leftArm.rotation.x = 0;
        this.rightArm.rotation.x = 0;
      }
    }

    if (this.grzesiekCrushTimer > 0) {
      const t = 1 - this.grzesiekCrushTimer / 0.9;
      const swing = Math.sin(t * Math.PI);
      if (this.leftArm && this.rightArm) {
        this.leftArm.rotation.z = -1.2 + swing * 1.5;
        this.rightArm.rotation.z = 1.2 - swing * 1.5;
        this.leftArm.rotation.x = -1.3 + swing * 1.8;
        this.rightArm.rotation.x = -1.3 + swing * 1.8;
      }
    }

    if (this.marcinReclamationTimer > 0 && this.playerGroup) {
      const pulse = 1 + Math.sin(performance.now() * 0.02) * 0.08;
      this.playerGroup.scale.set(pulse, 1.08, pulse);
    }

    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= dt;
    if (this.attackSwingTimer > 0) {
      this.attackSwingTimer -= dt;
      if (this.rightArm) {
        this.rightArm.rotation.x = -1.8 + (this.attackSwingTimer / 0.25) * 1.5;
        this.rightArm.rotation.z = -0.4;
      }
    } else if (this.rightArm) {
      this.rightArm.rotation.z = 0;
    }

    const gravity = 22.0;
    this.playerVel.y -= gravity * dt;

    if (this.isGrounded) {
      this.coyoteTimer = 0.12;
      this.hasDoubleJumped = false;
    } else {
      this.coyoteTimer -= dt;
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        this.playerVel.y = this.charDef.jumpForce;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        sound.playJump();
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z);
        if (this.playerGroup) this.playerGroup.scale.set(0.82, 1.25, 0.82);
      } else if ((this.activePerks.doubleJump > 0 || this.charDef.id === 'piotr') && !this.hasDoubleJumped) {
        this.playerVel.y = this.charDef.jumpForce * 1.05;
        this.hasDoubleJumped = true;
        this.jumpBufferTimer = 0;
        sound.playDoubleJump();
        this.spawnParticleRing(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0x38bdf8);
        this.sayQuote(this.charDef.id === 'piotr' ? 'SKOK WETERANA B4! Hopsa nad paletami!' : 'PODWÓJNY SKOK! Sprężyste odbicie Vibram!');
        if (this.playerGroup) this.playerGroup.scale.set(0.8, 1.3, 0.8);
      }
    }

    // Continuous unified Mega-Map boundaries across all 3 connected sectors (expanded in Z)
    const maxZForSector = this.playerPos.x < 36 ? 19.0 : this.playerPos.x < 116 ? 19.0 : 21.0;
    const currentBounds = { minX: -34.5, maxX: 204.5, minZ: -maxZForSector, maxZ: maxZForSector };

    const nextX = THREE.MathUtils.clamp(this.playerPos.x + this.playerVel.x * dt, currentBounds.minX, currentBounds.maxX);
    const nextY = this.playerPos.y + this.playerVel.y * dt;
    const nextZ = THREE.MathUtils.clamp(this.playerPos.z + this.playerVel.z * dt, currentBounds.minZ, currentBounds.maxZ);

    let landed = false;
    const pRadius = 0.28;

    for (const plat of this.platforms) {
      const minX = plat.x - plat.width / 2;
      const maxX = plat.x + plat.width / 2;
      const minZ = plat.z - plat.depth / 2;
      const maxZ = plat.z + plat.depth / 2;
      const topY = plat.y + plat.height / 2;

      if (nextX + pRadius > minX && nextX - pRadius < maxX &&
          nextZ + pRadius > minZ && nextZ - pRadius < maxZ) {

        if (this.playerPos.y >= topY - 0.22 && nextY <= topY) {
          if (plat.type === 'bathtub' && plat.bounce) {
            this.playerVel.y = plat.bounce;
            sound.playBounce();
            this.cameraShake = 0.35;
            this.sayQuote('HOP DO WANNY! Odlot na regał!');
            this.spawnParticleRing(plat.x, topY, plat.z, 0x06b6d4);
          } else if (plat.type === 'jump_pad' && plat.bounce) {
            this.playerVel.y = plat.bounce;
            sound.playBounce();
            this.triggerScreenShake(0.35, 0.25);
            this.sayQuote('SKOCZNIA! ODLOT NAD REGAŁAMI!');
            this.spawnParticleRing(plat.x, topY, plat.z, 0x38bdf8);
            this.emitFloatingToast('WYBICIE SKOCZNI!', plat.x, topY + 0.6, plat.z, 'perk');
            if (this.playerGroup) this.playerGroup.scale.set(0.7, 1.4, 0.7);
          } else if (plat.type === 'speed_pad') {
            const currentSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
            const moveAngle = Math.atan2(this.playerVel.z, this.playerVel.x) || 0;
            const boost = 14.5;
            this.playerVel.x = Math.cos(moveAngle) * (currentSpeed + boost);
            this.playerVel.z = Math.sin(moveAngle) * (currentSpeed + boost);
            this.spawnParticleRing(plat.x, topY, plat.z, 0xf59e0b);
            this.emitFloatingToast('SPRINT BOOST!', plat.x, topY + 0.6, plat.z, 'perk');
            this.playerVel.y = 0;
            this.playerPos.y = topY;
            landed = true;

            if (this.camera instanceof THREE.PerspectiveCamera) {
              const baseFov = 45;
              this.camera.fov = baseFov + 8;
              this.camera.updateProjectionMatrix();
            }
          } else {
            this.playerVel.y = 0;
            this.playerPos.y = topY;
            landed = true;
            if (plat.type === 'conveyor') {
              this.playerPos.x += 3.6 * dt;
            }
          }

          if (plat.type === 'finish_truck') {
            this.checkLevelFinish();
          }
        }
      }
    }

    const wasGrounded = this.isGrounded;
    this.isGrounded = landed;
    this.playerPos.x = nextX;
    if (!landed) {
      this.playerPos.y = Math.max(0.0, nextY);
      if (this.playerPos.y === 0.0) {
        landed = true;
        this.playerVel.y = 0;
      }
    }
    this.playerPos.z = nextZ;

    // Proximity trigger for the final finish gate / delivery van at the end of Sector C (x = 201)
    const finishTriggerX = 200.0;
    if (this.playerPos.x >= finishTriggerX && Math.abs(this.playerPos.z) < 3.5 && this.playerPos.y >= 0) {
      this.checkLevelFinish();
    }

    if (!wasGrounded && landed && this.playerGroup) {
      this.playerGroup.scale.set(1.2, 0.82, 1.2);
    }

    if (this.playerPos.y < -4.5) {
      this.takeDamage('Wypadłeś z rampy załadunkowej!');
      const respawnX = this.currentActiveSector === 3 ? 121 : this.currentActiveSector === 2 ? 41 : -32;
      this.playerPos.set(respawnX, 2, 0);
      this.playerVel.set(0, 0, 0);
    }
    // SOLID BOUNDARY CLAMPING
    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, this.levelBounds.minX, this.levelBounds.maxX);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, this.levelBounds.minZ, this.levelBounds.maxZ);

    if (this.playerGroup) {
      this.playerGroup.position.copy(this.playerPos);
      this.playerGroup.rotation.y = this.playerRot;
      this.playerGroup.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 8);
    }

    if (this.targetRing) {
      // Anchored to floor or platform directly under player feet for clear ground spatial awareness
      const groundY = Math.max(0.04, this.playerPos.y + 0.02);
      this.targetRing.position.set(this.playerPos.x, groundY, this.playerPos.z);
      this.targetRing.rotation.y = this.playerRot;
      const pulse = 1.0 + Math.sin(performance.now() * 0.006) * 0.06;
      this.targetRing.scale.set(pulse, 1.0, pulse);
    }
  }

  private updateCollectibles(dt: number) {
    this.collectibles.forEach((c) => {
      if (c.collected || !c.mesh) return;

      c.mesh.rotation.y += dt * 2.5;

      // Magnet Perk pull
      if (this.activePerks.magnet > 0) {
        const magDist = Math.hypot(c.x - this.playerPos.x, c.z - this.playerPos.z);
        if (magDist < 8.5) {
          const pullSpeed = 9.0 * dt;
          c.x += ((this.playerPos.x - c.x) / magDist) * pullSpeed;
          c.z += ((this.playerPos.z - c.z) / magDist) * pullSpeed;
          c.y += ((this.playerPos.y + 0.5 - c.y) / magDist) * pullSpeed;
          c.mesh.position.set(c.x, c.y, c.z);
        }
      }

      const dist = Math.hypot(c.x - this.playerPos.x, c.z - this.playerPos.z);
      const dy = Math.abs(c.y - (this.playerPos.y + 0.5));

      if (dist < 0.95 && dy < 1.2) {
        c.collected = true;
        this.levelRoot.remove(c.mesh);

        const ptsMult = this.doublePointsTimer > 0 ? 2 : 1;
        if (c.type === 'grout') {
          this.score += c.points * ptsMult;
          this.handleMateuszPassive(1);
          sound.playPickup();
          this.emitFloatingToast(`+${c.points * ptsMult} Pkt Fuga`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'vip_item') {
          this.score += c.points * ptsMult;
          this.handleMateuszPassive(1);
          this.collectedVipCount++;
          sound.playPickup(2);
          this.sayQuote(`ZEBRANO VIP: ${c.name}!`);
          this.emitFloatingToast(`📦 VIP ITEM!`, c.x, c.y + 0.5, c.z, 'vip');
        } else if (c.type === 'espresso') {
          this.activatePerk('espresso_boost', 18);
          this.emitFloatingToast(`☕ ESPRESSO!`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'magnet') {
          this.activatePerk('order_magnet', 20);
          this.emitFloatingToast(`🧲 RADIOMAGNES!`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'golden_cutter') {
          this.activatePerk('vibram_boots', 25);
          this.emitFloatingToast(`👟 VIBRAM BOOTS!`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'kfc_bucket') {
          this.score += c.points * ptsMult;
          this.activatePerk('kfc_bucket', 16);
          this.emitFloatingToast(`🍗 KUBEŁEK KFC! +2 KAWY & FURIA!`, c.x, c.y + 0.7, c.z, 'perk');
        } else if (c.type === 'easter_egg') {
          this.score += c.points * ptsMult;
          this.handleMateuszPassive(1);
          sound.playEasterEgg();
          this.sayQuote(`EASTER EGG ODNALEZIONY: ${c.name}! (+${c.points * ptsMult} pkt)`);
          this.emitFloatingToast(`🎉 EASTER EGG!`, c.x, c.y + 0.5, c.z, 'easter-egg');
        }

        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
      }
    });
  }

  private updateHazards(dt: number) {
    const now = performance.now() * 0.001;
    this.hazards.forEach((h) => {
      if (!h.active || !h.mesh) return;

      if (h.type === 'forklift') {
        h.x += h.speed * h.dir * dt;
        if (h.dir > 0 && h.x >= h.endX!) {
          h.dir = -1;
          h.mesh.rotation.y = Math.PI;
        } else if (h.dir < 0 && h.x <= h.startX) {
          h.dir = 1;
          h.mesh.rotation.y = 0;
        }
        h.mesh.position.set(h.x, h.y, h.z);

        const dist = Math.hypot(h.x - this.playerPos.x, h.z - this.playerPos.z);
        if (dist < 1.4 && Math.abs(h.y - this.playerPos.y) < 1.2) {
          if (this.charDef.id === 'marcin') {
            // Marcin passive: immune to forklift knockbacks
            this.emitFloatingToast('🛡️ AUTORYTET BHP: STOP SZTAPLARKI!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'perk');
          } else {
            this.takeDamage('Zostałeś potrącony przez wózek widłowy!');
          }
        }
      } else if (h.type === 'glue_spill') {
        const radius = h.width * 0.5;
        const dist = Math.hypot(h.x - this.playerPos.x, h.z - this.playerPos.z);
        if (dist < radius && this.playerPos.y < 0.35) {
          if (this.glueSlowTimer <= 0.1 && (this.activePerks.kfcBerserk || 0) <= 0 && this.activePerks.speedBoost <= 0) {
            this.emitFloatingToast('🍯 KLEJ MAPEI! SPOWOLNIENIE -50%!', this.playerPos.x, this.playerPos.y + 1.0, this.playerPos.z, 'damage');
          }
          this.glueSlowTimer = 0.35;
        }
        // Glue also slows down enemies walking through it
        for (const e of this.enemies) {
          if (e.state === 'defeated') continue;
          if (Math.hypot(e.x - h.x, e.z - h.z) < radius) {
            e.x -= (e.x - h.x) * 0.4 * dt;
            e.z -= (e.z - h.z) * 0.4 * dt;
          }
        }
      } else if (h.type === 'laser_cutter') {
        h.phase = (h.phase || 0) + dt * h.speed;
        const halfSpan = h.length * 0.5 - 0.35;
        const bladeZ = Math.sin(h.phase) * halfSpan;
        if (h.movingPart) {
          h.movingPart.position.z = bladeZ;
          h.movingPart.rotation.x += dt * 18.0;
        }
        const dx = Math.abs(this.playerPos.x - h.x);
        const dz = Math.abs(this.playerPos.z - h.z);
        // Player can jump over the laser beam (y > 0.65)
        if (dx < 0.65 && dz < h.length * 0.48 && this.playerPos.y < 0.58) {
          this.takeDamage('Przecięty przez laserową gilotynę do spieków CNC!');
        }
        // Enemies walking into the spinning blade take damage
        for (const e of this.enemies) {
          if (e.state === 'defeated' || e.stunTimer > 0) continue;
          if (Math.abs(e.x - h.x) < 0.65 && Math.abs(e.z - (h.z + bladeZ)) < 0.75) {
            e.hp -= 1;
            e.stunTimer = 0.8;
            this.emitFloatingToast('⚡ GILOTYNA CNC -1 HP!', e.x, e.y + 1.0, e.z, 'damage');
            if (e.hp <= 0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
              this.defeatEnemy(e, 200, true);
            }
          }
        }
      } else if (h.type === 'steam_geyser') {
        const period = h.speed || 4.2;
        h.timer = ((h.timer || 0) + dt) % period;
        const isErupting = h.timer > period - 1.15;
        const isWarning = h.timer > period - 2.1 && !isErupting;

        if (h.warningMesh) {
          const mat = h.warningMesh.material as THREE.MeshBasicMaterial;
          if (isErupting) {
            mat.color.setHex(0xef4444);
            mat.opacity = 0.85;
          } else if (isWarning) {
            mat.color.setHex(0xf59e0b);
            mat.opacity = 0.4 + Math.sin(now * 22) * 0.35;
          } else {
            mat.color.setHex(0x38bdf8);
            mat.opacity = 0.25;
          }
        }

        if (h.movingPart) {
          h.movingPart.visible = isErupting;
          if (isErupting) {
            const pulse = 0.85 + Math.sin(now * 30) * 0.2;
            h.movingPart.scale.set(pulse, 1.0, pulse);
          }
        }

        if (isErupting) {
          const dist = Math.hypot(this.playerPos.x - h.x, this.playerPos.z - h.z);
          if (dist < 1.15 && this.playerPos.y < 2.8) {
            this.playerVel.y = 16.5;
            this.isGrounded = false;
            sound.playBounce();
            this.emitFloatingToast('💨 GEJZER PARY! WYRZUT W GÓRĘ!', h.x, 1.8, h.z, 'perk');
          }
          for (const e of this.enemies) {
            if (e.state === 'defeated') continue;
            if (Math.hypot(e.x - h.x, e.z - h.z) < 1.3 && e.stunTimer <= 0) {
              e.stunTimer = 2.0;
              e.state = 'stunned';
              this.emitFloatingToast('💨 POPARZONY PARĄ!', e.x, e.y + 1.1, e.z, 'damage');
            }
          }
        }
      } else if (h.type === 'hydraulic_press') {
        const cycle = h.speed || 3.2;
        const prevTimer = h.timer || 0;
        h.timer = (prevTimer + dt) % cycle;
        // Cycle phases: 0..1.6 open, 1.6..2.2 warning, 2.2..2.55 slam down, 2.55..cycle retract
        let stamperY = 2.6;
        let isSlamming = false;
        if (h.timer >= 2.2 && h.timer < 2.55) {
          const t = (h.timer - 2.2) / 0.35;
          stamperY = THREE.MathUtils.lerp(2.6, 0.42, Math.min(1, t * 2.5));
          isSlamming = stamperY < 0.75;
          if (prevTimer < 2.28 && h.timer >= 2.28) {
            this.spawnParticleRing(h.x, 0.15, h.z, 0xf59e0b);
            if (Math.hypot(this.playerPos.x - h.x, this.playerPos.z - h.z) < 14) {
              this.triggerScreenShake(0.35, 0.2);
            }
          }
        } else if (h.timer >= 2.55) {
          const t = (h.timer - 2.55) / Math.max(0.1, cycle - 2.55);
          stamperY = THREE.MathUtils.lerp(0.42, 2.6, t);
        }
        if (h.movingPart) {
          h.movingPart.position.y = stamperY;
        }
        if (isSlamming) {
          if (Math.abs(this.playerPos.x - h.x) < 1.05 && Math.abs(this.playerPos.z - h.z) < 1.05 && this.playerPos.y < 1.2) {
            this.takeDamage('Zmieciony przez 500-tonową Prasę Hydrauliczną do Spieków!');
          }
          for (const e of this.enemies) {
            if (e.state === 'defeated') continue;
            if (Math.abs(e.x - h.x) < 1.2 && Math.abs(e.z - h.z) < 1.2 && e.stunTimer <= 0) {
              e.hp -= 3;
              e.stunTimer = 2.5;
              this.emitFloatingToast('💥 ZMIAŻDŻONY PRASĄ -3 HP!', e.x, e.y + 1.2, e.z, 'damage');
              if (e.hp <= 0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
                this.defeatEnemy(e, 280, true);
              }
            }
          }
        }
      }
    });
  }

  private updateExplosiveBarrels(dt: number) {
    for (let i = this.explosiveBarrels.length - 1; i >= 0; i--) {
      const b = this.explosiveBarrels[i];
      if (b.exploded || !b.mesh) continue;

      const distToPlayer = Math.hypot(b.x - this.playerPos.x, b.z - this.playerPos.z);
      const isPlayerAttacking = this.attackSwingTimer > 0;

      // Trigger fuse on melee attack or player proximity when attacking
      if (isPlayerAttacking && distToPlayer < 2.4 && b.fuseTimer < 0) {
        b.fuseTimer = 0.55;
        sound.playAlert();
        this.emitFloatingToast('⚡ LONT ZAPALONY!', b.x, b.y + 1.2, b.z, 'damage');
      }

      if (b.fuseTimer > 0) {
        b.fuseTimer -= dt;
        const pulse = 1.0 + Math.sin(performance.now() * 0.04) * 0.22;
        b.mesh.scale.set(pulse, pulse, pulse);

        if (b.fuseTimer <= 0) {
          b.exploded = true;
          this.levelRoot.remove(b.mesh);
          sound.playExplosion();
          this.triggerScreenShake(1.2, 0.8);
          this.spawnParticleRing(b.x, b.y + 0.5, b.z, 0xef4444);
          this.emitFloatingToast('💥 EKSPLOZJA KLEJU PRO FLEX!', b.x, b.y + 1.2, b.z, 'damage');

          // Detonate and damage enemies in 5.2m radius
          this.enemies.forEach((e) => {
            if (e.state === 'defeated') return;
            const edist = Math.hypot(e.x - b.x, e.z - b.z);
            if (edist < 5.2) {
              e.hp = Math.max(0, e.hp - 3);
              e.stunTimer = 3.5;
              e.state = 'stunned';
              this.emitFloatingToast('💥 -3 HP!', e.x, e.y + 1.2, e.z, 'damage');
              if (e.hp <= 0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
                e.state = 'defeated';
                if (e.mesh) e.mesh.visible = false;
                this.score += 350;
                this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
              }
            }
          });

          // Player splash damage if close
          if (distToPlayer < 3.2) {
            this.takeDamage('Zostałeś obrzucony eksplozyjnym klejem PRO FLEX!');
          }

          this.explosiveBarrels.splice(i, 1);
        }
      }
    }
  }

  // Reference to quotes defined at top of class
  private static readonly _DUPLICATE_ENEMY_QUOTES: Record<string, string[]> = {
    customer: [
      "Gdzie moje kafelki?!",
      "Awantura o rabat 10%!",
      "Chcę widzieć kierownika!",
      "Płytki miały być gładkie!"
    ],
    architect: [
      "To ma być ecru czy beż?!",
      "Brak dylatacji na podłodze!",
      "Gres niezgodny z projektem!",
      "Wizualizacja mówiła inaczej!"
    ],
    agv_robot: [
      "BEEP BOOP ZLEW B4!",
      "Uwaga! Transport palety!",
      "Błąd czujnika przeszkód!",
      "Sztaplowanie w toku!"
    ],
    inspector: [
      "Gdzie kask BHP?!",
      "Brak protokołu odbioru!",
      "Mandat 500 PLN za bałagan!",
      "Przekroczenie normy hałasu!"
    ],
    handlowiec: [
      "Mam super ofertę na zlew!",
      "Rabat 3% tylko dzisiaj!",
      "A może zestaw baterii?!",
      "Darmowa dostawa do hotelu!"
    ],
    monter: [
      "Dobiję to gumowym młotkiem!",
      "Brak poziomu w alei!",
      "Cięcie po skosie 45°!",
      "Mieszam klej wysokie wiązanie!"
    ],
    piorun_dron: [
      "BZZZT SKAN KODU B4!",
      "Niezgodność numeru WZ!",
      "Skanowanie palety A1!",
      "Detekcja ruchu w alei!"
    ],
    elite_walczak_guard: [
      "Strefa Walczaka zamknięta!",
      "Brak przepustki B4!",
      "Odwrót z magazynu!",
      "Tarcza BHP w gotowości!"
    ],
    kurier: [
      "Dostawa DPD od Rudego z DPD! Załatwię Johnny Walkera tanio",
      "Paczka ekspresowa DPD dla VIP! Załatwię Johnny Walkera tanio",
      "Paczka od Rudego! Załatwię Johnny Walkera tanio",
      "Johnny Walker Express u drzwi! Załatwię Johnny Walkera tanio"
    ],
    przedstawiciel_włoski: [
      "Mamma mia, armatura de lux!",
      "Zlatane baterie z Mediolanu!",
      "Prego, uwaga na marmur!",
      "Amore, to jest prawdziwy styl!"
    ],
    sztaplar_szalony: [
      "Z drogi, 3 tony ładunku!",
      "Paleciak bez hamulców!",
      "Uwaga wyjazd z alei C!",
      "Czysta moc 300 Nm!"
    ],
    walczak: [
      "Ten magazyn jest MÓJ!",
      "Anuluję wszystkie faktury!",
      "Zawiadamiam Centralę!",
      "Nikt tu nie wygra ze mną!"
    ],
    krol_leto: [
      "ZWALNIAM CIĘ DYSCYPLINARNIE!",
      "Dyscyplinarka w trybie natychmiastowym!",
      "Oddawaj kask BHP i przepustkę!",
      "Moja decyzja o zwolnieniu jest OSTATECZNA!",
      "Błąd w WZ-tce? To koniec Twojej kariery!"
    ],
    pan_roman: [
      "Panowie spieszę się! To tylko jakieś sanitariaty!",
      "Dostawa dla Klienta z Kęt! Uwaga na umywalki!",
      "Proszę zrobić przejście w alei A3!"
    ],
    serwisant: [
      "Przyjaciele! Kto nam pomoże?!",
      "Serwis Max-Flix na trasie! Szybka naprawa!",
      "Sprawdzam opór na fugach i zasilaniu!"
    ],
    bosman_krakow: [
      "Odprawa 3-msc w toku! Wyniki albo kara!",
      "Raport kwartalny do podpisu na cito!",
      "W Krakowie tak się zamówień nie spóźnia!"
    ],
    zombie_pracownik: [
      "KFC?! Dawid przywiózł kubełek! Z drogi!",
      "Czuję panierkę z pięciu alejek! Oddawaj stripsa!",
      "Trzecia zmiana bez obiadu... KUBEŁEK JEST MÓJ!",
      "Móóózg... znaczy KURCZAAAK z dostawy Dawida!"
    ]
  };

  private updateEnemies(dt: number) {
    if (this.globalEnemyShoutCooldown > 0) {
      this.globalEnemyShoutCooldown -= dt;
    }

    // Progressive pressure: unlock more simultaneous attackers as a run develops.
    // It uses the campaign's existing enemy set; no extra entities are spawned here.
    const elapsedSec = this.levelStartTime > 0 ? (performance.now() - this.levelStartTime) / 1000 : 0;
    const nextThreatTier = Math.min(4, Math.floor(elapsedSec / 55));
    if (nextThreatTier > this.threatTier) {
      this.threatTier = nextThreatTier;
      const tierMessages = [
        '',
        'ALARM MAGAZYNU: wzmożona aktywność przeciwników!',
        'UWAGA: kolejna zmiana weszła do akcji!',
        'SEKTOR ZAOSTRZA OCHRONĘ — trzymaj pozycję!',
        'MAKSYMALNY POZIOM ZAGROŻENIA — przetrwaj napór!',
      ];
      this.emitFloatingToast(tierMessages[this.threatTier], this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'damage');
      sound.playAlert();
    }

    // WAVE DIRECTOR: Rebuild the nearest-engager list at 5-6 Hz. Enemy movement
    // still updates every frame; only the expensive candidate allocation/sort is throttled.
    this.waveDirectorCooldown -= dt;
    if (this.waveDirectorCooldown <= 0) {
      this.waveDirectorCooldown = 0.18;
      const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
      const baseChasers = isMobile ? 2 : 3;
      const platformCap = isMobile ? 4 : 5;
      const maxActiveChasers = Math.min(platformCap, baseChasers + Math.floor(this.threatTier * 0.75));
      const activeCandidates: { enemy: EnemyItem; dist: number }[] = [];

      for (const e of this.enemies) {
        if (e.state === 'defeated' || !e.mesh) continue;
        const d = Math.hypot(this.playerPos.x - e.x, this.playerPos.z - e.z);
        if (d > 26.0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
          if (e.mesh.visible) e.mesh.visible = false;
          continue;
        }
        if (!e.mesh.visible) e.mesh.visible = true;
        if (e.type !== 'walczak' && e.type !== 'krol_leto' && d <= 18.0) {
          activeCandidates.push({ enemy: e, dist: d });
        }
      }

      activeCandidates.sort((a, b) => a.dist - b.dist);
      this.activeChaserIds.clear();
      for (let i = 0; i < Math.min(maxActiveChasers, activeCandidates.length); i++) {
        this.activeChaserIds.add(activeCandidates[i].enemy.id);
      }
    }

    this.enemies.forEach((e) => {
      if (e.state === 'defeated' || !e.mesh) return;

      const dx = this.playerPos.x - e.x;
      const dz = this.playerPos.z - e.z;
      const distToPlayer = Math.hypot(dx, dz);

      // Distance culling: skip heavy updates for distant non-boss enemies
      if (distToPlayer > 26.0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
        if (e.mesh.visible) e.mesh.visible = false;
        return;
      }
      if (!e.mesh.visible) e.mesh.visible = true;

      if (!e.hpBar) {
        e.hpBar = new THREE.Group();
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        fill.position.z = 0.01;
        e.hpBar.add(bg, fill);
        e.hpBar.position.y = e.type === 'walczak' || e.type === 'krol_leto' ? 2.4 : 1.65;
        e.mesh.add(e.hpBar);
        e.hpFill = fill;
        e.hpBar.visible = false;
      }
      if (e.hpBar) {
        const isDamaged = e.hp < e.maxHp;
        e.hpBar.visible = isDamaged;
        if (isDamaged) {
          e.hpBar.lookAt(this.camera.position);
          e.hpFill.scale.x = Math.max(0, e.hp / e.maxHp);
          e.hpFill.position.x = (e.hpFill.scale.x - 1) * 0.4;
        }
      }

      e.walkCycle += dt * 8;
      if (e.legL && e.legR && e.type !== 'piorun_dron') {
        e.legL.rotation.x = Math.sin(e.walkCycle) * 0.5;
        e.legR.rotation.x = -Math.sin(e.walkCycle) * 0.5;
      }

      // Ground Threat Ring for actively chasing enemies
      if (!e.threatRing && e.type !== 'piorun_dron') {
        const ringMesh = new THREE.Mesh(
          new THREE.RingGeometry(0.42, 0.54, 20),
          new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.04;
        e.threatRing = ringMesh;
        e.mesh.add(ringMesh);
      }
      if (e.threatRing) {
        e.threatRing.visible = (e.state === 'chase' || e.state === 'charging') && distToPlayer < 14;
      }

      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        if (e.stunTimer <= 0) {
          e.state = 'searching';
          e.searchTimer = 2.5;
        }
        return;
      }

      // Check whether this enemy is allowed to engage or must hold position in wave
      const canActivelyChase = e.type === 'walczak' || e.type === 'krol_leto' || this.activeChaserIds.has(e.id);

      // SIGHT & DETECTION LOGIC
      const threatAwareness = 1 + this.threatTier * 0.025;
      const detectionRange = (e.type === 'walczak' || e.type === 'krol_leto')
        ? 16.0
        : (e.state === 'chase' ? 12.0 : 8.5) * threatAwareness;
      const canSeePlayer = distToPlayer < detectionRange && canActivelyChase;

      if (canSeePlayer) {
        e.state = 'chase';
        e.lastKnownPlayerPos = { x: this.playerPos.x, z: this.playerPos.z };
        e.searchTimer = 0;
      } else if (e.state === 'chase') {
        e.state = 'searching';
        e.searchTimer = 2.5;
      }

      if (e.state === 'searching' && e.searchTimer !== undefined) {
        e.searchTimer -= dt;
        if (e.searchTimer <= 0) {
          e.state = 'patrol';
          e.lastKnownPlayerPos = null;
        } else if (e.lastKnownPlayerPos) {
          const sdx = e.lastKnownPlayerPos.x - e.x;
          const sdz = e.lastKnownPlayerPos.z - e.z;
          const sdist = Math.hypot(sdx, sdz);
          if (sdist > 0.5) {
            e.x += (sdx / sdist) * e.speed * 0.7 * dt;
            e.z += (sdz / sdist) * e.speed * 0.7 * dt;
          }
        }
      }

      // Global Throttled Shout Quotes (max 1 quote at a time across all enemies with 4.0s minimum gap)
      e.shoutTimer = (e.shoutTimer || 0) - dt;
      if (e.shoutTimer <= 0 && distToPlayer < 9.0 && this.globalEnemyShoutCooldown <= 0) {
        e.shoutTimer = 4.5 + Math.random() * 3.0;
        this.globalEnemyShoutCooldown = 4.0;
        const quotes = MaxFlizGameEngine.ENEMY_QUOTES[e.type] || ["Z drogi!"];
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        e.shoutText = quote;
        this.emitFloatingToast(quote, e.x, e.y + 1.25, e.z, 'enemy_shout', { enemyType: e.type });
      }

      // Special movement per type
      if (e.type === 'piorun_dron') {
        if (e.legL) e.legL.rotation.y += dt * 30;
        if (e.legR) e.legR.rotation.y += dt * 30;
        if (e.armL) e.armL.rotation.y += dt * 30;
        if (e.armR) e.armR.rotation.y += dt * 30;

        e.x += e.speed * e.dir * dt;
        if (e.dir > 0 && e.x >= e.endX) {
          e.dir = -1;
        } else if (e.dir < 0 && e.x <= e.startX) {
          e.dir = 1;
        }
        e.mesh.position.set(e.x, e.y + Math.sin(performance.now() * 0.005) * 0.12, e.z);
      } else if (e.type === 'walczak') {
        // Boss AI: Walczak
        const isPhase2 = e.hp <= e.maxHp * 0.5;
        if (isPhase2 && e.bossPhase !== 2) {
          e.bossPhase = 2;
          e.speed *= 1.45;
          sound.playSirens();
          this.triggerScreenShake(0.8, 1.0);
          this.emitFloatingToast('🚨 WALCZAK: TRYB SZAŁU (FAZA 2)!', e.x, e.y + 1.8, e.z, 'damage');
        }

        if (distToPlayer < 14.0) {
          const angle = Math.atan2(dx, dz);
          e.mesh.rotation.y = angle;
          e.x += (dx / Math.max(0.1, distToPlayer)) * e.speed * 0.95 * dt;
          e.z += (dz / Math.max(0.1, distToPlayer)) * e.speed * 0.95 * dt;
        } else {
          e.x += e.speed * e.dir * dt;
          if (e.dir > 0 && e.x >= e.endX) {
            e.dir = -1;
            e.mesh.rotation.y = Math.PI / 2;
          } else if (e.dir < 0 && e.x <= e.startX) {
            e.dir = 1;
            e.mesh.rotation.y = -Math.PI / 2;
          }
        }
        e.mesh.position.set(e.x, e.y, e.z);

        if (e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt;
          const cooldown = isPhase2 ? 1.8 : 3.0;
          if (e.specialActionTimer <= 0) {
            e.specialActionTimer = cooldown;
            this.spawnPenaltyNotice(e.x, e.y + 1.2, e.z);
          }
        }
        this.callbacks.onBossUpdate?.(e.name, e.hp, e.maxHp, true, e.bossPhase);
      } else if (e.type === 'krol_leto') {
        // Boss AI: Król-Leto
        const isPhase2 = e.hp <= e.maxHp * 0.5;
        if (isPhase2 && e.bossPhase !== 2) {
          e.bossPhase = 2;
          e.speed *= 1.5;
          sound.playEvilLaugh();
          this.triggerScreenShake(1.2, 1.5);
          this.emitFloatingToast('🔥 KRÓL-LETO: OSTATECZNE ZWOLNIENIE!', e.x, e.y + 1.8, e.z, 'damage');
        }

        if (distToPlayer < 15.0) {
          const angle = Math.atan2(dx, dz);
          e.mesh.rotation.y = angle;
          e.x += (dx / Math.max(0.1, distToPlayer)) * e.speed * 1.05 * dt;
          e.z += (dz / Math.max(0.1, distToPlayer)) * e.speed * 1.05 * dt;
          if (isPhase2 && Math.random() < 0.05) this.triggerScreenShake(0.1, 0.2);
        } else if (e.state === 'searching' && e.lastKnownPlayerPos) {
          const angle = Math.atan2(e.lastKnownPlayerPos.x - e.x, e.lastKnownPlayerPos.z - e.z);
          e.mesh.rotation.y = angle;
        } else {
          e.x += e.speed * e.dir * dt;
          if (e.dir > 0 && e.x >= e.endX) {
            e.dir = -1;
            e.mesh.rotation.y = Math.PI / 2;
          } else if (e.dir < 0 && e.x <= e.startX) {
            e.dir = 1;
            e.mesh.rotation.y = -Math.PI / 2;
          }
        }
        e.mesh.position.set(e.x, e.y, e.z);

        if (e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt;
          const cooldown = isPhase2 ? 1.2 : 2.2;
          if (e.specialActionTimer <= 0 && distToPlayer < 12.0) {
            e.specialActionTimer = cooldown;
            this.spawnDyscyplinarkaNotice(e.x, e.y + 1.2, e.z);
            this.emitFloatingToast('🚨 DYSCYPLINARKA!', e.x, e.y + 1.5, e.z, 'damage');
          }
        }
        this.callbacks.onBossUpdate?.(e.name, e.hp, e.maxHp, true, e.bossPhase);
      } else {
        // Dynamic Chase / Tracking AI for ground enemies
        const chaseRadius =
          e.type === 'zombie_pracownik'
            ? 18.0
            : e.type === 'kurier'
              ? 14.0
              : e.type === 'sztaplar_szalony'
                ? 12.0
                : 10.0;

        if (distToPlayer < chaseRadius) {
          if (e.state === 'patrol' && !e.alerted) {
            e.alerted = true;
            this.emitFloatingToast(e.type === 'zombie_pracownik' ? '🍗!' : '!', e.x, e.y + 1.35, e.z, 'damage');
            sound.playAlert();
          }
          e.state = 'chase';
          const angle = Math.atan2(dx, dz);
          e.mesh.rotation.y = angle;

          const chaseSpeed =
            e.speed *
            (e.type === 'zombie_pracownik'
              ? 1.42
              : e.type === 'kurier'
                ? 1.35
                : 1.2) *
            (1 + this.threatTier * 0.04);
          e.x += (dx / Math.max(0.1, distToPlayer)) * chaseSpeed * dt;
          e.z += (dz / Math.max(0.1, distToPlayer)) * chaseSpeed * dt;
        } else {
          e.alerted = false;
          e.state = 'patrol';
          e.z += e.speed * e.dir * dt;
          if (e.dir > 0 && e.z >= e.endX) {
            e.dir = -1;
            e.mesh.rotation.y = Math.PI;
          } else if (e.dir < 0 && e.z <= e.startX) {
            e.dir = 1;
            e.mesh.rotation.y = 0;
          }
        }
        e.mesh.position.set(e.x, e.y, e.z);

        // Ranged special attacks
        if ((e.type === 'handlowiec' || e.type === 'przedstawiciel_włoski') && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt;
          if (e.specialActionTimer <= 0 && distToPlayer < 9.0) {
            e.specialActionTimer = 2.8;
            this.spawnPenaltyNotice(e.x, e.y + 0.8, e.z);
            const msg = e.type === 'przedstawiciel_włoski' ? '🇮🇹 ARMATURA DE LUX!' : '📑 OFERTA RABATOWA!';
            this.emitFloatingToast(msg, e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'inspector' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt;
          if (e.specialActionTimer <= 0 && distToPlayer < 6.5) {
            e.specialActionTimer = 2.8;
            sound.playWhistle();
            this.emitFloatingToast('🚨 KONTROLA BHP!', e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'pan_roman' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt;
          if (e.specialActionTimer <= 0 && distToPlayer < 10.0) {
            e.specialActionTimer = 2.5;
            this.spawnSanitarywareProjectile(e.x, e.y + 0.8, e.z);
            this.emitFloatingToast('📦 UMYWALKA W DRODZE!', e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'serwisant' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt;
          if (e.specialActionTimer <= 0 && distToPlayer < 8.5) {
            e.specialActionTimer = 2.2;
            this.spawnSparkZapProjectile(e.x, e.y + 0.8, e.z);
            this.emitFloatingToast('⚡ ISKRA SERWISU!', e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'bosman_krakow' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt;
          if (e.specialActionTimer <= 0 && distToPlayer < 12.0) {
            e.specialActionTimer = 2.4;
            this.spawnOdprawaClipboardProjectile(e.x, e.y + 1.0, e.z);
            this.emitFloatingToast('📋 ODPRAWA 3-MSC (FATAL HIT)!', e.x, e.y + 1.4, e.z, 'damage');
          }
        }
      }

      // Check collision with player
      const dist = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
      const hitRadius = e.type === 'walczak' || e.type === 'krol_leto' ? 1.5 : e.type === 'elite_walczak_guard' ? 1.3 : 1.1;

      if (dist < hitRadius) {
        // 1. STOMP MECHANIC (Naskok z góry)
        if (this.playerVel.y < -0.8 && this.playerPos.y > e.y + 0.35) {
          const bounceForce = e.type === 'agv_robot' ? this.charDef.jumpForce * 1.3 : this.charDef.jumpForce * 0.95;
          this.playerVel.y = bounceForce;
          sound.playBounce();
          this.cameraShake = 0.35;
          this.spawnParticleRing(e.x, e.y + 0.8, e.z, 0x38bdf8);

          e.hp -= 2;
          this.emitFloatingToast('💥 STOMP! +150', e.x, e.y + 1.2, e.z, 'points');
          this.emitFloatingToast('-2 HP', e.x, e.y + 0.7, e.z, 'damage');

          if (e.hp <= 0) {
            this.defeatEnemy(e, 260, true);
          } else {
            e.stunTimer = 1.0;
            e.state = 'stunned';
          }
        } else if (Math.abs(e.y - this.playerPos.y) < 1.1) {
          // Horizontal Contact
          if ((this.activePerks.bulldozer || 0) > 0) {
            const nowMs = performance.now();
            const lastHit = this.bulldozerHitCooldowns.get(e.id) || 0;
            if (nowMs - lastHit > 550) {
              this.bulldozerHitCooldowns.set(e.id, nowMs);
              e.hp -= 3;
              e.stunTimer = 2.2;
              e.state = 'stunned';
              sound.playSmack();
              this.triggerScreenShake(0.45, 0.25);
              this.spawnParticleRing(e.x, e.y + 0.8, e.z, 0xfacc15);
              this.emitFloatingToast('🚜 TARAN PALECIAKIEM! -3 HP!', e.x, e.y + 1.2, e.z, 'combo');
              if (e.hp <= 0) this.defeatEnemy(e, 300, true);
            }
          } else if (this.marcinReclamationTimer > 0) {
            e.stunTimer = 2.5;
            e.state = 'stunned';
            this.emitFloatingToast('🛡️ AUDYT BHP!', e.x, e.y + 1, e.z, 'perk');
          } else if (this.grzesiekCrushTimer > 0) {
            e.hp -= 3;
            this.emitFloatingToast('-3 HP ŚCISK!', e.x, e.y + 1, e.z, 'damage');
            if (e.hp <= 0) this.defeatEnemy(e, 280, true);
          } else if (e.type === 'krol_leto') {
            if (this.activePerks.shield) {
              this.activePerks.shield = false;
              this.invulnerableTimer = 1.2;
              sound.playShieldBreak();
              this.sayQuote('Kask BHP zamortyzował atak Króla-Leto!');
            } else {
              this.takeDamage('🚨 ZWOLNIENIE DYSCYPLINARNE NA HITA OD KRÓLA-LETO!');
            }
          } else {
            this.takeDamage(`Zaatakował Cię: ${e.name}!`);
          }
        }
      }
    });
  }

  private spawnPenaltyNotice(x: number, y: number, z: number) {
    const mesh = createPenaltyNoticeProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = new THREE.Vector3(this.playerPos.x - x, 0, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, vel: dir.multiplyScalar(7.5), life: 3.5 });
    sound.playWhistle();
  }

  private spawnDyscyplinarkaNotice(x: number, y: number, z: number) {
    const mesh = createPenaltyNoticeProjectile();
    mesh.scale.setScalar(1.6);
    (mesh.material as THREE.MeshStandardMaterial).color.setHex(0xef4444);
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = new THREE.Vector3(this.playerPos.x - x, 0, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, vel: dir.multiplyScalar(10.0), life: 3.5, isDyscyplinarka: true });
    sound.playWhistle();
  }

  private spawnSanitarywareProjectile(x: number, y: number, z: number) {
    const mesh = createSanitarywareProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = new THREE.Vector3(this.playerPos.x - x, 0.2, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, vel: dir.multiplyScalar(8.2), life: 3.5 });
    sound.playWoosh();
  }

  private spawnSparkZapProjectile(x: number, y: number, z: number) {
    const mesh = createSparkZapProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = new THREE.Vector3(this.playerPos.x - x, 0.1, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, vel: dir.multiplyScalar(9.5), life: 3.0 });
    sound.playElectricalSparks();
  }

  private spawnOdprawaClipboardProjectile(x: number, y: number, z: number) {
    const mesh = createOdprawaClipboardProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = new THREE.Vector3(this.playerPos.x - x, 0.1, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, vel: dir.multiplyScalar(10.0), life: 4.0, isDyscyplinarka: true });
    sound.playWhistle();
    this.triggerScreenShake(0.4, 0.3);
  }

  private spawnFallingTileHazard(x: number, z: number, targetY = 0) {
    const tileMesh = createLargeTileModel();
    tileMesh.position.set(x, 12, z);
    tileMesh.rotation.x = 0.2;
    tileMesh.rotation.z = -0.35;
    this.levelRoot.add(tileMesh);

    // Red warning circle/ring indicator on ground
    const ringGeo = new THREE.RingGeometry(0.2, 1.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const warningRing = new THREE.Mesh(ringGeo, ringMat);
    warningRing.rotation.x = -Math.PI / 2;
    warningRing.position.set(x, targetY + 0.02, z);
    this.levelRoot.add(warningRing);

    sound.playSirenAlert();
    this.emitFloatingToast('⚠️ UWAGA! SPADAJĄCY GRES 120x280!', x, targetY + 1.5, z, 'damage');

    this.fallingTiles.push({
      id: `tile_${Date.now()}_${Math.random()}`,
      x,
      y: 12,
      z,
      targetY,
      fallSpeed: 0,
      state: 'warning',
      warningTimer: 1.1,
      mesh: tileMesh,
      warningRing,
    });
  }

  private updateFallingTiles(dt: number) {
    // Periodically auto-spawn falling tile hazards near player in active game
    this.fallingTileSpawnTimer += dt;
    if (this.fallingTileSpawnTimer >= 8.5) {
      this.fallingTileSpawnTimer = 0;
      // Spawn near player offset
      const offsetX = (Math.random() - 0.5) * 12;
      const offsetZ = (Math.random() - 0.5) * 8;
      const spawnX = Math.max(this.levelBounds.minX + 4, Math.min(this.levelBounds.maxX - 4, this.playerPos.x + offsetX));
      const spawnZ = Math.max(this.levelBounds.minZ + 2, Math.min(this.levelBounds.maxZ - 2, this.playerPos.z + offsetZ));
      this.spawnFallingTileHazard(spawnX, spawnZ, 0);
    }

    for (let i = this.fallingTiles.length - 1; i >= 0; i--) {
      const tile = this.fallingTiles[i];
      if (tile.state === 'warning') {
        tile.warningTimer -= dt;
        // Pulse warning ring scale and opacity
        const scale = 1 + Math.sin(tile.warningTimer * 20) * 0.15;
        tile.warningRing.scale.set(scale, scale, 1);
        (tile.warningRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(tile.warningTimer * 25) * 0.35;

        if (tile.warningTimer <= 0) {
          tile.state = 'falling';
        }
      } else if (tile.state === 'falling') {
        tile.fallSpeed += 28 * dt; // Gravity acceleration
        tile.y -= tile.fallSpeed * dt;
        tile.mesh.position.y = tile.y;
        tile.mesh.rotation.x += dt * 3.0;
        tile.mesh.rotation.y += dt * 4.0;

        if (tile.y <= tile.targetY + 0.1) {
          // Impact!
          tile.state = 'shattered';
          this.levelRoot.remove(tile.mesh);
          this.levelRoot.remove(tile.warningRing);
          this.fallingTiles.splice(i, 1);

          // Explosion sound & screen shake
          sound.playExplosion();
          this.triggerScreenShake(0.6, 0.4);

          // Glass / Tile Shatter Particles
          this.spawnExplosionParticles(tile.x, tile.targetY + 0.3, tile.z, 0xf3f4f6, 28);
          this.spawnParticleRing(tile.x, tile.targetY + 0.1, tile.z, 0xd97706);

          // AoE Damage to Player
          const playerDist = Math.hypot(this.playerPos.x - tile.x, this.playerPos.z - tile.z);
          if (playerDist < 2.2 && Math.abs(this.playerPos.y - tile.targetY) < 1.5) {
            this.takeDamage('Spadający Wielki Format Gresu Calacatta 120x280!');
          }

          // Damage or stun nearby enemies
          for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            const enemyDist = Math.hypot(enemy.x - tile.x, enemy.z - tile.z);
            if (enemyDist < 2.5) {
              enemy.hp -= 3;
              enemy.stunTimer = 2.5;
              this.emitFloatingToast('💥 TILE CRASH! -3 HP', enemy.x, enemy.y + 1.2, enemy.z, 'damage');
              if (enemy.hp <= 0) {
                this.defeatEnemy(enemy, 260, true);
              }
            }
          }
        }
      }
    }
  }

  private updateRandomSpawners(dt: number) {
    this.randomSpawnTimer += dt;
    if (this.randomSpawnTimer >= 10.0) {
      this.randomSpawnTimer = 0;
      // Spawn random Espresso or Nitro Boost pickup in active sector
      const rx = (Math.random() - 0.5) * 44;
      const rz = (Math.random() - 0.5) * 14;
      const isCoffee = Math.random() > 0.4;
      if (isCoffee) {
        this.addEspressoItem(`rand_esp_${Date.now()}`, rx, 0.4, rz);
        this.emitFloatingToast('☕ DOKIEROWANE ESPRESSO Z AUTOMATU!', rx, 1.2, rz, 'perk');
      } else {
        this.spawnDroppedPerk(rx, 0.5, rz, 'espresso_boost');
      }
    }
  }

  public triggerTimedWarehouseEvent(forcedIndex?: number) {
    if (this.state !== 'playing' || this.gameMode === 'survival') return;
    const eventIdx = forcedIndex !== undefined ? forcedIndex : this.timedEventIndex % 5;
    this.timedEventIndex++;
    this.timedEventCooldown = 26.0;

    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    if (eventIdx === 0) {
      // EVENT 1: DAWID PRZYWIÓZŁ JEDZENIE Z KFC! FALA GŁODNYCH ZOMBIE!
      sound.playSirenAlert();
      this.triggerScreenShake(0.75, 0.7);
      this.callbacks.onPerkDropBanner?.(
        '🍗 DAWID PRZYWIÓZŁ JEDZENIE Z KFC!',
        '🧟‍♂️',
        'Fala wygłodniałych magazynierów-zombie szarżuje po kubełki! Zbierz KFC pierwszy (+2 Kawy i Furia 2x Obrażeń)!',
        '#ef4444'
      );
      this.sayQuote('DAWID PRZYWIÓZŁ KUBEŁKI Z KFC! Cała zmiana biegnie jak horda zombie – bierz stripsy zanim zjedzą!');

      // Drop 2 KFC buckets + 1 KFC Perk Crate around the player
      this.addKfcBucketItem(`event_kfc_${Date.now()}_1`, px + 4.5, 0.45, THREE.MathUtils.clamp(pz - 2.2, -14, 14));
      this.addKfcBucketItem(`event_kfc_${Date.now()}_2`, px + 6.5, 0.45, THREE.MathUtils.clamp(pz + 2.2, -14, 14));
      this.spawnDroppedPerk(px + 2.8, 0.5, pz, 'kfc_bucket');

      // Spawn a charging horde of 5 hungry zombie warehouse workers around the player
      const offsets = [
        { dx: 11, dz: -4.5 },
        { dx: 12.5, dz: -1.5 },
        { dx: 13.5, dz: 1.8 },
        { dx: 11.5, dz: 4.5 },
        { dx: -10.5, dz: 0 },
      ];
      offsets.forEach((off, idx) => {
        const zx = THREE.MathUtils.clamp(px + off.dx, this.levelBounds.minX + 3, this.levelBounds.maxX - 3);
        const zz = THREE.MathUtils.clamp(pz + off.dz, -14, 14);
        this.addZombieWorkerEnemy(`zombie_wave_${Date.now()}_${idx}`, zx, zz - 5, zz + 5, 'Wygłodniały Zombie-Magazynier (KFC!)');
      });
    } else if (eventIdx === 1) {
      // EVENT 2: SZARŻA SZALONYCH SZTAPLAREK & ZŁOTY PALECIAK!
      sound.playSirenAlert();
      this.triggerScreenShake(0.8, 0.6);
      this.callbacks.onPerkDropBanner?.(
        '🚜 EVENT: SZARŻA SZTAPLAREK B4!',
        '⚡',
        'Zdzichu spuścił wózki ze smyczy! Złap Złoty Paleciak Turbo i taranuj wszystko na drodze!',
        '#eab308'
      );
      this.sayQuote('UWAGA NA KORYTARZ! Szarża sztaplarek! Łap Złoty Paleciak i jedziesz z nimi jak taran!');
      this.spawnDroppedPerk(px + 3.2, 0.5, pz - 1.5, 'golden_paleciak');
      this.spawnDroppedPerk(px + 3.2, 0.5, pz + 1.5, 'stretch_armor');
      this.addSztaplarEnemy(`event_sztaplar_${Date.now()}_1`, px + 12, Math.max(-14, pz - 5), Math.min(14, pz + 5), 'Szalony Rajdowiec Paleciaka');
      this.addSztaplarEnemy(`event_sztaplar_${Date.now()}_2`, px - 11, Math.max(-14, pz - 5), Math.min(14, pz + 5), 'Driftujący Sztaplarz B4');
    } else if (eventIdx === 2) {
      // EVENT 3: NALOT INSPEKCJI BHP & DESZCZ GRESU 120x280!
      sound.playSirenAlert();
      this.triggerScreenShake(0.7, 0.6);
      this.callbacks.onPerkDropBanner?.(
        '🚨 EVENT: NALOT INSPEKCJI BHP & DESZCZ GRESU!',
        '⛑️',
        'Z sufitu lecą płyty Calacatta 120x280! Zbierz Atestowany Kask BHP oraz Podwójne Espresso!',
        '#38bdf8'
      );
      this.sayQuote('NALOT INSPEKCJI BHP! Z góry sypie się wielki format 120x280 – zakładaj kask!');
      this.spawnDroppedPerk(px + 2.5, 0.5, pz, 'hardhat');
      this.spawnDroppedPerk(px + 4.5, 0.5, pz + 2.0, 'espresso_boost');
      for (let i = 0; i < 4; i++) {
        const tx = THREE.MathUtils.clamp(px + (i - 1.5) * 4.5, this.levelBounds.minX + 4, this.levelBounds.maxX - 4);
        const tz = THREE.MathUtils.clamp(pz + (Math.random() - 0.5) * 7, -12, 12);
        this.spawnFallingTileHazard(tx, tz, 0);
      }
      this.addInspectorEnemy(`event_insp_${Date.now()}`, px + 11, Math.max(-12, pz - 5), Math.min(12, pz + 5), 'Komisarz Lotnej Brygady BHP');
    } else if (eventIdx === 3) {
      // EVENT 4: BLACK FRIDAY -80% NA WANNY & PODWÓJNE PUNKTY!
      sound.playPickup(3);
      this.doublePointsTimer = 16.0;
      this.callbacks.onPerkDropBanner?.(
        '💸 PROMOCJA -80% NA WANNY! 2X PUNKTY (16s)!',
        '🛁',
        'Szturm klientów i architektów na salon! Wszystkie punkty x2 oraz deszcz złotych fug!',
        '#10b981'
      );
      this.sayQuote('PROMOCJA -80% NA WANNY WOLNOSTOJĄCE! Klienci szturmują bramę, a punkty liczą się PODWÓJNIE!');
      for (let i = 0; i < 4; i++) {
        this.addGroutItem(`event_grout_${Date.now()}_${i}`, px + 3 + i * 2.0, 0.6, THREE.MathUtils.clamp(pz + (i % 2 === 0 ? -1.5 : 1.5), -14, 14), 120);
      }
      this.spawnDroppedPerk(px + 3.5, 0.5, pz, 'order_magnet');
      this.addCustomerEnemy(`event_cust_${Date.now()}_1`, px + 10, Math.max(-12, pz - 5), Math.min(12, pz + 5), 'Łowca Promocji -80%');
      this.addArchitectEnemy(`event_arch_${Date.now()}_2`, px + 12, px + 18, pz, 'Architektka na Wyprzedaży');
    } else {
      // EVENT 5: KIEROWNIK MARCIN PRZEGRYWA W WORLD OF TANKS!
      sound.playSirenAlert();
      this.triggerScreenShake(0.75, 0.65);
      this.marcinWoTPenaltyTimer = 6.0;
      this.callbacks.onPerkDropBanner?.(
        '🎮 KIEROWNIK MARCIN PRZEGRYWA W WORLD OF TANKS!',
        '💢',
        'Kierownik stracił czołg w Lidze WoT i szuka winnego w alejkach! "Znajdę Ci zajęcie, wesołku..." (-30% szybkości na 6s)',
        '#f97316'
      );
      this.sayQuote('Kierownik Marcin przegrał bitwę w World of Tanks! "Znajdę Ci zaraz zajęcie, wesołku..."');
      this.spawnDroppedPerk(px + 2.8, 0.5, pz, 'espresso_boost');
      this.addHandlowiecEnemy(`event_marcin_wot_${Date.now()}`, px + 11, Math.max(-12, pz - 4), Math.min(12, pz + 4), 'Zirytowany Kierownik Marcin');
    }
  }

  private updateTimedEvents(dt: number) {
    this.timedEventCooldown -= dt;
    if (this.timedEventCooldown <= 0) {
      this.triggerTimedWarehouseEvent();
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      // Boomerang return logic (Piotr's Pipe Wrench)
      if (p.boomerang && !p.returning && p.maxLife && p.life < p.maxLife * 0.52) {
        p.returning = true;
        p.hitIds?.clear(); // Can hit enemies again on return!
      }
      if (p.boomerang && p.returning) {
        const toPlayer = new THREE.Vector3(
          this.playerPos.x - p.mesh.position.x,
          this.playerPos.y + 0.75 - p.mesh.position.y,
          this.playerPos.z - p.mesh.position.z
        );
        const distBack = toPlayer.length();
        if (distBack < 0.75) {
          this.levelRoot.remove(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
        toPlayer.normalize().multiplyScalar(17.5);
        p.vel.lerp(toPlayer, dt * 9.0);
      }

      // Homing logic (Mateusz's DualSense RGB discs)
      if (p.homing) {
        let nearest: EnemyItem | null = null;
        let minDist = 11.0;
        for (const e of this.enemies) {
          if (e.state === 'defeated') continue;
          const d = Math.hypot(e.x - p.mesh.position.x, e.z - p.mesh.position.z);
          if (d < minDist) {
            minDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          const desired = new THREE.Vector3(nearest.x - p.mesh.position.x, 0, nearest.z - p.mesh.position.z)
            .normalize()
            .multiplyScalar(p.vel.length());
          p.vel.lerp(desired, dt * 8.5);
        }
      }

      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spinSpeed) {
        p.mesh.rotation.y += p.spinSpeed * dt;
      }

      // Ricochet off Z corridor walls (Dawid's 45-degree diamond blade & tiles)
      if (p.ricochet && Math.abs(p.mesh.position.z) > 17.5) {
        p.vel.z *= -1;
        p.mesh.position.z = Math.sign(p.mesh.position.z) * 17.4;
        this.spawnParticleRing(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0xd97706);
      }

      // Dawid passive: projectiles collect grouts & items along their path!
      if (p.collectItems) {
        for (const c of this.collectibles) {
          if (c.collected || !c.mesh) continue;
          if (Math.hypot(c.x - p.mesh.position.x, c.z - p.mesh.position.z) < 1.35) {
            c.x = this.playerPos.x;
            c.y = this.playerPos.y + 0.5;
            c.z = this.playerPos.z;
            c.mesh.position.set(c.x, c.y, c.z);
          }
        }
      }

      let destroyProj = false;
      const berserkMult = (this.activePerks.kfcBerserk || 0) > 0 ? 2 : 1;
      const baseDmg = (p.damage ?? (this.charDef.id === 'dawid' ? 2 : 1)) *
        berserkMult * (this.gameMode === 'survival' ? this.survivalDamageMultiplier : 1);

      for (const e of this.enemies) {
        if (e.state === 'defeated') continue;
        if (p.hitIds && p.hitIds.has(e.id)) continue;

        const dist = Math.hypot(p.mesh.position.x - e.x, p.mesh.position.z - e.z);
        if (dist < 1.35 && Math.abs(p.mesh.position.y - e.y) < 1.35) {
          p.hitIds?.add(e.id);

          // Check if guard has active shield
          if (e.shieldActive && this.charDef.id !== 'grzesiek' && (this.activePerks.kfcBerserk || 0) <= 0) {
            sound.playShieldBreak();
            this.triggerBloomPulse(0.08);
            this.emitFloatingToast('🛡️ BLOK TARCZY!', e.x, e.y + 1, e.z, 'damage');
            e.shieldActive = false;
          } else {
            if (e.shieldActive) e.shieldActive = false;
            e.hp -= baseDmg;
            sound.playSmack();
            this.triggerBloomPulse(0.1);
            this.cameraShake = 0.25;
            this.spawnParticleRing(e.x, e.y + 0.8, e.z, this.charDef.color);
            this.emitFloatingToast(`-${baseDmg} HP`, e.x, e.y + 0.8, e.z, 'damage');

            if (p.slowOnHit) {
              e.speed = Math.max(1.0, e.speed * 0.72);
              this.emitFloatingToast('👾 GLITCH -30% SPD', e.x, e.y + 1.25, e.z, 'perk');
            }
            if (p.igniteOnHit) {
              e.onFireTimer = 2.5;
              this.spawnParticleRing(e.x, e.y + 0.5, e.z, 0xff5500);
            }

            // AoE shockwave on hit (Marcin's WZ Binder Stamp)
            if (p.aoeRadius && p.aoeRadius > 0) {
              this.spawnParticleRing(e.x, e.y + 0.4, e.z, 0xf59e0b);
              for (const other of this.enemies) {
                if (other.id !== e.id && other.state !== 'defeated') {
                  if (Math.hypot(other.x - e.x, other.z - e.z) <= p.aoeRadius) {
                    other.hp -= 1;
                    other.stunTimer = Math.max(other.stunTimer, p.stunDuration || 1.2);
                    other.state = 'stunned';
                    this.emitFloatingToast('📑 AUDYT AoE -1 HP!', other.x, other.y + 1.1, other.z, 'damage');
                    if (other.hp <= 0) {
                      this.defeatEnemy(other, 240, true);
                    }
                  }
                }
              }
            }

            if (e.hp <= 0) {
              this.defeatEnemy(e, 250, true);
            } else {
              e.stunTimer = Math.max(e.stunTimer, p.stunDuration || 0.65);
              e.state = 'stunned';
            }
          }

          if (p.boomerang) {
            // Boomerang keeps flying and turns back after hitting
            if (!p.returning) p.returning = true;
          } else if (p.pierce && p.pierce > 0) {
            p.pierce--;
          } else {
            destroyProj = true;
            break;
          }
        }
      }

      if (destroyProj || p.life <= 0) {
        this.levelRoot.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.life -= dt;
      ep.mesh.position.addScaledVector(ep.vel, dt);

      const dist = Math.hypot(ep.mesh.position.x - this.playerPos.x, ep.mesh.position.z - this.playerPos.z);
      if (dist < 0.85 && Math.abs(ep.mesh.position.y - this.playerPos.y) < 1.0) {
        if (ep.isDyscyplinarka) {
          if (this.activePerks.shield) {
            this.activePerks.shield = false;
            this.invulnerableTimer = 1.2;
            sound.playShieldBreak();
            this.sayQuote('Kask BHP zamortyzował DYSCYPLINARKĘ Króla-Leto!');
            this.emitFloatingToast('🛡️ BLOK DYSCYPLINARKI!', this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 'perk');
          } else {
            this.takeDamage('🚨 ZWOLNIENIE DYSCYPLINARNE NA HITA OD KRÓLA-LETO!', 99);
          }
        } else {
          this.takeDamage('Trafiło Cię wezwanie wyjaśniające od Walczaka!');
        }
        this.levelRoot.remove(ep.mesh);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (ep.life <= 0) {
        this.levelRoot.remove(ep.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private updateSpecialEffects(dt: number) {
    for (let i = this.specialEffects.length - 1; i >= 0; i--) {
      const effect = this.specialEffects[i];
      effect.life -= dt;
      const t = 1 - effect.life / effect.maxLife;

      if (effect.update) {
        effect.update(dt, t);
      } else {
        effect.mesh.scale.setScalar(1 + t * effect.grow);
        effect.mesh.rotation.z += dt * effect.spin;
        const mat = (effect.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | undefined;
        if (mat && 'opacity' in mat) {
          mat.opacity = Math.max(0, (effect.life / effect.maxLife) * 0.9);
        }
      }

      if (effect.life <= 0) {
        this.levelRoot.remove(effect.mesh);
        this.specialEffects.splice(i, 1);
      }
    }
  }

  private spawnGrzesiekShockwave() {
    // 1. Ground Shockwaves
    const geo = new THREE.TorusGeometry(0.9, 0.12, 14, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(this.playerPos.x, this.playerPos.y + 0.12, this.playerPos.z);
    mesh.scale.setScalar(0.2);
    this.levelRoot.add(mesh);
    this.specialEffects.push({ mesh, life: 0.7, maxLife: 0.7, grow: 7.5, spin: 9.0 });

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.08, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.set(this.playerPos.x, this.playerPos.y + 0.12, this.playerPos.z);
    ring2.scale.setScalar(0.18);
    this.levelRoot.add(ring2);
    this.specialEffects.push({ mesh: ring2, life: 0.6, maxLife: 0.6, grow: 8.5, spin: -7.0 });

    // 2. GIANT ROTATING & SQUEEZING MECHANICAL CRUSHER ARM (ŚCIŚK ZAGŁADY)
    const armGroup = new THREE.Group();
    armGroup.position.set(this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.3, emissive: 0x15803d, emissiveIntensity: 0.5 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.2, emissive: 0xeab308, emissiveIntensity: 0.4 });

    // Base Turret
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 16), steelMat);
    armGroup.add(baseMesh);

    // Boom arm
    const boomGroup = new THREE.Group();
    boomGroup.position.set(0, 0.15, 0);

    const boomMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), greenMat);
    boomMesh.position.set(0, 0.6, 0.2);
    boomMesh.rotation.x = 0.4;
    boomGroup.add(boomMesh);

    // Hydraulic cylinder
    const cylMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12), chromeMat);
    cylMesh.position.set(0, 0.5, 0.05);
    cylMesh.rotation.x = 0.4;
    boomGroup.add(cylMesh);

    // Forearm
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, 1.1, 0.5);

    const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), steelMat);
    forearmMesh.position.set(0, 0.4, 0.2);
    forearmMesh.rotation.x = -0.5;
    forearmGroup.add(forearmMesh);

    // Squeezing Pincer Jaws
    const clawBaseGroup = new THREE.Group();
    clawBaseGroup.position.set(0, 0.8, 0.4);

    const clawHub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), greenMat);
    clawBaseGroup.add(clawHub);

    // Left Jaw
    const leftJaw = new THREE.Group();
    const leftJawBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.15), steelMat);
    leftJawBar.position.set(-0.25, 0.35, 0);
    leftJawBar.rotation.z = -0.2;
    leftJaw.add(leftJawBar);

    const leftTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.12), teethMat);
    leftTeeth.position.set(-0.15, 0.6, 0.08);
    leftJaw.add(leftTeeth);
    clawBaseGroup.add(leftJaw);

    // Right Jaw
    const rightJaw = new THREE.Group();
    const rightJawBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.15), steelMat);
    rightJawBar.position.set(0.25, 0.35, 0);
    rightJawBar.rotation.z = 0.2;
    rightJaw.add(rightJawBar);

    const rightTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.12), teethMat);
    rightTeeth.position.set(0.15, 0.6, 0.08);
    rightJaw.add(rightTeeth);
    clawBaseGroup.add(rightJaw);

    forearmGroup.add(clawBaseGroup);
    boomGroup.add(forearmGroup);
    armGroup.add(boomGroup);

    armGroup.scale.setScalar(1.6);
    this.levelRoot.add(armGroup);

    let sparkTimer = 0;

    this.specialEffects.push({
      mesh: armGroup,
      life: 0.9,
      maxLife: 0.9,
      grow: 0,
      spin: 0,
      update: (dt: number, progress: number) => {
        // High-speed rotation around Y-axis
        armGroup.rotation.y += dt * 18.0;

        // Dynamic heavy slam arc
        armGroup.rotation.x = Math.sin(progress * Math.PI) * 0.5;

        // SQUEEZING / PINCHING CLAW ACTION (Obracające się i ściskające ramię):
        const closeAmount = Math.max(0, Math.sin(progress * Math.PI)); 
        leftJaw.rotation.z = closeAmount * 0.85;
        rightJaw.rotation.z = -closeAmount * 0.85;

        // Glowing teeth intensity
        teethMat.emissiveIntensity = 0.4 + closeAmount * 1.8;

        // Energy sparks burst during peak crush
        if (progress > 0.2 && progress < 0.8) {
          sparkTimer += dt;
          if (sparkTimer > 0.04) {
            sparkTimer = 0;
            this.spawnParticleRing(
              armGroup.position.x + (Math.random() - 0.5) * 0.8,
              armGroup.position.y + 1.2,
              armGroup.position.z + (Math.random() - 0.5) * 0.8,
              0x4ade80
            );
          }
        }

        // Smooth scale fade out near end
        if (progress > 0.7) {
          const fade = (1 - progress) / 0.3;
          armGroup.scale.setScalar(1.6 * fade);
        }
      },
    });
  }

  private updateParticles(dt: number) {
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const maxBudget = isMobile ? 36 : 75;
    if (this.particles.length > maxBudget) {
      const excess = this.particles.splice(0, this.particles.length - maxBudget);
      excess.forEach((p) => this.levelRoot.remove(p.mesh));
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      const scale = Math.max(0.001, pt.life / pt.maxLife);
      pt.mesh.scale.setScalar(scale);

      if (pt.life <= 0) {
        this.levelRoot.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  public triggerJump() {
    if (this.state !== 'playing') return;
    this.jumpBufferTimer = 0.22;
  }

  public triggerAttack() {
    if (this.state !== 'playing' || this.attackCooldownTimer > 0) return;

    const charId = this.currentCharacterId;
    this.attackComboStep = (this.attackComboStep + 1) % 3;
    const isThirdCombo = this.attackComboStep === 0;

    // Operator-specific attack cadence
    const baseAttackCooldown =
      charId === 'mateusz' ? 0.24 : charId === 'grzesiek' ? 0.42 : charId === 'dawid' ? 0.36 : 0.32;
    this.attackCooldownTimer = baseAttackCooldown *
      (this.gameMode === 'survival' ? this.survivalAttackRateMultiplier : 1);
    this.attackSwingTimer = 0.26;

    sound.playAttackWhoosh();
    const forward = new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
    const startOrigin = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.82, this.playerPos.z).addScaledVector(forward, 0.65);

    if (charId === 'marcin') {
      // MARCIN: Throws a 3D Navy & Gold WZ Binder that creates a magnetic audit shockwave on hit; every 3rd throw is a Critical Golden Stamp!
      const binderGroup = new THREE.Group();
      const coverMat = new THREE.MeshStandardMaterial({
        color: isThirdCombo ? 0xf59e0b : 0x1e3a8a,
        roughness: 0.25,
        metalness: isThirdCombo ? 0.75 : 0.3,
        emissive: isThirdCombo ? 0xd97706 : 0x1e40af,
        emissiveIntensity: isThirdCombo ? 0.6 : 0.25,
      });
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.46), coverMat);
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.07, 0.42),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
      );
      pages.position.x = 0.02;
      const goldSpine = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.11, 0.47),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
      );
      goldSpine.position.x = -0.16;
      binderGroup.add(cover, pages, goldSpine);
      if (isThirdCombo) binderGroup.scale.setScalar(1.35);
      binderGroup.position.copy(startOrigin);
      this.levelRoot.add(binderGroup);

      // Pull nearby grouts slightly toward Marcin on every binder throw
      for (const c of this.collectibles) {
        if (!c.collected && c.mesh && Math.hypot(c.x - this.playerPos.x, c.z - this.playerPos.z) < 6.5) {
          c.x = THREE.MathUtils.lerp(c.x, this.playerPos.x, 0.28);
          c.z = THREE.MathUtils.lerp(c.z, this.playerPos.z, 0.28);
          c.mesh.position.set(c.x, c.y, c.z);
        }
      }

      this.projectiles.push({
        mesh: binderGroup,
        vel: forward.clone().multiplyScalar(15.5),
        life: 0.95,
        damage: isThirdCombo ? 2 : 1,
        aoeRadius: isThirdCombo ? 2.8 : 1.8,
        stunDuration: isThirdCombo ? 1.6 : 0.9,
        spinSpeed: 14.0,
        hitIds: new Set(),
      });
      if (isThirdCombo) {
        this.emitFloatingToast('📑 KRYTYCZNY AUDYT WZ!', this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z, 'perk');
      }
    } else if (charId === 'grzesiek') {
      // GRZESIEK: Wide 140-degree Melee Cleave with a 200cm Aluminum Screed Level (Łata Brukarska) + Heavy 44cm Shockwave Crescent!
      const screedGroup = new THREE.Group();
      const barMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.88,
        roughness: 0.18,
        emissive: 0x22c55e,
        emissiveIntensity: 0.35,
      });
      const screedBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 0.22), barMat);
      const vial = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.14, 0.24),
        new THREE.MeshBasicMaterial({ color: 0x4ade80 })
      );
      const waveArc = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.08, 10, 24, Math.PI * 0.85),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85 })
      );
      waveArc.rotation.x = Math.PI / 2;
      screedGroup.add(screedBar, vial, waveArc);
      screedGroup.position.copy(startOrigin);
      screedGroup.rotation.y = this.playerRot;
      this.levelRoot.add(screedGroup);

      // Immediate close-range 140-degree cleave knockback & shield-break
      const berserkMult = (this.activePerks.kfcBerserk || 0) > 0 ? 2 : 1;
      for (const e of this.enemies) {
        if (e.state === 'defeated') continue;
        const dx = e.x - this.playerPos.x;
        const dz = e.z - this.playerPos.z;
        const dist = Math.hypot(dx, dz);
        const dot = (dx * forward.x + dz * forward.z) / Math.max(0.1, dist);
        if (dist < 3.4 && dot > -0.15) {
          if (e.shieldActive) {
            e.shieldActive = false;
            sound.playShieldBreak();
            this.emitFloatingToast('💥 TARCZA ROZBITA 44CM!', e.x, e.y + 1.3, e.z, 'combo');
          }
          e.hp -= 2 * berserkMult;
          e.stunTimer = 1.2;
          e.state = 'stunned';
          // Double knockback passive
          e.x += (dx / Math.max(0.1, dist)) * 2.4;
          e.z = THREE.MathUtils.clamp(e.z + (dz / Math.max(0.1, dist)) * 2.4, -17, 17);
          this.emitFloatingToast(`🔨 ŁATA 200CM! -${2 * berserkMult} HP`, e.x, e.y + 1.0, e.z, 'damage');
          if (e.hp <= 0) this.defeatEnemy(e, 270, true);
        }
      }

      this.projectiles.push({
        mesh: screedGroup,
        vel: forward.clone().multiplyScalar(13.0),
        life: 0.55,
        damage: 2,
        pierce: 3,
        spinSpeed: 18.0,
        hitIds: new Set(),
      });
    } else if (charId === 'dawid') {
      // DAWID: High-Velocity Spinning 45° Diamond Saw Blade + Beveled Calacatta Slab that pierces, ricochets, and collects items!
      const bladeGroup = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.05, 24),
        new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          metalness: 0.92,
          roughness: 0.14,
          emissive: 0xd97706,
          emissiveIntensity: 0.35,
        })
      );
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.46, 0.035, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2, emissive: 0xf59e0b, emissiveIntensity: 0.5 })
      );
      rim.rotation.x = Math.PI / 2;
      const tileCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.08, 0.48),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18, metalness: 0.2 })
      );
      tileCore.rotation.y = Math.PI / 4;
      bladeGroup.add(disc, rim, tileCore);
      bladeGroup.position.copy(startOrigin);
      this.levelRoot.add(bladeGroup);

      // Slight angle spread on 3rd combo shot (fires 2 blades at ±12°)
      const angles = isThirdCombo ? [-0.18, 0.18] : [0];
      angles.forEach((angOffset, idx) => {
        const meshInstance = idx === 0 ? bladeGroup : bladeGroup.clone();
        if (idx > 0) this.levelRoot.add(meshInstance);
        const dir = new THREE.Vector3(Math.sin(this.playerRot + angOffset), 0, Math.cos(this.playerRot + angOffset));
        this.projectiles.push({
          mesh: meshInstance,
          vel: dir.multiplyScalar(19.0),
          life: 1.25,
          damage: 2,
          pierce: 3,
          ricochet: true,
          collectItems: true,
          spinSpeed: 28.0,
          hitIds: new Set(),
        });
      });
    } else if (charId === 'mateusz') {
      // MATEUSZ: Triple Burst of Homing PlayStation DualSense RGB Discs (□, △, ○) that Glitch-Slow enemies!
      const spreadAngles = [-0.22, 0, 0.22];
      const colors = [0xec4899, 0x38bdf8, 0xa855f7];
      spreadAngles.forEach((ang, idx) => {
        const orbGroup = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.2, 0.055, 10, 20),
          new THREE.MeshBasicMaterial({ color: colors[idx] })
        );
        ring.rotation.x = Math.PI / 2;
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14, 0),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        orbGroup.add(ring, core);
        orbGroup.position.copy(startOrigin);
        this.levelRoot.add(orbGroup);

        const dir = new THREE.Vector3(Math.sin(this.playerRot + ang), 0, Math.cos(this.playerRot + ang));
        this.projectiles.push({
          mesh: orbGroup,
          vel: dir.multiplyScalar(16.5),
          life: 0.95,
          damage: 1,
          homing: true,
          slowOnHit: true,
          spinSpeed: 20.0,
          hitIds: new Set(),
        });
      });
    } else if (charId === 'piotr') {
      // PIOTR: Throws a Heavy Crimson Pipe Wrench (Bumerangowy Klucz Francuski) that returns to Piotr, hitting twice & igniting with 70% Bimber sparks!
      const wrenchGroup = new THREE.Group();
      const redSteel = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        metalness: 0.75,
        roughness: 0.25,
        emissive: 0xdc2626,
        emissiveIntensity: 0.35,
      });
      const chromeJaw = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 });
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.72), redSteel);
      const jawTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.16), chromeJaw);
      jawTop.position.set(0.08, 0, 0.32);
      const jawBot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.12), chromeJaw);
      jawBot.position.set(0.06, 0, 0.14);
      wrenchGroup.add(handle, jawTop, jawBot);
      wrenchGroup.position.copy(startOrigin);
      this.levelRoot.add(wrenchGroup);

      this.projectiles.push({
        mesh: wrenchGroup,
        vel: forward.clone().multiplyScalar(16.5),
        life: 1.35,
        maxLife: 1.35,
        damage: 1,
        pierce: 4,
        boomerang: true,
        returning: false,
        igniteOnHit: true,
        spinSpeed: 24.0,
        hitIds: new Set(),
      });
    }

    // Agile enemies attempt dodge reactions
    this.enemies.forEach((e) => {
      if (e.state === 'defeated' || e.state === 'stunned') return;
      const dist = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
      if (dist < 4.0 && (e.type === 'piorun_dron' || e.type === 'kurier' || e.type === 'monter' || e.type === 'elite_walczak_guard')) {
        if (Math.random() < 0.35) {
          const dodgeOffset = Math.random() > 0.5 ? 1.4 : -1.4;
          e.z = THREE.MathUtils.clamp(e.z + dodgeOffset, e.startX, e.endX);
          this.emitFloatingToast('💨 UNIK!', e.x, e.y + 1.0, e.z, 'damage');
        }
      }
    });
  }

  public triggerAbility() {
    if (this.state !== 'playing' || this.abilityTimer > 0) return;
    this.abilityTimer = this.charDef.abilityCooldown;
    const abilityDamageMultiplier = this.gameMode === 'survival' ? this.survivalDamageMultiplier : 1;

    sound.playAbility(this.currentCharacterId);
    this.cameraShake = 0.45;
    this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, this.charDef.color);

    if (this.currentCharacterId === 'marcin') {
      this.marcinReclamationTimer = 8;
      this.invulnerableTimer = Math.max(this.invulnerableTimer, 8);
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.callbacks.onHpUpdate(this.hp, this.maxHp);
      this.activatePerk('order_magnet', 10);
      this.sayQuote('PIECZĘĆ WZ WBITA! 8 sekund nietykalności, +1 Kawa i Audyt Reklamacyjny na 9 metrów!');
      sound.playReclamation();
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0xfacc15);
      const radius = 9.0;
      this.enemies.forEach((e) => {
        if (e.state === 'defeated') return;
        const dist = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
        if (dist < radius) {
          e.stunTimer = 5.0;
          e.state = 'stunned';
          const damage = Math.ceil(2 * abilityDamageMultiplier);
          e.hp = Math.max(0, e.hp - damage);
          this.emitFloatingToast('-' + damage + ' HP Pieczęć WZ!', e.x, e.y + 0.8, e.z, 'damage');
          if (e.hp <= 0) {
            this.defeatEnemy(e, 240, false);
          }
        }
      });
    } else if (this.currentCharacterId === 'grzesiek') {
      this.grzesiekCrushTimer = 0.9;
      this.grzesiekCrushPulse = 1.0;
      this.activatePerk('golden_paleciak', 6);
      this.spawnGrzesiekShockwave();
      const forward = new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
      this.playerPos.x += forward.x * 1.8;
      this.playerPos.z += forward.z * 1.8;
      this.sayQuote('ŚCIŚK ZAGŁADY 44CM + TRYB TARANA! Z drogi śledzie, Grzesiek jedzie!');
      sound.playSciskCrush();
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0x4ade80);
      this.enemies.forEach((e) => {
        if (e.state === 'defeated') return;
        const dx = e.x - this.playerPos.x;
        const dz = e.z - this.playerPos.z;
        const dist = Math.hypot(dx, dz);
        const dirDot = (dx * forward.x + dz * forward.z) / Math.max(1, dist);
        if (dist < 5.6 && dirDot > -0.35) {
          e.shieldActive = false;
          const damage = Math.ceil(3 * abilityDamageMultiplier);
          e.hp -= damage;
          e.stunTimer = 2.0;
          e.state = 'stunned';
          this.cameraShake = 0.65;
          this.spawnParticleRing(e.x, e.y + 0.6, e.z, 0x86efac);
          this.emitFloatingToast('-' + Math.ceil(3 * abilityDamageMultiplier) + ' HP ŚCISK 44CM!', e.x, e.y + 0.8, e.z, 'damage');
          if (e.hp <= 0) {
            this.defeatEnemy(e, 300, false);
          }
        }
      });
    } else if (this.currentCharacterId === 'dawid') {
      this.activatePerk('hardhat', 15);
      // Dawid also drops a fresh KFC bucket right in front of him!
      const fwd = new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
      this.addKfcBucketItem(
        `dawid_kfc_${Date.now()}`,
        this.playerPos.x + fwd.x * 2.2,
        0.45,
        THREE.MathUtils.clamp(this.playerPos.z + fwd.z * 2.2, -15, 15)
      );
      this.sayQuote('JA WIEM LEPIEJ! Salwa 5 płyt Calacatta 120x280 pod kątem 45° + świeży Kubełek KFC!');
      sound.playAttackWhoosh();
      const angles = [-0.5, -0.25, 0, 0.25, 0.5];
      angles.forEach((offsetAngle) => {
        const rot = this.playerRot + offsetAngle;
        const forward = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
        const tileGeo = new THREE.BoxGeometry(0.85, 0.12, 0.55);
        const tileMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          emissive: 0xd97706,
          emissiveIntensity: 0.65,
          metalness: 0.8,
          roughness: 0.2,
        });
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.position.set(this.playerPos.x, this.playerPos.y + 0.65, this.playerPos.z).addScaledVector(forward, 0.65);
        this.levelRoot.add(tile);
        this.projectiles.push({
          mesh: tile,
          vel: forward.multiplyScalar(17.5),
          life: 1.45,
          damage: 2,
          pierce: 4,
          ricochet: true,
          collectItems: true,
          spinSpeed: 12.0,
          hitIds: new Set(),
        });
      });
      this.emitFloatingToast('🧱 SALWA GRESU 120x280 + 🍗 KFC!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'perk');
    } else if (this.currentCharacterId === 'mateusz') {
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.callbacks.onHpUpdate(this.hp, this.maxHp);
      this.activatePerk('espresso_boost', 6);
      this.activatePerk('vibram_boots', 8);
      this.sayQuote('BSOD OVERCLOCK! Zamrażam wrogów w promieniu 11m + Speedrun i 2x Skok!');
      sound.playAbility('mateusz');
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.8, this.playerPos.z, 0x3b82f6);
      this.emitFloatingToast('🎮 KOPUŁA BSOD & OVERCLOCK!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'perk');

      this.enemies.forEach((e) => {
        if (e.state === 'defeated') return;
        const dist = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
        if (dist < 11.0) {
          e.stunTimer = 5.5;
          e.state = 'stunned';
          const damage = Math.ceil(1 * abilityDamageMultiplier);
          e.hp = Math.max(0, e.hp - damage);
          this.emitFloatingToast('💻 BSOD LAG -' + damage + ' HP!', e.x, e.y + 0.8, e.z, 'damage');
          if (e.hp <= 0) this.defeatEnemy(e, 240, false);
        }
      });
    } else if (this.currentCharacterId === 'piotr') {
      this.sayQuote('POTRÓJNA FLASZKA ZE SKARBCZYKA! 3x 70% bimbru zza regału B4 – ściana ognia na gresie!');
      this.throwBimberMolotov(0);
      this.throwBimberMolotov(-0.28);
      this.throwBimberMolotov(0.28);
    }
  }

  private throwBimberMolotov(angleOffset = 0) {
    sound.playMolotovThrow();
    this.attackSwingTimer = 0.35;
    if (this.rightArm) {
      this.rightArm.rotation.x = -2.2;
    }

    const rot = this.playerRot + angleOffset;
    const forward = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    const molotovData = createBimberBottleMolotov();
    const startPos = new THREE.Vector3(
      this.playerPos.x + forward.x * 0.7,
      this.playerPos.y + 1.1,
      this.playerPos.z + forward.z * 0.7
    );
    molotovData.group.position.copy(startPos);
    this.levelRoot.add(molotovData.group);

    // Initial forward velocity + high arc
    const throwVel = forward.clone().multiplyScalar(13.5);
    throwVel.y = 5.8;

    this.bimberMolotovs.push({
      mesh: molotovData.group,
      pos: startPos,
      vel: throwVel,
      spin: new THREE.Vector3(
        8.0 + Math.random() * 4.0,
        3.0 + Math.random() * 2.0,
        2.0 + Math.random() * 2.0
      ),
      life: 2.8,
      flameLight: molotovData.flameLight,
      flameMesh: molotovData.flameMesh,
    });

    this.emitFloatingToast('🍾 KOKTAJL MOŁOTOWA Z BIMBREM!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'combo');
  }

  private updateBimberMolotovs(dt: number) {
    for (let i = this.bimberMolotovs.length - 1; i >= 0; i--) {
      const b = this.bimberMolotovs[i];
      b.life -= dt;

      // Gravity pulls it down
      b.vel.y -= 17.0 * dt;
      b.pos.addScaledVector(b.vel, dt);

      // Tumbling spin in flight
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
      b.mesh.position.copy(b.pos);

      // Flickering flame wick
      if (b.flameMesh) {
        const pulse = 1.0 + Math.sin(performance.now() * 0.02) * 0.3;
        b.flameMesh.scale.set(pulse, pulse * 1.2, pulse);
      }
      if (b.flameLight) {
        b.flameLight.intensity = 2.0 + Math.sin(performance.now() * 0.03) * 0.8;
      }

      // Trail of glowing sparks/smoke
      if (Math.random() < 0.5) {
        this.spawnParticleRing(b.pos.x, b.pos.y, b.pos.z, 0xff7700);
      }

      // Check collision with enemies
      let hitEnemy = false;
      this.enemies.forEach((e) => {
        if (e.state === 'defeated') return;
        const dist = Math.hypot(b.pos.x - e.x, b.pos.z - e.z);
        if (dist < 1.15 && Math.abs(b.pos.y - e.y) < 1.2) {
          hitEnemy = true;
        }
      });

      // Find platform ground height beneath the bottle
      let floorY = 0;
      for (const p of this.platforms) {
        const halfW = p.width / 2;
        const halfD = p.depth / 2;
        if (
          b.pos.x >= p.x - halfW &&
          b.pos.x <= p.x + halfW &&
          b.pos.z >= p.z - halfD &&
          b.pos.z <= p.z + halfD
        ) {
          const top = p.y + p.height / 2;
          if (top > floorY && b.pos.y >= top - 0.4) {
            floorY = top;
          }
        }
      }

      const hitGround = b.pos.y <= floorY + 0.15 && b.vel.y <= 0;

      if (hitEnemy || hitGround || b.life <= 0) {
        // DETONATION!
        this.detonateBimberMolotov(b.pos.x, Math.max(floorY, 0), b.pos.z);
        this.levelRoot.remove(b.mesh);
        this.bimberMolotovs.splice(i, 1);
      }
    }
  }

  private detonateBimberMolotov(x: number, y: number, z: number) {
    sound.playGlassShatter();
    sound.playFireCrackle();
    this.triggerScreenShake(0.55, 0.45);

    // 1. Shards of broken glass flying in all directions
    for (let s = 0; s < 12; s++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 5.0;
      const shardGeo = new THREE.BoxGeometry(0.08, 0.08, 0.03);
      const shardMat = new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.9 });
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.set(x, y + 0.3, z);
      this.levelRoot.add(shard);
      this.particles.push({
        mesh: shard,
        vel: new THREE.Vector3(Math.cos(angle) * speed, 2.5 + Math.random() * 3.5, Math.sin(angle) * speed),
        life: 0.6,
        maxLife: 0.6,
      });
    }

    // 2. Fireball impact flash
    const flashGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      transparent: true,
      opacity: 0.85,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(x, y + 0.6, z);
    this.levelRoot.add(flash);
    this.specialEffects.push({
      mesh: flash,
      life: 0.45,
      maxLife: 0.45,
      grow: 3.5,
      spin: 4.0,
    });

    // 3. Initial burst damage to anyone in the direct splash
    this.enemies.forEach((e) => {
      if (e.state === 'defeated') return;
      const dist = Math.hypot(e.x - x, e.z - z);
      if (dist < 3.2 && Math.abs(e.y - y) < 1.8) {
        e.hp -= 2;
        e.stunTimer = 1.5;
        e.state = 'stunned';
        e.onFireTimer = 3.5;
        this.emitFloatingToast('💥 -2 HP KOKTAJL!', e.x, e.y + 0.9, e.z, 'damage');
        if (e.hp <= 0) {
          this.defeatEnemy(e, 280, false);
        }
      }
    });

    this.emitFloatingToast('🔥 MORZE OGNIA 70%!', x, y + 1.3, z, 'combo');

    // 4. Create persistent burning fire puddle
    const puddle = createMolotovFirePuddle(3.8);
    puddle.group.position.set(x, y + 0.02, z);
    this.levelRoot.add(puddle.group);

    this.bimberFirePuddles.push({
      group: puddle.group,
      x,
      y,
      z,
      radius: 3.8,
      duration: 6.0,
      maxDuration: 6.0,
      tickTimer: 0.4,
      flames: puddle.flames,
      light: puddle.light,
    });
  }

  private updateBimberFirePuddles(dt: number) {
    for (let i = this.bimberFirePuddles.length - 1; i >= 0; i--) {
      const p = this.bimberFirePuddles[i];
      p.duration -= dt;

      // Animate flickering fire spires
      const time = performance.now() * 0.001;
      p.flames.forEach((flame) => {
        const u = flame.userData;
        const flicker = Math.sin(time * u.speed + u.phase);
        const scaleY = Math.max(0.3, 1.0 + flicker * 0.4);
        flame.scale.set(1.0 + flicker * 0.15, scaleY, 1.0 + flicker * 0.15);
      });

      // Flickering light
      p.light.intensity = 3.5 + Math.sin(time * 14) * 1.2;

      // Rising smoke and embers
      if (Math.random() < 0.45) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (p.radius * 0.7);
        const ex = p.x + Math.cos(angle) * r;
        const ez = p.z + Math.sin(angle) * r;
        const ember = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.08),
          new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })
        );
        ember.position.set(ex, p.y + 0.3, ez);
        this.levelRoot.add(ember);
        this.particles.push({
          mesh: ember,
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.8 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8),
          life: 0.5,
          maxLife: 0.5,
        });
      }

      // Damage ticks over time
      p.tickTimer -= dt;
      if (p.tickTimer <= 0) {
        p.tickTimer = 0.5; // Damage every 0.5s

        this.enemies.forEach((e) => {
          if (e.state === 'defeated') return;
          const dist = Math.hypot(e.x - p.x, e.z - p.z);
          if (dist < p.radius && Math.abs(e.y - p.y) < 1.5) {
            e.hp -= 1;
            e.onFireTimer = 2.0;
            e.speed = Math.max(1.0, e.speed * 0.85); // Slowed by burning bimber
            sound.playHit();
            this.emitFloatingToast('🔥 -1 HP OGIEŃ!', e.x, e.y + 0.8, e.z, 'damage');
            this.spawnParticleRing(e.x, e.y + 0.5, e.z, 0xff5500);

            if (e.hp <= 0) {
              this.defeatEnemy(e, 260, false);
            }
          }
        });
      }

      // Fade out near expiration
      if (p.duration <= 0.8) {
        const fade = p.duration / 0.8;
        p.group.scale.set(fade, fade, fade);
        p.light.intensity *= fade;
      }

      if (p.duration <= 0) {
        // Puddle extinguishes with a puff of smoke
        for (let k = 0; k < 6; k++) {
          this.spawnDust(p.x + (Math.random() - 0.5) * 2, p.y + 0.2, p.z + (Math.random() - 0.5) * 2, 0x64748b);
        }
        this.levelRoot.remove(p.group);
        this.bimberFirePuddles.splice(i, 1);
      }
    }
  }

  private defeatEnemy(e: EnemyItem, points: number, showToast: boolean = true) {
    if (e.state === 'defeated') return;
    e.state = 'defeated';
    e.mesh.visible = false;
    const hitStopDur = (e.type === 'walczak' || e.type === 'krol_leto') ? 0.22 : 0.05;
    this.triggerHitStop(hitStopDur);

    // Combo streak calculation
    this.comboStreak++;
    this.comboTimer = this.charDef.id === 'mateusz' ? 5.5 : 3.8;
    const comboMultiplier = 1 + (this.comboStreak - 1) * 0.25;
    const finalPoints = Math.round(points * comboMultiplier);
    this.score += finalPoints;
    this.handleMateuszPassive(2);
    if (this.gameMode === 'survival') {
      this.survivalKills++;
      this.spawnSurvivalXpGem(e.x, e.y, e.z, e.maxHp >= 4 ? 3 : 1);
    }

    if (showToast) {
      this.emitFloatingToast(`+${finalPoints} Pkt Neutralizacja!`, e.x, e.y + 1, e.z, 'points');
    }

    if (this.comboStreak >= 2) {
      const comboMsg =
        this.comboStreak >= 5
          ? `👑 LEGENDARNY KIEROWNIK x${this.comboStreak}!`
          : this.comboStreak >= 4
            ? `⚡⚡ SAKRAMENCKI FLOW x${this.comboStreak}!`
            : this.comboStreak >= 3
              ? `🔥🔥 WŚCIEKŁY MAGAZYNIER x${this.comboStreak}!`
              : `🔥 COMBO x${this.comboStreak}!`;
      this.emitFloatingToast(comboMsg, e.x, e.y + 1.6, e.z, 'combo');
    }

    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);

    // In-world Perk Drop (Perki dropione na mapie z wrogów!)
    const dropChance =
      this.charDef.id === 'piotr'
        ? 1.0
        : e.type === 'walczak' || e.maxHp >= 4
          ? 1.0
          : 0.48;

    if (Math.random() <= dropChance) {
      this.spawnDroppedPerk(e.x, e.y + 0.1, e.z);
    }

    if (e.type === 'walczak' || e.maxHp >= 4) {
      this.callbacks.onBossUpdate?.(e.name, 0, e.maxHp, false);
      this.sayQuote('BYŁY KIEROWNIK WALCZAK ZANEUTRALIZOWANY! Droga wolna!');

      // Intense long screen shake for boss defeat!
      this.triggerScreenShake(2.2, 1.25);

      this.spawnParticleRing(e.x, e.y + 1.0, e.z, 0xef4444);
      this.spawnParticleRing(e.x, e.y + 1.5, e.z, 0xf59e0b);
      this.spawnParticleRing(e.x, e.y + 2.0, e.z, 0x3b82f6);

      const geo = new THREE.TorusGeometry(1.2, 0.18, 16, 48);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(e.x, e.y + 0.5, e.z);
      this.levelRoot.add(mesh);
      this.specialEffects.push({ mesh, life: 1.2, maxLife: 1.2, grow: 12.0, spin: 15.0 });
    } else {
      // Mild screen shake for regular enemies
      this.triggerScreenShake(0.35, 0.25);
    }
  }

  private takeDamage(reason: string, amount: number = 1) {
    if (this.invulnerableTimer > 0) return;

    if (this.marcinReclamationTimer > 0) {
      this.triggerScreenShake(0.2, 0.2);
      return;
    }

    if (this.activePerks.shield) {
      this.activePerks.shield = false;
      this.invulnerableTimer = 1.2;
      sound.playShieldBreak();
      this.sayQuote('Kask BHP amortyzował uderzenie!');
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 0x3b82f6);
      this.callbacks.onPerksUpdate?.(this.activePerks);
      this.triggerScreenShake(0.4, 0.3);
      return;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableTimer = 1.8;
    sound.playHit();
    this.triggerBloomPulse(0.45);
    this.callbacks.onHpUpdate(this.hp, this.maxHp);

    // Screen Shake on damage received by player!
    this.triggerScreenShake(0.9, 0.5);

    if (this.hp <= 0) {
      this.state = 'gameover';
      this.playerVel.set(0, 0, 0);
      this.screenShakeTimer = 0;
      this.screenShakeIntensity = 0;
      this.cameraShake = 0;
      if (this.container) {
        this.container.style.transform = '';
      }
      sound.stopMusic();
      sound.playGameOver();
      const finalReason = this.gameMode === 'survival'
        ? reason + ' | Fala ' + this.survivalWave + ' • ' + this.survivalKills + ' eliminacji • ' + Math.floor(this.survivalElapsed) + ' s'
        : reason;
      this.callbacks.onGameOver(finalReason);
    }
  }

  private checkLevelFinish() {
    if (this.state !== 'playing') return;

    const requiredVip = Math.min(4, this.totalVipCount);
    if (this.collectedVipCount < requiredVip) {
      if (this.finishWarningTimer <= 0) {
        this.finishWarningTimer = 2.5;
        const remaining = requiredVip - this.collectedVipCount;
        this.sayQuote(`BHP Magazynu: Zbierz jeszcze min. ${remaining} zamówień VIP przed załadunkiem do vana!`);
        this.emitFloatingToast(`BRAKUJE ${remaining} VIP!`, this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'vip');
        sound.playHit();
      }
      return;
    }

    this.state = 'victory';
    sound.stopMusic();
    sound.playWin();
    const elapsed = Math.max(1, Math.round((performance.now() - this.levelStartTime) / 1000));
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
    this.callbacks.onLevelComplete(3, this.score, timeStr);
  }

  private spawnDust(x: number, y: number, z: number, color = 0xd1d5db) {
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.1, z);
    this.levelRoot.add(mesh);
    this.particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.8 + 0.2, (Math.random() - 0.5) * 1.5),
      life: 0.4,
      maxLife: 0.4,
    });
  }

  private spawnParticleRing(x: number, y: number, z: number, color = 0x38bdf8) {
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const num = isMobile ? 8 : 14;
    for (let i = 0; i < num; i++) {
      const angle = (i / num) * Math.PI * 2;
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.levelRoot.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * 4.2, Math.random() * 1.0, Math.sin(angle) * 4.2),
        life: 0.55,
        maxLife: 0.55,
      });
    }
  }

  private spawnExplosionParticles(x: number, y: number, z: number, color = 0xf3f4f6, count = 20) {
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const actualCount = isMobile ? Math.min(10, count) : count;
    for (let i = 0; i < actualCount; i++) {
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.levelRoot.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 5.0;
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 3.5 + 1.0, Math.sin(angle) * speed),
        life: 0.65,
        maxLife: 0.65,
      });
    }
  }

  private sayQuote(quote: string) {
    this.speechBubbleTimer = 3.5;
    this.callbacks.onSpeechBubble(quote);
  }

  private sayRandomVoiceLine() {
    if (this.charDef.voiceLines && this.charDef.voiceLines.length > 0) {
      const idx = Math.floor(Math.random() * this.charDef.voiceLines.length);
      this.sayQuote(this.charDef.voiceLines[idx]);
    }
  }

  private updateCamera(dt: number) {
    if (this.state === 'title') {
      const t = performance.now() * 0.0006;
      const radius = 4.5;
      const height = 1.8 + Math.sin(t * 0.8) * 0.35;
      const px = this.playerPos.x;
      const py = this.playerPos.y;
      const pz = this.playerPos.z;

      this.camera.position.x = px + Math.sin(t) * radius;
      this.camera.position.z = pz + Math.cos(t) * radius;
      this.camera.position.y = py + height;
      this.camera.lookAt(px, py + 1.0, pz);

      if (this.playerGroup) {
        this.playerGroup.rotation.y = Math.sin(t * 0.8) * 0.35;
      }
      return;
    }

    // Determine target positions with smooth velocity look-ahead
    const velLookAheadX = THREE.MathUtils.clamp(this.playerVel.x * 0.18, -2.5, 2.5);
    const velLookAheadZ = THREE.MathUtils.clamp(this.playerVel.z * 0.18, -2.5, 2.5);
    const targetX = this.playerPos.x + velLookAheadX;
    const targetZ = this.playerPos.z + velLookAheadZ;

    // Smooth vertical tracking: dampen camera Y so jumping doesn't violently bounce the screen
    const targetGroundY = this.isGrounded ? this.playerPos.y : this.smoothCamY;
    this.smoothCamY = THREE.MathUtils.damp(this.smoothCamY, targetGroundY, this.isGrounded ? 8.0 : 2.4, dt);
    const targetY = this.smoothCamY;

    // Check if an active boss is nearby to dynamically pull camera out slightly for tactical awareness
    const activeBoss = this.enemies.find((e) => (e.type === 'walczak' || e.type === 'krol_leto') && e.state !== 'defeated');
    let targetBossZoom = 1.0;
    if (activeBoss) {
      const bossDist = Math.hypot(activeBoss.x - this.playerPos.x, activeBoss.z - this.playerPos.z);
      if (bossDist < 20) {
        targetBossZoom = 1.18;
      }
    }
    this.bossCamZoom = THREE.MathUtils.damp(this.bossCamZoom, targetBossZoom, 2.5, dt);

    // Target offsets for camera modes:
    // 'tpp' (Default): Podwyższony widok taktyczny (~45° widok z góry i zza pleców w stylu Hades / Brawl Stars)
    // Zapewnia pełną widoczność flankujących wrogów, pułapek posadzkowych i alei magazynu bez zasłaniania przez regały!
    const zoomMultiplier = this.bossCamZoom * this.camZoomFactor;
    let baseOffsetX = -2.5;
    let baseOffsetY = 10.5;
    let baseOffsetZ = 8.8;

    if (this.cameraMode === 'close') {
      baseOffsetX = -4.2;
      baseOffsetY = 5.8;
      baseOffsetZ = 5.2;
    } else if (this.cameraMode === 'iso') {
      baseOffsetX = 0.0;
      baseOffsetY = 14.0;
      baseOffsetZ = 12.0;
    }

    const targetOffsetX = baseOffsetX * zoomMultiplier;
    const targetOffsetY = baseOffsetY * zoomMultiplier;
    const targetOffsetZ = baseOffsetZ * zoomMultiplier;

    // Smoothly interpolate camera offset between modes
    this.currentCamOffset.x = THREE.MathUtils.damp(this.currentCamOffset.x, targetOffsetX, 5.2, dt);
    this.currentCamOffset.y = THREE.MathUtils.damp(this.currentCamOffset.y, targetOffsetY, 5.2, dt);
    this.currentCamOffset.z = THREE.MathUtils.damp(this.currentCamOffset.z, targetOffsetZ, 5.2, dt);

    // Responsive FOV based on screen aspect ratio (mobile portrait vs landscape vs desktop)
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const aspect = (window.innerWidth || 1280) / Math.max(1, window.innerHeight || 720);
      const baseFov = aspect < 0.65 ? 60 : aspect < 1.0 ? 54 : aspect < 1.35 ? 48 : 45;
      if (Math.abs(this.camera.fov - baseFov) > 0.2) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, baseFov, 4.0, dt);
        this.camera.updateProjectionMatrix();
      }
    }

    const camTarget = new THREE.Vector3(
      targetX + this.currentCamOffset.x,
      targetY + this.currentCamOffset.y,
      targetZ + this.currentCamOffset.z
    );

    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    const isMobileDevice = window.innerWidth < 900 || ('ontouchstart' in window);

    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= dt;
      const progress = Math.max(0, this.screenShakeTimer / Math.max(0.001, this.screenShakeDuration));
      // Calibrated shake: reduced by 65% to prevent disorientation while keeping impact feel
      const currentIntensity = this.screenShakeIntensity * Math.pow(progress, 1.2) * 0.35;

      shakeX = (Math.random() - 0.5) * currentIntensity * 1.5;
      shakeY = (Math.random() - 0.5) * currentIntensity * 1.5;
      shakeZ = (Math.random() - 0.5) * currentIntensity * 1.5;

      // DOM container shake transform (disabled on mobile to avoid costly browser layout reflows)
      if (this.container && !isMobileDevice) {
        const domPxX = (Math.random() - 0.5) * currentIntensity * 10;
        const domPxY = (Math.random() - 0.5) * currentIntensity * 10;
        const domDeg = (Math.random() - 0.5) * currentIntensity * 1.2;
        this.container.style.transform = `translate3d(${domPxX.toFixed(1)}px, ${domPxY.toFixed(1)}px, 0px) rotate(${domDeg.toFixed(2)}deg)`;
      } else if (this.container && isMobileDevice && this.container.style.transform !== '') {
        this.container.style.transform = '';
      }

      if (this.screenShakeTimer <= 0) {
        this.screenShakeIntensity = 0;
        if (this.container) {
          this.container.style.transform = '';
        }
      }
    } else if (this.cameraShake > 0) {
      shakeX = (Math.random() - 0.5) * this.cameraShake * 0.4;
      shakeY = (Math.random() - 0.5) * this.cameraShake * 0.4;
      shakeZ = (Math.random() - 0.5) * this.cameraShake * 0.4;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
      if (this.container && this.container.style.transform !== '') {
        this.container.style.transform = '';
      }
    } else {
      if (this.container && this.container.style.transform !== '') {
        this.container.style.transform = '';
      }
    }

    camTarget.x += shakeX;
    camTarget.y += shakeY;
    camTarget.z += shakeZ;

    // Smooth camera position follow
    this.camera.position.lerp(camTarget, dt * 7.5);

    // Look ahead framing for tactical readability
    const lookAheadX = this.cameraMode === 'tpp' ? 1.8 : this.cameraMode === 'close' ? 2.4 : 0.5;
    const lookAheadY = this.cameraMode === 'tpp' ? 0.7 : this.cameraMode === 'close' ? 1.1 : 0.5;
    const lookAheadZ = this.cameraMode === 'tpp' ? 0.0 : this.cameraMode === 'close' ? -0.5 : 0.0;

    const desiredLookAt = new THREE.Vector3(
      this.playerPos.x + lookAheadX + velLookAheadX * 0.45 + shakeX * 0.3,
      this.smoothCamY + lookAheadY + shakeY * 0.3,
      this.playerPos.z + lookAheadZ + velLookAheadZ * 0.45 + shakeZ * 0.3
    );
    this.currentLookAt.lerp(desiredLookAt, dt * 8.5);
    this.camera.lookAt(this.currentLookAt);

    if (this.dirLight) {
      this.dirLight.position.set(this.playerPos.x + 14, 28, this.playerPos.z + 12);
      this.dirLight.target.position.copy(this.playerPos);
      this.dirLight.target.updateMatrixWorld();
    }

    // Dynamic Shader Uniform Updates for Depth of Field and Stencil Outline
    if (this.dofBlurMaterial) {
      this.dofBlurMaterial.uniforms.uTime.value = performance.now() * 0.001;
      this.dofBlurMaterial.uniforms.uScreenSize.value.set(window.innerWidth || 1280, window.innerHeight || 720);
    }
    if (this.outlineMaterial) {
      this.outlineMaterial.uniforms.uTime.value = performance.now() * 0.001;
      if ((this.activePerks.kfcBerserk || 0) > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xef4444);
      } else if ((this.activePerks.bulldozer || 0) > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xfacc15);
      } else if (this.activePerks.speedBoost > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xec4899);
      } else if (this.marcinWoTPenaltyTimer > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xf97316);
      } else {
        this.outlineMaterial.uniforms.uColor.value.setHex(0x38bdf8);
      }
    }
    if (this.rimLight) {
      this.rimLight.position.set(this.playerPos.x - 18, 12, this.playerPos.z - 18);
    }
  }

  public getPlayerPos(): THREE.Vector3 {
    return this.playerPos.clone();
  }

  public getScore(): number {
    return this.score;
  }

  public getCollectedVipCount(): number {
    return this.collectedVipCount;
  }

  public getElapsedSeconds(): number {
    return Math.max(1, Math.round((performance.now() - this.levelStartTime) / 1000));
  }

  public isBossDefeated(): boolean {
    return this.enemies.some((e) => e.type === 'walczak' && e.state === 'defeated');
  }

  public getActivePerks(): ActivePerks {
    return { ...this.activePerks };
  }

  public activatePerk(perkId: PerkType, duration: number = 20): boolean {
    if (perkId === 'hardhat') {
      this.activePerks.shield = true;
      sound.playPerkPickup();
      this.sayQuote('Założono atestowany kask BHP!');
    } else if (perkId === 'vibram_boots') {
      this.activePerks.doubleJump = Math.max(this.activePerks.doubleJump, duration);
      sound.playDoubleJump();
      this.sayQuote('Buty robocze Vibram: podwójny skok w powietrzu aktywny!');
    } else if (perkId === 'order_magnet') {
      this.activePerks.magnet = Math.max(this.activePerks.magnet, duration);
      sound.playMagnetHum();
      this.sayQuote('Skaner radiowy przyciąga zamówienia!');
    } else if (perkId === 'espresso_boost') {
      this.activePerks.speedBoost = Math.max(this.activePerks.speedBoost, duration);
      sound.playPerkPickup();
      this.sayQuote('Podwójne espresso: sprint po korytarzu!');
    } else if (perkId === 'kfc_bucket') {
      this.hp = Math.min(this.maxHp, this.hp + 2);
      this.callbacks.onHpUpdate(this.hp, this.maxHp);
      this.activePerks.kfcBerserk = Math.max(this.activePerks.kfcBerserk || 0, duration);
      sound.playPerkPickup();
      this.sayQuote('KUBEŁEK KFC OD DAWIDA! +2 Kawy, podwójne obrażenia i odporność na klej!');
    } else if (perkId === 'golden_paleciak') {
      this.activePerks.bulldozer = Math.max(this.activePerks.bulldozer || 0, duration);
      sound.playPerkPickup();
      this.sayQuote('ZŁOTY PALECIAK TURBO! Rozjeżdżam wrogów na pełnej prędkości!');
    } else if (perkId === 'stretch_armor') {
      this.activePerks.shield = true;
      this.invulnerableTimer = Math.max(this.invulnerableTimer, duration);
      sound.playPerkPickup();
      this.sayQuote('ZBROJA Z CZARNEJ FOLII STRETCH VIP! 10 sekund całkowitej nietykalności!');
    }

    this.callbacks.onPerksUpdate?.(this.activePerks);
    return true;
  }

  private handleMateuszPassive(amount: number) {
    if (this.currentCharacterId !== 'mateusz') return;
    this.mateuszPassiveCount += amount;
    if (this.mateuszPassiveCount >= 9) {
      this.mateuszPassiveCount -= 9;
      this.activatePerk('espresso_boost', 3);
      this.invulnerableTimer = Math.max(this.invulnerableTimer, 3);
      this.sayQuote('UMOWA NA 9 MIESIĘCY! Speedrun aktywowany!');
      this.emitFloatingToast('🚀 SPEEDRUN CONTRACT!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'combo');
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0xffffff);
    }
  }

  public renderMinimap(canvas: HTMLCanvasElement | null) {
    if (!canvas || this.state !== 'playing' || !this.minimapVisible) return;
    
    this.minimapFrameCounter++;
    if (this.minimapFrameCounter % 2 !== 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // High-tech radar dark background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;
    const scale = this.minimapZoomScale;

    // Concentric grid rings
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, w * 0.22, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, w * 0.42, 0, Math.PI * 2);
    ctx.moveTo(centerX, 0); ctx.lineTo(centerX, h);
    ctx.moveTo(0, centerY); ctx.lineTo(w, centerY);
    ctx.stroke();

    // 1. Level Platforms & Aisle Boundaries
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1;

    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      const dx = (p.x - this.playerPos.x) * scale;
      const dz = (p.z - this.playerPos.z) * scale;
      const pw = Math.max(3, p.width * scale);
      const pd = Math.max(3, p.depth * scale);

      const mx = centerX + dx - pw / 2;
      const my = centerY + dz - pd / 2;

      if (mx + pw >= 0 && mx <= w && my + pd >= 0 && my <= h) {
        ctx.fillRect(mx, my, pw, pd);
        ctx.strokeRect(mx, my, pw, pd);
      }
    }

    // 2. Collectibles & VIP Orders
    for (let i = 0; i < this.collectibles.length; i++) {
      const col = this.collectibles[i];
      if (col.collected) continue;
      const dx = (col.x - this.playerPos.x) * scale;
      const dz = (col.z - this.playerPos.z) * scale;
      const mx = centerX + dx;
      const my = centerY + dz;

      if (mx >= 0 && mx <= w && my >= 0 && my <= h) {
        ctx.fillStyle = col.type === 'vip_item' || col.type === 'golden_cutter' ? '#f59e0b' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(mx, my, col.type === 'vip_item' ? 4.5 : 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Dropped Perk Crates
    for (let i = 0; i < this.droppedPerks.length; i++) {
      const perk = this.droppedPerks[i];
      if (perk.collected) continue;
      const dx = (perk.x - this.playerPos.x) * scale;
      const dz = (perk.z - this.playerPos.z) * scale;
      const mx = centerX + dx;
      const my = centerY + dz;

      if (mx >= 0 && mx <= w && my >= 0 && my <= h) {
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(mx, my, 4.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Exit Gate (WYJŚCIE 🏁)
    if (this.finishGatePos) {
      const dx = (this.finishGatePos.x - this.playerPos.x) * scale;
      const dz = (this.finishGatePos.z - this.playerPos.z) * scale;
      const mx = centerX + dx;
      const my = centerY + dz;

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(mx, my, 6.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.font = '900 9px Google Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WYJŚCIE 🏁', mx, my - 8);
    }

    // 5. Enemies (Red markers / Alert Exclamation)
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.state === 'defeated') continue;
      const dx = (e.x - this.playerPos.x) * scale;
      const dz = (e.z - this.playerPos.z) * scale;
      const mx = centerX + dx;
      const my = centerY + dz;

      if (mx >= -10 && mx <= w + 10 && my >= -10 && my <= h + 10) {
        const isBoss = e.type === 'walczak' || e.type === 'krol_leto';
        ctx.fillStyle = isBoss ? '#ef4444' : e.state === 'chase' || e.state === 'charging' ? '#ff4d4d' : '#f43f5e';
        const size = isBoss ? 6.5 : 4.0;

        ctx.beginPath();
        ctx.arc(mx, my, size, 0, Math.PI * 2);
        ctx.fill();

        if (isBoss) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        if (e.state === 'chase' || e.state === 'charging') {
          ctx.fillStyle = '#facc15';
          ctx.font = '900 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', mx, my - size - 2);
        }
      }
    }

    // 6. Player Marker (Centered with direction indicator)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.playerRot);

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Radar scan line effect
    const sweep = (performance.now() * 0.0025) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(sweep) * (w * 0.45), centerY + Math.sin(sweep) * (h * 0.45));
    ctx.stroke();
  }
}
