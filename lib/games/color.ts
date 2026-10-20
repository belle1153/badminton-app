/** Team colours are admin-picked, so the text on top of them is chosen here:
 *  whichever of white or the app's navy ink has the higher WCAG contrast. */

const WHITE = "#ffffff";
const INK = "#0b1c30";

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export function textOn(hex: string): typeof WHITE | typeof INK {
  const bg = luminance(hex);
  return contrast(bg, luminance(WHITE)) >= contrast(bg, luminance(INK)) ? WHITE : INK;
}
