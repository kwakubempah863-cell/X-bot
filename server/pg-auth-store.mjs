import pg from 'pg'
import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys'

const { Pool } = pg

let pool

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Postgres auth state')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      idleTimeoutMillis: 30000,
    })
  }

  return pool
}

export async function usePostgresAuthState(sessionId = 'default') {
  const db = getPool()

  await db.query(`
    CREATE TABLE IF NOT EXISTS baileys_pg_auth (
      session_id TEXT,
      key_id TEXT,
      value TEXT,
      PRIMARY KEY (session_id, key_id)
    )
  `)

  const readCreds = async () => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const { rows } = await db.query(
          'SELECT value FROM baileys_pg_auth WHERE session_id = $1 AND key_id = $2',
          [sessionId, 'creds']
        )

        if (rows[0]) {
          return JSON.parse(rows[0].value, BufferJSON.reviver)
        }

        return initAuthCreds()
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Neon unreachable at startup: failed to read auth state after 3 attempts');
  }

  const writeCreds = async (data) => {
    await db.query(`
      INSERT INTO baileys_pg_auth (session_id, key_id, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (session_id, key_id)
      DO UPDATE SET value = EXCLUDED.value
    `, [sessionId, 'creds', JSON.stringify(data, BufferJSON.replacer)])
  }

  const queryWithConnectionRetry = async (query, values) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let client
      try {
        client = await db.connect()
        return await client.query(query, values)
      } catch (error) {
        const isConnectionError =
          error?.code === 'ECONNRESET' ||
          /connection terminated unexpectedly/i.test(String(error?.message || ''))

        if (client) {
          client.release(isConnectionError ? error : undefined)
          client = null
        }

        if (!isConnectionError || attempt === 1) throw error

        console.warn('[X AUTH] Postgres connection interrupted; retrying query once')
      } finally {
        if (client) client.release()
      }
    }
  }

  const keys = {
    get: async (type, ids) => {
      const keyIds = ids.map((id) => `${type}-${id}`)
      const { rows } = await queryWithConnectionRetry(
        'SELECT key_id, value FROM baileys_pg_auth WHERE session_id = $1 AND key_id = ANY($2::text[])',
        [sessionId, keyIds]
      )

      const results = {}
      for (const row of rows) {
        const id = row.key_id.slice(type.length + 1)
        let value = JSON.parse(row.value, BufferJSON.reviver)
        if (type === 'app-state-sync-key' && value) {
          value = proto.Message.AppStateSyncKeyData.fromObject(value)
        }
        results[id] = value
      }

      return results
    },
    set: async (data) => {
      const client = await db.connect()

      try {
        await client.query('BEGIN')
        for (const type in data) {
          for (const id in data[type]) {
            await client.query(`
              INSERT INTO baileys_pg_auth (session_id, key_id, value)
              VALUES ($1, $2, $3)
              ON CONFLICT (session_id, key_id)
              DO UPDATE SET value = EXCLUDED.value
            `, [
              sessionId,
              `${type}-${id}`,
              JSON.stringify(data[type][id], BufferJSON.replacer)
            ])
          }
        }
        await client.query('COMMIT')
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally {
        client.release();
      }
    },
  }

  const creds = await readCreds()

  const state = { creds, keys };
  return {
    state,
    saveCreds: () => writeCreds(state.creds),
  }
}