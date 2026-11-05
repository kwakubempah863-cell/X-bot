import db from '../db.mjs'

const r = db.prepare(`
  DELETE FROM tenants
  WHERE id != 'default'
    AND status NOT IN ('connected', 'approved')
`).run()

console.log('deleted:', r.changes)
console.log(
  'remaining:',
  db.prepare('SELECT id, status FROM tenants').all()
)