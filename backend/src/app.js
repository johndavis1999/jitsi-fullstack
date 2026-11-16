import cors from 'cors'
import { randomUUID } from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import { meetings, users } from './data.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const jwtLifetimeDays = 30
const jwtLifetimeSeconds = jwtLifetimeDays * 24 * 60 * 60

export function createApp({ frontendOrigins } = {}) {
  const availableMeetings = [...meetings]
  const allowedOrigins = new Set(
    frontendOrigins
      ?? process.env.FRONTEND_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)
      ?? ['https://localhost:5174', 'https://192.168.31.244:5174'],
  )
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin))
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 204,
  }))
  app.use(express.json({ limit: '16kb' }))
  app.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'meeting-prototype-api' })
  })

  app.get('/api/users', (_request, response) => {
    response.json({ users })
  })

  app.get('/api/users/:userId/meetings', (request, response) => {
    const { userId } = request.params

    if (!uuidPattern.test(userId)) {
      response.status(400).json({ error: 'invalid_user_id' })
      return
    }

    const host = users.find((user) => user.id === userId)

    if (!host) {
      response.status(404).json({ error: 'user_not_found' })
      return
    }

    response.json({
      host,
      meetings: availableMeetings.filter((meeting) => meeting.hostId === host.id),
    })
  })

  app.post('/api/meetings', (request, response) => {
    const { userId } = request.body || {}
    if (!uuidPattern.test(userId || '')) {
      response.status(400).json({ error: 'invalid_user_id' })
      return
    }
    const host = users.find((user) => user.id === userId)
    if (!host) {
      response.status(404).json({ error: 'user_not_found' })
      return
    }
    const id = randomUUID()
    const meeting = { id, roomName: id, title: 'Reunion libre', description: 'Sala creada por el anfitrion.', hostId: host.id, status: 'scheduled' }
    availableMeetings.push(meeting)
    response.status(201).json({ meeting, host })
  })

  app.get('/api/meetings/:meetingId', (request, response) => {
    const { meetingId } = request.params

    if (!uuidPattern.test(meetingId)) {
      response.status(400).json({ error: 'invalid_meeting_id' })
      return
    }

    const meeting = availableMeetings.find((item) => item.id === meetingId)

    if (!meeting) {
      response.status(404).json({ error: 'meeting_not_found' })
      return
    }

    const host = users.find((user) => user.id === meeting.hostId)
    response.json({ meeting, host })
  })

  app.post('/api/meetings/:meetingId/token', (request, response) => {
    const { meetingId } = request.params
    const { userId } = request.body || {}

    if (!uuidPattern.test(meetingId)) {
      response.status(400).json({ error: 'invalid_meeting_id' })
      return
    }

    if (!uuidPattern.test(userId || '')) {
      response.status(400).json({ error: 'invalid_user_id' })
      return
    }

    const meeting = availableMeetings.find((item) => item.id === meetingId)

    if (!meeting) {
      response.status(404).json({ error: 'meeting_not_found' })
      return
    }

    const user = users.find((item) => item.id === userId)

    if (!user) {
      response.status(404).json({ error: 'user_not_found' })
      return
    }

    if (meeting.hostId !== user.id) {
      response.status(403).json({ error: 'host_only' })
      return
    }

    const appId = process.env.JWT_APP_ID
    const appSecret = process.env.JWT_APP_SECRET

    if (!appId || !appSecret) {
      response.status(503).json({ error: 'jwt_auth_not_configured' })
      return
    }

    const token = jwt.sign({
      room: meeting.roomName,
      context: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          moderator: true,
        },
      },
    }, appSecret, {
      algorithm: 'HS256',
      audience: appId,
      expiresIn: jwtLifetimeSeconds,
      issuer: appId,
      subject: process.env.JWT_XMPP_DOMAIN || 'meet.jitsi',
    })

    const claims = jwt.decode(token)
    response.status(201).json({
      token,
      expiresAt: claims.exp * 1000,
      expiresInSeconds: jwtLifetimeSeconds,
      roomName: meeting.roomName,
    })
  })

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' })
  })

  return app
}