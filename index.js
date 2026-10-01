const express = require('express')
const app = express()
const cors = require('cors')
const { randomBytes } = require('crypto')
require('dotenv').config()

app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const users = []

const parseDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10) === value ? date : null
}

app.post('/api/users', (req, res) => {
  const body = req.body || {}
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!username) return res.status(400).json({ error: 'Username is required.' })

  const user = { username, _id: randomBytes(12).toString('hex'), exercises: [] }
  users.push(user)
  res.json({ username: user.username, _id: user._id })
})

app.get('/api/users', (req, res) => {
  res.json(users.map(({ username, _id }) => ({ username, _id })))
})

app.post('/api/users/:_id/exercises', (req, res) => {
  const user = users.find(({ _id }) => _id === req.params._id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const body = req.body || {}
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const duration = Number(body.duration)
  const date = body.date ? parseDate(body.date) : new Date()
  if (!description || !Number.isFinite(duration) || duration <= 0 || !date) {
    return res.status(400).json({ error: 'Description, a positive duration, and a valid date are required.' })
  }

  const exercise = { description, duration, date, _id: user._id }
  user.exercises.push(exercise)
  res.json({ username: user.username, ...exercise, date: date.toDateString() })
})

app.get('/api/users/:_id/exercises', (req, res) => {
  res.redirect(302, `/api/users/${req.params._id}/logs`)
})

app.get('/api/users/:_id/logs', (req, res) => {
  const user = users.find(({ _id }) => _id === req.params._id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const { from, to, limit } = req.query
  const fromDate = from === undefined ? null : parseDate(from)
  const toDate = to === undefined ? null : parseDate(to)
  const parsedLimit = limit === undefined ? null : Number(limit)
  if ((from !== undefined && !fromDate) || (to !== undefined && !toDate) ||
      (limit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 0))) {
    return res.status(400).json({ error: 'Use valid dates (yyyy-mm-dd) and a non-negative integer limit.' })
  }

  let log = user.exercises.filter(({ date }) =>
    (!fromDate || date >= fromDate) &&
    (!toDate || date <= new Date(`${to}T23:59:59.999Z`))
  )
  if (parsedLimit !== null) log = log.slice(0, parsedLimit)

  res.json({
    _id: user._id,
    username: user.username,
    count: log.length,
    log: log.map(({ description, duration, date }) => ({
      description,
      duration,
      date: date.toDateString()
    }))
  })
})

if (require.main === module) {
  const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
  })
}

module.exports = app
