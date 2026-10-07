export interface PresetAvatar {
  id: string;
  name: string;
  category: 'cyber' | 'retro' | 'synth' | 'cosmic' | 'pixel';
  gradient: string;
  accentColor: string;
  iconName: string;
  svgDataUri: string;
}

// Generate stylized SVG avatars encoded as clean Data URIs
function createAvatarUri(bgGradient: [string, string], innerSvg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}" />
        <stop offset="100%" stop-color="${bgGradient[1]}" />
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="28" fill="url(#g)" />
    <rect x="2" y="2" width="96" height="48" rx="26" fill="url(#glow)" />
    ${innerSvg}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'cyber-dj',
    name: 'Cyber DJ',
    category: 'cyber',
    gradient: 'from-indigo-600 to-violet-900',
    accentColor: '#818cf8',
    iconName: 'Headphones',
    svgDataUri: createAvatarUri(['#4f46e5', '#1e1b4b'], `
      <circle cx="50" cy="50" r="26" fill="#0f172a" stroke="#818cf8" stroke-width="3"/>
      <path d="M32 50 C32 37 40 28 50 28 C60 28 68 37 68 50" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
      <rect x="26" y="44" width="10" height="18" rx="4" fill="#818cf8"/>
      <rect x="64" y="44" width="10" height="18" rx="4" fill="#818cf8"/>
      <circle cx="50" cy="52" r="6" fill="#38bdf8"/>
      <path d="M44 64 Q50 70 56 64" fill="none" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'neon-runner',
    name: 'Neon Pulse',
    category: 'cyber',
    gradient: 'from-fuchsia-600 to-pink-900',
    accentColor: '#f472b6',
    iconName: 'Zap',
    svgDataUri: createAvatarUri(['#c026d3', '#701a75'], `
      <polygon points="54,20 32,52 48,52 44,80 68,44 52,44" fill="#f472b6" stroke="#fdf2f8" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="28" cy="28" r="3" fill="#fbcfe8"/>
      <circle cx="72" cy="70" r="4" fill="#e879f9"/>
      <circle cx="74" cy="26" r="2" fill="#ffffff"/>
    `),
  },
  {
    id: 'synth-maestro',
    name: 'Synth Maestro',
    category: 'synth',
    gradient: 'from-amber-500 to-rose-900',
    accentColor: '#fbbf24',
    iconName: 'Music',
    svgDataUri: createAvatarUri(['#d97706', '#881337'], `
      <rect x="24" y="32" width="52" height="38" rx="8" fill="#18181b" stroke="#fbbf24" stroke-width="3"/>
      <rect x="30" y="40" width="8" height="22" rx="2" fill="#f8fafc"/>
      <rect x="42" y="40" width="8" height="22" rx="2" fill="#f8fafc"/>
      <rect x="54" y="40" width="8" height="22" rx="2" fill="#f8fafc"/>
      <rect x="62" y="40" width="8" height="22" rx="2" fill="#f8fafc"/>
      <rect x="35" y="38" width="5" height="13" rx="1.5" fill="#09090b"/>
      <rect x="47" y="38" width="5" height="13" rx="1.5" fill="#09090b"/>
      <circle cx="50" cy="24" r="5" fill="#fbbf24"/>
    `),
  },
  {
    id: 'cosmic-star',
    name: 'Cosmic Beat',
    category: 'cosmic',
    gradient: 'from-cyan-500 to-blue-900',
    accentColor: '#22d3ee',
    iconName: 'Sparkles',
    svgDataUri: createAvatarUri(['#06b6d4', '#1e3a8a'], `
      <circle cx="50" cy="50" r="24" fill="#030712" stroke="#22d3ee" stroke-width="2.5"/>
      <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#67e8f9" stroke-width="2.5" stroke-dasharray="3,3" transform="rotate(-25 50 50)"/>
      <path d="M50 32 L53 45 L66 48 L55 55 L58 68 L50 59 L42 68 L45 55 L34 48 L47 45 Z" fill="#38bdf8"/>
    `),
  },
  {
    id: 'retro-arcade',
    name: 'Pixel Hero',
    category: 'retro',
    gradient: 'from-emerald-500 to-teal-950',
    accentColor: '#34d399',
    iconName: 'Gamepad2',
    svgDataUri: createAvatarUri(['#10b981', '#042f2e'], `
      <rect x="22" y="32" width="56" height="36" rx="10" fill="#0f172a" stroke="#34d399" stroke-width="3"/>
      <line x1="34" y1="44" x2="34" y2="56" stroke="#34d399" stroke-width="4" stroke-linecap="round"/>
      <line x1="28" y1="50" x2="40" y2="50" stroke="#34d399" stroke-width="4" stroke-linecap="round"/>
      <circle cx="62" cy="46" r="4" fill="#fb7185"/>
      <circle cx="70" cy="54" r="4" fill="#38bdf8"/>
    `),
  },
  {
    id: 'hologram-idol',
    name: 'Holo Vocalist',
    category: 'synth',
    gradient: 'from-purple-600 to-indigo-950',
    accentColor: '#c084fc',
    iconName: 'Mic',
    svgDataUri: createAvatarUri(['#9333ea', '#1e1b4b'], `
      <circle cx="50" cy="50" r="30" fill="none" stroke="#c084fc" stroke-width="1.5" stroke-dasharray="4,4"/>
      <rect x="42" y="28" width="16" height="26" rx="8" fill="#e9d5ff" stroke="#a855f7" stroke-width="2.5"/>
      <line x1="50" y1="56" x2="50" y2="72" stroke="#c084fc" stroke-width="3" stroke-linecap="round"/>
      <line x1="40" y1="72" x2="60" y2="72" stroke="#c084fc" stroke-width="3" stroke-linecap="round"/>
      <path d="M36 44 C36 54 64 54 64 44" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sound-architect',
    name: 'Sound Wave',
    category: 'cyber',
    gradient: 'from-teal-500 to-slate-900',
    accentColor: '#2dd4bf',
    iconName: 'Radio',
    svgDataUri: createAvatarUri(['#14b8a6', '#0f172a'], `
      <rect x="22" y="46" width="6" height="16" rx="3" fill="#2dd4bf"/>
      <rect x="32" y="36" width="6" height="32" rx="3" fill="#2dd4bf"/>
      <rect x="42" y="24" width="6" height="52" rx="3" fill="#5eead4"/>
      <rect x="52" y="30" width="6" height="42" rx="3" fill="#5eead4"/>
      <rect x="62" y="40" width="6" height="26" rx="3" fill="#2dd4bf"/>
      <rect x="72" y="48" width="6" height="12" rx="3" fill="#2dd4bf"/>
    `),
  },
  {
    id: 'master-valkyrie',
    name: 'Valkyrie Rhythm',
    category: 'cosmic',
    gradient: 'from-rose-500 to-indigo-950',
    accentColor: '#fb7185',
    iconName: 'Crown',
    svgDataUri: createAvatarUri(['#f43f5e', '#311042'], `
      <path d="M30 64 L24 38 L38 48 L50 28 L62 48 L76 38 L70 64 Z" fill="#fb7185" stroke="#ffe4e6" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="50" cy="56" r="4" fill="#ffffff"/>
      <circle cx="36" cy="58" r="2.5" fill="#fecdd3"/>
      <circle cx="64" cy="58" r="2.5" fill="#fecdd3"/>
    `),
  },
];

export const DEFAULT_AVATAR = PRESET_AVATARS[0];

export function getAvatarById(id?: string): PresetAvatar {
  if (!id) return DEFAULT_AVATAR;
  return PRESET_AVATARS.find((a) => a.id === id) || DEFAULT_AVATAR;
}
