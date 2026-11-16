import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Hash, UserRound, Video } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import MeetingCall from '../components/MeetingCall'

const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN || '192.168.31.244:8443'
const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'https://192.168.31.244:3001').replace(/\/$/, '')

interface Profile {
  id: string
  name: string
}

interface SessionUser {
  id: string
  name: string
}

interface MeetingInfo {
  id: string
  roomName: string
  title: string
  description: string
  hostId: string
  status: string
}

interface CachedMeetingToken {
  token: string
  expiresAt: number
}

function readSessionUser(): SessionUser | null {
  try {
    const stored = localStorage.getItem('user')
    if (stored) {
      const user = JSON.parse(stored) as Partial<SessionUser>
      if (typeof user.id === 'string' && typeof user.name === 'string') {
        return { id: user.id, name: user.name }
      }
    }

    const id = localStorage.getItem('encuentro.profileId') || ''
    const name = localStorage.getItem('encuentro.profileName') || ''
    return id && name ? { id, name } : null
  } catch {
    return null
  }
}

export default function SharedMeetingPage() {
  const { meetingId = '' } = useParams()
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null)
  const [host, setHost] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionUser] = useState(readSessionUser)
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [meetingToken, setMeetingToken] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()

    async function loadMeeting() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`${backendUrl}/api/meetings/${encodeURIComponent(meetingId)}`, {
          signal: controller.signal,
        })
        const data = await response.json() as { meeting?: MeetingInfo; host?: Profile; error?: string }
        if (!response.ok || !data.meeting) {
          throw new Error(data.error === 'meeting_not_found' ? 'No encontramos esa reunión.' : 'No se pudo cargar la invitación.')
        }
        setMeeting(data.meeting)
        setHost(data.host || null)
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Error al conectar con el backend.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadMeeting()
    return () => controller.abort()
  }, [meetingId])

  if (joined && meeting) {
    return (
      <MeetingCall
        roomName={meeting.roomName}
        displayName={sessionUser?.name || ''}
        jwt={meetingToken}
        onLeave={() => setJoined(false)}
      />
    )
  }

  if (loading) {
    return (
      <main className="invite-state">
        <span className="loader-ring loader-ring-dark" />
        <span>Buscando la reunión</span>
      </main>
    )
  }

  if (error || !meeting) {
    return (
      <main className="invite-state">
        <strong>{error || 'No encontramos esa reunión.'}</strong>
        <Link className="invite-back-link" to="/"><ArrowLeft size={16} /> Volver a Encuentro</Link>
      </main>
    )
  }

  async function joinMeeting() {
    if (!sessionUser || !meeting || joining) return

    setJoining(true)
    setJoinError('')

    try {
      let token: string | undefined
      if (meeting.hostId === sessionUser.id) {
        const cacheKey = `encuentro.jwt.${meeting.id}.${sessionUser.id}`
        let cached: CachedMeetingToken | null = null

        try {
          cached = JSON.parse(localStorage.getItem(cacheKey) || 'null') as CachedMeetingToken | null
        } catch {
          cached = null
        }

        if (cached && cached.expiresAt > Date.now() + 60_000) {
          token = cached.token
        } else {
          const response = await fetch(`${backendUrl}/api/meetings/${encodeURIComponent(meeting.id)}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: sessionUser.id }),
          })
          const data = await response.json() as { token?: string; expiresAt?: number; error?: string }
          if (!response.ok || !data.token || !data.expiresAt) {
            throw new Error(data.error === 'jwt_auth_not_configured'
              ? 'La autenticación JWT todavía no está activada en Jitsi.'
              : 'No se pudo validar al anfitrión para esta reunión.')
          }

          token = data.token
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ token, expiresAt: data.expiresAt } satisfies CachedMeetingToken))
          } catch {
            // The token is still usable for this join even when storage is disabled.
          }
        }
      }

      setMeetingToken(token)
      setJoined(true)
    } catch (requestError) {
      setJoinError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar la reunión.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="lobby-shell">
      <header className="site-header">
        <Link className="brand-lockup" to="/" aria-label="Volver a Encuentro">
          <span className="brand-symbol"><Video size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">Encuentro</span>
        </Link>
        <a className="server-link" href={`https://${jitsiDomain}`} target="_blank" rel="noreferrer">
          <span className="server-indicator" />
          <span>Instancia configurada</span>
          <ArrowUpRight size={15} />
        </a>
      </header>

      <section className="lobby-content invite-content">
        <div className="dashboard-column">
          <div className="eyebrow"><span /> INVITACIÓN A REUNIÓN</div>
          <h1>Hay un lugar<br /><em>para ti.</em></h1>
          <p className="intro-copy">Revisa los detalles y únete con el perfil guardado en este dispositivo.</p>

          <section className="invite-meeting" aria-labelledby="invite-title">
            <div className="invite-meeting-topline">
              <span className="meeting-mark"><Video size={18} /></span>
              <span className="meeting-status">{meeting.status === 'scheduled' ? 'Programada' : meeting.status}</span>
            </div>
            <h2 id="invite-title">{meeting.title}</h2>
            <p>{meeting.description}</p>
            <div className="invite-host"><UserRound size={15} /> Anfitrión: {host?.name || 'Usuario de Encuentro'}</div>
            <div className="invite-room-id"><Hash size={13} /> {meeting.id}</div>
          </section>

          {sessionUser ? (
            <div className="invite-session">
              <span className="session-caption">PERFIL DE ESTA SESIÓN</span>
              <strong><UserRound size={16} /> {sessionUser.name}</strong>
              {sessionUser.id === meeting.hostId && <span className="host-session-badge">Anfitrión verificado por el backend</span>}
              {joinError && <p className="inline-error" role="alert">{joinError}</p>}
              <button className="join-button" disabled={joining} onClick={() => void joinMeeting()} type="button">
                <Video size={19} />
                <span>{joining ? 'Preparando acceso…' : `Unirme como ${sessionUser.name}`}</span>
                <ArrowUpRight size={17} />
              </button>
            </div>
          ) : (
            <div className="invite-no-session">
              <p>Para unirte, primero selecciona un perfil en este dispositivo.</p>
              <Link className="join-button" to="/">
                <UserRound size={19} />
                <span>Elegir perfil</span>
                <ArrowUpRight size={17} />
              </Link>
            </div>
          )}
          <p className="privacy-note">Se solicitará permiso para utilizar tu micrófono. La cámara inicia apagada.</p>
        </div>

        <aside className="instance-panel" aria-label="Servidor de videollamadas">
          <div className="panel-topline"><span>JITSI</span><span>REUNIÓN COMPARTIDA</span></div>
          <div className="signal-art" aria-hidden="true">
            <div className="signal-orbit orbit-one" />
            <div className="signal-orbit orbit-two" />
            <div className="signal-core"><Video size={30} strokeWidth={1.6} /></div>
            <span className="signal-dot dot-one" />
            <span className="signal-dot dot-two" />
            <span className="signal-dot dot-three" />
          </div>
          <div className="instance-details">
            <span className="instance-caption">SALA PERMANENTE</span>
            <strong>{meeting.roomName}</strong>
            <span className="instance-state"><span /> Enlace listo para compartir</span>
          </div>
          <div className="panel-footer"><span>JITSI MEET</span><span>UUID</span><span>WEBRTC</span></div>
        </aside>
      </section>

      <footer className="site-footer">
        <Link className="invite-home-link" to="/"><ArrowLeft size={14} /> Volver a mis reuniones</Link>
        <span>ENCUENTRO · VIDEOCONFERENCIA</span>
      </footer>
    </main>
  )
}
