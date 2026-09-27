// Hand-built SVG art. Flat shapes, thick dark outlines (Kurzgesagt-ish, but chunkier).
import type { Look } from "./ladder";

export const INK = "#120d2b";
const W = 2.6; // outline width in viewBox units (~1px per unit at render size)

const stroke = `stroke="${INK}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round"`;

function hairOrGhutra(look: Look): { back: string; front: string } {
  if (look.headwear === "ghutra") {
    return {
      // cloth hangs behind the shoulders
      back: `<path d="M10 22 Q9 4 24 4 Q39 4 38 22 L40 40 Q24 44 8 40 Z" fill="#fbfaf6" ${stroke}/>`,
      front:
        `<path d="M11 22 Q10 5 24 5 Q38 5 37 22 Q35 13 24 12.5 Q13 13 11 22 Z" fill="#fbfaf6" ${stroke}/>` +
        `<path d="M12.5 11 Q24 5.5 35.5 11" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>` +
        `<path d="M12.5 11 Q24 5.5 35.5 11" fill="none" stroke="#2a2440" stroke-width="1.4" stroke-linecap="round"/>`,
    };
  }
  return {
    back: "",
    front: `<path d="M12.6 18 Q12 6.5 24 6.5 Q36 6.5 35.4 18 Q31 11.5 24 11.8 Q17 11.5 12.6 18 Z" fill="${look.hair}" ${stroke}/>`,
  };
}

function beard(look: Look): string {
  if (look.beard === "none") return "";
  const d =
    look.beard === "long"
      ? "M12.8 18.5 Q12 34 18 40 Q24 45 30 40 Q36 34 35.2 18.5 Q24 36 12.8 18.5 Z"
      : look.beard === "full"
        ? "M12.8 18.5 Q24 47 35.2 18.5 Q24 36 12.8 18.5 Z"
        : "M13.6 20.5 Q24 42 34.4 20.5 Q24 35 13.6 20.5 Z";
  return (
    `<path d="${d}" fill="${look.beardColor}" ${stroke}/>` +
    `<path d="M19.4 23.4 Q24 21.4 28.6 23.4 Q24 25.2 19.4 23.4 Z" fill="${look.beardColor}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`
  );
}

function head(look: Look): string {
  const { back, front } = hairOrGhutra(look);
  return `
    ${back}
    <rect x="20.5" y="26" width="7" height="8" fill="${look.skin}" ${stroke}/>
    <circle cx="12.6" cy="20" r="3" fill="${look.skin}" ${stroke}/>
    <circle cx="35.4" cy="20" r="3" fill="${look.skin}" ${stroke}/>
    <circle cx="24" cy="19" r="11" fill="${look.skin}" ${stroke}/>
    <circle cx="16.8" cy="22.3" r="2.2" fill="#ff6f91" opacity=".35"/>
    <circle cx="31.2" cy="22.3" r="2.2" fill="#ff6f91" opacity=".35"/>
    ${beard(look)}
    <path class="mouth" d="M21.6 25.9 Q24 27.8 26.4 25.9" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M17.6 14.8 L21.2 14.2 M26.8 14.2 L30.4 14.8" stroke="${look.hair}" stroke-width="1.9" stroke-linecap="round"/>
    <g class="eyes">
      <ellipse cx="19.8" cy="18.4" rx="1.7" ry="2.2" fill="${INK}"/>
      <ellipse cx="28.2" cy="18.4" rx="1.7" ry="2.2" fill="${INK}"/>
      <circle cx="20.4" cy="17.6" r=".6" fill="#fff"/>
      <circle cx="28.8" cy="17.6" r=".6" fill="#fff"/>
    </g>
    ${front}`;
}

/** Full standing figure in a kandura. viewBox 0 0 48 74, feet on y=72. */
export function personSVG(look: Look): string {
  const arm = (side: "l" | "r") => {
    const x = side === "l" ? 8.2 : 32.8;
    return `<g class="arm arm-${side}">
      <rect x="${x}" y="36" width="7" height="20" rx="3.5" fill="${look.outfit}" ${stroke}/>
      <circle cx="${x + 3.5}" cy="57" r="3" fill="${look.skin}" ${stroke}/>
    </g>`;
  };
  return `<svg viewBox="0 0 48 74" xmlns="http://www.w3.org/2000/svg" overflow="visible">
    <g class="body">
      <ellipse cx="18" cy="72" rx="4.6" ry="2.3" fill="#3b2a20" ${stroke}/>
      <ellipse cx="30" cy="72" rx="4.6" ry="2.3" fill="#3b2a20" ${stroke}/>
      ${arm("l")}${arm("r")}
      <path d="M11 71 L13 40 Q13 33 24 33 Q35 33 35 40 L37 71 Z" fill="${look.outfit}" ${stroke}/>
      <path d="M20 34.5 Q24 37.5 28 34.5" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M24 37 L24 49" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="24" cy="50.4" r="1.9" fill="${look.outfit}" stroke="${INK}" stroke-width="1.5"/>
      <g class="head">${head(look)}</g>
    </g>
  </svg>`;
}

/** Just the face, cropped for the round "you" badge. */
export function faceSVG(look: Look): string {
  return `<svg viewBox="9 6 30 30" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="30" width="48" height="20" fill="${look.outfit}" ${stroke}/>
    ${head(look)}
  </svg>`;
}

export function flagSVG(color: string): string {
  return `<svg viewBox="0 0 30 52" xmlns="http://www.w3.org/2000/svg" overflow="visible">
    <rect x="4" y="5" width="4" height="46" rx="2" fill="#d9d4ee" ${stroke}/>
    <path class="cloth" d="M8 7 L27 13.5 L8 21 Z" fill="${color}" ${stroke}/>
    <circle cx="6" cy="4.5" r="3" fill="${color}" ${stroke}/>
  </svg>`;
}

export function goalSVG(color: string): string {
  return `<svg viewBox="0 0 46 70" xmlns="http://www.w3.org/2000/svg" overflow="visible">
    <rect x="5" y="6" width="5" height="63" rx="2.5" fill="#d9d4ee" ${stroke}/>
    <path class="cloth" d="M10 8 Q24 4 42 9 L42 32 Q26 27 10 31 Z" fill="${color}" ${stroke}/>
    <path d="M26 12.5 L28.3 17.2 L33.4 17.8 L29.6 21.2 L30.7 26.2 L26 23.6 L21.3 26.2 L22.4 21.2 L18.6 17.8 L23.7 17.2 Z"
      fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="7.5" cy="5" r="3.6" fill="${color}" ${stroke}/>
  </svg>`;
}
