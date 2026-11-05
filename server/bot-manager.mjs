/* -------------------------------------------------------------------------- */
/* X: BOT MANAGER                                                             */
/*                                                                            */
/* Owns every paired WhatsApp runtime. One instance per tenant.               */
/* -------------------------------------------------------------------------- */

import { WhatsAppRuntime } from './whatsapp.mjs'
import {
  listTenants,
  getTenant,
  createTenant,
  approveTenant,
  denyTenant,
  deleteTenant,
  getTenantByOwner
} from './db.mjs'

export class BotManager {
  constructor() {
    /* Map<tenantId, WhatsAppRuntime> */
    this.runtimes = new Map()

    /* Map<tenantId, Promise> — prevents double-start races */
    this.starting = new Map()
  }

  /* -------------------------------------------------------------------------- */
  /* Lookup                                                                     */
  /* -------------------------------------------------------------------------- */

  get(tenantId) {
    return this.runtimes.get(tenantId) || null
  }

  has(tenantId) {
    return this.runtimes.has(tenantId)
  }

  list() {
    return [...this.runtimes.entries()].map(([tenantId, runtime]) => ({
      tenantId,
      status: runtime.getStatus()
    }))
  }

  /* -------------------------------------------------------------------------- */
  /* Boot / shutdown                                                            */
  /* -------------------------------------------------------------------------- */

  async start(tenantId) {
    if (this.runtimes.has(tenantId)) {
      return this.runtimes.get(tenantId)
    }

    /* Guard against concurrent starts of the same tenant */
    if (this.starting.has(tenantId)) {
      return this.starting.get(tenantId)
    }

    const promise = (async () => {
      const tenant = getTenant(tenantId)

      if (!tenant) {
        throw new Error(`Unknown tenant: ${tenantId}`)
      }

      if (tenant.status === 'denied') {
        throw new Error(`Tenant ${tenantId} is denied.`)
      }

      const runtime = new WhatsAppRuntime(tenantId)

      this.runtimes.set(tenantId, runtime)

      try {
        await runtime.connect()
      } catch (error) {
        console.error(
          `[X MANAGER] Failed to start tenant ${tenantId}:`,
          error?.message || error
        )
        this.runtimes.delete(tenantId)
        throw error
      } finally {
        this.starting.delete(tenantId)
      }

      return runtime
    })()

    this.starting.set(tenantId, promise)

    return promise
  }

  /*
   * Stop a runtime. Sets intentionalShutdown so the close
   * handler in whatsapp.mjs refuses to reconnect, then
   * logs out cleanly and removes the runtime from the map.
   */
  async stop(tenantId) {
    const runtime = this.runtimes.get(tenantId)

    if (!runtime) {
      return false
    }

    /*
     * Hard-kill flag. The connection.update close handler
     * checks this before scheduling any reconnect. Setting
     * status alone isn't enough — the close handler overwrites
     * it back to 'reconnecting' unless lastDisconnect reports
     * a 401, which WhatsApp doesn't always send.
     */
    runtime.intentionalShutdown = true
    runtime.status = 'logged_out'

    if (runtime.reconnectTimer) {
      clearTimeout(runtime.reconnectTimer)
      runtime.reconnectTimer = null
    }

    try {
      if (runtime.sock) {
        await runtime.sock.logout()
      }
    } catch (error) {
      console.warn(
        `[X MANAGER] Logout for ${tenantId} failed:`,
        error?.message || error
      )
    }

    try {
      if (runtime.sock) {
        runtime.sock.end?.()
      }
    } catch {}

    runtime.sock = null

    this.runtimes.delete(tenantId)

    try {
      const { markTenantDisconnected } = await import('./db.mjs')
      markTenantDisconnected(tenantId)
    } catch (error) {
      console.warn(
        `[X MANAGER] markTenantDisconnected failed for ${tenantId}:`,
        error?.message || error
      )
    }

    return true
  }

  /* -------------------------------------------------------------------------- */
  /* Boot all approved tenants                                                  */
  /* -------------------------------------------------------------------------- */

  async startAll() {
    const tenants = listTenants().filter(
      (t) => t.status === 'approved' || t.status === 'connected'
    )

    for (const tenant of tenants) {
      try {
        await this.start(tenant.id)
      } catch (error) {
        console.error(
          `[X MANAGER] Skipping tenant ${tenant.id}:`,
          error?.message || error
        )
      }
    }

    return this.runtimes.size
  }

  /* -------------------------------------------------------------------------- */
  /* Tenant lifecycle helpers                                                   */
  /* -------------------------------------------------------------------------- */

  /*
   * Create a tenant (or return an existing one) and start
   * its runtime. Returns { tenant, runtime }.
   */
  async provisionTenant({ ownerJid, displayName, notes }) {
    const existing = getTenantByOwner(ownerJid)

    if (existing) {
      const runningRuntime = this.runtimes.get(existing.id)

      if (runningRuntime) {
        return { tenant: existing, runtime: runningRuntime }
      }

      const startedRuntime = await this.start(existing.id)
      return { tenant: existing, runtime: startedRuntime }
    }

    const tenantId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    const authFolder = `./auth/x-${tenantId}`

    const tenant = createTenant({
      id: tenantId,
      ownerJid,
      displayName: displayName || null,
      authFolder,
      notes: notes || null
    })

    approveTenant(tenantId, 'system')

    const newRuntime = await this.start(tenantId)

    return { tenant, runtime: newRuntime }
  }

  /*
   * Tear down a tenant completely: stop the runtime, wipe
   * its auth folder, delete the row.
   */
  async deprovisionTenant(tenantId) {
    /*
     * Stop first. This guarantees the reconnect loop is dead
     * before we delete anything.
     */
    await this.stop(tenantId)

    /*
     * Wipe the auth folder so a re-pair starts clean. Without
     * this, Baileys loads the stale session and WhatsApp
     * rejects the handshake on the next pairing attempt.
     */
    try {
      const { getTenant: getTenantLocal } = await import('./db.mjs')
      const { rm } = await import('node:fs/promises')
      const pathMod = await import('node:path')

      const tenant = getTenantLocal(tenantId)

      if (tenant?.auth_folder) {
        const folder = pathMod.resolve(tenant.auth_folder)
        await rm(folder, { recursive: true, force: true })
      }
    } catch (error) {
      console.warn(
        `[X MANAGER] Failed to clear auth folder for ${tenantId}:`,
        error?.message || error
      )
    }

    /*
     * Delete the tenant row. If your schema doesn't have
     * ON DELETE CASCADE on every tenant-scoped table, add
     * explicit deletes here.
     */
    const { deleteTenant: deleteTenantLocal } = await import('./db.mjs')
    deleteTenantLocal(tenantId)

    return true
  }
}