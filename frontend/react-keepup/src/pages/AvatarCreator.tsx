/**
 * AvatarCreator — RPG-style layered avatar builder
 * Uses inline SVG for full render-to-dataURL support (no external assets).
 * D&D integration ready: each option tagged with class/race metadata.
 */
import React, { useState, useRef, useCallback } from 'react';
import './AvatarCreator.css';

// ─── Option Definitions ──────────────────────────────────────────────────────

const SKIN_TONES = [
  { id: 'fair',        label: 'Fair',         color: '#FDDBB4', shadow: '#E8A87C', lip: '#C97A6A' },
  { id: 'light',       label: 'Light',        color: '#F5C38A', shadow: '#D4956A', lip: '#B8705C' },
  { id: 'medium',      label: 'Medium',       color: '#D4956A', shadow: '#B06840', lip: '#8C4A38' },
  { id: 'tan',         label: 'Tan',          color: '#C68642', shadow: '#9A6020', lip: '#7A4828' },
  { id: 'brown',       label: 'Brown',        color: '#8D5524', shadow: '#6A3510', lip: '#5A2A18' },
  { id: 'dark',        label: 'Dark',         color: '#5B2A0A', shadow: '#3F1A05', lip: '#4A2218' },
  { id: 'orc',         label: '🌿 Orc',       color: '#6B9E50', shadow: '#4A7030', lip: '#3A5820' },
  { id: 'undead',      label: '💀 Undead',    color: '#C8C8B0', shadow: '#989880', lip: '#808060' },
  { id: 'aasimar',     label: '✨ Aasimar',   color: '#D8CAFF', shadow: '#B0A0E0', lip: '#C090D0' },
  { id: 'dragonborn',  label: '🐉 Dragonborn',color: '#9B4040', shadow: '#722020', lip: '#601A1A' },
];

const HAIR_STYLES = [
  { id: 0,  label: 'Bald',         icon: '🥚' },
  { id: 1,  label: 'Buzz',         icon: '✂️' },
  { id: 2,  label: 'Short',        icon: '🧒' },
  { id: 3,  label: 'Medium',       icon: '👤' },
  { id: 4,  label: 'Long Straight',icon: '💇' },
  { id: 5,  label: 'Afro/Curly',   icon: '🌟' },
  { id: 6,  label: 'Spiky',        icon: '⚡' },
  { id: 7,  label: 'Mohawk',       icon: '🤘' },
  { id: 8,  label: 'Ponytail',     icon: '🎀' },
  { id: 9,  label: 'Wild/Mage',    icon: '🧙' },
  { id: 10, label: 'Top Bun',      icon: '🍙' },
  { id: 11, label: 'Braided',      icon: '🪢' },
];

const HAIR_COLORS = [
  { id: 'black',     label: 'Black',     color: '#1A1A1A' },
  { id: 'darkbrown', label: 'Dark Brown',color: '#3B1F0A' },
  { id: 'brown',     label: 'Brown',     color: '#6B3A1F' },
  { id: 'auburn',    label: 'Auburn',    color: '#922B21' },
  { id: 'red',       label: 'Red',       color: '#CC3300' },
  { id: 'strawberry',label: 'Strawberry',color: '#E07050' },
  { id: 'blonde',    label: 'Blonde',    color: '#D4AA40' },
  { id: 'platinum',  label: 'Platinum',  color: '#EEE0C4' },
  { id: 'white',     label: 'White',     color: '#F5F5F0' },
  { id: 'gray',      label: 'Gray',      color: '#909090' },
  { id: 'blue',      label: '💙 Blue',   color: '#2255CC' },
  { id: 'purple',    label: '💜 Purple', color: '#7722AA' },
  { id: 'green',     label: '💚 Green',  color: '#228833' },
  { id: 'pink',      label: '🩷 Pink',   color: '#EE44AA' },
];

const EYE_STYLES = [
  { id: 0, label: 'Normal',     icon: '👁️' },
  { id: 1, label: 'Almond',     icon: '😌' },
  { id: 2, label: 'Wide',       icon: '😲' },
  { id: 3, label: 'Cat Slit',   icon: '🐱' },
  { id: 4, label: 'Glowing',    icon: '✨' },
  { id: 5, label: 'Half-Closed',icon: '😏' },
  { id: 6, label: 'Fierce',     icon: '😠' },
  { id: 7, label: 'Stars',      icon: '⭐' },
];

const EYE_COLORS = [
  { id: 'brown',  color: '#6B3A1F' }, { id: 'darkbrown', color: '#3B1F0A' },
  { id: 'hazel',  color: '#8B6914' }, { id: 'green',     color: '#2E7D32' },
  { id: 'blue',   color: '#1565C0' }, { id: 'lightblue', color: '#42A5F5' },
  { id: 'gray',   color: '#607080' }, { id: 'violet',    color: '#7B1FA2' },
  { id: 'red',    color: '#C62828' }, { id: 'gold',      color: '#F9A825' },
  { id: 'white',  color: '#E0E0E0' }, { id: 'black',     color: '#111111' },
];

const BROW_STYLES = [
  { id: 0, label: 'Natural' }, { id: 1, label: 'Thick'  },
  { id: 2, label: 'Thin'    }, { id: 3, label: 'Arched' },
  { id: 4, label: 'Angry'   }, { id: 5, label: 'Raised' },
];

const MOUTH_STYLES = [
  { id: 0, label: 'Neutral', icon: '😐' }, { id: 1, label: 'Smile',    icon: '🙂' },
  { id: 2, label: 'Grin',    icon: '😁' }, { id: 3, label: 'Smirk',   icon: '😏' },
  { id: 4, label: 'Open',    icon: '😮' }, { id: 5, label: 'Fangs',   icon: '🧛' },
];

const FACIAL_HAIR = [
  { id: 0,  label: 'None',          icon: '🚫' },
  { id: 1,  label: 'Stubble',       icon: '🪒' },
  { id: 2,  label: 'Goatee',        icon: '🧔' },
  { id: 3,  label: 'Full Beard',    icon: '🧔‍♂️' },
  { id: 4,  label: 'Mustache',      icon: '🥸' },
  { id: 5,  label: 'Dwarf Beard',   icon: '⛏️' },
];

const CLOTHING = [
  { id: 0,  label: 'T-Shirt',       icon: '👕', color: '#3A7BD5' },
  { id: 1,  label: 'Hoodie',        icon: '🧥', color: '#555' },
  { id: 2,  label: 'Suit',          icon: '👔', color: '#2C3E50' },
  { id: 3,  label: 'Mage Robes',    icon: '🧙', color: '#4A148C' },
  { id: 4,  label: 'Leather Armor', icon: '🛡️', color: '#795548' },
  { id: 5,  label: 'Chainmail',     icon: '⛓️', color: '#90A4AE' },
  { id: 6,  label: 'Plate Armor',   icon: '🪖', color: '#546E7A' },
  { id: 7,  label: 'Ranger Cloak',  icon: '🌿', color: '#33691E' },
  { id: 8,  label: 'Paladin',       icon: '⚔️', color: '#C8A600' },
  { id: 9,  label: 'Druid Vest',    icon: '🍃', color: '#558B2F' },
];

const HELMETS = [
  { id: 0,  label: 'None',          icon: '❌' },
  { id: 1,  label: 'Wizard Hat',    icon: '🧙' },
  { id: 2,  label: 'Knight Helm',   icon: '⛑️' },
  { id: 3,  label: 'Crown',         icon: '👑' },
  { id: 4,  label: 'Circlet',       icon: '💫' },
  { id: 5,  label: 'Horned Helm',   icon: '🐂' },
  { id: 6,  label: 'Baseball Cap',  icon: '🧢' },
  { id: 7,  label: 'Hood',          icon: '🎭' },
  { id: 8,  label: 'Bandana',       icon: '🏴‍☠️' },
  { id: 9,  label: 'Tiara',         icon: '✨' },
];

const WEAPONS = [
  { id: 0,  label: 'None',    icon: '✊' },
  { id: 1,  label: 'Sword',   icon: '⚔️' },
  { id: 2,  label: 'Staff',   icon: '🪄' },
  { id: 3,  label: 'Bow',     icon: '🏹' },
  { id: 4,  label: 'Dagger',  icon: '🗡️' },
  { id: 5,  label: 'Axe',     icon: '🪓' },
  { id: 6,  label: 'Wand',    icon: '✨' },
  { id: 7,  label: 'Shield',  icon: '🛡️' },
  { id: 8,  label: 'Scythe',  icon: '💀' },
  { id: 9,  label: 'Tome',    icon: '📖' },
];

const BACKGROUNDS = [
  { id: 'midnight',  label: 'Midnight',   type: 'solid',    color: '#0A0A1A' },
  { id: 'twilight',  label: 'Twilight',   type: 'gradient', from: '#1A0530', to: '#0A0A1A' },
  { id: 'forest',    label: 'Forest',     type: 'gradient', from: '#0D2B0D', to: '#1A3A1A' },
  { id: 'dungeon',   label: 'Dungeon',    type: 'gradient', from: '#1A1208', to: '#2A1E0E' },
  { id: 'fire',      label: '🔥 Fire',    type: 'gradient', from: '#1A0000', to: '#3A0800' },
  { id: 'ice',       label: '❄️ Ice',     type: 'gradient', from: '#031A2E', to: '#0A2A44' },
  { id: 'holy',      label: '✨ Holy',    type: 'gradient', from: '#2A2000', to: '#3A3000' },
  { id: 'shadow',    label: '🌑 Shadow',  type: 'gradient', from: '#050508', to: '#0F0F18' },
  { id: 'ocean',     label: '🌊 Ocean',   type: 'gradient', from: '#001A30', to: '#002A50' },
  { id: 'volcano',   label: '🌋 Volcano', type: 'gradient', from: '#2A0500', to: '#1A1000' },
];

const AURAS = [
  { id: 'none',   label: 'None',    color: 'transparent',  glow: 'none' },
  { id: 'fire',   label: '🔥 Fire', color: '#FF6B00',      glow: '#FF3300' },
  { id: 'ice',    label: '❄️ Ice',  color: '#44AAFF',      glow: '#0088CC' },
  { id: 'arcane', label: '💜 Arcane',color: '#AA44FF',     glow: '#7700CC' },
  { id: 'holy',   label: '✨ Holy', color: '#FFDD44',      glow: '#FFAA00' },
  { id: 'nature', label: '🌿 Nature',color: '#44FF88',     glow: '#00CC44' },
  { id: 'shadow', label: '🌑 Shadow',color: '#442266',     glow: '#220044' },
  { id: 'blood',  label: '🩸 Blood', color: '#CC0000',     glow: '#880000' },
];

// ─── Interface ───────────────────────────────────────────────────────────────

export interface AvatarOptions {
  skin: string;
  hairStyle: number;
  hairColor: string;
  eyeStyle: number;
  eyeColor: string;
  browStyle: number;
  browColor: string; // 'match' = same as hairColor
  mouthStyle: number;
  facialHair: number;
  clothing: number;
  clothingColor: string;
  helmet: number;
  weapon: number;
  background: string;
  aura: string;
}

const DEFAULT_OPTIONS: AvatarOptions = {
  skin: 'medium', hairStyle: 3, hairColor: 'brown',
  eyeStyle: 0, eyeColor: 'brown', browStyle: 0, browColor: 'match',
  mouthStyle: 1, facialHair: 0, clothing: 0, clothingColor: '',
  helmet: 0, weapon: 0, background: 'midnight', aura: 'none',
};

interface Props {
  onApply: (dataUrl: string, options: AvatarOptions) => void;
  onClose: () => void;
  initialOptions?: Partial<AvatarOptions>;
}

// ─── SVG Renderer ────────────────────────────────────────────────────────────

function AvatarSVG({ opts }: { opts: AvatarOptions }) {
  const skin   = SKIN_TONES.find(s => s.id === opts.skin) || SKIN_TONES[2];
  const hairC  = HAIR_COLORS.find(h => h.id === opts.hairColor)?.color || '#6B3A1F';
  const eyeC   = EYE_COLORS.find(e => e.id === opts.eyeColor)?.color || '#6B3A1F';
  const browC  = opts.browColor === 'match' ? hairC : (HAIR_COLORS.find(h => h.id === opts.browColor)?.color || hairC);
  const bg     = BACKGROUNDS.find(b => b.id === opts.background) || BACKGROUNDS[0];
  const aura   = AURAS.find(a => a.id === opts.aura) || AURAS[0];
  const clothC = opts.clothingColor || CLOTHING[opts.clothing]?.color || '#3A7BD5';

  const s = skin.color;
  const sd = skin.shadow;
  const lip = skin.lip;

  // ── Hair paths ──────────────────────────────────────────────────────────
  const hairPaths: Record<number, React.ReactElement | null> = {
    0: null, // bald
    1: ( // buzz — thin skullcap
      <ellipse cx="100" cy="63" rx="63" ry="30" fill={hairC} />
    ),
    2: ( // short
      <path d={`M37 95 Q37 32 100 28 Q163 32 163 95 Q155 50 100 42 Q45 50 37 95`} fill={hairC} />
    ),
    3: ( // medium — covers top + small sideburns
      <g>
        <path d={`M37 105 Q35 28 100 24 Q165 28 163 105 Q155 45 100 38 Q45 45 37 105`} fill={hairC} />
        <path d={`M37 105 Q34 118 38 130 Q42 120 44 108`} fill={hairC} />
        <path d={`M163 105 Q166 118 162 130 Q158 120 156 108`} fill={hairC} />
      </g>
    ),
    4: ( // long straight — panels to shoulder
      <g>
        <path d={`M37 105 Q35 28 100 24 Q165 28 163 105 Q155 42 100 36 Q45 42 37 105`} fill={hairC} />
        <path d={`M37 105 Q28 140 30 195 Q42 190 46 175 Q44 145 50 115`} fill={hairC} />
        <path d={`M163 105 Q172 140 170 195 Q158 190 154 175 Q156 145 150 115`} fill={hairC} />
      </g>
    ),
    5: ( // afro / curly — big fluffy dome
      <g>
        <ellipse cx="100" cy="50" rx="80" ry="68" fill={hairC} />
        {/* texture bumps */}
        {[[-30,40],[-55,55],[-65,75],[30,40],[55,55],[65,75],[0,28]].map(([dx,dy],i) => (
          <circle key={i} cx={100+dx} cy={dy} r="16" fill={hairC}
            style={{filter:'brightness(0.92)'}} />
        ))}
      </g>
    ),
    6: ( // spiky
      <g>
        <ellipse cx="100" cy="70" rx="62" ry="42" fill={hairC} />
        {[-40,-22,-5,13,30,45].map((dx,i) => (
          <polygon key={i}
            points={`${100+dx-8},65 ${100+dx},${20 + (i%2)*12} ${100+dx+8},65`}
            fill={hairC} />
        ))}
      </g>
    ),
    7: ( // mohawk — strip + shaved sides
      <g>
        <rect x="88" y="15" width="24" height="80" rx="10" fill={hairC} />
        <path d={`M37 105 Q37 82 47 80 Q55 78 62 82 Q52 88 50 98`} fill={sd} />
        <path d={`M163 105 Q163 82 153 80 Q145 78 138 82 Q148 88 150 98`} fill={sd} />
      </g>
    ),
    8: ( // ponytail
      <g>
        <path d={`M37 105 Q35 28 100 24 Q165 28 163 105 Q155 42 100 36 Q45 42 37 105`} fill={hairC} />
        <path d={`M138 70 Q160 90 155 150 Q148 175 145 200 Q138 190 140 165 Q142 135 135 100`} fill={hairC} />
        <ellipse cx="147" cy="202" rx="8" ry="6" fill={hairC} />
      </g>
    ),
    9: ( // wild / mage — disheveled
      <g>
        {[[-60,55],[-68,72],[-62,90],[-45,42],[-20,30],[5,22],[30,28],[52,36],[65,55],[68,75],[62,92]].map(([dx,dy],i) => (
          <ellipse key={i} cx={100+dx} cy={dy} rx="14" ry="20"
            transform={`rotate(${dx*0.8},${100+dx},${dy})`} fill={hairC} />
        ))}
      </g>
    ),
    10: ( // bun
      <g>
        <ellipse cx="100" cy="68" rx="62" ry="42" fill={hairC} />
        <circle cx="100" cy="28" r="20" fill={hairC} style={{filter:'brightness(0.9)'}} />
        <path d={`M85 28 Q100 18 115 28`} fill="none" stroke={sd} strokeWidth="2" />
      </g>
    ),
    11: ( // braided
      <g>
        <path d={`M37 105 Q35 28 100 24 Q165 28 163 105 Q155 42 100 36 Q45 42 37 105`} fill={hairC} />
        {/* left braid */}
        {[100,115,130,145,160,175].map((y,i) => (
          <ellipse key={i} cx={i%2===0?32:28} cy={y} rx="8" ry="10" fill={hairC}
            style={{filter:`brightness(${i%2===0?1:0.85})`}} />
        ))}
        {/* right braid */}
        {[100,115,130,145,160,175].map((y,i) => (
          <ellipse key={i+10} cx={i%2===0?168:172} cy={y} rx="8" ry="10" fill={hairC}
            style={{filter:`brightness(${i%2===0?1:0.85})`}} />
        ))}
      </g>
    ),
  };

  // ── Eyes ──────────────────────────────────────────────────────────────────
  function renderEye(cx: number, flip = false) {
    const scaleX = flip ? -1 : 1;
    const t = `scale(${scaleX} 1) translate(${flip ? -200 : 0},0)`;
    switch(opts.eyeStyle) {
      case 1: // almond
        return (
          <g key={cx} transform={t}>
            <path d={`M${cx-13},107 Q${cx},96 ${cx+13},107 Q${cx},112 ${cx-13},107`} fill="white" />
            <circle cx={cx} cy={105} r="5.5" fill={eyeC} />
            <circle cx={cx} cy={105} r="3" fill="#111" />
            <circle cx={cx+2} cy={103} r="1.5" fill="white" opacity="0.8" />
          </g>
        );
      case 2: // wide
        return (
          <g key={cx} transform={t}>
            <ellipse cx={cx} cy={106} rx="13" ry="11" fill="white" />
            <circle cx={cx} cy={106} r="7" fill={eyeC} />
            <circle cx={cx} cy={106} r="4" fill="#111" />
            <circle cx={cx+2} cy={104} r="2" fill="white" opacity="0.8" />
          </g>
        );
      case 3: // cat slit
        return (
          <g key={cx} transform={t}>
            <ellipse cx={cx} cy={106} rx="11" ry="8" fill={eyeC} />
            <ellipse cx={cx} cy={106} rx="3" ry="7" fill="#111" />
            <circle cx={cx+2} cy={102} r="1.5" fill="rgba(255,255,255,0.6)" />
          </g>
        );
      case 4: // glowing
        return (
          <g key={cx} transform={t}>
            <ellipse cx={cx} cy={106} rx="12" ry="9" fill={eyeC} style={{filter:`drop-shadow(0 0 4px ${eyeC})`}} />
            <ellipse cx={cx} cy={106} rx="6" ry="5" fill="white" opacity="0.8" style={{filter:`drop-shadow(0 0 3px white)`}} />
          </g>
        );
      case 5: // half-closed
        return (
          <g key={cx} transform={t}>
            <ellipse cx={cx} cy={108} rx="11" ry="7" fill="white" />
            <circle cx={cx} cy={108} r="5.5" fill={eyeC} />
            <circle cx={cx} cy={108} r="3" fill="#111" />
            <path d={`M${cx-12},104 Q${cx},102 ${cx+12},104`} fill={s} />
          </g>
        );
      case 6: // fierce / angled
        return (
          <g key={cx} transform={t}>
            <path d={`M${cx-12},102 Q${cx},110 ${cx+12},105`} fill="white" />
            <ellipse cx={cx} cy={106} rx="10" ry="7" fill="white" />
            <circle cx={cx} cy={106} r="5" fill={eyeC} />
            <circle cx={cx} cy={106} r="2.5" fill="#111" />
          </g>
        );
      case 7: // stars
        return (
          <g key={cx} transform={t}>
            <text x={cx-8} y={113} fontSize="16" textAnchor="middle">⭐</text>
          </g>
        );
      default: // 0: normal
        return (
          <g key={cx} transform={t}>
            <ellipse cx={cx} cy={106} rx="11" ry="8" fill="white" />
            <circle cx={cx} cy={106} r="5.5" fill={eyeC} />
            <circle cx={cx} cy={106} r="3" fill="#111" />
            <circle cx={cx+2} cy={104} r="1.5" fill="white" opacity="0.8" />
          </g>
        );
    }
  }

  // ── Eyebrows ──────────────────────────────────────────────────────────────
  function renderBrow(cx: number, flip = false) {
    const t = flip ? `scale(-1 1) translate(-200,0)` : undefined;
    const sw = opts.browStyle === 1 ? 5 : opts.browStyle === 2 ? 2 : 3.5;
    const paths: Record<number,string> = {
      0: `M${cx-12} 93 Q${cx} 88 ${cx+12} 92`,
      1: `M${cx-13} 93 Q${cx} 85 ${cx+13} 91`,
      2: `M${cx-10} 93 Q${cx} 90 ${cx+10} 92`,
      3: `M${cx-12} 95 Q${cx} 87 ${cx+12} 92`,
      4: `M${cx-12} 90 Q${cx} 94 ${cx+12} 95`,
      5: `M${cx-12} 96 Q${cx} 86 ${cx+12} 93`,
    };
    return (
      <path key={cx} transform={t} d={paths[opts.browStyle] || paths[0]}
        fill="none" stroke={browC} strokeWidth={sw} strokeLinecap="round" />
    );
  }

  // ── Nose ──────────────────────────────────────────────────────────────────
  const noseEl = (
    <g>
      <circle cx="94" cy="125" r="2.8" fill={sd} />
      <circle cx="106" cy="125" r="2.8" fill={sd} />
      <path d="M94 118 Q100 122 106 118" fill="none" stroke={sd} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );

  // ── Mouth ─────────────────────────────────────────────────────────────────
  const mouths: Record<number, React.ReactElement> = {
    0: <path d="M88 142 Q100 143 112 142" fill="none" stroke={lip} strokeWidth="2.5" strokeLinecap="round" />,
    1: <path d="M87 140 Q100 150 113 140" fill="none" stroke={lip} strokeWidth="3" strokeLinecap="round" />,
    2: (
      <g>
        <path d="M85 139 Q100 154 115 139" fill={lip} />
        <path d="M90 140 Q100 148 110 140" fill="white" />
      </g>
    ),
    3: <path d="M88 141 Q95 147 112 138" fill="none" stroke={lip} strokeWidth="2.5" strokeLinecap="round" />,
    4: (
      <g>
        <ellipse cx="100" cy="143" rx="14" ry="7" fill={lip} />
        <ellipse cx="100" cy="143" rx="10" ry="4" fill="#222" />
      </g>
    ),
    5: (
      <g>
        {/* Dark mouth interior */}
        <path d="M86 140 Q100 153 114 140 Q108 147 100 148 Q92 147 86 140" fill="#1A0A0A" />
        {/* Upper lip */}
        <path d="M86 140 Q92 136 100 138 Q108 136 114 140" fill={lip} stroke={lip} strokeWidth="1" />
        {/* Lower lip */}
        <path d="M86 140 Q100 152 114 140" fill="none" stroke={lip} strokeWidth="2.5" strokeLinecap="round" />
        {/* Teeth row */}
        <path d="M88 140 Q100 148 112 140 L110 143 Q100 146 90 143 Z" fill="white" />
        {/* Left fang */}
        <polygon points="93,141 97,141 94.5,152" fill="white" />
        {/* Right fang */}
        <polygon points="103,141 107,141 105.5,152" fill="white" />
        {/* Fang shading */}
        <polygon points="96,141 97,141 94.5,152" fill="rgba(180,180,200,0.4)" />
        <polygon points="106,141 107,141 105.5,152" fill="rgba(180,180,200,0.4)" />
      </g>
    ),
  };

  // ── Facial Hair ───────────────────────────────────────────────────────────
  const facialHairs: Record<number, React.ReactElement | null> = {
    0: null,
    1: <ellipse cx="100" cy="148" rx="22" ry="8" fill={browC} opacity="0.35" />,
    2: (
      <g>
        <path d="M91 148 Q100 162 109 148" fill={browC} opacity="0.85" />
        <ellipse cx="100" cy="141" rx="8" ry="5" fill={browC} opacity="0.6" />
      </g>
    ),
    3: (
      <g>
        <path d="M78 140 Q100 175 122 140 Q100 165 78 140" fill={browC} opacity="0.85" />
        <ellipse cx="100" cy="142" rx="18" ry="8" fill={browC} opacity="0.7" />
      </g>
    ),
    4: <path d="M82 138 Q100 132 118 138 Q100 148 82 138" fill={browC} opacity="0.85" />,
    5: (
      <g>
        <ellipse cx="100" cy="150" rx="25" ry="12" fill={browC} opacity="0.9" />
        {[0,1,2,3,4,5].map(i => (
          <path key={i} d={`M${75+i*10},150 Q${80+i*10},${170+i*3} ${75+i*10},${180+i*2}`}
            fill="none" stroke={browC} strokeWidth="3" strokeLinecap="round" />
        ))}
      </g>
    ),
  };

  // ── Clothing ──────────────────────────────────────────────────────────────
  function renderClothing(id: number) {
    const cc2 = clothC;
    const ccd = `color-mix(in srgb,${cc2} 70%,black)`;
    switch(id) {
      case 2: // suit
        return (
          <g>
            <path d={`M35 190 Q50 175 80 172 L100 195 L120 172 Q150 175 165 190 L170 260 L30 260 Z`} fill={cc2} />
            <path d={`M80 172 Q100 200 120 172 L118 180 L100 198 L82 180 Z`} fill="white" />
            <path d={`M98 180 L100 230 L102 180`} fill={cc2} />
          </g>
        );
      case 3: // mage robes
        return (
          <g>
            <path d={`M20 195 Q45 170 75 168 L100 188 L125 168 Q155 170 180 195 L185 260 L15 260 Z`} fill={cc2} />
            <path d={`M20 195 L15 260`} fill={`color-mix(in srgb,${cc2} 80%,black)`} />
            <path d={`M180 195 L185 260`} fill={`color-mix(in srgb,${cc2} 80%,black)`} />
            <circle cx="100" cy="183" r="6" fill="#FFD700" />
            <path d={`M94 183 L106 183 L108 192 L100 196 L92 192 Z`} fill="#FFD700" />
          </g>
        );
      case 4: // leather armor
        return (
          <g>
            <path d={`M30 185 Q55 168 80 166 L100 185 L120 166 Q145 168 170 185 L172 260 L28 260 Z`} fill={cc2} />
            {/* shoulder pads */}
            <ellipse cx="68" cy="173" rx="18" ry="10" fill={ccd} />
            <ellipse cx="132" cy="173" rx="18" ry="10" fill={ccd} />
            {/* buckle */}
            <rect x="94" y="185" width="12" height="8" rx="2" fill="#C8A600" />
          </g>
        );
      case 5: // chainmail
        return (
          <g>
            <path d={`M30 185 Q55 168 80 166 L100 185 L120 166 Q145 168 170 185 L172 260 L28 260 Z`} fill={cc2} />
            {/* chain pattern */}
            {Array.from({length:5}).map((_,row) => Array.from({length:8}).map((_2,col) => (
              <ellipse key={`${row}-${col}`}
                cx={38 + col*16 + (row%2)*8} cy={185 + row*14}
                rx="6" ry="4" fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            )))}
            <ellipse cx="68" cy="172" rx="20" ry="11" fill={ccd} />
            <ellipse cx="132" cy="172" rx="20" ry="11" fill={ccd} />
          </g>
        );
      case 6: // plate armor
        return (
          <g>
            <path d={`M28 183 Q52 162 78 160 L100 182 L122 160 Q148 162 172 183 L174 260 L26 260 Z`} fill={cc2} />
            {/* chest plate */}
            <path d={`M70 170 Q100 190 130 170 L125 220 Q100 230 75 220 Z`} fill={`color-mix(in srgb,${cc2} 90%,white)`} />
            {/* pauldrons */}
            <path d={`M52 160 Q40 155 35 170 Q45 175 60 172`} fill={ccd} />
            <path d={`M148 160 Q160 155 165 170 Q155 175 140 172`} fill={ccd} />
            {/* center line */}
            <line x1="100" y1="178" x2="100" y2="228" stroke={ccd} strokeWidth="2" />
          </g>
        );
      case 7: // ranger cloak
        return (
          <g>
            <path d={`M20 182 Q50 165 80 162 L100 180 L120 162 Q150 165 180 182 L190 260 L10 260 Z`} fill={cc2} />
            {/* hood hanging down back */}
            <path d={`M65 162 Q100 155 135 162 Q130 180 100 185 Q70 180 65 162`} fill={ccd} />
          </g>
        );
      case 8: // paladin  
        return (
          <g>
            <path d={`M28 183 Q52 162 78 160 L100 182 L122 160 Q148 162 172 183 L174 260 L26 260 Z`} fill={cc2} />
            <path d={`M70 168 Q100 185 130 168 L125 215 Q100 225 75 215 Z`} fill="white" />
            {/* cross */}
            <rect x="96" y="178" width="8" height="30" fill="#C8A600" />
            <rect x="86" y="188" width="28" height="8" fill="#C8A600" />
            <ellipse cx="64" cy="168" rx="20" ry="12" fill={ccd} />
            <ellipse cx="136" cy="168" rx="20" ry="12" fill={ccd} />
          </g>
        );
      case 9: // druid vest
        return (
          <g>
            <path d={`M32 185 Q56 168 82 166 L100 183 L118 166 Q144 168 168 185 L170 260 L30 260 Z`} fill={cc2} />
            {/* leaf patterns */}
            {[[60,190],[85,175],[115,175],[140,190],[75,208],[125,208]].map(([x,y],i) => (
              <path key={i} d={`M${x},${y} Q${x+6},${y-8} ${x+4},${y+4} Z`} fill="rgba(80,180,80,0.5)" />
            ))}
          </g>
        );
      default: // 0: t-shirt / 1: hoodie
        return (
          <g>
            <path d={`M35 188 Q58 172 82 170 L100 188 L118 170 Q142 172 165 188 L168 260 L32 260 Z`} fill={cc2} />
            {id === 1 && (
              <path d={`M65 170 Q100 162 135 170 Q128 185 100 190 Q72 185 65 170`} fill={ccd} />
            )}
          </g>
        );
    }
  }

  // ── Helmet / Hat ─────────────────────────────────────────────────────────
  const helmets: Record<number, React.ReactElement | null> = {
    0: null,
    1: ( // wizard hat — brim sits at hairline (y≈90), cone rises to y≈10
      <g>
        {/* Cone shadow */}
        <path d="M63 92 Q100 10 137 92" fill="#1E0840" />
        {/* Cone main */}
        <path d="M58 90 Q100 12 142 90 L148 98 Q100 90 52 98 Z" fill="#3D1280" />
        {/* Brim */}
        <ellipse cx="100" cy="95" rx="52" ry="11" fill="#3D1280" />
        <ellipse cx="100" cy="93" rx="48" ry="8" fill="#5020A0" />
        {/* Gem at tip */}
        <circle cx="100" cy="18" r="7" fill="#FFD700" style={{filter:'drop-shadow(0 0 6px #FFD700)'}} />
        <circle cx="100" cy="18" r="4" fill="#FFF8A0" />
        {/* Stars on cone */}
        {[[82,50],[118,58],[92,68],[108,42]].map(([x,y],i) => (
          <text key={i} x={x} y={y} fontSize="9" textAnchor="middle">⭐</text>
        ))}
      </g>
    ),
    2: ( // knight helmet — shell from head-top (y≈38) down to just above brows
      <g>
        {/* Main shell */}
        <path d="M47 138 Q42 55 100 38 Q158 55 153 138 Q148 80 100 65 Q52 80 47 138" fill="#607080" />
        {/* Inner face-opening shadow */}
        <path d="M50 120 Q47 85 100 76 Q153 85 150 120" fill="#546070" />
        {/* Cheek plates */}
        <path d="M47 138 Q44 120 50 110 Q56 100 58 110 L55 130" fill="#50616F" />
        <path d="M153 138 Q156 120 150 110 Q144 100 142 110 L145 130" fill="#50616F" />
        {/* Visor slits */}
        {[-6,3,12,21].map((dy,i) => (
          <line key={i} x1="58" y1={98+dy} x2="142" y2={98+dy}
            stroke="rgba(0,0,0,0.55)" strokeWidth="2.5" />
        ))}
        {/* Top ridge */}
        <path d="M46 62 Q100 46 154 62 Q150 50 100 38 Q50 50 46 62" fill="#4A5568" />
      </g>
    ),
    3: ( // crown
      <g>
        <path d="M62 73 L62 55 L76 68 L100 48 L124 68 L138 55 L138 73 Z" fill="#C8A600" />
        <path d="M60 72 Q100 78 140 72 L138 82 Q100 88 62 82 Z" fill="#C8A600" />
        {[[100,52],[76,68],[124,68]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="5" fill={['#FF4444','#4444FF','#44BB44'][i]} />
        ))}
      </g>
    ),
    4: ( // circlet
      <g>
        <path d="M48 95 Q100 82 152 95 Q148 100 100 87 Q52 100 48 95" fill="#C8A600" />
        <circle cx="100" cy="88" r="7" fill="#44AAFF" style={{filter:'drop-shadow(0 0 4px #44AAFF)'}} />
      </g>
    ),
    5: ( // horned helmet — shell from head-top (y≈40) with horns sprouting from upper sides
      <g>
        {/* Main shell */}
        <path d="M48 132 Q42 56 100 40 Q158 56 152 132 Q148 76 100 62 Q52 76 48 132" fill="#4A4A4A" />
        {/* Horn bases on sides of head */}
        <path d="M52 78 Q36 42 46 14 Q54 38 66 70" fill="#8B7355" />
        <path d="M148 78 Q164 42 154 14 Q146 38 134 70" fill="#8B7355" />
        {/* Horn shading */}
        <path d="M52 78 Q42 55 46 30 Q48 48 54 65" fill="rgba(0,0,0,0.2)" />
        <path d="M148 78 Q158 55 154 30 Q152 48 146 65" fill="rgba(0,0,0,0.2)" />
        {/* Top rim of helm */}
        <path d="M50 70 Q100 56 150 70 Q148 58 100 46 Q52 58 50 70" fill="#3A3A3A" />
      </g>
    ),
    6: ( // baseball cap — dome from head-top (y≈44) with brim at hairline (y≈90)
      <g>
        {/* Cap dome */}
        <path d="M44 90 Q42 48 100 42 Q158 48 156 90 Q140 76 100 70 Q60 76 44 90" fill="#2244AA" />
        {/* Button on top */}
        <circle cx="100" cy="44" r="5" fill="#1A3388" />
        {/* Panel stitching lines */}
        <path d="M100 44 Q85 62 84 88" fill="none" stroke="#1A3388" strokeWidth="1" opacity="0.6" />
        <path d="M100 44 Q115 62 116 88" fill="none" stroke="#1A3388" strokeWidth="1" opacity="0.6" />
        {/* Brim */}
        <path d="M40 88 Q100 82 160 88 L158 95 Q100 89 42 95 Z" fill="#1A3388" />
        {/* Front peak extension */}
        <path d="M28 93 Q38 88 44 90 L42 97 Q36 95 26 98 Z" fill="#1A3388" />
      </g>
    ),
    7: ( // hood — covers from head-top down, deep shadows at sides
      <g>
        {/* Hood body */}
        <path d="M40 142 Q36 52 100 38 Q164 52 160 142 Q150 78 100 64 Q50 78 40 142" fill="#2A2A3A" />
        {/* Left deep shadow fold */}
        <path d="M40 142 Q37 118 52 106 Q65 98 70 108" fill="#1A1A28" />
        {/* Right deep shadow fold */}
        <path d="M160 142 Q163 118 148 106 Q135 98 130 108" fill="#1A1A28" />
        {/* Inner rim at face opening */}
        <path d="M55 66 Q100 52 145 66 Q100 54 55 66" fill="#1A1A28" />
        {/* Fabric crease top */}
        <path d="M62 46 Q100 38 138 46" fill="none" stroke="#1A1A28" strokeWidth="2" opacity="0.6" />
      </g>
    ),
    8: ( // bandana
      <g>
        <path d="M46 100 Q100 88 154 100 L154 115 Q100 105 46 115 Z" fill="#AA2222" />
        <path d="M46 100 Q36 98 32 105 Q40 112 46 115" fill="#AA2222" />
        {/* knot on side */}
        <circle cx="34" cy="108" r="7" fill="#882222" />
        <path d="M28 108 Q32 100 36 105 Q30 112 28 108" fill="#882222" />
      </g>
    ),
    9: ( // tiara  
      <g>
        <path d="M62 90 Q100 80 138 90 Q130 86 100 82 Q70 86 62 90" fill="#D4AF37" />
        <path d="M96 84 L100 72 L104 84" fill="#D4AF37" />
        <circle cx="100" cy="70" r="5" fill="#FF69B4" style={{filter:'drop-shadow(0 0 4px #FF69B4)'}} />
        {[[-16,85],[16,85]].map(([dx,y],i) => (
          <g key={i}>
            <path d={`M${100+dx-2},${y} L${100+dx},${y-8} L${100+dx+2},${y}`} fill="#D4AF37" />
            <circle cx={100+dx} cy={y-9} r="3" fill="#88DDFF" />
          </g>
        ))}
      </g>
    ),
  };

  // ── Weapon ────────────────────────────────────────────────────────────────
  const weapons: Record<number, React.ReactElement | null> = {
    0: null,
    1: ( // sword
      <g transform="translate(148,50)">
        <line x1="15" y1="0" x2="15" y2="90" stroke="#AAB0B8" strokeWidth="5" strokeLinecap="round" />
        <line x1="3" y1="25" x2="27" y2="25" stroke="#8B7355" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="15" cy="95" rx="7" ry="8" fill="#8B7355" />
        <path d="M12 0 L18 0 L15 -15 Z" fill="#E0E8F0" />
      </g>
    ),
    2: ( // staff
      <g transform="translate(155,40)">
        <line x1="8" y1="15" x2="8" y2="120" stroke="#8B6914" strokeWidth="6" strokeLinecap="round" />
        <circle cx="8" cy="10" r="12" fill="#4A0E82" style={{filter:'drop-shadow(0 0 6px #8844FF)'}} />
        <circle cx="8" cy="10" r="7" fill="#AA66FF" />
        <circle cx="8" cy="10" r="3" fill="white" opacity="0.8" />
      </g>
    ),
    3: ( // bow
      <g transform="translate(152,45)">
        <path d="M8 10 Q28 60 8 110" fill="none" stroke="#8B6914" strokeWidth="4" strokeLinecap="round" />
        <line x1="8.5" y1="12" x2="8.5" y2="108" stroke="#D4C4A0" strokeWidth="1.5" />
        <line x1="15" y1="60" x2="55" y2="60" stroke="#D4C4A0" strokeWidth="2" />
        <path d="M55 55 L60 60 L55 65 Z" fill="#C8A600" />
      </g>
    ),
    4: ( // dagger
      <g transform="translate(152,60)" style={{transform:'translate(152px,60px) rotate(-30deg)', transformOrigin:'152px 60px'}}>
        <path d="M12 0 L16 0 L14 55 Z" fill="#C0C8D0" />
        <line x1="7" y1="52" x2="21" y2="52" stroke="#8B7355" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="14" cy="60" rx="5" ry="7" fill="#8B7355" />
      </g>
    ),
    5: ( // axe
      <g transform="translate(148,48)">
        <line x1="16" y1="0" x2="16" y2="95" stroke="#8B6914" strokeWidth="5" strokeLinecap="round" />
        <path d="M16 8 Q35 12 38 30 Q38 50 16 48 Q24 35 24 28 Q22 18 16 8" fill="#888" />
        <path d="M16 8 Q2 20 5 38 Q8 50 16 48 Q10 35 10 28 Q10 18 16 8" fill="#666" />
      </g>
    ),
    6: ( // wand
      <g transform="translate(155,55)">
        <line x1="10" y1="15" x2="10" y2="105" stroke="#6B3A1F" strokeWidth="4" strokeLinecap="round" />
        <text x="3" y="18" fontSize="18">✨</text>
      </g>
    ),
    7: ( // shield
      <g transform="translate(145,68)">
        <path d="M10 5 Q2 5 2 20 L2 55 Q2 75 18 85 Q34 75 34 55 L34 20 Q34 5 26 5 Z" fill="#446688" />
        <path d="M16 15 Q10 20 10 35 L10 55 Q10 65 18 72 Q26 65 26 55 L26 35 Q26 20 20 15 Z" fill="#557799" opacity="0.5" />
        <line x1="18" y1="10" x2="18" y2="78" stroke="#C8A600" strokeWidth="2" />
        <line x1="5" y1="40" x2="31" y2="40" stroke="#C8A600" strokeWidth="2" />
      </g>
    ),
    8: ( // scythe
      <g transform="translate(148,38)">
        <line x1="14" y1="0" x2="14" y2="115" stroke="#4A3A3A" strokeWidth="5" strokeLinecap="round" />
        <path d="M14 5 Q45 2 48 22 Q50 40 25 42 Q38 30 35 18 Q28 8 14 8" fill="#888" />
        <ellipse cx="14" cy="118" rx="6" ry="8" fill="#3A3A3A" />
      </g>
    ),
    9: ( // tome
      <g transform="translate(145,70)">
        <rect x="2" y="5" width="36" height="48" rx="3" fill="#4A1A0A" />
        <rect x="5" y="8" width="30" height="42" rx="2" fill="#6A2A10" />
        <text x="11" y="38" fontSize="22">📖</text>
        <rect x="2" y="5" width="6" height="48" rx="2" fill="#3A1008" />
      </g>
    ),
  };

  // ── Background gradient defs ─────────────────────────────────────────────
  const bgEl = bg.type === 'gradient' && bg.from && bg.to ? (
    <>
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.from} />
          <stop offset="100%" stopColor={bg.to} />
        </linearGradient>
        {aura.id !== 'none' && (
          <radialGradient id="auraGrad" cx="50%" cy="45%" r="45%">
            <stop offset="0%" stopColor={aura.color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={aura.color} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <rect x="0" y="0" width="200" height="260" fill="url(#bgGrad)" />
    </>
  ) : (
    <>
      {aura.id !== 'none' && (
        <defs>
          <radialGradient id="auraGrad" cx="50%" cy="45%" r="45%">
            <stop offset="0%" stopColor={aura.color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={aura.color} stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      <rect x="0" y="0" width="200" height="260" fill={bg.color} />
    </>
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 260"
      width="200"
      height="260"
      style={{ display: 'block' }}
    >
      {/* Background */}
      {bgEl}

      {/* Aura */}
      {aura.id !== 'none' && (
        <ellipse cx="100" cy="120" rx="88" ry="110" fill="url(#auraGrad)" />
      )}

      {/* Stars / particles for certain backgrounds */}
      {['twilight','midnight','shadow','shadow','holy'].includes(opts.background) && (
        <g opacity="0.5">
          {[[20,20],[50,35],[80,15],[130,25],[160,18],[175,40],[170,65]].map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.5" fill="white" />
          ))}
        </g>
      )}

      {/* Weapon (behind body, in right area) */}
      {weapons[opts.weapon]}

      {/* Clothing / body */}
      {renderClothing(opts.clothing)}

      {/* Neck */}
      <path d={`M86 156 Q86 172 82 180 Q100 188 118 180 Q114 172 114 156`} fill={s} />

      {/* Head */}
      <ellipse cx="100" cy="110" rx="64" ry="75" fill={s} />

      {/* Head shading */}
      <ellipse cx="120" cy="100" rx="30" ry="40" fill={sd} opacity="0.18" />

      {/* Hair — drawn after head so it sits on top, but before ears so ears clip the sides */}
      {opts.hairStyle !== 0 && hairPaths[opts.hairStyle]}

      {/* Ears — drawn AFTER hair so they always appear in front (no hair-through-ear bug) */}
      <ellipse cx="38" cy="112" rx="11" ry="16" fill={s} />
      <ellipse cx="162" cy="112" rx="11" ry="16" fill={s} />
      <ellipse cx="38" cy="112" rx="6" ry="11" fill={sd} />
      <ellipse cx="162" cy="112" rx="6" ry="11" fill={sd} />

      {/* Eyebrows — both use cx=72; flip=true mirrors about x=100 → lands at x=128 */}
      {renderBrow(72)}
      {renderBrow(72, true)}

      {/* Eyes */}
      {renderEye(72)}
      {renderEye(72, true)}

      {/* Nose */}
      {noseEl}

      {/* Mouth */}
      {mouths[opts.mouthStyle] || mouths[0]}

      {/* Facial hair */}
      {facialHairs[opts.facialHair]}

      {/* Helmet / hat (on top of everything) */}
      {helmets[opts.helmet]}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = ['Face', 'Hair', 'Style', 'Equipment', 'World'] as const;
type Tab = typeof TABS[number];

const AvatarCreator: React.FC<Props> = ({ onApply, onClose, initialOptions }) => {
  const [opts, setOpts] = useState<AvatarOptions>({ ...DEFAULT_OPTIONS, ...initialOptions });
  const [activeTab, setActiveTab] = useState<Tab>('Face');
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const set = useCallback(<K extends keyof AvatarOptions>(key: K, val: AvatarOptions[K]) => {
    setOpts(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleApply = async () => {
    setSaving(true);
    try {
      const svgEl = svgRef.current?.querySelector('svg');
      if (!svgEl) return;

      // Serialize SVG → data URL
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
      onApply(encoded, opts);
    } finally {
      setSaving(false);
    }
  };

  const skinObj = SKIN_TONES.find(s => s.id === opts.skin);

  return (
    <div className="avatar-creator-overlay" onClick={onClose}>
      <div className="avatar-creator-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ac-header">
          <h2>⚔️ Avatar Creator</h2>
          <p className="ac-subtitle">Build your legend — D&D ready</p>
          <button className="ac-close" onClick={onClose}>✕</button>
        </div>

        <div className="ac-body">
          {/* Preview */}
          <div className="ac-preview">
            <div className="ac-preview-frame" ref={svgRef}>
              <AvatarSVG opts={opts} />
            </div>
            <div className="ac-preview-info">
              <div className="ac-stat-badge">
                <span className="stat-label">Race</span>
                <span className="stat-value">{skinObj?.label?.replace(/^[^\w]*/, '') || 'Human'}</span>
              </div>
              <div className="ac-stat-badge">
                <span className="stat-label">Weapon</span>
                <span className="stat-value">{WEAPONS[opts.weapon]?.label}</span>
              </div>
            </div>
            <button className="ac-apply-btn" onClick={handleApply} disabled={saving}>
              {saving ? '✨ Applying…' : '✅ Use as Avatar'}
            </button>
          </div>

          {/* Panel */}
          <div className="ac-panel">
            {/* Tabs */}
            <div className="ac-tabs">
              {TABS.map(t => (
                <button key={t} className={`ac-tab ${activeTab === t ? 'active' : ''}`}
                  onClick={() => setActiveTab(t)}>
                  {t === 'Face' ? '😶' : t === 'Hair' ? '💇' : t === 'Style' ? '👕'
                    : t === 'Equipment' ? '⚔️' : '🌍'} {t}
                </button>
              ))}
            </div>

            <div className="ac-tab-content">
              {/* ── FACE TAB ─────────────────────────────────────────────── */}
              {activeTab === 'Face' && (
                <div className="ac-section-group">
                  <section className="ac-section">
                    <h4>Skin / Race</h4>
                    <div className="ac-swatch-grid">
                      {SKIN_TONES.map(s => (
                        <button key={s.id} title={s.label}
                          className={`swatch-btn skin-swatch ${opts.skin === s.id ? 'selected' : ''}`}
                          style={{ background: s.color }}
                          onClick={() => set('skin', s.id)}>
                          {s.id !== 'fair' && s.label.includes('🌿') ? '🌿' :
                           s.label.includes('💀') ? '💀' : s.label.includes('✨') ? '✨' :
                           s.label.includes('🐉') ? '🐉' : ''}
                        </button>
                      ))}
                    </div>
                    <div className="ac-swatch-labels">
                      {SKIN_TONES.map(s => (
                        <span key={s.id} className={`swatch-label ${opts.skin === s.id ? 'active' : ''}`}
                          onClick={() => set('skin', s.id)}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Eye Style</h4>
                    <div className="ac-option-chips">
                      {EYE_STYLES.map(e => (
                        <button key={e.id} className={`chip ${opts.eyeStyle === e.id ? 'selected' : ''}`}
                          onClick={() => set('eyeStyle', e.id)}>
                          {e.icon} {e.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Eye Color</h4>
                    <div className="ac-swatch-grid">
                      {EYE_COLORS.map(e => (
                        <button key={e.id} title={e.id}
                          className={`swatch-btn ${opts.eyeColor === e.id ? 'selected' : ''}`}
                          style={{ background: e.color }}
                          onClick={() => set('eyeColor', e.id)} />
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Eyebrows</h4>
                    <div className="ac-option-chips">
                      {BROW_STYLES.map(b => (
                        <button key={b.id} className={`chip ${opts.browStyle === b.id ? 'selected' : ''}`}
                          onClick={() => set('browStyle', b.id)}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Expression</h4>
                    <div className="ac-option-chips">
                      {MOUTH_STYLES.map(m => (
                        <button key={m.id} className={`chip ${opts.mouthStyle === m.id ? 'selected' : ''}`}
                          onClick={() => set('mouthStyle', m.id)}>
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Facial Hair</h4>
                    <div className="ac-option-chips">
                      {FACIAL_HAIR.map(f => (
                        <button key={f.id} className={`chip ${opts.facialHair === f.id ? 'selected' : ''}`}
                          onClick={() => set('facialHair', f.id)}>
                          {f.icon} {f.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* ── HAIR TAB ─────────────────────────────────────────────── */}
              {activeTab === 'Hair' && (
                <div className="ac-section-group">
                  <section className="ac-section">
                    <h4>Hairstyle</h4>
                    <div className="ac-option-chips wrap">
                      {HAIR_STYLES.map(h => (
                        <button key={h.id} className={`chip ${opts.hairStyle === h.id ? 'selected' : ''}`}
                          onClick={() => set('hairStyle', h.id)}>
                          {h.icon} {h.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Hair Color</h4>
                    <div className="ac-swatch-grid wide">
                      {HAIR_COLORS.map(h => (
                        <button key={h.id} title={h.label}
                          className={`swatch-btn ${opts.hairColor === h.id ? 'selected' : ''}`}
                          style={{ background: h.color, border: h.color === '#F5F5F0' ? '1px solid #555' : undefined }}
                          onClick={() => set('hairColor', h.id)} />
                      ))}
                    </div>
                    <div className="hair-color-name">
                      {HAIR_COLORS.find(h => h.id === opts.hairColor)?.label}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Brow Color</h4>
                    <div className="ac-option-chips">
                      <button className={`chip ${opts.browColor === 'match' ? 'selected' : ''}`}
                        onClick={() => set('browColor', 'match')}>
                        🔗 Match Hair
                      </button>
                      {HAIR_COLORS.slice(0, 6).map(h => (
                        <button key={h.id}
                          className={`chip swatch-chip ${opts.browColor === h.id ? 'selected' : ''}`}
                          style={{ '--chip-accent': h.color } as React.CSSProperties}
                          onClick={() => set('browColor', h.id)}>
                          <span className="chip-dot" style={{ background: h.color }} />
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* ── STYLE TAB ────────────────────────────────────────────── */}
              {activeTab === 'Style' && (
                <div className="ac-section-group">
                  <section className="ac-section">
                    <h4>Clothing</h4>
                    <div className="ac-option-chips wrap">
                      {CLOTHING.map(c => (
                        <button key={c.id}
                          className={`chip clothing-chip ${opts.clothing === c.id ? 'selected' : ''}`}
                          onClick={() => {
                            set('clothing', c.id);
                            set('clothingColor', c.color);
                          }}>
                          {c.icon} {c.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Clothing Color Override</h4>
                    <div className="ac-color-palette">
                      {['#3A7BD5','#CC3333','#228833','#C8A600','#7722AA','#222244','#555','#C8A600','#1A3A1A','#4A1A0A'].map(c => (
                        <button key={c} className={`palette-btn ${opts.clothingColor === c ? 'selected' : ''}`}
                          style={{ background: c }} onClick={() => set('clothingColor', c)} />
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Background</h4>
                    <div className="ac-option-chips wrap">
                      {BACKGROUNDS.map(b => (
                        <button key={b.id}
                          className={`chip bg-chip ${opts.background === b.id ? 'selected' : ''}`}
                          style={{ '--bg-from': b.from || b.color, '--bg-to': b.to || b.color } as React.CSSProperties}
                          onClick={() => set('background', b.id)}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* ── EQUIPMENT TAB ────────────────────────────────────────── */}
              {activeTab === 'Equipment' && (
                <div className="ac-section-group">
                  <section className="ac-section">
                    <h4>Helmet / Headwear</h4>
                    <div className="ac-option-chips wrap">
                      {HELMETS.map(h => (
                        <button key={h.id} className={`chip ${opts.helmet === h.id ? 'selected' : ''}`}
                          onClick={() => set('helmet', h.id)}>
                          {h.icon} {h.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>Weapon</h4>
                    <div className="ac-option-chips wrap">
                      {WEAPONS.map(w => (
                        <button key={w.id} className={`chip ${opts.weapon === w.id ? 'selected' : ''}`}
                          onClick={() => set('weapon', w.id)}>
                          {w.icon} {w.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className="ac-dnd-tip">
                    <span>🎲</span>
                    <span>Equipment choices will be available as metadata for D&D character sheets in a future update.</span>
                  </div>
                </div>
              )}

              {/* ── WORLD TAB ────────────────────────────────────────────── */}
              {activeTab === 'World' && (
                <div className="ac-section-group">
                  <section className="ac-section">
                    <h4>✨ Aura / Magic Effect</h4>
                    <div className="ac-option-chips wrap">
                      {AURAS.map(a => (
                        <button key={a.id}
                          className={`chip aura-chip ${opts.aura === a.id ? 'selected' : ''}`}
                          style={{ '--aura-color': a.color } as React.CSSProperties}
                          onClick={() => set('aura', a.id)}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="ac-section">
                    <h4>🎲 Quick Classes</h4>
                    <p className="ac-hint">Apply a preset — you can still customize after.</p>
                    <div className="ac-class-presets">
                      {[
                        { label:'🧙 Wizard', skin:'fair', hair:9, hairC:'white', eye:4, eyeC:'violet', cloth:3, helm:1, weapon:2, aura:'arcane', bg:'twilight', fh:0 },
                        { label:'⚔️ Fighter', skin:'medium', hair:2, hairC:'darkbrown', eye:0, eyeC:'brown', cloth:6, helm:2, weapon:1, aura:'none', bg:'dungeon', fh:1 },
                        { label:'🏹 Ranger', skin:'tan', hair:4, hairC:'brown', eye:1, eyeC:'green', cloth:7, helm:0, weapon:3, aura:'nature', bg:'forest', fh:2 },
                        { label:'🗡️ Rogue', skin:'light', hair:7, hairC:'black', eye:5, eyeC:'gray', cloth:4, helm:8, weapon:4, aura:'shadow', bg:'shadow', fh:0 },
                        { label:'✨ Paladin', skin:'fair', hair:3, hairC:'blonde', eye:4, eyeC:'gold', cloth:8, helm:3, weapon:7, aura:'holy', bg:'holy', fh:0 },
                        { label:'🌿 Druid', skin:'tan', hair:10, hairC:'auburn', eye:3, eyeC:'green', cloth:9, helm:0, weapon:6, aura:'nature', bg:'forest', fh:3 },
                        { label:'🧛 Vampire', skin:'undead', hair:4, hairC:'black', eye:6, eyeC:'red', cloth:2, helm:0, weapon:8, aura:'blood', bg:'shadow', fh:0 },
                        { label:'🐉 Dragonborn', skin:'dragonborn', hair:0, hairC:'black', eye:4, eyeC:'gold', cloth:6, helm:5, weapon:1, aura:'fire', bg:'volcano', fh:0 },
                        { label:'🌿 Orc', skin:'orc', hair:1, hairC:'black', eye:6, eyeC:'red', cloth:5, helm:5, weapon:5, aura:'none', bg:'dungeon', fh:3 },
                      ].map(preset => (
                        <button key={preset.label} className="class-preset-btn"
                          onClick={() => setOpts({
                            skin: preset.skin, hairStyle: preset.hair, hairColor: preset.hairC,
                            eyeStyle: preset.eye, eyeColor: preset.eyeC, browStyle: 0,
                            browColor: 'match', mouthStyle: 1, facialHair: preset.fh,
                            clothing: preset.cloth, clothingColor: CLOTHING[preset.cloth]?.color || '',
                            helmet: preset.helm, weapon: preset.weapon,
                            background: preset.bg, aura: preset.aura,
                          })}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarCreator;
