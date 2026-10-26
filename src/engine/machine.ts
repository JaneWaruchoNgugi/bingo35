import { LITE, rimOf, letterOf, rnd } from '../game/constants'
import { DRUM, DRUM_L } from '../components/DrumArt'

export interface Ball {
  n: number
  /** along the drum's axis (left–right on screen) */
  x: number
  /** up–down, and z towards the viewer: the drum turns in this plane */
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** position before the last physics step, for interpolated drawing */
  px?: number
  py?: number
  pz?: number
  /** slowly drifting random push, so balls tumble instead of jittering */
  wx?: number
  wy?: number
  wz?: number
  gone?: boolean
  pick?: Pick
}

interface Pick {
  t0?: number
  /** 0..1 progress towards the exit; the ball shrinks as it enters the tube */
  k: number
  sx?: number
  sy?: number
  ex: number
  ey: number
  cb?: () => void
}

/** Physics state shared between the game (which asks for balls) and the canvas renderer. */
export class MachineState {
  balls: Ball[] = []
  /** true while the drum is spinning fast */
  busy = false

  constructor() {
    this.reset()
  }

  reset() {
    this.balls = Array.from({ length: 85 }, (_, i) => {
      const a = Math.PI * (0.25 + Math.random() * 0.5)
      const d = Math.random() * (R - BR)
      return {
        n: i < 75 ? i + 1 : 1 + rnd(75),
        x: (Math.random() - 0.5) * 2 * (L - BR),
        y: Math.sin(a) * d,
        z: Math.cos(a) * d,
        vx: Math.random() * 2 - 1,
        vy: 0,
        vz: Math.random() * 2 - 1,
      }
    })
  }

  /**
   * Draw ball `n` out of the drum into the tube mouth at (`ex`, `ey`), in drum units from the
   * drum's centre (screen space); `cb` fires when it has entered the tube.
   */
  pick(n: number, cb: () => void, ex = 0, ey = R - BR) {
    let b = this.balls.find(x => x.n === n && !x.pick && !x.gone)
    if (!b) {
      b = { n, x: ex, y: R - BR, z: 0, vx: 0, vy: 0, vz: 0 }
      this.balls.push(b)
    }
    b.pick = { k: 0, cb, ex, ey }
  }

  remove(n: number) {
    const k = this.balls.findIndex(b => b.n === n)
    if (k >= 0) this.balls.splice(k, 1)
  }
}

/** Drum units are viewBox units of DrumArt; the canvas covers the inside of the glass plus a margin. */
const R = DRUM.r
const L = DRUM_L
const BR = 44
const PAD = 12
/** Canvas pixels per drum unit: below 1 keeps the canvas light on phones. */
const SCALE = LITE ? 0.6 : 0.8
export const CANVAS_BOX = { x: DRUM.x0 - PAD, y: DRUM.cy - R - PAD, w: 2 * (L + PAD), h: 2 * (R + PAD) }
export const CANVAS_PX = { w: Math.round(CANVAS_BOX.w * SCALE), h: Math.round(CANVAS_BOX.h * SCALE) }
/** Fixed physics step: motion is the same on 60 Hz and 120 Hz screens. */
const STEP = 1000 / 60
/** Scale of a picked ball when it reaches the tube mouth (matches the tube ball). */
export const PICK_SCALE = 0.78
export const PICK_MS = 750

const mix = (h: string, t: number) => {
  const n = parseInt(h.slice(1), 16)
  const r = n >> 16
  const g = (n >> 8) & 255
  const bl = n & 255
  const k = t < 0 ? 0 : 255
  const a = Math.abs(t)
  return `rgb(${Math.round(r + (k - r) * a)},${Math.round(g + (k - g) * a)},${Math.round(bl + (k - bl) * a)})`
}

/** Largest on-canvas ball radius (a front ball, f = 1.08); sprites are drawn at this size and only ever scaled down. */
const SPR_R = Math.ceil(BR * 1.08)
/** Half the sprite's side, in ball radii: room for the ground shadow under the ball. */
const SPR_PAD = 1.2

/**
 * Paints ball `n` of radius `r` centred on (X, Y). Painting a ball takes five gradients and two
 * text runs, far too much to repeat for 85 balls every frame, so it is done once per number into
 * a sprite (see `sprite`) and the frame loop only copies the sprites.
 */
function paintBall(c: CanvasRenderingContext2D, n: number, X: number, Y: number, r: number) {
  const rm = rimOf(n)
  const c0 = rm[0]
  const c1 = rm[1]
  // ground shadow
  c.fillStyle = 'rgba(0,0,0,.28)'
  c.beginPath()
  c.ellipse(X + r * 0.08, Y + r * 0.98, r * 0.75, r * 0.16, 0, 0, 7)
  c.fill()
  // body
  const g = c.createRadialGradient(X - r * 0.35, Y - r * 0.4, r * 0.05, X, Y, r)
  g.addColorStop(0, mix(c0, 0.6))
  g.addColorStop(0.32, mix(c0, 0.12))
  g.addColorStop(0.8, mix(c1, -0.18))
  g.addColorStop(1, mix(c1, -0.45))
  c.fillStyle = g
  c.beginPath()
  c.arc(X, Y, r, 0, 7)
  c.fill()
  if (c.createConicGradient) {
    const cg = c.createConicGradient(0.6, X, Y)
    cg.addColorStop(0, 'rgba(255,255,255,.28)')
    cg.addColorStop(0.3, 'rgba(255,255,255,0)')
    cg.addColorStop(0.6, 'rgba(255,255,255,.18)')
    cg.addColorStop(1, 'rgba(255,255,255,.28)')
    c.fillStyle = cg
    c.beginPath()
    c.arc(X, Y, r, 0, 7)
    c.fill()
  }
  const rg2 = c.createRadialGradient(X + r * 0.45, Y + r * 0.55, r * 0.1, X + r * 0.45, Y + r * 0.55, r * 0.75)
  rg2.addColorStop(0, mix(c0, 0.45))
  rg2.addColorStop(1, 'rgba(255,255,255,0)')
  c.globalAlpha = 0.45
  c.fillStyle = rg2
  c.beginPath()
  c.arc(X, Y, r, 0, 7)
  c.fill()
  c.globalAlpha = 1
  // label disc
  const lr = r * 0.64
  c.fillStyle = 'rgba(0,0,0,.3)'
  c.beginPath()
  c.arc(X, Y + r * 0.03, lr * 1.05, 0, 7)
  c.fill()
  const dg = c.createRadialGradient(X - lr * 0.2, Y - lr * 0.3, lr * 0.05, X, Y, lr)
  dg.addColorStop(0, '#ffffff')
  dg.addColorStop(0.75, '#f8f9ff')
  dg.addColorStop(1, '#d9e0f2')
  c.fillStyle = dg
  c.beginPath()
  c.arc(X, Y, lr, 0, 7)
  c.fill()
  c.strokeStyle = mix(c0, -0.2)
  c.lineWidth = Math.max(1, r * 0.05)
  c.stroke()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#17184a'
  c.font = `800 ${r * 0.34}px Rubik,system-ui,sans-serif`
  c.fillText(letterOf(n), X, Y - r * 0.36)
  c.font = `800 ${r * 0.44}px Rubik,system-ui,sans-serif`
  c.fillText(String(n), X, Y + r * 0.17)
  // highlights
  c.save()
  c.translate(X - r * 0.42, Y - r * 0.62)
  c.rotate(-0.55)
  const hg = c.createLinearGradient(0, -r * 0.14, 0, r * 0.14)
  hg.addColorStop(0, 'rgba(255,255,255,.95)')
  hg.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = hg
  c.beginPath()
  c.ellipse(0, 0, r * 0.3, r * 0.12, 0, 0, 7)
  c.fill()
  c.restore()
  c.fillStyle = 'rgba(255,255,255,.9)'
  c.beginPath()
  c.arc(X - r * 0.58, Y - r * 0.5, r * 0.07, 0, 7)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,.35)'
  c.lineWidth = Math.max(1, r * 0.045)
  c.beginPath()
  c.arc(X, Y, r * 0.95, Math.PI * 0.15, Math.PI * 0.55)
  c.stroke()
}

const sprites = new Map<number, HTMLCanvasElement>()
/**
 * Drops the cached ball pictures. Each one is shrunk to nothing first: Safari on iPhone frees a
 * canvas's memory late, and enough dropped canvases blank the page.
 */
function clearSprites() {
  sprites.forEach(s => (s.width = s.height = 0))
  sprites.clear()
}
// a sprite painted before the web font arrived would keep the fallback font
document.fonts?.addEventListener?.('loadingdone', clearSprites)

/** The cached picture of ball `n` at radius SPR_R, centred in a square of side 2 * SPR_PAD * SPR_R. */
function sprite(n: number) {
  let s = sprites.get(n)
  if (!s) {
    s = document.createElement('canvas')
    s.width = s.height = Math.ceil(2 * SPR_PAD * SPR_R)
    const half = s.width / 2
    paintBall(s.getContext('2d')!, n, half, half, SPR_R)
    sprites.set(n, s)
  }
  return s
}

/** Starts the canvas loop. Returns a function that stops it. */
export function startMachine(cv: HTMLCanvasElement, ms: MachineState): () => void {
  const c = cv.getContext('2d')!
  /** turn of the drum, for the ribs drawn on the glass */
  let ang = 0
  let last = performance.now()
  let acc = 0
  let power = 0
  let raf = 0
  const reduce = matchMedia('(prefers-reduced-motion:reduce)')
  // a busy phone may drop the canvas memory; the cached ball pictures go with it, so repaint them
  const restore = clearSprites
  cv.addEventListener('contextrestored', restore)

  function physics(red: boolean) {
    const bs = ms.balls
    // the motor spins up and down smoothly instead of switching on and off
    power += ((ms.busy ? 1 : 0) - power) * (1 - Math.exp(-STEP / 380))
    /** speed of the glass wall, in drum units per step */
    const wall = 1.2 + power * 9
    const jig = 0.25 + power * 0.9
    const lim = R - BR
    bs.forEach(b => {
      b.px = b.x
      b.py = b.y
      b.pz = b.z
      if (b.gone || b.pick) return
      b.wx = ((b.wx ?? 0) + (Math.random() - 0.5) * 0.3) * 0.9
      b.wy = ((b.wy ?? 0) + (Math.random() - 0.5) * 0.3) * 0.9
      b.wz = ((b.wz ?? 0) + (Math.random() - 0.5) * 0.3) * 0.9
      b.vx += b.wx * jig
      b.vy += 0.42 + b.wy * jig
      b.vz += b.wz * jig
      b.vx *= 0.99
      b.vy *= 0.99
      b.vz *= 0.99
      const sp = Math.hypot(b.vx, b.vy, b.vz)
      const mx = 14
      if (sp > mx) {
        b.vx *= mx / sp
        b.vy *= mx / sp
        b.vz *= mx / sp
      }
      if (!red) {
        b.x += b.vx
        b.y += b.vy
        b.z += b.vz
      }
      // the round wall: bounce, and the turning glass drags the ball along with it
      const d = Math.hypot(b.y, b.z)
      if (d > lim) {
        const ny = b.y / d
        const nz = b.z / d
        b.y = ny * lim
        b.z = nz * lim
        const dot = b.vy * ny + b.vz * nz
        if (dot > 0) {
          b.vy -= 1.4 * dot * ny
          b.vz -= 1.4 * dot * nz
        }
        // tangent of the turn: the front of the drum moves up
        const ty = -nz
        const tz = ny
        const vt = b.vy * ty + b.vz * tz
        const pull = (wall - vt) * 0.22
        b.vy += ty * pull
        b.vz += tz * pull
      }
      // the gold ends, which cover the last 34 units of the glass (front balls look 6% bigger)
      const xl = (L - 30) / 1.06 - BR
      if (b.x > xl) {
        b.x = xl
        if (b.vx > 0) b.vx *= -0.6
      } else if (b.x < -xl) {
        b.x = -xl
        if (b.vx < 0) b.vx *= -0.6
      }
    })

    for (let it = 0; it < 2; it++)
      for (let i = 0; i < bs.length; i++)
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i]
          const b = bs[j]
          if (a.pick || b.pick || a.gone || b.gone) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dz = b.z - a.z
          const md = BR * 1.9
          if (dx > md || dx < -md) continue
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 < md * md && d2 > 0.0001) {
            const d = Math.sqrt(d2)
            const nx = dx / d
            const ny = dy / d
            const nz = dz / d
            const o = (md - d) / 2
            a.x -= nx * o
            a.y -= ny * o
            a.z -= nz * o
            b.x += nx * o
            b.y += ny * o
            b.z += nz * o
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz
            if (rv < 0) {
              const im = -rv * 0.8
              a.vx -= nx * im
              a.vy -= ny * im
              a.vz -= nz * im
              b.vx += nx * im
              b.vy += ny * im
              b.vz += nz * im
            }
          }
        }

    ang += (wall / R) * (red ? 0.3 : 1)
  }

  /** On-screen size factor of a ball at depth z: balls at the back of the drum look smaller. */
  const depth = (z: number) => 0.84 + 0.22 * ((z + R) / (2 * R))

  /** A picked ball glides (in screen space) to its tube mouth, speeding up as the tube sucks it in. */
  function pickMove(b: Ball, now: number) {
    const p = b.pick!
    if (p.t0 === undefined) {
      p.t0 = now
      const f = depth(b.z)
      p.sx = b.x * f
      p.sy = b.y * f
    }
    const k = Math.min(1, (now - p.t0) / PICK_MS)
    const ex = k * k * (3 - 2 * k)
    const ey = k * k * (2 - k)
    // a small wobble while it is lifted out of the pile
    const wob = Math.sin(k * Math.PI * 2) * (1 - k) * 10
    b.x = p.sx! + (p.ex - p.sx!) * ex + wob
    b.y = p.sy! + (p.ey - p.sy!) * ey
    b.z = 0
    b.px = b.x
    b.py = b.y
    b.pz = 0
    p.k = k
    if (k >= 1) {
      const cb = p.cb
      b.pick = undefined
      b.gone = true
      cb && cb()
    }
  }

  // phones draw the machine at 30 fps; physics runs on a fixed step, so the motion is unchanged
  const minGap = LITE ? 1000 / 30 - 2 : 0
  let drawn = 0
  // nothing is drawn while the machine is scrolled out of view
  let onScreen = true
  const io = new IntersectionObserver(es => (onScreen = es[0].isIntersecting))
  io.observe(cv)

  /** Centre of the drum on the canvas, in drum units. */
  const CX = DRUM.cx - CANVAS_BOX.x
  const CY = DRUM.cy - CANVAS_BOX.y
  const RIBS = 10

  /** The glass ribs turning with the drum: the back half before the balls, the front half after. */
  function ribs(front: boolean) {
    c.lineWidth = 3
    for (let k = 0; k < RIBS; k++) {
      const a = ang + (k / RIBS) * Math.PI * 2
      const z = Math.cos(a)
      if (front !== z > 0) continue
      const y = CY - Math.sin(a) * (R - 4)
      c.strokeStyle = front ? `rgba(220,240,255,${0.08 + z * 0.22})` : `rgba(160,200,255,${0.05 - z * 0.08})`
      c.beginPath()
      c.moveTo(PAD, y)
      c.lineTo(CANVAS_BOX.w - PAD, y)
      c.stroke()
    }
  }

  function frame() {
    const nw = performance.now()
    if (!onScreen || nw - drawn < minGap) {
      // keep the clock running so the balls don't jump when drawing resumes
      if (!onScreen) {
        ms.balls.forEach(b => b.pick && !b.gone && pickMove(b, nw))
        last = nw
      }
      raf = requestAnimationFrame(frame)
      return
    }
    drawn = nw
    acc += Math.min(100, nw - last)
    last = nw
    const red = reduce.matches
    let steps = 0
    while (acc >= STEP && steps++ < 5) {
      physics(red)
      acc -= STEP
    }
    if (acc > STEP) acc = 0
    // draw between the last two physics states so motion stays smooth at any frame rate
    const al = acc / STEP
    ms.balls.forEach(b => b.pick && !b.gone && pickMove(b, nw))
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, cv.width, cv.height)
    c.setTransform(cv.width / CANVAS_BOX.w, 0, 0, cv.height / CANVAS_BOX.h, 0, 0)
    ribs(false)
    const pr = ms.balls
      .filter(b => !b.gone)
      .map(b => {
        const bx = (b.px ?? b.x) + (b.x - (b.px ?? b.x)) * al
        const by = (b.py ?? b.y) + (b.y - (b.py ?? b.y)) * al
        const bz = (b.pz ?? b.z) + (b.z - (b.pz ?? b.z)) * al
        // picked balls already live in screen space
        const f = b.pick ? 1 : depth(bz)
        return { b, x: CX + bx * f, y: CY + by * f, z: b.pick ? 1e4 : bz, s: f }
      })
      .sort((p, q) => p.z - q.z)

    pr.forEach(p => {
      const r = BR * p.s * (p.b.pick ? 1 - (1 - PICK_SCALE) * p.b.pick.k : 1)
      const h = SPR_PAD * r
      c.drawImage(sprite(p.b.n), p.x - h, p.y - h, 2 * h, 2 * h)
    })
    ribs(true)
    raf = requestAnimationFrame(frame)
  }
  frame()
  return () => {
    cancelAnimationFrame(raf)
    io.disconnect()
    cv.removeEventListener('contextrestored', restore)
  }
}
