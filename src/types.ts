export type CharacterId = 'marcin' | 'grzesiek' | 'dawid' | 'mateusz' | 'piotr';

export interface CharacterStats {
  speed: number;    // 1-5 scale
  jump: number;     // 1-5 scale
  power: number;    // 1-5 scale
  defense: number;  // 1-5 scale
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  role: string;
  title: string;
  color: number;
  secondaryColor: number;
  speed: number;
  jumpForce: number;
  abilityName: string;
  abilityDescription: string;
  abilityCooldown: number; // in seconds
  passiveName: string;
  passiveDescription: string;
  voiceLines: string[];
  bio: string;
  stats: CharacterStats;
}

export type CollectibleType =
  | 'grout'
  | 'tile_box'
  | 'coffee'
  | 'vip_item'
  | 'espresso'
  | 'magnet'
  | 'golden_cutter'
  | 'kfc_bucket'
  | 'carrara'
  | 'easter_egg';

export interface CollectibleItem {
  id: string;
  type: CollectibleType;
  name: string;
  x: number;
  y: number;
  z: number;
  mesh?: any;
  collected: boolean;
  points: number;
}

export type EnemyType =
  | 'customer'
  | 'walczak'
  | 'forklift'
  | 'architect'
  | 'inspector'
  | 'agv_robot'
  | 'handlowiec'
  | 'monter'
  | 'piorun_dron'
  | 'elite_walczak_guard'
  | 'kurier'
  | 'przedstawiciel_włoski'
  | 'sztaplar_szalony'
  | 'krol_leto'
  | 'pan_roman'
  | 'serwisant'
  | 'bosman_krakow'
  | 'zombie_pracownik'
  | 'pomazaniec'
  | 'sebix_m';

export interface EnemyItem {
  id: string;
  type: EnemyType;
  name: string;
  mesh?: any;
  speechMesh?: any;
  x: number;
  y: number;
  z: number;
  startX: number;
  endX: number;
  speed: number;
  dir: number;
  hp: number;
  maxHp: number;
  state: 'patrol' | 'chase' | 'searching' | 'stunned' | 'defeated' | 'charging';
  lastKnownPlayerPos?: { x: number; z: number } | null;
  searchTimer?: number;
  stunTimer: number;
  shoutTimer: number;
  shoutText: string;
  attackCooldown: number;
  walkCycle: number;
  legL?: any;
  legR?: any;
  armL?: any;
  armR?: any;
  specialActionTimer?: number;
  bossPhase?: number;
  chargeDir?: number;
  chargeTimer?: number;
  shieldActive?: boolean;
  onFireTimer?: number;
  alerted?: boolean;
  hpBar?: any;
  hpFill?: any;
  threatRing?: any;
  shieldRing?: any;
  bikeWheels?: any[];
  propeller?: any;
  rageTime?: number;
  trailTimer?: number;
  dashTimer?: number;
  // Stable formation data for Survival's encirclement director.
  aiSlot?: number;
  aiFlankAngle?: number;
  aiOrbitSign?: number;
  surgeRunner?: boolean;
  survivalAuditor?: boolean;
  auraBuffed?: boolean;
  auraRing?: any;
}

export interface HazardItem {
  id: string;
  type:
    | 'forklift'
    | 'spill'
    | 'steam_faucet'
    | 'falling_lamp'
    | 'conveyor'
    | 'stretch_barrier'
    | 'roller_gate'
    | 'cement_spill'
    | 'laser_cutter'
    | 'steam_geyser'
    | 'hydraulic_press';
  mesh?: any;
  startX: number;
  startZ: number;
  endX?: number;
  endZ?: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  width: number;
  length: number;
  dir: number;
  active: boolean;
  timer?: number;
  phase?: number;
  movingPart?: any;
  warningMesh?: any;
  life?: number; // temporary Survival traps are removed after their active window
  cooldown?: number; // contact cooldown for traps that can hit repeatedly
}

export interface PlatformBlock {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  type: 'floor' | 'shelf' | 'pallet' | 'bathtub' | 'conveyor' | 'ramp' | 'finish_truck' | 'scaffold' | 'jump_pad' | 'speed_pad';
  bounce?: number;
  mesh?: any;
}

export interface LevelConfig {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  targetItemsRequired: number;
  spawnPoint: { x: number; y: number; z: number };
  exitPoint: { x: number; y: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  dialogueQuote: string;
}

export type GameState = 'title' | 'playing' | 'paused' | 'levelup' | 'victory' | 'gameover';

export interface ActivePerks {
  doubleJump: number;   // remaining duration in seconds (>0 enables 2nd jump)
  shield: boolean;      // Foreman hardhat 1-hit invulnerability
  magnet: number;       // remaining duration in seconds
  speedBoost: number;   // remaining duration in seconds
  kfcBerserk?: number;  // KFC chicken feast: 2x damage + speed + slow immunity
  bulldozer?: number;   // Golden Pallet Jack: ram enemies on contact
  attackHaste?: number;
  arcDrone?: number;
  xpSurge?: number;
  damageWard?: number;
}

export type PerkType =
  | 'hardhat'
  | 'vibram_boots'
  | 'order_magnet'
  | 'espresso_boost'
  | 'kfc_bucket'
  | 'golden_paleciak'
  | 'stretch_armor'
  | 'attack_haste'
  | 'arc_drone'
  | 'xp_surge'
  | 'damage_ward'
  | 'forklift_horn'
  | 'night_shift_espresso'
  | 'golden_wz'
  | 'pallet_guard';

export interface PerkDef {
  id: PerkType;
  name: string;
  description: string;
  icon: string;
  color: number;
  duration?: number;
}

export interface DroppedPerkItem {
  id: string;
  perkId: PerkType;
  name: string;
  icon: string;
  color: number;
  x: number;
  y: number;
  z: number;
  initialY: number;
  mesh: any;
  collected: boolean;
  life: number;
  duration: number;
  beacon?: any;
}

export const AVAILABLE_PERKS: PerkDef[] = [
  {
    id: 'hardhat',
    name: 'Atestowany Kask BHP',
    description: 'Tarcza ochronna na 1 bezpośrednie trafienie od wściekłego klienta, inspektora lub kary Walczaka.',
    icon: '⛑️',
    color: 0x3b82f6,
  },
  {
    id: 'vibram_boots',
    name: 'Buty Magazynowe Vibram',
    description: 'Umożliwia podwójny skok w powietrzu, pozwalając wspinać się na najwyższe regały wysokiego składu.',
    icon: '👟',
    color: 0x10b981,
    duration: 25,
  },
  {
    id: 'order_magnet',
    name: 'Radiowy Magnes Zamówień',
    description: 'Przyciąga wszystkie palety, WZ-tki, kleje i próbki marmuru z odległości aż 10 metrów!',
    icon: '🧲',
    color: 0x8b5cf6,
    duration: 20,
  },
  {
    id: 'espresso_boost',
    name: 'Podwójne Espresso z Showroomu',
    description: 'Maksymalny zryw prędkości (+65%) i natychmiastowa gotowość do omijania wózków i palet.',
    icon: '☕',
    color: 0xf59e0b,
    duration: 18,
  },
  {
    id: 'kfc_bucket',
    name: 'Kubełek KFC od Dawida',
    description: 'Gorące stripsy i skrzydełka! Leczy +2 Kawy BHP, daje Furię KFC (podwójne obrażenia i odporność na klej)!',
    icon: '🍗',
    color: 0xef4444,
    duration: 16,
  },
  {
    id: 'golden_paleciak',
    name: 'Złoty Paleciak Turbo B4',
    description: 'Tryb Tarana! Rozjeżdżasz wrogów samym biegiem, zadając im 3 HP obrażeń przy zderzeniu!',
    icon: '🚜',
    color: 0xeab308,
    duration: 14,
  },
  {
    id: 'stretch_armor',
    name: 'Zbroja z Folii Stretch VIP',
    description: 'Owijasz się 5 warstwami czarnej folii stretch: Tarcza BHP + 10 sekund całkowitej nietykalności!',
    icon: '🛡️',
    color: 0x06b6d4,
    duration: 10,
  },

  {
    id: 'attack_haste',
    name: 'Tryb Turbo Skanera',
    description: 'Przez 22 sekundy skraca odstęp między atakami operatora.',
    icon: '📡',
    color: 0x38bdf8,
    duration: 22,
  },
  {
    id: 'arc_drone',
    name: 'Dron Piorun — asysta',
    description: 'Przez 28 sekund dron okresowo razi najbliższego przeciwnika impulsem elektrycznym.',
    icon: '🤖',
    color: 0x22d3ee,
    duration: 28,
  },
  {
    id: 'xp_surge',
    name: 'Premia za normę',
    description: 'Przez 24 sekundy kryształy doświadczenia dają 50% więcej XP.',
    icon: '📈',
    color: 0xa78bfa,
    duration: 24,
  },
  {
    id: 'damage_ward',
    name: 'Pancerz z palety EURO',
    description: 'Przez 24 sekundy blokuje jedno trafienie co 2,4 sekundy.',
    icon: '🪵',
    color: 0x84cc16,
    duration: 24,
  },
  {
    id: 'forklift_horn',
    name: 'Klakson Sztaplarki B4',
    description: 'Jednorazowy impuls dźwiękowy ogłusza przeciwników w promieniu 7 metrów i przerywa ich szarże.',
    icon: '📣',
    color: 0xf97316,
  },
  {
    id: 'night_shift_espresso',
    name: 'Espresso Nocnej Zmiany',
    description: 'Przez 20 sekund zwiększa prędkość i tempo ataku. Działa również z aktywnymi perkami turbo.',
    icon: '⚡',
    color: 0xeab308,
    duration: 20,
  },
  {
    id: 'golden_wz',
    name: 'Złota WZ-tka',
    description: 'Natychmiast przyznaje 600 punktów i 8 kryształów XP. Rzadki, jednorazowy zastrzyk progresji.',
    icon: '📜',
    color: 0xfbbf24,
  },
  {
    id: 'pallet_guard',
    name: 'Barykada EURO',
    description: 'Przez 18 sekund aktywuje dodatkową osłonę i zmniejsza ryzyko kolejnego trafienia.',
    icon: '🛡️',
    color: 0x65a30d,
    duration: 18,
  },
];


