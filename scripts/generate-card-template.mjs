/**
 * Generates the STAND-IN Mint Ambassador card template.
 *
 * This exists only because the real designed template has not been supplied yet. It
 * renders everything that is static on the card -- branding, title, field labels,
 * footer -- leaving the three value slots blank for src/lib/ambassador/card.ts to
 * stamp at request time.
 *
 * When the real design arrives: flatten it to templates/ambassador-card-background.jpg,
 * re-measure the boxes in src/lib/ambassador/card-config.ts against it, and delete this
 * script. The layout constants below are duplicated in card-config.ts on purpose --
 * that file is the calibration the app trusts, and it must be re-measured against
 * whatever template is actually in place rather than assuming this one.
 *
 *   node scripts/generate-card-template.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "ambassador-card-background.jpg",
);

const W = 1080;
const H = 1350;

const FONT = "Liberation Sans, DejaVu Sans, sans-serif";

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a3d2c"/>
      <stop offset="55%" stop-color="#0b2f23"/>
      <stop offset="100%" stop-color="#061f17"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="12%" r="60%">
      <stop offset="0%" stop-color="#16a34a" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#16a34a" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Oversized watermark leaf, bottom-right -->
  <g opacity="0.06" transform="translate(880 1180) scale(5.2) rotate(-18)">
    <path d="M 0 -30 C 26 -8, 22 18, 0 28 C -22 18, -26 -8, 0 -30 Z" fill="#86efac"/>
  </g>

  <!-- Badge -->
  <circle cx="540" cy="168" r="56" fill="#ffffff" fill-opacity="0.08"
          stroke="#86efac" stroke-opacity="0.55" stroke-width="2"/>
  <path d="M 540 132 C 578 160, 572 194, 540 206 C 508 194, 502 160, 540 132 Z" fill="#86efac"/>
  <path d="M 540 146 L 540 200" stroke="#0b2f23" stroke-width="3" stroke-linecap="round"/>

  <text x="540" y="276" text-anchor="middle" font-family="${FONT}" font-size="30"
        font-weight="600" letter-spacing="9" fill="#86efac">MINTREWARDS</text>

  <text x="540" y="378" text-anchor="middle" font-family="${FONT}" font-size="66"
        font-weight="700" letter-spacing="2" fill="#ffffff">MINT AMBASSADOR</text>

  <text x="540" y="420" text-anchor="middle" font-family="${FONT}" font-size="19"
        font-weight="500" letter-spacing="6" fill="#dcfce7" fill-opacity="0.72">OFFICIAL IDENTIFICATION</text>

  <rect x="480" y="450" width="120" height="4" rx="2" fill="#16a34a"/>

  <!-- Detail panel: three equal 183px rows. The value slots are deliberately left
       empty; card.ts stamps them at the baselines recorded in card-config.ts. -->
  <rect x="80" y="512" width="920" height="550" rx="28"
        fill="#ffffff" fill-opacity="0.06"
        stroke="#86efac" stroke-opacity="0.28" stroke-width="2"/>

  <text x="140" y="580" font-family="${FONT}" font-size="20" font-weight="600"
        letter-spacing="5" fill="#86efac">NAME</text>
  <rect x="140" y="695" width="800" height="2" fill="#86efac" fill-opacity="0.16"/>

  <text x="140" y="763" font-family="${FONT}" font-size="20" font-weight="600"
        letter-spacing="5" fill="#86efac">UNIVERSITY</text>
  <rect x="140" y="878" width="800" height="2" fill="#86efac" fill-opacity="0.16"/>

  <text x="140" y="946" font-family="${FONT}" font-size="20" font-weight="600"
        letter-spacing="5" fill="#86efac">BATCH</text>

  <!-- Footer -->
  <rect x="80" y="1192" width="920" height="2" fill="#86efac" fill-opacity="0.14"/>
  <text x="540" y="1248" text-anchor="middle" font-family="${FONT}" font-size="20"
        font-weight="500" letter-spacing="5" fill="#dcfce7" fill-opacity="0.7">AMBASSADOR PROGRAMME</text>
  <text x="540" y="1296" text-anchor="middle" font-family="${FONT}" font-size="20"
        font-weight="600" letter-spacing="1" fill="#86efac">mintrewards.app</text>
</svg>
`;

await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(OUT);
console.log(`Wrote ${OUT}`);
