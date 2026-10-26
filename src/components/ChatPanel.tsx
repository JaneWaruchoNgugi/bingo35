import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useGame } from '../hooks/useGame'

/** A steady colour per name, so each player keeps the same avatar colour. */
const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

export function ChatPanel() {
  const g = useGame()
  const log = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')

  useLayoutEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [g.chatLog[g.chatLog.length - 1]?.id])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (v) {
      g.say('You', v)
      setText('')
    }
  }

  return (
    <div className="gp chatp">
      <div className="pt">Live Chat</div>
      <div className="chat" ref={log} aria-live="polite">
        {g.chatLog.map(m => (
          <p key={m.id} className={m.who === 'Host' ? 'chost' : m.who === 'You' ? 'you' : ''}>
            <i className="cav" style={{ '--h': hue(m.who) } as React.CSSProperties} aria-hidden="true">
              {m.who[0]}
            </i>
            <span className="cmsg">
              <b>{m.who}</b> <span>{m.msg}</span>
            </span>
          </p>
        ))}
      </div>
      <form className="chat-in" onSubmit={submit}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…" autoComplete="off" />
        <button className="ghost" type="submit">
          Send
        </button>
      </form>
    </div>
  )
}
