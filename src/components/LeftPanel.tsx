import { useId } from 'react'
import { Crown, Ticket, Users } from 'lucide-react'
import { MAXCALL, QUICK_CARDS, QUICK_PRICES } from '../game/constants'
import type { Game } from '../game/store'
import { useGame } from '../hooks/useGame'

const ringBg = (deg: number) => `conic-gradient(var(--gold) ${deg}deg,var(--line) 0)`

/**
 * Round panel: a gold dial (time left while buying, balls drawn while live) beside the round's
 * name and counts, then the coin stakes and the gold "Pick your cards" button.
 */
export function LeftPanel() {
  const g = useGame()
  const badge = g.phase === 'buy' ? 'Open' : g.phase === 'draw' ? 'Live' : 'Closed'
  const live = g.phase !== 'buy'
  const deg = live ? (g.called.length / MAXCALL) * 360 : g.ringDeg
  return (
    <div className={'gp left leftp b35 rp ' + g.phase}>
      <div className="rtop">
        <div className="rdial" style={{ '--p': deg + 'deg' } as React.CSSProperties} role="timer">
          <span className="rface">
            {live ? (
              <>
                <small>Drawn</small>
                <b>{g.called.length}</b>
                <small>of {MAXCALL}</small>
              </>
            ) : (
              <>
                <small>Draw in</small>
                <b className="timer">{g.timerText}</b>
              </>
            )}
          </span>
        </div>
        <div className="rinfo">
          <span className={'lpill ' + g.phase}>{badge}</span>
          <h3 className="rtitle">Round {g.round || 1}</h3>
          <p className="rsub">{live ? (g.phase === 'draw' ? 'Drawing now' : 'Round over') : 'Tickets on sale'}</p>
          <ul className="rstats">
            <li>
              <Ticket aria-hidden="true" />
              <b>{g.avail}</b>
              <span>/ 40 left</span>
            </li>
            <li>
              <Users aria-hidden="true" />
              <b>{g.participants}</b>
              <span>players</span>
            </li>
          </ul>
        </div>
      </div>
      <i className="rorn" aria-hidden="true">
        <Crown />
      </i>
      <QuickPick />
      <PickButton />
    </div>
  )
}

function pickLabel(g: Game) {
  if (g.phase === 'buy') return g.myBought ? 'Cards bought' : 'Pick your cards'
  return g.queued.length ? 'Saved for next round ✓' : 'Pick cards for next round'
}

/** Instant play: tap a stake to get four cards at that price, ready to confirm. */
export function QuickPick({ className }: { className?: string }) {
  const g = useGame()
  return (
    <div className={'qpick stake' + (className ? ' ' + className : '')}>
      <div className="stkhead">
        <Crown aria-hidden="true" />
        <span>{g.phase === 'buy' ? 'Choose your stake' : 'Stake for next round'}</span>
        <em>{QUICK_CARDS} cards</em>
      </div>
      <div className="stakes">
        {QUICK_PRICES.map((p, i) => (
          <button
            key={p}
            type="button"
            className={'stk s' + i}
            aria-label={`${QUICK_CARDS} cards at KES ${p} each, KES ${p * QUICK_CARDS} total`}
            disabled={!g.canPick || p * QUICK_CARDS > g.pts}
            onClick={() => g.openQuick(p)}
          >
            <Chip i={i} value={p} />
            <em>
              Total <b>{p * QUICK_CARDS}</b>
            </em>
          </button>
        ))}
      </div>
    </div>
  )
}

/** chip colours per stake: body, inlay, edge inserts */
const CHIPS = [
  ['#13774a', '#073a24', '#f4ead0'],
  ['#9b1f33', '#420b16', '#f4ead0'],
  ['#2a3f9a', '#0d1a4a', '#f4ead0'],
  ['#1b1b1b', '#060606', '#e9c46a'],
]

/** A casino chip seen from above with a little of its side showing: edge inserts, a gold-ringed inlay, the value and a shine. */
function Chip({ i, value }: { i: number; value: number }) {
  const [body, inlay, spot] = CHIPS[i]
  // ids must be unique per copy: a gradient defined in a hidden copy does not paint
  const id = 'chip' + i + useId().replace(/:/g, '')
  return (
    <svg className="chip" viewBox="0 0 100 106" aria-hidden="true">
      <defs>
        <radialGradient id={id + 'b'} cx=".4" cy=".35" r=".75">
          <stop offset="0" stopColor={body} stopOpacity=".85" />
          <stop offset=".6" stopColor={body} />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </radialGradient>
        <radialGradient id={id + 'i'} cx=".45" cy=".35" r=".7">
          <stop offset="0" stopColor={body} />
          <stop offset="1" stopColor={inlay} />
        </radialGradient>
        <linearGradient id={id + 'g'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset=".5" stopColor="#e9b648" />
          <stop offset="1" stopColor="#9a6a1a" />
        </linearGradient>
        <clipPath id={id + 'c'}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      {/* the chip's side, a few pixels below the face */}
      <circle cx="50" cy="56" r="47" fill="#000" opacity=".55" />
      <circle cx="50" cy="54" r="47" fill={inlay} />
      {/* face with eight edge inserts */}
      <circle cx="50" cy="50" r="47" fill={`url(#${id}b)`} />
      <g clipPath={`url(#${id}c)`}>
        {Array.from({ length: 8 }, (_, k) => (
          <g key={k} transform={`rotate(${k * 45} 50 50)`}>
            <rect x="43" y="1" width="14" height="15" rx="1.5" fill={spot} />
            <rect x="46" y="1" width="2.2" height="15" fill={body} opacity=".55" />
            <rect x="51.8" y="1" width="2.2" height="15" fill={body} opacity=".55" />
          </g>
        ))}
      </g>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="1.5" />
      {/* gold ring and inlay */}
      <circle cx="50" cy="50" r="33.5" fill={`url(#${id}g)`} />
      <circle cx="50" cy="50" r="30.5" fill={`url(#${id}i)`} />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#e9c46a" strokeOpacity=".6" strokeWidth=".8" strokeDasharray="2.2 2.2" />
      {/* crown, currency and value */}
      <path d="M43.5,30 L44.5,24.5 L47.5,27.5 L50,23 L52.5,27.5 L55.5,24.5 L56.5,30 Z" fill="#e9c46a" />
      <text x="50" y="40" textAnchor="middle" className="chk">
        KES
      </text>
      <text x="50" y={value >= 100 ? 63 : 64.5} textAnchor="middle" className={'chv' + (value >= 100 ? ' w3' : '')}>
        {value}
      </text>
      {/* shine */}
      <path d="M14,38 A38,38 0 0 1 62,12 A44,40 0 0 0 14,38 Z" fill="#fff" opacity=".22" />
      <ellipse cx="36" cy="26" rx="20" ry="9" transform="rotate(-30 36 26)" fill="#fff" opacity=".08" />
    </svg>
  )
}

export function PickButton({ className }: { className?: string }) {
  const g = useGame()
  return (
    <button
      className={'pickbtn' + (className ? ' ' + className : '')}
      disabled={!g.canPick || g.pts < 10}
      onClick={() => g.openModal()}
    >
      <Crown aria-hidden="true" />
      <span>{pickLabel(g)}</span>
    </button>
  )
}

/** Mobile "next draw" box (hidden on desktop by CSS). */
export function NextBox() {
  const g = useGame()
  return (
    <div className="gp next nextbox">
      <div className="pt" style={{ margin: 0 }}>
        NEXT DRAW
      </div>
      <span className="timer">{g.timerText}</span>
      <div className="mut">Ticket Buying Ends</div>
      <div className="mut">Current Participants</div>
      <div className="big2">{g.participants} / 40</div>
    </div>
  )
}

export { ringBg }
