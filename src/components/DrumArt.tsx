import { memo } from 'react'

/** Decorative SVG layers of the drum machine: podium, stands, glass drum, five exit tubes and their slots. */
export const VB_W = 1189
export const VB_H = 1323
const VIEWBOX = `0 0 ${VB_W} ${VB_H}`

/** The glass drum in viewBox units: a horizontal cylinder from x0 to x1, radius r around cy. */
export const DRUM = { cx: 594, cy: 400, r: 226, x0: 150, x1: 1038 }
/** Half the drum's inside length. */
export const DRUM_L = (DRUM.x1 - DRUM.x0) / 2

const TOP = DRUM.cy - DRUM.r
const BOT = DRUM.cy + DRUM.r

/** Five tubes leave the bottom of the drum and drop into a row of slots on the podium. */
const SLOT_Y = 1078
const SLOT_R = 84
const COLLAR_Y = BOT + 26
const SLOT_COLORS = ['#22e07a', '#2f7bff', '#ffc21a', '#ff2d3d', '#e040fb']

export const PIPES = SLOT_COLORS.map((color, i) => {
  const xt = DRUM.cx + (i - 2) * 170
  const xb = DRUM.cx + (i - 2) * 214
  const yt = COLLAR_Y
  const yb = SLOT_Y - SLOT_R + 8
  const h = yb - yt
  // straight down, a bend outwards, straight down again, like the tubes on the real machine
  const tube = `M${xt},${yt} C${xt},${yt + h * 0.55} ${xb},${yt + h * 0.4} ${xb},${yb}`
  return {
    color,
    tube,
    /** the path a ball rides: from the drum's floor, down the tube, and a short drop into the slot */
    ride: `M${xt},${BOT - 30} L${xt},${yt} ${tube.slice(tube.indexOf('C'))} L${xb},${SLOT_Y - 20}`,
    top: { x: xt, y: BOT - 30 },
    hole: { x: xb, y: SLOT_Y },
  }
})

/** Gold light strip: three strokes instead of a blur, which phones redraw slowly. */
function Neon({ d }: { d: string }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#e2ad3e" strokeWidth="14" opacity=".2" />
      <path d={d} stroke="#f3c45a" strokeWidth="7" opacity=".5" />
      <path d={d} stroke="#fff1b8" strokeWidth="3" />
    </g>
  )
}

/** A gold band around the end of the drum, seen from the front. */
function EndCap({ x, side }: { x: number; side: -1 | 1 }) {
  const hub = x + side * 58
  return (
    <g>
      {/* the wheel and axle outside the drum */}
      <rect x={hub - 30} y={DRUM.cy - 150} width="60" height="300" rx="26" fill="#111f1a" stroke="url(#goldV)" strokeWidth="6" />
      <rect x={hub - 30} y={DRUM.cy - 150} width="60" height="300" rx="26" fill="url(#hubG)" opacity=".9" />
      {[-110, -55, 0, 55, 110].map(dy => (
        <rect key={dy} x={hub - 30} y={DRUM.cy + dy - 4} width="60" height="8" fill="#000000" opacity=".45" />
      ))}
      <rect x={hub + side * 30 - (side > 0 ? 0 : 26)} y={DRUM.cy - 46} width="26" height="92" rx="9" fill="#1a2b25" stroke="url(#goldV)" strokeWidth="5" />
      {/* the gold rings that hold the glass */}
      <rect x={x - 34} y={TOP - 26} width="68" height={2 * DRUM.r + 52} rx="30" fill="url(#goldV)" />
      <rect x={x - 22} y={TOP - 14} width="44" height={2 * DRUM.r + 28} rx="20" fill="none" stroke="#5a3205" strokeWidth="3" opacity=".6" />
      <rect x={x - 6} y={TOP - 26} width="12" height={2 * DRUM.r + 52} fill="#fff6cf" opacity=".35" />
      {[TOP - 8, DRUM.cy, BOT + 8].map(y => (
        <circle key={y} cx={x} cy={y} r="7" fill="#fff1b8" stroke="#6b3a04" strokeWidth="2" />
      ))}
    </g>
  )
}

/** Back layer, under the balls: podium, stands, the back of the glass and the tubes. */
export const DrumBack = memo(function DrumBack() {
  const sx0 = DRUM.x0 - 58
  const sx1 = DRUM.x1 + 58
  return (
    <svg className="pipes drum-b" viewBox={VIEWBOX} aria-hidden="true">
      <defs>
        <linearGradient id="gold" x1="0" x2="1">
          <stop offset="0" stopColor="#b8690b" />
          <stop offset=".35" stopColor="#ffe9a0" />
          <stop offset=".6" stopColor="#ffb02e" />
          <stop offset="1" stopColor="#a85f06" />
        </linearGradient>
        <linearGradient id="goldC" x1="0" x2="1">
          <stop offset="0" stopColor="#6b3a04" />
          <stop offset=".18" stopColor="#c9850f" />
          <stop offset=".4" stopColor="#fff1b8" />
          <stop offset=".62" stopColor="#f0a828" />
          <stop offset=".88" stopColor="#8a4f06" />
          <stop offset="1" stopColor="#4a2702" />
        </linearGradient>
        <linearGradient id="goldV" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8a4f06" />
          <stop offset=".12" stopColor="#ffe9a0" />
          <stop offset=".3" stopColor="#e09a1c" />
          <stop offset=".5" stopColor="#fff1b8" />
          <stop offset=".7" stopColor="#c9850f" />
          <stop offset=".9" stopColor="#ffd77a" />
          <stop offset="1" stopColor="#6b3a04" />
        </linearGradient>
        <linearGradient id="hubG" x1="0" x2="1">
          <stop offset="0" stopColor="#050c0a" />
          <stop offset=".45" stopColor="#3a554c" />
          <stop offset=".6" stopColor="#1b2c26" />
          <stop offset="1" stopColor="#050c0a" />
        </linearGradient>
        <linearGradient id="navy" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0f5a3c" />
          <stop offset=".45" stopColor="#0a3d29" />
          <stop offset="1" stopColor="#031a10" />
        </linearGradient>
        <linearGradient id="navyTop" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#04170f" />
          <stop offset="1" stopColor="#0f4a32" />
        </linearGradient>
        <linearGradient id="stand" x1="0" x2="1">
          <stop offset="0" stopColor="#03180f" />
          <stop offset=".38" stopColor="#14714a" />
          <stop offset=".62" stopColor="#0b4a30" />
          <stop offset="1" stopColor="#021309" />
        </linearGradient>
        <linearGradient id="glassBack" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c5f9e3" stopOpacity=".34" />
          <stop offset=".18" stopColor="#8cf2ca" stopOpacity=".1" />
          <stop offset=".8" stopColor="#3ad09b" stopOpacity=".14" />
          <stop offset="1" stopColor="#c5f9e3" stopOpacity=".32" />
        </linearGradient>
        <linearGradient id="glassFront" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ecfdf6" stopOpacity=".5" />
          <stop offset=".07" stopColor="#c5f9e3" stopOpacity=".16" />
          <stop offset=".2" stopColor="#c5f9e3" stopOpacity="0" />
          <stop offset=".78" stopColor="#0a402d" stopOpacity="0" />
          <stop offset=".93" stopColor="#0a402d" stopOpacity=".28" />
          <stop offset="1" stopColor="#a6f5d6" stopOpacity=".45" />
        </linearGradient>
        <radialGradient id="bayG" cx=".5" cy=".4" r=".7">
          <stop offset="0" stopColor="#1d4738" />
          <stop offset=".7" stopColor="#0a241b" />
          <stop offset="1" stopColor="#030f0b" />
        </radialGradient>
      </defs>

      {/* lower tier of the podium */}
      <path d="M40,1170 Q40,1120 594,1112 Q1148,1120 1148,1170 L1148,1250 Q1148,1298 594,1305 Q40,1298 40,1250 Z" fill="url(#navy)" />
      <path d="M40,1170 Q40,1120 594,1112 Q1148,1120 1148,1170" fill="none" stroke="url(#gold)" strokeWidth="7" />
      <Neon d="M52,1214 Q594,1250 1136,1214" />
      <path d="M44,1258 Q594,1300 1144,1258" fill="none" stroke="url(#gold)" strokeWidth="6" />
      {/* the crown badge on the front of the podium */}
      <g transform="translate(594 1240)">
        <path d="M-150,-42 L-40,-42 L0,10 L40,-42 L150,-42" fill="none" stroke="url(#gold)" strokeWidth="6" strokeLinejoin="round" />
        <path d="M-110,-28 A110 70 0 0 1 110,-28" fill="none" stroke="url(#gold)" strokeWidth="4" opacity=".8" />
        <path d="M-34,-6 L-38,-40 L-17,-24 L0,-48 L17,-24 L38,-40 L34,-6 Z" fill="url(#goldV)" stroke="#5a3a08" strokeWidth="2" />
        <rect x="-36" y="-8" width="72" height="9" rx="3" fill="url(#goldV)" />
      </g>

      {/* upper tier, the slots sit on its front */}
      <path d="M110,996 Q110,938 594,930 Q1078,938 1078,996 L1078,1130 Q1078,1176 594,1182 Q110,1176 110,1130 Z" fill="url(#navy)" />
      <path d="M118,994 Q118,946 594,940 Q1070,946 1070,994 Q1070,1010 594,1016 Q118,1010 118,994 Z" fill="url(#navyTop)" />
      <path d="M110,996 Q110,938 594,930 Q1078,938 1078,996" fill="none" stroke="url(#gold)" strokeWidth="6" />
      {/* marble veins on the front of the upper tier */}
      <g fill="none" stroke="#bff5dc" strokeLinecap="round" opacity=".16">
        <path d="M130,1060 C250,1040 300,1110 420,1090 S600,1150 700,1120" strokeWidth="2" />
        <path d="M600,1170 C700,1100 820,1140 900,1080 S1020,1060 1070,1040" strokeWidth="1.5" />
        <path d="M200,1160 C260,1120 330,1150 380,1120" strokeWidth="1.2" />
        <path d="M840,1170 C880,1140 960,1150 1040,1110" strokeWidth="1.2" />
      </g>
      <Neon d="M116,1026 Q594,1060 1072,1026" />
      <Neon d="M114,1150 Q594,1184 1074,1150" />

      {/* stands: a fluted gold column under each wheel, standing on a plinth on the podium,
          with a curved arm that cradles the end of the drum */}
      {[sx0, sx1].map((x, k) => {
        const side = k ? 1 : -1
        const ring = k ? DRUM.x1 : DRUM.x0
        const top = DRUM.cy + 138
        return (
          <g key={x}>
            <path d={`M${x},${top + 40} C${x},${BOT + 40} ${ring},${BOT + 60} ${ring},${BOT + 14}`} fill="none" stroke="#5a3205" strokeWidth="26" strokeLinecap="round" />
            <path d={`M${x},${top + 40} C${x},${BOT + 40} ${ring},${BOT + 60} ${ring},${BOT + 14}`} fill="none" stroke="url(#goldV)" strokeWidth="18" strokeLinecap="round" />
            <rect x={x - 46} y={top} width="92" height="26" rx="8" fill="url(#goldC)" stroke="#5a3205" strokeWidth="3" />
            <path d={`M${x - 30},${top + 24} L${x + 30},${top + 24} L${x + 38},950 L${x - 38},950 Z`} fill="url(#goldV)" stroke="#5a3205" strokeWidth="3" />
            {[-18, -6, 6, 18].map(d => (
              <path key={d} d={`M${x + d},${top + 34} L${x + d * 1.25},940`} stroke="#6b3a04" strokeWidth="3" opacity=".55" />
            ))}
            <path d={`M${x - 3},${top + 34} L${x - 3},940`} stroke="#fff6cf" strokeWidth="5" opacity=".45" />
            <rect x={x - 14} y={top + 120} width="28" height="160" rx="14" fill="#0d5236" stroke="#fff1b8" strokeWidth="3" />
            <circle cx={x} cy={top + 200} r="7" fill="#fff1b8" />
            <rect x={x - 62} y="944" width="124" height="34" rx="9" fill="url(#goldC)" stroke="#5a3205" strokeWidth="3" />
            <rect x={x - 70} y="972" width="140" height="14" rx="5" fill="#7a4f0c" />
            <circle cx={x + side * 0} cy={top + 13} r="6" fill="#3a2002" />
          </g>
        )
      })}

      {/* back of the glass: the balls tumble in front of it */}
      <rect x={DRUM.x0} y={TOP} width={DRUM.x1 - DRUM.x0} height={2 * DRUM.r} fill="url(#glassBack)" />
      <rect x={DRUM.x0} y={TOP} width={DRUM.x1 - DRUM.x0} height={2 * DRUM.r} fill="#0b402d" opacity=".28" />

      {/* tubes */}
      {PIPES.map(({ tube, ride }, i) => (
        <g key={i} fill="none" strokeLinecap="round">
          <path id={'pp' + i} d={ride} stroke="none" />
          <path d={tube} stroke="#eef6f2" strokeWidth="78" opacity=".45" />
          <path d={tube} stroke="#1f3a30" strokeWidth="68" opacity=".45" />
          <path d={tube} stroke="#ffffff" strokeWidth="6" opacity=".6" />
        </g>
      ))}
    </svg>
  )
})

/** Middle layer, over the balls in the drum: glass shine and the gold ends. */
export const DrumFront = memo(function DrumFront() {
  const W = DRUM.x1 - DRUM.x0
  return (
    <svg className="pipes drum-f" viewBox={VIEWBOX} aria-hidden="true">
      {/* the glass bulges: light along the top, shade and a reflection along the bottom */}
      <rect x={DRUM.x0} y={TOP} width={W} height={2 * DRUM.r} fill="url(#glassFront)" />
      {/* rims of the glass */}
      <rect x={DRUM.x0} y={TOP} width={W} height="10" fill="#e8fcf4" opacity=".55" />
      <rect x={DRUM.x0} y={BOT - 10} width={W} height="10" fill="#a6f5d6" opacity=".45" />
      {/* long highlights along the cylinder */}
      <rect x={DRUM.x0 + 40} y={TOP + 26} width={W - 80} height="16" rx="8" fill="#ffffff" opacity=".55" />
      <rect x={DRUM.x0 + 60} y={TOP + 52} width={W - 120} height="5" rx="2.5" fill="#ffffff" opacity=".35" />
      <rect x={DRUM.x0 + 40} y={BOT - 46} width={W - 80} height="7" rx="3.5" fill="#ffffff" opacity=".22" />
      {/* ribs near each end of the glass */}
      {[28, 52, W - 52, W - 28].map(dx => (
        <rect key={dx} x={DRUM.x0 + dx - 3} y={TOP} width="6" height={2 * DRUM.r} fill="#e8fcf4" opacity=".28" />
      ))}
      <rect className="drum-glow" x={DRUM.x0} y={TOP} width={W} height={2 * DRUM.r} fill="none" stroke="#f8d77c" strokeWidth="6" />
      <EndCap x={DRUM.x0} side={-1} />
      <EndCap x={DRUM.x1} side={1} />
    </svg>
  )
})

function Collar({ x, y, w = 96 }: { x: number; y: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2 - 6} y="-24" width={w + 12} height="18" rx="7" fill="url(#goldC)" />
      <rect x={-w / 2} y="-8" width={w} height="34" rx="6" fill="url(#goldC)" />
      <rect x={-w / 2} y="4" width={w} height="4" fill="#4a2702" opacity=".5" />
    </g>
  )
}

/** Front layer, above the riding balls: glass sheen on the tubes, gold collars and the slots. */
export const DrumBays = memo(function DrumBays() {
  return (
    <svg className="pipes pipes-f" viewBox={VIEWBOX} aria-hidden="true">
      {PIPES.map(({ tube, top, hole, color }, i) => (
        <g key={i}>
          <path d={tube} fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".55" transform="translate(-22 0)" />
          <path d={tube} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity=".35" transform="translate(22 0)" />
          <Collar x={top.x} y={COLLAR_Y} />
          <Collar x={hole.x} y={SLOT_Y - SLOT_R - 6} w={100} />
          <circle cx={hole.x + 6} cy={hole.y + 8} r={SLOT_R + 8} fill="#000000" opacity=".45" />
          <circle cx={hole.x} cy={hole.y} r={SLOT_R} fill="url(#bayG)" stroke="url(#gold)" strokeWidth="18" />
          <circle cx={hole.x} cy={hole.y} r={SLOT_R + 9} fill="none" stroke="#5a3205" strokeWidth="2" />
          <circle cx={hole.x} cy={hole.y} r={SLOT_R - 13} fill="none" stroke={color} strokeWidth="14" opacity=".3" />
          <circle cx={hole.x} cy={hole.y} r={SLOT_R - 14} fill="none" stroke={color} strokeWidth="7" />
          <circle cx={hole.x} cy={hole.y} r={SLOT_R - 14} fill={color} opacity=".12" />
          <path d={`M${hole.x - SLOT_R + 14},${hole.y - 30} A${SLOT_R} ${SLOT_R} 0 0 1 ${hole.x + 10},${hole.y - SLOT_R + 4}`} fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
        </g>
      ))}
    </svg>
  )
})
