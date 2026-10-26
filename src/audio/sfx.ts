/**
 * Every sound in BINGO35: a late-night lounge-jazz loop (upright bass, brushes, ride cymbal,
 * electric piano and vibraphone, busier while numbers are drawn), the brass-and-glass drum
 * machine sounds made once at start-up, card and gold-coin handling, a royal fanfare with harp
 * and timpani for wins, and a hall that cheers and claps.
 * Clips in ./samples are used where they exist (see samples/CREDITS.md); every other sound, and
 * any clip that fails to load, is synthesized live. The context starts on the first user gesture.
 */
type Bus = 'sfx' | 'music' | 'pad' | 'crowd'
interface Opts {
  vol?: number
  a?: number
  /** hold the level until the end instead of decaying */
  sus?: boolean
  type?: OscillatorType
  to?: number
  gl?: number
  vib?: number
  det?: number
  lp?: number
  hp?: number
  q?: number
  send?: number
  pan?: number
  bus?: Bus
}
interface NoiseOpts extends Opts {
  ft?: BiquadFilterType
  f0?: number
  f1?: number
}
interface ClipOpts {
  vol?: number
  pan?: number
  rate?: number
  /** fit the clip to this many seconds (fades out at the end) */
  dur?: number
  bus?: Bus
}

/**
 * Recordings by file name without extension. `name-1`, `name-2`… are takes of one sound and
 * one is picked at random each time. Each clip ships as .ogg and .m4a; the browser gets the one
 * it can play.
 */
const CLIPS = import.meta.glob('./samples/*.{mp3,ogg,wav,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
/** Clip levels, so each recording sits where its synthesized version did. */
const CLIP_VOL: Record<string, number> = {
  music: 0.08,
  coin: 0.26,
  card: 1.8,
  swipe: 0.51,
  fan: 0.9,
  deal: 1,
  tick: 0.82,
  near: 0.2,
  jackpot: 0.68,
  star: 0.3,
  end: 0.18,
  cheer: 1,
  'cheer-small': 0.72,
  applause: 0.8,
}
/** the file to load for each clip name, in the format this browser plays best */
function clipFiles() {
  const a = typeof Audio !== 'undefined' ? new Audio() : undefined
  const ok = (t: string) => !!a && a.canPlayType(t) !== ''
  const order = [ok('audio/ogg; codecs="vorbis"') && 'ogg', ok('audio/mp4; codecs="mp4a.40.2"') && 'm4a', 'mp3', 'wav', 'ogg', 'm4a']
  const by: Record<string, Record<string, string>> = {}
  for (const [path, url] of Object.entries(CLIPS)) {
    const m = path.match(/([^/]+)\.(\w+)$/)!
    ;(by[m[1]] ??= {})[m[2]] = url
  }
  return Object.entries(by).map(([name, f]) => {
    const urls = [...new Set(order.filter(Boolean) as string[])].filter(x => f[x]).map(x => f[x])
    return { name, urls }
  })
}

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
/** Am7 – F – C – G: a bright, rolling loop in A minor, voiced for a warm pad */
const PROG = [
  [57, 60, 64, 67],
  [57, 60, 65, 69],
  [55, 60, 64, 67],
  [55, 59, 62, 67],
]
const ROOT = [45, 41, 36, 43]
/** the marimba hook, one note per 8th (0 = rest); the second time round it answers itself */
const HOOK = [
  [
    [76, 0, 79, 81, 0, 79, 76, 0],
    [77, 0, 76, 0, 72, 0, 74, 0],
    [76, 0, 79, 0, 84, 0, 83, 79],
    [81, 0, 79, 0, 74, 0, 0, 0],
  ],
  [
    [76, 0, 79, 81, 0, 84, 83, 0],
    [81, 0, 77, 0, 76, 0, 72, 0],
    [74, 0, 76, 0, 79, 0, 76, 0],
    [74, 0, 71, 0, 79, 0, 0, 0],
  ],
]
/** marimba run order over the chord tones while numbers are drawn, one note per 16th */
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]
const BPM = 112
/** music level, and where it returns to after being ducked */
const MUSIC = 3.6
/**
 * Per-sound level trims in dB, measured by rendering each sound offline so the sounds
 * sit above the music, the crowd leads the win, and small UI sounds stay subtle but audible.
 */
const TRIM: Record<string, number> = { go: 3.5, combo: 1.5, cheer: 15, aww: 14, star: 3.5, tick: 10, pop: 13, swipe: 24, shimmer: 6, coin: 8, end: -2 }
const db = (x: number) => 10 ** (x / 20)
const S16 = 60 / BPM / 4

/** pitch steps of the five slot tings, a minor pentatonic up the row: A – C – D – E – G */
const POP_STEPS = [0, 3, 5, 7, 10].map(x => 2 ** (x / 12))

type Kit = Record<'whirl' | 'tok' | 'swish' | 'pop' | 'land' | 'chime', AudioBuffer>

/**
 * The ball sounds, written straight into small buffers once when sound starts. Playing one is a
 * single buffer and a gain, instead of the dozens of oscillators and filters the old ones built
 * for every ball, which kept the phone busy through the draw.
 */
function makeKit(c: BaseAudioContext): Kit {
  const sr = c.sampleRate
  const mk = (dur: number, f: (t: number) => number) => {
    const b = c.createBuffer(1, Math.ceil(dur * sr), sr)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = f(i / sr)
    return b
  }
  const TAU = Math.PI * 2
  /** a sine sweeping from f0 to f1 over `glide` seconds, with its phase carried between samples */
  const sweep = (f0: number, f1: number, glide: number) => {
    let ph = 0
    return (t: number) => {
      const k = Math.min(1, t / glide)
      ph += (TAU * (f0 + (f1 - f0) * k)) / sr
      return Math.sin(ph)
    }
  }
  /** soft noise: white noise through a one-pole lowpass (0 < a < 1, smaller is darker) */
  const soft = (a: number) => {
    let y = 0
    return () => (y += (Math.random() * 2 - 1 - y) * a)
  }

  // the drum turning: a low rumble that rolls with each turn, and balls tumbling over each other
  const rumble = soft(0.025)
  const clacks = Array.from({ length: 34 }, () => ({ at: 0.05 + Math.random() * 1.5, f: 900 + Math.random() * 900, v: 0.12 + Math.random() * 0.16 }))
  const whirl = mk(1.6, t => {
    const roll = 0.65 + 0.35 * Math.sin(TAU * 2.6 * t)
    let v = rumble() * 3.2 * roll * Math.min(1, t / 0.25)
    for (const k of clacks) {
      const x = t - k.at
      if (x >= 0 && x < 0.035) v += (Math.sin(TAU * k.f * x) + 0.4 * Math.sin(TAU * k.f * 2.3 * x)) * Math.exp(-x * 140) * k.v
    }
    return v
  })

  // the brass gate opening under the drum: a metal click with a short ring
  const tok = mk(0.16, t => (Math.sin(TAU * 2350 * t) * 0.5 + Math.sin(TAU * 3720 * t) * 0.3) * Math.exp(-t * 38) + (t < 0.004 ? (Math.random() * 2 - 1) * 0.5 : 0))

  // the ball rolling down the glass tube: a hollow band of air with a fast glassy rattle
  const lo = soft(0.08)
  const hi = soft(0.45)
  const swish = mk(0.45, t => {
    const rattle = 0.6 + 0.4 * Math.sin(TAU * 34 * t)
    return (hi() - lo()) * rattle * Math.sin((Math.PI * t) / 0.45) ** 2 * 1.5
  })

  // a crystal ting as the ball comes out of the tube
  const pop = mk(0.5, t => (Math.sin(TAU * 1760 * t) + 0.35 * Math.sin(TAU * 1760 * 4.2 * t) * Math.exp(-t * 30)) * Math.exp(-t * 9) * 0.45)

  // the ball dropping into its brass cup: a soft thunk and a warm metal ring
  const tone3 = sweep(170, 90, 0.07)
  const land = mk(0.45, t => tone3(t) * Math.exp(-t * 30) * 0.8 + (Math.sin(TAU * 880 * t) * 0.18 + Math.sin(TAU * 1330 * t) * 0.1) * Math.exp(-t * 11) + (t < 0.003 ? (Math.random() * 2 - 1) * 0.25 : 0))

  // one of your numbers: two plucked harp notes, A then E, with a glint on top
  const harp = (f: number, t: number) => (t < 0 ? 0 : (Math.sin(TAU * f * t) + 0.45 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 6) + 0.15 * Math.sin(TAU * f * 3 * t) * Math.exp(-t * 12)) * Math.exp(-t * 4.5))
  const chime = mk(0.9, t => (harp(880, t) + harp(1318.5, t - 0.09) + 0.3 * harp(2637, t - 0.09)) * 0.3)

  return { whirl, tok, swish, pop, land, chime }
}

function createSfx() {
  let ctx: AudioContext | undefined
  let master!: GainNode
  let revIn!: GainNode
  let sfxBus!: GainNode
  let musicBus!: GainNode
  let padBus!: GainNode
  let crowdBus!: GainNode
  let noiseBuf!: AudioBuffer
  let kit!: Kit
  const bank: Record<string, AudioBuffer> = {}
  let sfxOn = true
  let musicOn = true
  let crowdOn = true
  let loopT: number | undefined
  let ir!: AudioBuffer
  /** the groove pre-rendered once per mood, so a busy page can never make it stutter */
  const loops: { idle?: AudioBuffer; draw?: AudioBuffer } = {}
  interface Voice {
    src: AudioBufferSourceNode
    g: GainNode
  }
  let loopPlay: { t0: number; idle: Voice; draw?: Voice; drawing: boolean; rec: boolean; lvl: number } | undefined
  let drawing: () => boolean = () => false
  /** level multiplier applied to every envelope while one sound is being scheduled */
  let boost = 1

  // ---- the caller: a hall host's voice for the big moments (start of the draw, near wins, wins) ----
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  let voiceOn = true
  let speaking = false
  const lines: string[] = []
  let callerVoice: SpeechSynthesisVoice | null | undefined
  function pickVoice() {
    if (callerVoice !== undefined || !synth) return callerVoice
    const all = synth.getVoices().filter(v => /^en/i.test(v.lang))
    if (!all.length) return null
    const like = ['Google UK English Male', 'Daniel', 'Microsoft Ryan', 'Microsoft Guy', 'Google US English', 'Alex', 'Samantha']
    callerVoice = like.map(n => all.find(v => v.name.includes(n))).find(Boolean) || all.find(v => /en-GB/i.test(v.lang)) || all[0]
    return callerVoice
  }
  function speakNext() {
    if (!synth || speaking || !lines.length) return
    const u = new SpeechSynthesisUtterance(lines.shift()!)
    const v = pickVoice()
    if (v) u.voice = v
    u.lang = v?.lang || 'en-GB'
    u.rate = 1.05
    u.pitch = 0.95
    speaking = true
    // some browsers drop onend, so never let the queue jam
    const fail = setTimeout(done, 4000)
    function done() {
      clearTimeout(fail)
      speaking = false
      speakNext()
    }
    u.onend = u.onerror = done
    synth.speak(u)
  }
  /** queue a line for the caller; urgent lines cut in front of the ball calls */
  function speak(text: string, urgent = false) {
    if (!synth || !voiceOn || !ctx) return
    if (urgent) {
      lines.length = 0
      synth.cancel()
      speaking = false
    }
    lines.push(text)
    // stay with the action: drop calls that fell too far behind
    if (lines.length > 6) lines.splice(0, lines.length - 6)
    speakNext()
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    } catch {
      return
    }
    const c = ctx
    master = c.createGain()
    master.gain.value = 2.6
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -20
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.2
    // a brick-wall limiter after the glue compressor keeps the louder mix from clipping
    const limit = c.createDynamicsCompressor()
    limit.threshold.value = -2.5
    limit.knee.value = 0
    limit.ratio.value = 20
    limit.attack.value = 0.001
    limit.release.value = 0.1
    master.connect(comp)
    comp.connect(limit)
    limit.connect(c.destination)

    // a bright hall: decorrelated noise tails, darker towards the end
    const len = Math.floor(c.sampleRate * 2)
    ir = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const k = i / len
        lp += (Math.random() * 2 - 1 - lp) * (0.9 - k * 0.75)
        d[i] = lp * Math.pow(1 - k, 2.8) * (i < c.sampleRate * 0.01 ? i / (c.sampleRate * 0.01) : 1)
      }
    }
    const rev = c.createConvolver()
    rev.buffer = ir
    revIn = c.createGain()
    revIn.connect(rev)
    const wet = c.createGain()
    wet.gain.value = 0.38
    rev.connect(wet)
    wet.connect(master)

    const bus = (v: number, to: AudioNode = master) => {
      const g = c.createGain()
      g.gain.value = v
      g.connect(to)
      return g
    }
    sfxBus = bus(1.5)
    crowdBus = bus(1.4)
    musicBus = bus(MUSIC)
    padBus = bus(1, musicBus)

    kit = makeKit(c)
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

    const load = async (urls: string[]): Promise<AudioBuffer> => {
      for (const url of urls) {
        try {
          // a single-file build inlines clips as data: URLs, which some pages may not fetch
          const b = url.startsWith('data:')
            ? Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), ch => ch.charCodeAt(0)).buffer
            : await (await fetch(url)).arrayBuffer()
          // the callback form, because older Safari has no promise version
          return await new Promise<AudioBuffer>((ok, no) => c.decodeAudioData(b, ok, no))
        } catch {
          // try the next format
        }
      }
      throw new Error('no playable file')
    }
    const music = clipFiles().map(({ name, urls }) =>
      load(urls).then(buf => {
        bank[name] = buf
        if (name.startsWith('music')) syncMusic()
      }),
    )
    // the synthesized groove is only rendered if the recorded music cannot be played
    Promise.allSettled(music).then(() => {
      if (bank.music) return
      renderLoop(false, LOOP_STEPS)
        .then(b => (loops.idle = b))
        .then(() => renderLoop(true, LOOP_STEPS / 2))
        .then(b => (loops.draw = b))
        .catch(() => {})
    })
    clearInterval(loopT)
    loopT = window.setInterval(syncMusic, 200)
    // a silent line during the first tap unlocks speech on iOS
    if (synth) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      synth.speak(u)
      synth.onvoiceschanged = () => (callerVoice = undefined)
    }
  }

  const ok = () => !!ctx && sfxOn && ctx.state === 'running'
  const okM = () => !!ctx && musicOn && ctx.state === 'running'
  const okC = () => !!ctx && crowdOn && ctx.state === 'running'
  const now = () => ctx!.currentTime + 0.01
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)

  /** one buffer through one gain (and a panner if needed), dry: the cheapest way to make a sound */
  function play(buf: AudioBuffer, t: number, o: { vol?: number; pan?: number; rate?: number; dur?: number } = {}) {
    const c = ctx!
    const src = c.createBufferSource()
    src.buffer = buf
    if (o.rate) src.playbackRate.value = o.rate
    const g = c.createGain()
    g.gain.value = o.vol ?? 1
    if (o.dur) {
      g.gain.setValueAtTime(o.vol ?? 1, t + Math.max(0, o.dur - 0.12))
      g.gain.linearRampToValueAtTime(0.0001, t + o.dur)
    }
    src.connect(g)
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, o.pan))
      g.connect(p)
      p.connect(sfxBus)
    } else g.connect(sfxBus)
    src.start(t)
    src.stop(t + (o.dur ?? buf.duration / (o.rate ?? 1)) + 0.02)
  }

  function dest(b: Bus = 'sfx') {
    return b === 'music' ? musicBus : b === 'pad' ? padBus : b === 'crowd' ? crowdBus : sfxBus
  }

  function env(t: number, dur: number, v: number, a: number, sus?: boolean) {
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    v *= boost
    g.gain.linearRampToValueAtTime(v, t + a)
    if (sus) {
      g.gain.setValueAtTime(v, Math.max(t + a, t + dur - 0.35))
      g.gain.linearRampToValueAtTime(0.0001, t + dur)
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    return g
  }

  function panner(pan: number) {
    const c = ctx!
    if (!c.createStereoPanner) return null
    const p = c.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    return p
  }

  /** source → filters → envelope → panner → bus, with a reverb send */
  function route(src: AudioNode, g: GainNode, o: Opts) {
    const c = ctx!
    let n = src
    for (const [type, f] of [
      ['lowpass', o.lp],
      ['highpass', o.hp],
    ] as [BiquadFilterType, number | undefined][]) {
      if (!f) continue
      const bq = c.createBiquadFilter()
      bq.type = type
      bq.frequency.value = f
      bq.Q.value = o.q ?? 0.7
      n.connect(bq)
      n = bq
    }
    n.connect(g)
    let last: AudioNode = g
    const p = o.pan ? panner(o.pan) : null
    if (p) {
      g.connect(p)
      last = p
    }
    last.connect(dest(o.bus))
    const s = o.send ?? 0.2
    if (s > 0) {
      const sg = c.createGain()
      sg.gain.value = s
      last.connect(sg)
      sg.connect(revIn)
    }
  }

  function tone(f: number, t: number, dur: number, o: Opts = {}) {
    const c = ctx!
    const os = c.createOscillator()
    os.type = o.type || 'sine'
    os.frequency.setValueAtTime(f, t)
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur * (o.gl ?? 1))
    if (o.det) os.detune.value = o.det
    if (o.vib) {
      const l = c.createOscillator()
      const lg = c.createGain()
      l.frequency.value = 5.5
      lg.gain.value = o.vib
      l.connect(lg)
      lg.connect(os.frequency)
      l.start(t)
      l.stop(t + dur + 0.05)
    }
    route(os, env(t, dur, o.vol ?? 0.1, o.a ?? 0.005, o.sus), o)
    os.start(t)
    os.stop(t + dur + 0.05)
  }

  function noiseSrc(t: number, dur: number) {
    const src = ctx!.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.05)
    return src
  }

  function noise(t: number, dur: number, o: NoiseOpts = {}) {
    const bq = ctx!.createBiquadFilter()
    bq.type = o.ft || 'bandpass'
    bq.frequency.setValueAtTime(o.f0 ?? 1000, t)
    if (o.f1) bq.frequency.exponentialRampToValueAtTime(o.f1, t + dur)
    bq.Q.value = o.q ?? 1
    noiseSrc(t, dur).connect(bq)
    route(bq, env(t, dur, o.vol ?? 0.1, o.a ?? 0.003, o.sus), { ...o, lp: undefined, hp: undefined })
  }

  /** the clip `name`, or a random take of it (name-1, name-2…) */
  function take(name: string) {
    if (bank[name]) return bank[name]
    const all: AudioBuffer[] = []
    for (let k = 1; bank[name + '-' + k]; k++) all.push(bank[name + '-' + k])
    return all.length ? all[Math.floor(Math.random() * all.length)] : undefined
  }

  /** play a recorded clip if one was supplied; false means use the synthesized sound */
  function clip(name: string, t: number, o: ClipOpts = {}) {
    const buf = take(name)
    if (!buf) return false
    const c = ctx!
    const src = c.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = o.rate ?? 1
    const g = c.createGain()
    // clips are levelled by CLIP_VOL, not by the synth trims
    const v = (o.vol ?? 1) * (CLIP_VOL[name] ?? 1)
    g.gain.setValueAtTime(v, t)
    if (o.dur) {
      g.gain.setValueAtTime(v, t + Math.max(0, o.dur - 0.15))
      g.gain.linearRampToValueAtTime(0.0001, t + o.dur)
    }
    src.connect(g)
    const p = o.pan ? panner(o.pan) : null
    if (p) {
      g.connect(p)
      p.connect(dest(o.bus))
    } else g.connect(dest(o.bus))
    src.start(t)
    if (o.dur) src.stop(t + o.dur + 0.05)
    return true
  }

  /** FM bell: a bright strike that melts into a pure tone */
  function bell(f: number, t: number, v: number, dur = 1.4, o: Opts = {}, ratio = 3.5, idx = 2.2) {
    const c = ctx!
    const car = c.createOscillator()
    const mod = c.createOscillator()
    const mg = c.createGain()
    car.frequency.value = f
    mod.frequency.value = f * ratio
    mg.gain.setValueAtTime(f * idx, t)
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.5)
    mod.connect(mg)
    mg.connect(car.frequency)
    route(car, env(t, dur, v, 0.002), { send: 0.35, ...o })
    car.start(t)
    mod.start(t)
    car.stop(t + dur + 0.05)
    mod.stop(t + dur + 0.05)
  }

  /** electric piano: a soft FM tine with a slow tremolo, on the pad bus so the kick-free mix still breathes */
  function rhodes(f: number, t: number, dur: number, v: number, pan = 0) {
    bell(f, t, v, dur, { bus: 'pad', pan, send: 0.3 }, 1, 1.1)
    tone(f, t, dur * 0.8, { vol: v * 0.35, vib: 2.5, a: 0.01, pan, send: 0.2, bus: 'pad' })
  }
  /** vibraphone: a mellow bar with the motor's shimmer */
  function vibes(f: number, t: number, v: number, dur = 0.9, pan = 0.2) {
    bell(f, t, v, dur, { bus: 'music', pan, send: 0.45 }, 4, 0.9)
    tone(f, t, dur, { vol: v * 0.6, vib: 6, a: 0.003, pan, send: 0.4, bus: 'music' })
  }
  /** the groove's kick: round and soft, felt more than heard */
  function thump(t: number, v: number) {
    tone(118, t, 0.3, { vol: v, to: 44, gl: 0.3, a: 0.002, send: 0, bus: 'music' })
    noise(t, 0.008, { ft: 'highpass', f0: 2500, vol: v * 0.15, send: 0, bus: 'music' })
  }
  /** a tight, roomy clap on 2 and 4 */
  function snap(t: number, v: number) {
    ;[0, 0.009, 0.019].forEach((d, k) => noise(t + d, k === 2 ? 0.12 : 0.02, { f0: 1500, q: 1.1, vol: v * (k === 2 ? 1 : 0.6), a: 0.001, bus: 'music', send: 0.3, pan: 0.1 }))
  }
  /** shaker: a short bright grain, panned a little right */
  function shaker(t: number, v: number) {
    noise(t, 0.045, { ft: 'highpass', f0: 7000, vol: v, a: 0.006, bus: 'music', send: 0.05, pan: 0.3 })
  }
  /** synth bass: a rounded saw over a sine sub */
  function bass(f: number, t: number, v: number, dur = S16 * 1.7) {
    tone(f, t, dur, { vol: v, type: 'sawtooth', lp: 520, q: 1.5, a: 0.004, send: 0, bus: 'music' })
    tone(f, t, dur, { vol: v * 0.9, a: 0.004, send: 0, bus: 'music' })
  }
  /** a warm pad chord: detuned saws through a soft filter, swelling in */
  function pad(ch: number[], t: number, dur: number, v: number) {
    ch.forEach((m, k) => {
      const pan = -0.45 + k * 0.3
      ;[-7, 7].forEach(d => tone(mtof(m), t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.25, lp: 1100, q: 0.5, pan, send: 0.5, sus: true, bus: 'pad' }))
    })
  }
  /** marimba: a woody bar with a quick knock */
  function mallet(f: number, t: number, v: number, pan = 0.15) {
    bell(f, t, v, 0.55, { bus: 'music', pan, send: 0.35 }, 4, 0.7)
    tone(f, t, 0.45, { vol: v * 0.7, a: 0.002, pan, send: 0.3, bus: 'music' })
  }
  /** timpani: a tuned drum with a boom and a skin slap */
  function timp(f: number, t: number, v: number, dur = 1.6) {
    tone(f, t, dur, { vol: v, to: f * 0.97, a: 0.004, send: 0.4 })
    tone(f * 1.5, t, dur * 0.5, { vol: v * 0.35, a: 0.004, send: 0.3 })
    noise(t, 0.08, { f0: 300, q: 0.8, vol: v * 0.5, send: 0.2 })
  }
  /** a timpani roll that swells for `d` seconds */
  function timpRoll(f: number, t: number, d: number, v: number) {
    for (let x = 0; x < d; x += 0.055) timp(f, t + x, v * (0.25 + 0.75 * (x / d)), 0.3)
  }
  /** a French-horn-like note: warm, slow to speak, slightly breathy */
  function horn(f: number, t: number, dur: number, v: number, pan = 0) {
    ;[-6, 6].forEach(d => tone(f, t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.05, lp: 1500, q: 0.8, pan, send: 0.45, sus: true }))
    tone(f / 2, t, dur, { vol: v * 0.6, a: 0.06, pan, send: 0.4, sus: true })
  }
  /** harp glissando over the given notes */
  function gliss(notes: number[], t: number, v: number, gap = 0.04) {
    notes.forEach((m, k) => {
      const f = mtof(m)
      const pan = -0.6 + (1.2 * k) / notes.length
      tone(f, t + k * gap, 1.1, { vol: v, a: 0.002, pan, send: 0.5 })
      tone(f * 2, t + k * gap, 0.4, { vol: v * 0.3, a: 0.002, pan, send: 0.4 })
    })
  }

  /** a metal coin: inharmonic partials and a bright scrape */
  function clink(f: number, t: number, v: number, pan = 0) {
    ;[1, 2.76, 5.4, 8.93].forEach((r, k) => tone(f * r, t, 0.5 / (k + 1), { vol: v / (k + 1.4), a: 0.001, pan, send: 0.3 }))
    noise(t, 0.04, { ft: 'highpass', f0: 7000, vol: v * 0.6, pan })
  }

  /** two plastic balls knocking together */
  function kick(t: number, v: number, bus: Bus = 'music') {
    tone(150, t, 0.3, { vol: v, to: 45, gl: 0.45, a: 0.002, send: 0, bus })
    noise(t, 0.012, { ft: 'highpass', f0: 3000, vol: v * 0.25, send: 0, bus })
  }
  function snare(t: number, v: number) {
    tone(200, t, 0.1, { vol: v * 0.6, to: 140, a: 0.001, send: 0.1, bus: 'music' })
    noise(t, 0.16, { ft: 'highpass', f0: 1800, vol: v, a: 0.001, send: 0.25, bus: 'music' })
  }
  function hat(t: number, v: number, open = false) {
    noise(t, open ? 0.16 : 0.035, { ft: 'highpass', f0: 8500, vol: v, bus: 'music', send: 0.08, pan: open ? 0.25 : -0.2 })
  }
  function crash(t: number, v: number, dur = 2.2) {
    noise(t, dur, { ft: 'highpass', f0: 5200, f1: 3500, vol: v, a: 0.002, send: 0.5 })
    noise(t, dur * 0.5, { f0: 9000, q: 0.6, vol: v * 0.5, send: 0.3 })
  }
  function brass(f: number, t: number, dur: number, v: number, pan = 0, bus: Bus = 'sfx') {
    ;[-9, 0, 9].forEach(d => tone(f, t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.03, lp: 2800, q: 1.2, pan, send: 0.35, bus }))
  }

  /** a kalimba-like pluck: a warm tine with a woody knock */
  function kalimba(f: number, t: number, v: number, pan: number, dur = 1.1) {
    tone(f, t, dur, { vol: v, a: 0.002, pan, send: 0.35 })
    tone(f * 5.4, t, 0.09, { vol: v * 0.25, a: 0.001, pan, send: 0.2 })
    tone(f * 2, t, dur * 0.4, { vol: v * 0.18, a: 0.002, pan, send: 0.3 })
    noise(t, 0.02, { f0: 1800, q: 2, vol: v * 0.5, pan, send: 0.1 })
  }
  // ---- crowd ----
  /** one pair of hands: a sharp double transient */
  function handClap(t: number, v: number, pan: number) {
    const f = rnd(900, 2600)
    noise(t, rnd(0.02, 0.045), { f0: f, q: rnd(0.8, 2), vol: v, a: 0.001, pan, bus: 'crowd', send: 0.25 })
    noise(t + 0.008, 0.03, { f0: f * 1.3, q: 1.5, vol: v * 0.5, a: 0.001, pan, bus: 'crowd', send: 0.2 })
  }
  /** a crowd voice: a gliding buzz through vowel formants */
  function voice(t: number, f0: number, f1: number, dur: number, v: number, fm: [number, number], pan: number) {
    const c = ctx!
    const os = c.createOscillator()
    os.type = 'sawtooth'
    os.frequency.setValueAtTime(f0, t)
    os.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6)
    const g = env(t, dur, v, 0.12)
    for (const f of fm) {
      const bq = c.createBiquadFilter()
      bq.type = 'bandpass'
      bq.frequency.value = f
      bq.Q.value = 5
      os.connect(bq)
      bq.connect(g)
    }
    route(g, c.createGain(), { pan, bus: 'crowd', send: 0.45 })
    os.start(t)
    os.stop(t + dur + 0.05)
  }
  function whistle(t: number, v: number) {
    const f = rnd(1900, 2600)
    tone(f, t, 0.8, { vol: v, to: f * 1.35, gl: 0.3, vib: 40, a: 0.04, pan: rnd(-0.7, 0.7), bus: 'crowd', send: 0.4 })
  }
  /** a hall full of people cheering and clapping: swells in, holds, then thins out */
  function crowd(t: number, d: number, size: number) {
    const rate = 38 * size
    for (let k = 0, n = Math.floor(rate * d); k < n; k++) {
      const x = Math.random() * d
      const lvl = Math.min(1, x / 0.35) * (x > d * 0.6 ? 1 - (x - d * 0.6) / (d * 0.4) : 1)
      handClap(t + x, 0.09 * (0.3 + 0.7 * lvl) * rnd(0.5, 1), rnd(-0.9, 0.9))
    }
    // the roar under the claps
    noise(t, d, { f0: 700, f1: 1100, q: 0.6, vol: 0.06 * size, a: 0.3, bus: 'crowd', send: 0.4 })
    noise(t, d * 0.8, { f0: 300, q: 0.8, vol: 0.05 * size, a: 0.25, bus: 'crowd', send: 0.3 })
    for (let k = 0; k < 12 * size; k++) {
      const f = rnd(200, 460)
      voice(t + Math.random() * 1.2, f, f * rnd(1.3, 1.8), rnd(0.8, 1.6), 0.028, k % 2 ? [700, 1150] : [380, 850], rnd(-0.85, 0.85))
    }
    for (let k = 0; k < 3 * size; k++) whistle(t + 0.2 + Math.random() * d * 0.5, 0.035)
  }
  /** pull the music down under a big moment */
  function duck(t: number, depth: number, hold: number) {
    const g = musicBus.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(MUSIC, t)
    g.linearRampToValueAtTime(MUSIC * depth, t + 0.05)
    g.setValueAtTime(MUSIC * depth, t + hold)
    g.linearRampToValueAtTime(MUSIC, t + hold + 0.6)
  }

  // ---- the groove ----
  /** eight bars while waiting (the hook plays every other time round); the draw loop is half that */
  const LOOP_STEPS = 128

  /**
   * Render the groove offline. The tail that rings past the end is folded back
   * onto the start, so the buffer loops without a seam.
   */
  async function renderLoop(draw: boolean, steps: number) {
    const real = { ctx, revIn, musicBus, padBus }
    const sr = real.ctx!.sampleRate
    const n = Math.round(steps * S16 * sr)
    const off = new OfflineAudioContext(2, n + sr * 2, sr)
    const rv = off.createConvolver()
    rv.buffer = ir
    const wet = off.createGain()
    // the loop is played through the music bus, so take its gain back out of the reverb
    wet.gain.value = 0.38 / MUSIC
    rv.connect(wet)
    wet.connect(off.destination)
    ctx = off as unknown as AudioContext
    revIn = off.createGain()
    revIn.connect(rv)
    musicBus = off.createGain()
    musicBus.connect(off.destination)
    padBus = off.createGain()
    padBus.connect(musicBus)
    try {
      for (let s = 0; s < steps; s++) beat(s % 64, s * S16, draw, s >> 6)
    } finally {
      ;({ ctx, revIn, musicBus, padBus } = real)
    }
    const out = await off.startRendering()
    const buf = real.ctx!.createBuffer(2, n, sr)
    for (let ch = 0; ch < 2; ch++) {
      const src = out.getChannelData(ch)
      const dst = buf.getChannelData(ch)
      dst.set(src.subarray(0, n))
      for (let i = n; i < src.length; i++) dst[i - n] += src[i]
    }
    return buf
  }

  /** start, stop and crossfade the music to match the settings and the game */
  function syncMusic() {
    if (!ctx) return
    const c = ctx
    const stop = () => {
      loopPlay?.idle.src.stop()
      loopPlay?.draw?.src.stop()
      loopPlay = undefined
    }
    if (!okM()) return stop()
    // the recorded loops when they loaded, otherwise the synthesized ones
    const rec = !!bank.music
    const idle = rec ? bank.music : loops.idle
    const draw = rec ? bank['music-draw'] : loops.draw
    const lvl = rec ? CLIP_VOL.music : 0.65
    if (loopPlay && loopPlay.rec !== rec) stop()
    const t = c.currentTime + 0.05
    // both loops run against the same clock, so switching between them lands on the beat
    const voice = (b: AudioBuffer, v: number, t0: number): Voice => {
      const src = c.createBufferSource()
      src.buffer = b
      src.loop = true
      const g = c.createGain()
      g.gain.value = v
      src.connect(g)
      g.connect(musicBus)
      src.start(t, (t - t0) % b.duration)
      return { src, g }
    }
    const d = drawing()
    if (!loopPlay) {
      if (!idle) return
      loopPlay = { t0: t, idle: voice(idle, lvl, t), drawing: false, rec, lvl }
    }
    if (!loopPlay.draw && draw) loopPlay.draw = voice(draw, 0, loopPlay.t0)
    if (loopPlay.draw && loopPlay.drawing !== d) {
      loopPlay.drawing = d
      // switch on the next beat, with a short crossfade
      const at = nextBeat(c.currentTime + 0.02)
      loopPlay.idle.g.gain.setTargetAtTime(d ? 0 : lvl, at, 0.06)
      loopPlay.draw.g.gain.setTargetAtTime(d ? lvl : 0, at, 0.06)
    }
  }

  /** the first beat (every `every` beats) of the music at or after time t */
  function nextBeat(t: number, every = 1) {
    if (!loopPlay) return t
    const b = (S16 * 4) * every
    return loopPlay.t0 + Math.ceil((t - loopPlay.t0 - 0.001) / b) * b
  }

  function beat(s: number, t: number, draw: boolean, cycle: number) {
    const bar = (s >> 4) & 3
    const p = s & 15
    const ch = PROG[bar]
    const root = mtof(ROOT[bar])
    // kick on every beat, clap on 2 and 4
    if (p % 4 === 0) thump(t, draw ? 0.26 : 0.2)
    if (p === 4 || p === 12) snap(t, draw ? 0.1 : 0.07)
    // shaker on the 8ths while waiting, the 16ths while drawing, accented off the beat
    if (draw || p % 2 === 0) shaker(t, p % 4 === 2 ? 0.05 : 0.025)
    // bass bounces between the root and its octave, with a pickup into the next bar
    if (p % 2 === 0) bass(p % 4 === 2 ? root * 2 : root, t, draw ? 0.13 : 0.11)
    if (p === 15) bass(mtof(ROOT[(bar + 1) & 3]) * 2, t, 0.07, S16 * 0.9)
    // a held pad chord per bar
    if (p === 0) pad(ch, t, S16 * 15.5, draw ? 0.011 : 0.013)
    // marimba: the hook while waiting, quick runs while drawing
    if (draw) {
      mallet(mtof(ch[ARP[p % 8]] + 12), t, p % 4 === 0 ? 0.03 : 0.018, Math.sin(s * 0.6) * 0.4)
    } else if (p % 2 === 0) {
      const m = HOOK[cycle & 1][bar][p / 2]
      if (m) mallet(mtof(m), t, 0.034)
    }
    // a sparkle at the top of every loop
    if (s === 0 && cycle === 0) bell(mtof(88), t, 0.012, 1.6, { bus: 'music', pan: 0.4, send: 0.6 }, 3.5, 1.5)
  }

  /** seconds between scheduling a sound and hearing it: the output latency of the device */
  function lag() {
    if (!ctx) return 0
    const c = ctx as AudioContext & { outputLatency?: number }
    return Math.min(0.3, (c.outputLatency || 0) + (c.baseLatency || 0))
  }

  const api = {
    init,
    /**
     * How long from now (ms) a sound scheduled with `at` can be heard at the earliest.
     * Animations that have sounds start this much later, so picture and sound land together.
     */
    leadMs() {
      return ok() ? Math.round((lag() + 0.03) * 1000) : 0
    },
    /** the audio-clock time to schedule a sound at so it is heard at performance.now() time `p` */
    at(p: number) {
      if (!ctx) return 0
      return ctx.currentTime + (p - performance.now()) / 1000 - lag()
    },
    /** The music gets busier while numbers are being drawn. */
    bindDrawing(fn: () => boolean) {
      drawing = fn
    },
    set(k: 'sfx' | 'music' | 'crowd' | 'voice', v: boolean) {
      init()
      if (k === 'sfx') sfxOn = crowdOn = v
      if (k === 'music') musicOn = v
      if (k === 'crowd') crowdOn = v
      if (k === 'voice') {
        voiceOn = v
        if (!v) {
          lines.length = 0
          synth?.cancel()
        }
      }
      if (ctx) syncMusic()
    },
    /** the caller says something; urgent cuts off the ball calls */
    say(text: string, urgent = false) {
      speak(text, urgent)
    },
    // ---- the balls: tiny sounds made once (see makeKit), each played as one buffer ----
    /** the blower: soft air with a few plastic clicks, until the first ball is sucked in (dur seconds) */
    whirl(dur = 1.5) {
      if (!ok()) return
      play(kit.whirl, now(), { vol: 0.09, dur: Math.min(dur, kit.whirl.duration) })
    },
    /** pipe i takes its ball: a light tok and a short swish down the tube */
    slide(i = 0, _dur = 1.1, at?: number) {
      if (!ok()) return
      const t = at ?? now()
      const pan = (i - 2) / 2.5
      play(kit.tok, t, { vol: 0.1, pan, rate: 0.9 + i * 0.04 })
      play(kit.swish, t + 0.03, { vol: 0.06, pan })
    },
    /** the ball pops out of its hole: a bubbly blip, climbing C – E – G – A – C across the tubes */
    ding(i: number, at?: number) {
      if (!ok()) return
      play(kit.pop, at ?? now(), { vol: 0.14, pan: (i - 2) / 2.5, rate: POP_STEPS[i] ?? 1 })
    },
    /** the ball settles in the tray under its hole */
    land(_n: number, i: number, at?: number) {
      if (!ok()) return
      play(kit.land, at ?? now(), { vol: 0.16, pan: (i - 2) / 2.5, rate: rnd(0.95, 1.05) })
    },
    /** one of your numbers came up */
    hit(at?: number) {
      if (!ok()) return
      play(kit.chime, at ?? now(), { vol: 0.45 })
    },
    /** end of a round you played */
    cheer(big: boolean) {
      if (!okC()) return
      const t = now()
      if (clip(big ? 'cheer' : 'cheer-small', t, { bus: 'crowd', dur: big ? 2.5 : 1.8 })) {
        return
      }
      crowd(t, big ? 2 : 1.2, big ? 0.7 : 0.4)
    },
    aww() {
      if (!okC()) return
      const t = now()
      noise(t, 1.0, { f0: 450, f1: 260, q: 0.6, vol: 0.05, a: 0.2, bus: 'crowd' })
      for (let k = 0; k < 5; k++) {
        const f = rnd(200, 360)
        voice(t + Math.random() * 0.2, f * 1.15, f * 0.6, rnd(0.9, 1.3), 0.035, [650, 1000], rnd(-0.8, 0.8))
      }
      for (let k = 0; k < 7; k++) handClap(t + 0.85 + Math.random() * 0.5, 0.04, rnd(-0.8, 0.8))
    },
    star(i: number) {
      if (!ok()) return
      const t = now()
      if (clip('star-' + (Math.min(3, i) + 1), t, { vol: CLIP_VOL.star })) return
      // a celesta note that climbs with each star
      const m = [81, 84, 88, 93][Math.min(3, i)]
      bell(mtof(m), t, 0.12, 1.2, {}, 4, 1.2)
      tone(mtof(m + 12), t, 0.5, { vol: 0.03, a: 0.002, send: 0.5 })
    },
    /** several of your numbers in one draw: a harp sweep that ends on a horn and a timpani hit */
    combo(n: number) {
      if (!ok()) return
      const t = now()
      const run = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91]
      const steps = Math.min(run.length, n + 4)
      gliss(run.slice(0, steps), t, 0.06, 0.05)
      const end = t + steps * 0.05
      timp(mtof(45), end, 0.22, 1.2)
      horn(mtof(run[steps - 1] - 12), end, 0.5, 0.025)
    },
    /** one number away: a timpani heartbeat under a rising string tremolo */
    near() {
      if (!ok()) return
      const t = now()
      if (clip('near', t)) return
      ;[0, 0.24, 0.8, 1.04].forEach((d, k) => timp(mtof(40), t + d, k % 2 ? 0.16 : 0.24, 0.5))
      ;[0, 7].forEach(iv => tone(mtof(57 + iv), t, 1.5, { vol: 0.03, to: mtof(64 + iv), type: 'sawtooth', lp: 1600, a: 0.7, vib: 12, send: 0.5 }))
      bell(mtof(88), t + 1.4, 0.07, 1, {}, 4, 1.2)
    },
    /** countdown: a grandfather clock, tick then tock, with a deep chime at the very end */
    tick(k: number) {
      if (!ok()) return
      const t = now()
      if (clip('tick', t, { rate: k % 2 ? 1 : 0.84 })) return
      const f = k % 2 ? 1250 : 980
      tone(f, t, 0.05, { vol: 0.15, a: 0.001, send: 0.15 })
      noise(t, 0.02, { f0: f * 2, q: 3, vol: 0.06, send: 0.1 })
      if (k <= 1) bell(mtof(45), t, 0.14, 2, { send: 0.5 }, 2.4, 2)
      else if (k <= 3) tone(70, t, 0.18, { vol: 0.1, to: 50, send: 0 })
    },
    pop() {
      if (!ok()) return
      const t = now()
      if (clip('card', t, { rate: rnd(0.95, 1.08) })) return
      // a thick card snapped onto the felt, with a little gold glint
      noise(t, 0.03, { f0: 1800, q: 1.2, vol: 0.12, a: 0.001, send: 0.1 })
      tone(260, t, 0.08, { vol: 0.1, to: 180, a: 0.002, send: 0.05 })
      bell(mtof(93), t + 0.03, 0.03, 0.4, {}, 4, 1)
    },
    swipe() {
      if (!ok()) return
      const t = now()
      const pan = rnd(-0.4, 0.4)
      if (clip('swipe', t, { pan, rate: rnd(0.95, 1.1) })) return
      noise(t, 0.2, { f0: 900, f1: 4200, q: 1.3, vol: 0.07, a: 0.04, pan, send: 0.15 })
      noise(t + 0.17, 0.02, { f0: 3000, q: 2, vol: 0.04, pan })
    },
    /** quick pick: a fresh pack is opened and dealt */
    deal() {
      if (!ok()) return
      const t = now()
      if (!clip('deal', t)) api.shimmer()
      else clip('swipe', t + 0.35, { rate: 1.1 })
    },
    /** a harp glissando */
    shimmer() {
      if (!ok()) return
      const t = now()
      // the cards fan out over the harp
      if (clip('fan', t)) boost *= 0.6
      ;[72, 74, 76, 79, 81, 84, 86, 88, 91].forEach((m, k) => {
        tone(mtof(m), t + k * 0.035, 0.7, { vol: 0.05, type: 'triangle', a: 0.002, pan: -0.6 + k * 0.15, send: 0.45 })
        tone(mtof(m + 12), t + k * 0.035, 0.25, { vol: 0.015, a: 0.002, pan: -0.6 + k * 0.15 })
      })
    },
    /** gold coins poured into a tray */
    coin() {
      if (!ok()) return
      const t = now()
      if (clip('coin', t)) clip('coin', t + 0.09, { vol: 0.7, rate: 1.1, pan: 0.3 })
      for (let k = 0; k < 6; k++) clink(rnd(2600, 3400), t + k * 0.045 + Math.random() * 0.02, 0.05 * (1 - k * 0.1), rnd(-0.5, 0.5))
      tone(140, t, 0.1, { vol: 0.08, to: 80, send: 0 })
      bell(mtof(91), t + 0.25, 0.04, 0.9, {}, 4, 1)
    },
    /** the draw starts: a timpani roll into a short royal horn call. Returns the seconds until the call. */
    go() {
      if (!ok()) return 0
      const t = now()
      // the call lands on a beat of the music
      const hit = nextBeat(t + 0.45)
      const r = hit - t
      timpRoll(mtof(45), t, r, 0.12)
      timp(mtof(45), hit, 0.3, 1.4)
      // G – C – E – G, the last one held
      ;[67, 72, 76].forEach((m, k) => horn(mtof(m), hit + k * 0.11, 0.12, 0.03, (k - 1) * 0.3))
      horn(mtof(79), hit + 0.33, 0.6, 0.032)
      return hit - ctx!.currentTime + lag()
    },
    /** round over: a gentle falling chime */
    end() {
      if (!ok()) return
      const t = now()
      if (clip('end', t)) return
      // the vibraphone walks down to the tonic over a soft piano chord
      ;[79, 76, 74, 72].forEach((m, k) => vibes(mtof(m), t + k * 0.18, 0.06, 1.2, 0.3 - k * 0.2))
      ;[60, 64, 67, 71].forEach((m, k) => rhodes(mtof(m), t + 0.55 + k * 0.01, 2, 0.03, -0.3 + k * 0.2))
    },
    /** the win popup: a royal fanfare over harp and timpani, and the whole hall cheering */
    bingo() {
      if (!ctx || ctx.state !== 'running') return
      const t = now()
      duck(t, 0.2, 2.5)
      if (ok() && !clip('jackpot', t)) {
        timp(mtof(43), t, 0.32, 1.8)
        crash(t, 0.04, 2.6)
        gliss([60, 64, 67, 72, 76, 79, 84, 88, 91, 96], t, 0.05, 0.035)
        // C – C – C – G, then a held C major chord
        ;[[72, 0], [72, 0.14], [72, 0.28], [79, 0.42]].forEach(([m, d]) => horn(mtof(m), t + 0.1 + d, 0.13, 0.034))
        ;[60, 64, 67, 72].forEach((m, k) => horn(mtof(m), t + 0.72, 1.1, 0.024, (k - 1.5) * 0.3))
        timp(mtof(36), t + 0.72, 0.3, 2)
        ;[84, 88, 91, 96].forEach((m, k) => bell(mtof(m), t + 0.75 + k * 0.07, 0.04, 1.4, { pan: -0.4 + k * 0.27 }, 4, 1.2))
      }
      if (!okC()) return
      // the cheer itself follows from cheer(), half a second later
      if (!clip('applause', t + 0.05, { bus: 'crowd', dur: 2.5 })) {
        boost = db(18)
        crowd(t + 0.05, 2.5, 0.9)
      }
    },
  }
  // every sound starts at its own trim and leaves the level at 1 for the next one
  for (const k of Object.keys(api) as (keyof typeof api)[]) {
    const f = api[k] as (...a: unknown[]) => unknown
    ;(api as Record<string, unknown>)[k] = (...a: unknown[]) => {
      boost = db(TRIM[k] ?? 0)
      try {
        return f(...a)
      } finally {
        boost = 1
      }
    }
  }
  return api
}

export const SFX = createSfx()
