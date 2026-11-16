import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app.js'
import { meetings, users } from '../src/data.js'

let server
let baseUrl

before(async () => {
  server = createServer(createApp({ frontendOrigins: ['https://localhost:5174'] }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
})

test('health endpoint reports the prototype API as ready', async () => {
  const response = await fetch(`${baseUrl}/api/health`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'meeting-prototype-api',
  })
})

test('demo data contains four users and ten unique UUID rooms', () => {
  assert.equal(users.length, 4)
  assert.equal(meetings.length, 10)
  assert.equal(new Set(meetings.map((meeting) => meeting.id)).size, 10)
  assert.ok(meetings.every((meeting) => meeting.id === meeting.roomName))
  assert.ok(meetings.every((meeting) => users.some((user) => user.id === meeting.hostId)))
})

test('host meetings endpoint returns only the selected host meetings', async () => {
  const host = users[0]
  const response = await fetch(`${baseUrl}/api/users/${host.id}/meetings`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.host.id, host.id)
  assert.equal(body.meetings.length, 3)
  assert.ok(body.meetings.every((meeting) => meeting.hostId === host.id))
})

test('host meetings endpoint validates UUIDs and unknown users', async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/users/nope/meetings`)
  const missingResponse = await fetch(`${baseUrl}/api/users/00000000-0000-4000-8000-000000000000/meetings`)

  assert.equal(invalidResponse.status, 400)
  assert.deepEqual(await invalidResponse.json(), { error: 'invalid_user_id' })
  assert.equal(missingResponse.status, 404)
  assert.deepEqual(await missingResponse.json(), { error: 'user_not_found' })
})

test('shared meeting endpoint resolves the reusable room and host by UUID', async () => {
  const meeting = meetings[0]
  const response = await fetch(`${baseUrl}/api/meetings/${meeting.id}`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.meeting.id, meeting.id)
  assert.equal(body.meeting.roomName, meeting.roomName)
  assert.equal(body.host.id, meeting.hostId)
})

test('shared meeting endpoint rejects invalid and unknown UUIDs', async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/meetings/nope`)
  const missingResponse = await fetch(`${baseUrl}/api/meetings/00000000-0000-4000-8000-000000000000`)

  assert.equal(invalidResponse.status, 400)
  assert.deepEqual(await invalidResponse.json(), { error: 'invalid_meeting_id' })
  assert.equal(missingResponse.status, 404)
  assert.deepEqual(await missingResponse.json(), { error: 'meeting_not_found' })
})

test('only the configured host can receive a room-scoped JWT valid for 30 days', async () => {
  const previousAppId = process.env.JWT_APP_ID
  const previousSecret = process.env.JWT_APP_SECRET
  process.env.JWT_APP_ID = 'meeting-prototype-test'
  process.env.JWT_APP_SECRET = 'test-secret-with-sufficient-length-for-hmac'

  try {
    const meeting = meetings[0]
    const response = await fetch(`${baseUrl}/api/meetings/${meeting.id}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: meeting.hostId }),
    })
    const body = await response.json()
    const claims = jwt.verify(body.token, process.env.JWT_APP_SECRET, {
      algorithms: ['HS256'],
      audience: process.env.JWT_APP_ID,
      issuer: process.env.JWT_APP_ID,
    })

    assert.equal(response.status, 201)
    assert.equal(claims.room, meeting.roomName)
    assert.equal(claims.context.user.id, meeting.hostId)
    assert.equal(claims.context.user.name, users[0].name)
    assert.equal(claims.context.user.moderator, true)
    assert.equal(claims.sub, 'meet.jitsi')
    assert.equal(claims.exp - claims.iat, 30 * 24 * 60 * 60)
    assert.equal(body.expiresAt, claims.exp * 1000)
    assert.equal(body.expiresInSeconds, 30 * 24 * 60 * 60)
  } finally {
    if (previousAppId === undefined) delete process.env.JWT_APP_ID
    else process.env.JWT_APP_ID = previousAppId
    if (previousSecret === undefined) delete process.env.JWT_APP_SECRET
    else process.env.JWT_APP_SECRET = previousSecret
  }
})

test('non-hosts cannot request a moderator JWT', async () => {
  const meeting = meetings[0]
  const nonHost = users[1]
  const response = await fetch(`${baseUrl}/api/meetings/${meeting.id}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: nonHost.id }),
  })

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'host_only' })
})

test('a demo user can create a room that is scoped to its host', async () => {
  const response = await fetch(`${baseUrl}/api/meetings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: users[1].id }),
  })
  const { meeting } = await response.json()
  assert.equal(response.status, 201)
  assert.equal(meeting.roomName, meeting.id)
  assert.equal(meeting.hostId, users[1].id)
  const lookup = await fetch(`${baseUrl}/api/meetings/${meeting.id}`)
  assert.equal((await lookup.json()).meeting.id, meeting.id)
  const previousAppId = process.env.JWT_APP_ID
  const previousSecret = process.env.JWT_APP_SECRET
  process.env.JWT_APP_ID = 'meeting-prototype-test'
  process.env.JWT_APP_SECRET = 'test-secret-with-sufficient-length-for-hmac'
  try {
    const hostResponse = await fetch(`${baseUrl}/api/meetings/${meeting.id}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: users[1].id }),
    })
    assert.equal(hostResponse.status, 201)
    const { token } = await hostResponse.json()
    const claims = jwt.verify(token, process.env.JWT_APP_SECRET, { algorithms: ['HS256'] })
    assert.equal(claims.room, meeting.id)
    assert.equal(claims.context.user.id, users[1].id)
    assert.equal(claims.context.user.moderator, true)
  } finally {
    if (previousAppId === undefined) delete process.env.JWT_APP_ID
    else process.env.JWT_APP_ID = previousAppId
    if (previousSecret === undefined) delete process.env.JWT_APP_SECRET
    else process.env.JWT_APP_SECRET = previousSecret
  }
  const rejected = await fetch(`${baseUrl}/api/meetings/${meeting.id}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: users[0].id }),
  })
  assert.equal(rejected.status, 403)
  const invalid = await fetch(`${baseUrl}/api/meetings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'invalid' }),
  })
  assert.equal(invalid.status, 400)
})

test('CORS allows the configured React frontend origin', async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    headers: { Origin: 'https://localhost:5174' },
  })

  assert.equal(response.headers.get('access-control-allow-origin'), 'https://localhost:5174')
})