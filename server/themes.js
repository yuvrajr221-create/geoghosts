export const THEMES = {
  'haunted-mansion': {
    label: 'Haunted Mansion',
    bg: '#120d1a', panel: '#1d1527', text: '#e9e1f5', muted: '#a99bc2',
    accent: '#b78cff', accent2: '#ff9a3c',
    font: 'Georgia, "Times New Roman", serif',
    pattern: 'radial-gradient(circle at 15% 8%, #2e1d44 0, transparent 38%), radial-gradient(circle at 85% 92%, #3d1f2e 0, transparent 38%)',
    size: 'auto',
  },
  'neon-void': {
    label: 'Neon Void',
    bg: '#05060a', panel: '#0b0f1a', text: '#d6fff6', muted: '#6fb5a8',
    accent: '#00ffd0', accent2: '#ff2bd6',
    font: '"Courier New", Courier, monospace',
    pattern: 'linear-gradient(rgba(0,255,208,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,208,.06) 1px, transparent 1px)',
    size: '32px 32px',
  },
  'vapor-cemetery': {
    label: 'Vapor Cemetery',
    bg: '#1a1033', panel: '#251646', text: '#ffe9fb', muted: '#c9a6e8',
    accent: '#ff71ce', accent2: '#01cdfe',
    font: '"Trebuchet MS", Verdana, sans-serif',
    pattern: 'linear-gradient(180deg, #1a1033 0%, #34195c 62%, rgba(255,113,206,.28) 100%)',
    size: 'auto',
  },
  'pumpkin-patch': {
    label: 'Pumpkin Patch',
    bg: '#140a02', panel: '#22130a', text: '#ffedd5', muted: '#d3a074',
    accent: '#ff8a1f', accent2: '#a3e635',
    font: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive',
    pattern: 'radial-gradient(circle at 50% 120%, rgba(255,138,31,.28) 0, transparent 55%)',
    size: 'auto',
  },
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'haunted-mansion';
