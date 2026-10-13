import { BRAND } from '../config/brand'
import { GOLD, GOLD_TEXT } from '../theme'

// Shield crest. Replace this component's SVG with the real university seal when you have it.
export function Crest({ size = 48 }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 110" aria-hidden="true">
      <path d="M50 4 92 18v38c0 26-18 42-42 50C26 98 8 82 8 56V18z" fill="#0f204b" stroke={GOLD} strokeWidth="6" />
      <text x="50" y="68" textAnchor="middle" fontSize="38" fontWeight="700" fill={GOLD} fontFamily="'Playfair Display Variable', Georgia, serif">
        {BRAND.initials}
      </text>
    </svg>
  )
}

// layout="row": crest beside the wordmark (sidebar). layout="stack": centered (login).
// `color` is the colour of the top line; use white on navy, navy on white.
export default function Logo({ layout = 'row', size = 40, color = '#fff' }) {
  const stacked = layout === 'stack'
  const onDark = color === '#fff'
  return (
    <div className={`flex items-center ${stacked ? 'flex-col gap-3' : 'flex-row gap-3'}`}>
      <Crest size={size} />
      <div className={stacked ? 'text-center' : 'text-left'} style={{ lineHeight: 1 }}>
        <div
          className="font-serif font-bold"
          style={{ color, fontSize: stacked ? 30 : 17, letterSpacing: stacked ? 3 : 1.5, lineHeight: 1.1 }}
        >
          {BRAND.wordmark.top}
        </div>
        <div
          className="font-sans font-semibold"
          style={{ color: onDark ? GOLD : GOLD_TEXT, fontSize: stacked ? 13 : 9.5, letterSpacing: stacked ? 8 : 4.5, marginTop: stacked ? 8 : 4 }}
        >
          {BRAND.wordmark.bottom}
        </div>
      </div>
    </div>
  )
}
