import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import {
  Bot,
  ChevronRight,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users
} from 'lucide-react'

type Tenant = {
  tenantId: string
  status: string
  connectedJid?: string | null
  groupCount?: number
}

type Ban = {
  jid: string
  reason: string | null
  banned_at: string
  expires_at: string | null
  permanent: number
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers || {})
    }
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error || `Request failed (${res.status})`)
  }

  return res.json()
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [bans, setBans] = useState<Ban[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const [t, b] = await Promise.all([
        apiFetch<Tenant[]>('/api/tenants'),
        apiFetch<Ban[]>('/api/bans')
      ])

      setTenants(t)
      setBans(b)
    } catch (error) {
      toast.error('Could not load tenants', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [])

  async function disconnect(tenantId: string, event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    setBusy(tenantId)
    try {
      await apiFetch(`/api/tenants/${tenantId}/runtime/logout`, { method: 'POST' })
      toast.success('Disconnected')
      await load()
    } catch (error) {
      toast.error('Disconnect failed', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setBusy(null)
    }
  }

  async function remove(tenantId: string, event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (!confirm(`Delete tenant ${tenantId}? This cannot be undone.`)) return

    setBusy(tenantId)
    try {
      await apiFetch(`/api/tenants/${tenantId}`, { method: 'DELETE' })
      toast.success('Deleted')
      await load()
    } catch (error) {
      toast.error('Delete failed', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setBusy(null)
    }
  }

  async function unban(jid: string) {
    try {
      await apiFetch(`/api/bans/${encodeURIComponent(jid)}`, { method: 'DELETE' })
      toast.success('Unbanned')
      await load()
    } catch (error) {
      toast.error('Unban failed', {
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          tenant management
        </p>
        <h1 className="mt-2 font-serif text-4xl">Paired bots</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every WhatsApp number that has paired to run its own X instance.
          Click a row to see live telemetry.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            Active tenants ({tenants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tenants paired yet.
            </p>
          ) : (
            <div className="space-y-3">
              {tenants.map((t) => (
                <div
                  key={t.tenantId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-4 transition hover:border-primary/40"
                >
                  <Link
                    to="/app/tenants/$tenantId"
                    params={{ tenantId: t.tenantId }}
                    className="group min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-muted-foreground">
                          {t.tenantId}
                        </p>
                        <p className="mt-1 truncate text-sm">
                          {t.connectedJid || 'Not connected'}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span
                              className={`size-2 rounded-full ${
                                t.status === 'connected'
                                  ? 'bg-primary'
                                  : 'bg-muted-foreground'
                              }`}
                            />
                            {t.status}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {t.groupCount ?? 0} groups
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </Link>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === t.tenantId}
                      onClick={(e) => void disconnect(t.tenantId, e)}
                    >
                      <LogOut className="mr-1 size-3.5" />
                      Disconnect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === t.tenantId}
                      onClick={(e) => void remove(t.tenantId, e)}
                    >
                      <Trash2 className="mr-1 size-3.5 text-destructive" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-destructive" />
            Banned users ({bans.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bans.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No users are currently banned.
            </p>
          ) : (
            <div className="space-y-2">
              {bans.map((b) => (
                <div
                  key={b.jid}
                  className="flex items-center justify-between rounded-xl border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs">{b.jid}</p>
                    {b.reason && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {b.reason}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {b.permanent
                        ? 'Permanent'
                        : `Expires ${new Date(b.expires_at!).toLocaleString()}`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void unban(b.jid)}>
                    Unban
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}