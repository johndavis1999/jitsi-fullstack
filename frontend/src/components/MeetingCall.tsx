import { useRef, useState } from 'react'
import { JitsiMeeting } from '@jitsi/react-sdk'
import { ArrowLeft, Hash, Video } from 'lucide-react'

interface MeetingApi {
  executeCommand: (command: string) => void
  dispose: () => void
}

interface MeetingCallProps {
  roomName: string
  displayName: string
  jwt?: string
  onLeave: () => void
}

const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN || '192.168.31.244:8443'

export default function MeetingCall({ roomName, displayName, jwt, onLeave }: MeetingCallProps) {
  const [loading, setLoading] = useState(true)
  const apiRef = useRef<MeetingApi | null>(null)

  function leaveCall() {
    apiRef.current?.dispose()
    apiRef.current = null
    onLeave()
  }

  return (
    <main className="call-shell">
      <header className="call-header">
        <a className="brand-lockup" href="/" aria-label="Volver a Encuentro">
          <span className="brand-symbol"><Video size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">Encuentro</span>
        </a>
        <div className="call-room-label">
          <Hash size={15} />
          <span>{roomName}</span>
        </div>
        <button className="back-button" onClick={() => apiRef.current?.executeCommand('hangup')} type="button">
          <ArrowLeft size={17} />
          <span>Salir</span>
        </button>
      </header>
      <section className="meeting-stage" aria-label={`Reunión ${roomName}`}>
        {loading && (
          <div className="meeting-loader" role="status">
            <span className="loader-ring" />
            <span>Conectando a la sala</span>
          </div>
        )}
        <JitsiMeeting
          key={roomName}
          domain={jitsiDomain}
          roomName={roomName}
          jwt={jwt}
          lang="es"
          userInfo={{ displayName, email: '' }}
          configOverwrite={{
            disableDeepLinking: true,
            hideLoginButton: true,
            prejoinConfig: { enabled: false },
            readOnlyName: true,
            startWithAudioMuted: false,
            startWithVideoMuted: true,
          }}
          onApiReady={(api) => {
            apiRef.current = api
            setLoading(false)
          }}
          onReadyToClose={leaveCall}
          getIFrameRef={(node) => {
            node.style.width = '100%'
            node.style.height = '100%'
          }}
        />
      </section>
    </main>
  )
}
