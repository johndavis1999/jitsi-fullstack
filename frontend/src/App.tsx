import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Hash,
  Link2,
  MonitorUp,
  Plus,
  RefreshCw,
  UserRound,
  Video,
} from 'lucide-react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import SharedMeetingPage from './routes/SharedMeetingPage'
import './App.css'

const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN || '192.168.31.244:8443'
const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'https://192.168.31.244:3001').replace(/\/$/, '')

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

interface SessionUser {
  id: string
  name: string
}

interface HostedMeeting {
  id: string
  roomName: string
  title: string
  description: string
  hostId: string
  status: string
}

function readStoredUser(): SessionUser | null {
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

function readStoredProfileId() {
  if (readStoredUser()) return readStoredUser()?.id || ''
  try {
    return localStorage.getItem('encuentro.profileId') || ''
  } catch {
    return ''
  }
}

function saveSessionUser(profile: Profile | null) {
  try {
    if (profile) {
      const user = { id: profile.id, name: profile.name }
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('encuentro.profileId', profile.id)
      localStorage.setItem('encuentro.profileName', profile.name)
    } else {
      localStorage.removeItem('user')
      localStorage.removeItem('encuentro.profileId')
      localStorage.removeItem('encuentro.profileName')
    }
    return true
  } catch {
    return false
  }
}

function Dashboard() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState(readStoredProfileId)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [hostedMeetings, setHostedMeetings] = useState<HostedMeeting[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingsError, setMeetingsError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [copiedMeetingId, setCopiedMeetingId] = useState('')
  const [copiedNativeId, setCopiedNativeId] = useState('')
  const [shareError, setShareError] = useState('')
  const [creatingMeeting, setCreatingMeeting] = useState(false)
  const [openingNativeId, setOpeningNativeId] = useState('')

  const activeProfileId = profiles.some((profile) => profile.id === selectedProfileId)
    ? selectedProfileId
    : ''
  const selectedProfile = profiles.find((profile) => profile.id === activeProfileId)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProfiles() {
      setProfileLoading(true)
      setProfileError('')

      try {
        const response = await fetch(`${backendUrl}/api/users`, { signal: controller.signal })
        if (!response.ok) throw new Error('No se pudieron cargar los perfiles.')
        const data = await response.json() as { users: Profile[] }
        setProfiles(data.users)
        const savedProfileId = readStoredUser()?.id || ''
        const savedProfile = data.users.find((profile) => profile.id === savedProfileId)
        if (savedProfile) saveSessionUser(savedProfile)
      } catch (error) {
        if (!controller.signal.aborted) {
          setProfileError(error instanceof Error ? error.message : 'Error al conectar con el backend.')
        }
      } finally {
        if (!controller.signal.aborted) setProfileLoading(false)
      }
    }

    void loadProfiles()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (profileLoading || activeProfileId) return
    saveSessionUser(null)
  }, [activeProfileId, profileLoading])

  useEffect(() => {
    if (!activeProfileId) return

    const controller = new AbortController()

    async function loadMeetings() {
      setMeetingsLoading(true)
      setMeetingsError('')

      try {
        const response = await fetch(
          `${backendUrl}/api/users/${encodeURIComponent(activeProfileId)}/meetings`,
          { signal: controller.signal },
        )
        const data = await response.json() as { meetings?: HostedMeeting[]; error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudieron cargar las reuniones.')
        setHostedMeetings(data.meetings || [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setHostedMeetings([])
          setMeetingsError(error instanceof Error ? error.message : 'Error al conectar con el backend.')
        }
      } finally {
        if (!controller.signal.aborted) setMeetingsLoading(false)
      }
    }

    void loadMeetings()
    return () => controller.abort()
  }, [activeProfileId, refreshVersion])

  function joinMeeting(hostedMeeting: HostedMeeting) {
    if (!selectedProfile) return

    navigate(`/${hostedMeeting.id}`)
  }

  async function copyMeetingLink(hostedMeeting: HostedMeeting) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${hostedMeeting.id}`)
      setCopiedMeetingId(hostedMeeting.id)
      setShareError('')
    } catch {
      setShareError(`No se pudo copiar. Enlace de ${hostedMeeting.title}: ${window.location.origin}/${hostedMeeting.id}`)
    }
  }

  async function copyNativeMeetingLink(hostedMeeting: HostedMeeting) {
    const url = `https://${jitsiDomain}/${encodeURIComponent(hostedMeeting.roomName)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedNativeId(hostedMeeting.id)
      setShareError('')
    } catch {
      setShareError(`No se pudo copiar. Enlace nativo para invitados: ${url}`)
    }
  }

  function refreshMeetings() {
    setRefreshVersion((version) => version + 1)
  }

  async function createMeeting() {
    if (!selectedProfile || creatingMeeting) return
    setCreatingMeeting(true)
    setMeetingsError('')
    try {
      const response = await fetch(`${backendUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedProfile.id }),
      })
      const data = await response.json() as { meeting?: HostedMeeting }
      if (!response.ok || !data.meeting) throw new Error('No se pudo crear la reunion.')
      setRefreshVersion((version) => version + 1)
    } catch (error) {
      setMeetingsError(error instanceof Error ? error.message : 'No se pudo crear la reunion.')
    } finally {
      setCreatingMeeting(false)
    }
  }

  async function openNativeMeeting(hostedMeeting: HostedMeeting) {
    if (!selectedProfile || openingNativeId) return
    const nativeWindow = window.open('', '_blank')
    if (!nativeWindow) {
      setShareError('Permite ventanas emergentes para abrir Jitsi nativo.')
      return
    }
    setOpeningNativeId(hostedMeeting.id)
    setShareError('')
    try {
      const response = await fetch(`${backendUrl}/api/meetings/${encodeURIComponent(hostedMeeting.id)}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedProfile.id }),
      })
      const data = await response.json() as { token?: string }
      if (!response.ok || !data.token) throw new Error('No se pudo validar al anfitrion.')
      const url = new URL(`https://${jitsiDomain}/${encodeURIComponent(hostedMeeting.roomName)}`)
      url.searchParams.set('jwt', data.token)
      nativeWindow.location.replace(url.href)
      nativeWindow.opener = null
    } catch {
      nativeWindow.close()
      setShareError('No se pudo abrir Jitsi nativo o validar al anfitrion.')
    } finally {
      setOpeningNativeId('')
    }
  }

  return (
    <main className="lobby-shell">
      <header className="site-header">
        <a className="brand-lockup" href="#inicio" aria-label="Encuentro, inicio">
          <span className="brand-symbol"><Video size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">Encuentro</span>
        </a>
        <div className="header-actions">
          <a className="server-link" href={`https://${jitsiDomain}`} target="_blank" rel="noreferrer">
            <span className="server-indicator" />
            <span>Instancia configurada</span>
            <ArrowUpRight size={15} />
          </a>
          <label className="profile-picker">
            <UserRound size={17} aria-hidden="true" />
            <span className="visually-hidden">Perfil simulado</span>
            <select
              aria-label="Seleccionar perfil"
              disabled={profileLoading || profiles.length === 0}
              onChange={(event) => {
                const profileId = event.target.value
                setHostedMeetings([])
                setMeetingsError('')
                setSelectedProfileId(profileId)
                const profile = profiles.find((item) => item.id === profileId) || null
                if (!saveSessionUser(profile)) {
                  setProfileError('No se pudo guardar el perfil en este navegador.')
                }
              }}
              value={activeProfileId}
            >
              <option value="">{profileLoading ? 'Cargando perfiles…' : 'Elegir perfil'}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>
      </header>

      <section className="lobby-content" id="inicio">
        <div className="dashboard-column">
          <div className="eyebrow"><span /> REUNIONES ASIGNADAS</div>
          <h1>Tu agenda.<br /><em>Tus reuniones.</em></h1>
          <p className="intro-copy">
            {selectedProfile
              ? `Reuniones moderadas por ${selectedProfile.name}.`
              : 'Elige un perfil para consultar las reuniones que modera.'}
          </p>

          <section className="meetings-section" aria-labelledby="meetings-heading">
            <div className="meetings-toolbar">
              <div>
                <span className="section-kicker">PANEL DEL ANFITRIÓN</span>
                <h2 id="meetings-heading">{selectedProfile ? 'Tus salas' : 'Salas disponibles por perfil'}</h2>
              </div>
              <button className="meeting-join-button" disabled={!selectedProfile || creatingMeeting} onClick={() => void createMeeting()} type="button">
                <Plus size={16} /> {creatingMeeting ? 'Creando...' : 'Crear sala'}
              </button>
              <button
                className="refresh-button"
                disabled={!selectedProfileId || meetingsLoading}
                onClick={refreshMeetings}
                title="Actualizar reuniones"
                type="button"
              >
                <RefreshCw size={17} className={meetingsLoading ? 'is-spinning' : ''} />
              </button>
            </div>

            {profileError && <p className="inline-error" role="alert">{profileError}</p>}
            {meetingsError && <p className="inline-error" role="alert">{meetingsError}</p>}
            {shareError && <p className="inline-error" role="alert">{shareError}</p>}

            {!selectedProfileId && !profileLoading && !profileError && (
              <div className="meetings-empty">
                <UserRound size={22} />
                <strong>Selecciona un perfil</strong>
                <span>La lista mostrará las reuniones donde ese perfil es anfitrión.</span>
              </div>
            )}

            {meetingsLoading && activeProfileId && (
              <div className="meetings-empty" role="status">
                <span className="loader-ring loader-ring-dark" />
                <strong>Consultando el backend</strong>
              </div>
            )}

            {!meetingsLoading && activeProfileId && !meetingsError && hostedMeetings.length === 0 && (
              <div className="meetings-empty">
                <CalendarDays size={22} />
                <strong>No hay reuniones asignadas</strong>
                <span>Este perfil todavía no tiene reuniones como anfitrión.</span>
              </div>
            )}

            {!meetingsLoading && hostedMeetings.length > 0 && (
              <div className="meeting-list" aria-live="polite">
                {hostedMeetings.map((hostedMeeting) => (
                  <article className="meeting-row" key={hostedMeeting.id}>
                    <div className="meeting-mark"><Video size={18} /></div>
                    <div className="meeting-copy">
                      <div className="meeting-title-line">
                        <h3>{hostedMeeting.title}</h3>
                        <span className="meeting-status">{hostedMeeting.status === 'scheduled' ? 'Programada' : hostedMeeting.status}</span>
                      </div>
                      <p>{hostedMeeting.description}</p>
                      <span className="meeting-id"><Hash size={12} /> {hostedMeeting.id.slice(0, 8)}</span>
                    </div>
                    <div className="meeting-actions">
                      <button
                        aria-label={`Abrir ${hostedMeeting.title} en Jitsi nativo como moderador`}
                        className="meeting-share-button"
                        disabled={Boolean(openingNativeId)}
                        onClick={() => void openNativeMeeting(hostedMeeting)}
                        title="Abrir Jitsi nativo como moderador"
                        type="button"
                      >
                        <MonitorUp size={16} />
                      </button>
                      <button
                        aria-label={copiedNativeId === hostedMeeting.id ? 'Enlace nativo copiado' : `Copiar enlace nativo de ${hostedMeeting.title}`}
                        className="meeting-share-button"
                        onClick={() => void copyNativeMeetingLink(hostedMeeting)}
                        title={copiedNativeId === hostedMeeting.id ? 'Enlace nativo copiado' : 'Copiar enlace nativo para invitados'}
                        type="button"
                      >
                        {copiedNativeId === hostedMeeting.id ? <Check size={16} /> : <Link2 size={16} />}
                      </button>
                      <button
                        aria-label={copiedMeetingId === hostedMeeting.id ? 'Enlace copiado' : `Copiar enlace de ${hostedMeeting.title}`}
                        className="meeting-share-button"
                        onClick={() => void copyMeetingLink(hostedMeeting)}
                        title={copiedMeetingId === hostedMeeting.id ? 'Enlace copiado' : 'Copiar enlace para invitar'}
                        type="button"
                      >
                        {copiedMeetingId === hostedMeeting.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button className="meeting-join-button" onClick={() => joinMeeting(hostedMeeting)} type="button">
                        <span>Entrar</span>
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="instance-panel" aria-label="Configuración de la instancia">
          <div className="panel-topline">
            <span>01</span>
            <span>MI INSTANCIA</span>
          </div>
          <div className="signal-art" aria-hidden="true">
            <div className="signal-orbit orbit-one" />
            <div className="signal-orbit orbit-two" />
            <div className="signal-core"><Video size={30} strokeWidth={1.6} /></div>
            <span className="signal-dot dot-one" />
            <span className="signal-dot dot-two" />
            <span className="signal-dot dot-three" />
          </div>
          <div className="instance-details">
            <span className="instance-caption">SERVIDOR JITSI</span>
            <strong>{jitsiDomain}</strong>
            <span className="instance-state"><span /> Configurado para esta instancia</span>
          </div>
          <div className="panel-footer">
            <span>JITSI MEET</span>
            <span>WEBRTC</span>
            <span>LOCAL / VPS</span>
          </div>
        </aside>
      </section>

      <footer className="site-footer">
        <span>ENCUENTRO · VIDEOCONFERENCIA</span>
        <span>Conectado a infraestructura propia</span>
      </footer>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/:meetingId" element={<SharedMeetingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
