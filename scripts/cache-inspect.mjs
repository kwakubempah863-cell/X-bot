// scripts/cache-inspect.mjs
import Database from 'better-sqlite3'

const db = new Database('data/x-runtime.sqlite')

const targetId = process.argv[2] || 'A5ED54BA8750312216737ACF538CB62D'

console.log('=== Lookup for message_id:', targetId, '===')
const row = db.prepare(`
  SELECT message_id, kind, stored_at, length(envelope) AS bytes
  FROM antidelete_cache
  WHERE message_id = ?
`).get(targetId)
console.log(row || 'NOT FOUND')

console.log('')
console.log('=== Count by kind ===')
const byKind = db.prepare(`
  SELECT kind, COUNT(*) AS c
  FROM antidelete_cache
  GROUP BY kind
`).all()
console.table(byKind)

console.log('')
console.log('=== Last 20 rows (any kind) ===')
const recent = db.prepare(`
  SELECT message_id, kind, stored_at, length(envelope) AS bytes
  FROM antidelete_cache
  ORDER BY stored_at DESC
  LIMIT 20
`).all()
for (const r of recent) {
  const when = new Date(r.stored_at).toISOString()
  console.log(`  ${when}  ${String(r.kind).padEnd(8)}  ${String(r.bytes).padStart(6)}b  ${r.message_id}`)
}

console.log('')
console.log('=== All viewonce rows (if any) ===')
const vo = db.prepare(`
  SELECT message_id, kind, stored_at, length(envelope) AS bytes
  FROM antidelete_cache
  WHERE kind = 'viewonce'
  ORDER BY stored_at DESC
  LIMIT 10
`).all()
if (vo.length) {
  console.table(vo)
} else {
  console.log('NONE')
}

console.log('')
console.log('=== Total rows ===')
console.log(db.prepare('SELECT COUNT(*) AS c FROM antidelete_cache').get().c)