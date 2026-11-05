// server/auth-store.mjs
import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys'
import db from './db.mjs'

/**
 * A production-grade SQLite-backed auth state for Baileys.
 * This replaces the fragile `useMultiFileAuthState`.
 */
export async function useSQLiteAuthState(sessionId = 'default') {
  // Create the table if it doesn't exist
  db.prepare(`
    CREATE TABLE IF NOT EXISTS baileys_auth (
      session_id TEXT NOT NULL,
      key_id TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (session_id, key_id)
    )
  `).run()

  // --- Credential Handling ---
  const readCreds = () => {
    const row = db.prepare(
      'SELECT value FROM baileys_auth WHERE session_id=? AND key_id=?'
    ).get(sessionId, 'creds')

    if (row) {
      return JSON.parse(row.value, BufferJSON.reviver)
    }
    return initAuthCreds()
  }

  const writeCreds = (data) => {
    db.prepare(`
      INSERT OR REPLACE INTO baileys_auth (session_id, key_id, value)
      VALUES (?, ?, ?)
    `).run(sessionId, 'creds', JSON.stringify(data, BufferJSON.replacer))
  }

  // --- Key Handling (Signal keys, etc.) ---
  const keys = {
    get: (type, ids) => {
      const results = {}
      const stmt = db.prepare(
        'SELECT value FROM baileys_auth WHERE session_id=? AND key_id=?'
      )
      for (const id of ids) {
        const row = stmt.get(sessionId, `${type}-${id}`)
        if (row) {
          let value = JSON.parse(row.value, BufferJSON.reviver)
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          }
          results[id] = value
        }
      }
      return results
    },
    set: (data) => {
      const tx = db.transaction(() => {
        for (const type in data) {
          for (const id in data[type]) {
            db.prepare(`
              INSERT OR REPLACE INTO baileys_auth (session_id, key_id, value)
              VALUES (?, ?, ?)
            `).run(
              sessionId,
              `${type}-${id}`,
              JSON.stringify(data[type][id], BufferJSON.replacer)
            )
          }
        }
      })
      tx()
    },
  }

  const creds = readCreds()

  return {
    state: {
      creds,
      keys: {
        get: keys.get,
        set: (data) => {
          keys.set(data)
          // 'creds.update' listener will save the creds.
        },
      },
    },
    saveCreds: () => {
      writeCreds(creds)
    },
  }
}