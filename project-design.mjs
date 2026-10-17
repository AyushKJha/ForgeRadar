export const DESIGN_STYLES=['glassmorphism','neumorphism','minimalism','aesthetic','maximalism','retro','editorial','brutalism'];
export const DESIGN_PALETTES=['aurora','ember','ocean','orchid','forest','mono','citrus','rose'];
export const DESIGN_MOTIONS=['subtle','playful','cinematic','none'];

export function normalizeProjectDesign(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid project design');
  const style=input.style||'glassmorphism',palette=input.palette||'aurora',motion=input.motion||'subtle';
  if(!DESIGN_STYLES.includes(style)||!DESIGN_PALETTES.includes(palette)||!DESIGN_MOTIONS.includes(motion))throw new Error('Choose a supported style, palette and motion');
  return {style,palette,motion};
}

export function designStylesheet(input){
  const {style,palette,motion}=normalizeProjectDesign(input);
  return `/* Approved project design: ${style} / ${palette} / ${motion}. */\n`+
    `:root{--bg:#0d1420;--surface:#172238;--ink:#f5f7fb;--muted:#b8c5d7;--accent:#83e0c8;--accent-ink:#08221e;--edge:#33465d;--glow:#79b8ff55;--radius:22px;--shadow:0 22px 65px #03091488;--panel-filter:none;--font:Inter,system-ui,sans-serif;--spacing:28px}`+
    `\nbody[data-palette="ember"]{--bg:#1c1118;--surface:#30202b;--ink:#fff5ec;--muted:#d9bdb6;--accent:#ffae70;--accent-ink:#341708;--edge:#65414a;--glow:#ff884b55}`+
    `\nbody[data-palette="ocean"]{--bg:#071b28;--surface:#123349;--ink:#effaff;--muted:#bdd8e8;--accent:#71d9f5;--accent-ink:#063040;--edge:#316079;--glow:#4cc5ee55}`+
    `\nbody[data-palette="orchid"]{--bg:#170f28;--surface:#291c43;--ink:#fcf5ff;--muted:#d7c8e5;--accent:#dda5ff;--accent-ink:#30103f;--edge:#66447d;--glow:#bd72ec55}`+
    `\nbody[data-palette="forest"]{--bg:#0e1c19;--surface:#1b352e;--ink:#f0fff7;--muted:#bbd4c8;--accent:#a5e6ad;--accent-ink:#12311b;--edge:#406557;--glow:#83d39255}`+
    `\nbody[data-palette="mono"]{--bg:#111214;--surface:#24272b;--ink:#fbfbf9;--muted:#c7c8c7;--accent:#f1efe7;--accent-ink:#161719;--edge:#55595d;--glow:#eeeeee33}`+
    `\nbody[data-palette="citrus"]{--bg:#1e1b0d;--surface:#35331d;--ink:#ffffeb;--muted:#e2ddaa;--accent:#e6f47c;--accent-ink:#283009;--edge:#777545;--glow:#e0ea6d55}`+
    `\nbody[data-palette="rose"]{--bg:#23121d;--surface:#3c2336;--ink:#fff2f8;--muted:#e5bdcf;--accent:#ff9acb;--accent-ink:#40162b;--edge:#7b4965;--glow:#fa87bf55}`+
    `\nbody[data-style="glassmorphism"]{--panel-filter:blur(20px);--shadow:0 24px 80px #0006}`+
    `\nbody[data-style="glassmorphism"] .panel,body[data-style="glassmorphism"] .record{background:color-mix(in srgb,var(--surface) 68%,transparent);backdrop-filter:var(--panel-filter);border:1px solid color-mix(in srgb,var(--edge) 65%,white 18%)}`+
    `\nbody[data-style="neumorphism"]{--shadow:14px 14px 32px #0008,-10px -10px 28px #ffffff0d}`+
    `\nbody[data-style="neumorphism"] .panel,body[data-style="neumorphism"] .record{border:1px solid #ffffff0d;box-shadow:var(--shadow);background:linear-gradient(145deg,color-mix(in srgb,var(--surface) 90%,white 10%),var(--surface))}`+
    `\nbody[data-style="minimalism"]{--radius:7px;--shadow:none;--spacing:34px}`+
    `\nbody[data-style="minimalism"] .panel,body[data-style="minimalism"] .record{border-width:0 0 1px;background:transparent}`+
    `\nbody[data-style="aesthetic"]{--radius:32px;--shadow:0 30px 80px #0005;--font:Georgia,serif}`+
    `\nbody[data-style="aesthetic"] h1,body[data-style="aesthetic"] h2{font-weight:400;font-style:italic}`+
    `\nbody[data-style="maximalism"]{--radius:10px;--shadow:9px 9px 0 var(--accent);--spacing:32px}`+
    `\nbody[data-style="maximalism"] .panel,body[data-style="maximalism"] .record{border:2px solid var(--accent)}`+
    `\nbody[data-style="retro"]{--radius:3px;--shadow:5px 5px 0 #000;--font:'Courier New',monospace}`+
    `\nbody[data-style="retro"] .panel,body[data-style="retro"] .record{border:2px solid var(--ink)}`+
    `\nbody[data-style="editorial"]{--radius:1px;--shadow:none;--font:Georgia,serif}`+
    `\nbody[data-style="editorial"] .panel,body[data-style="editorial"] .record{border-top:2px solid var(--accent);border-left:0;border-right:0;background:transparent}`+
    `\nbody[data-style="brutalism"]{--radius:0;--shadow:7px 7px 0 var(--accent);--font:Arial,system-ui,sans-serif}`+
    `\nbody[data-style="brutalism"] .panel,body[data-style="brutalism"] .record{border:2px solid var(--ink)}`+
    `\nbody[data-motion="none"] *,body[data-motion="none"] *::before,body[data-motion="none"] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}`+
    `\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}\n`;
}
