import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Activity,
  ArrowLeft,
  Bot,
  RefreshCw,
  ShieldAlert,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react'

type ActivityRow = {
  id: number
  group_id: string | null
  actor_jid: string | null
  command: string
  message_body: string | null
  created_at: string
}

type EventRow = {
  id: number
  event: string
  details: string | null
  created_at: string
}

type CommandStat = {
  command: string
  count: number
}

type GroupRow = {
  group_id: string
  name: string | null
  member_count: number
  admins_count: number
  connection_state: string
}

type TenantDetail = {
  tenant: {
    id: string
    owner_jid: string
    display_name: string | null
    status: string
    total_commands: number
    connected_at: string | null
    disconnected_at: string | null
    created_at: string
  }
  groups: GroupRow[]
  stats: {
    totalGroups: number
    totalMembers: number
    totalCommands: number
    activityRows: number
  }
  activity: ActivityRow[]
  commandStats: CommandStat[]
  connectionEvents: EventRow[]
  live: {
    status: string
    connectedJid: string | null
    qr: { dataUrl: string } | null
    groupCount: number
    lastError: string | null
  } | null
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return res.json()
}

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const data = await apiFetch<TenantDetail>(
        `/api/tenants/${encodeURIComponent(tenantId)}/detail`
      )
      setDetail(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(t)
  }, [tenantId])

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/tenants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to tenants
        </Link>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive">
              {error || 'Tenant not found'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { tenant, groups, stats, activity, commandStats, connectionEvents, live } = detail

  const isConnected = (live?.status || tenant.status) === 'connected'

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/app/tenants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to tenants
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {isConnected ? (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
              <Wifi className="size-6 text-primary" />
            </div>
          ) : (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              <WifiOff className="size-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-serif text-3xl">
              {tenant.display_name || 'Unnamed bot'}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {tenant.id}
            </p>
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Bot}
          label="Status"
          value={tenant.status}
          detail={live?.status ? `Live: ${live.status}` : 'No live runtime'}
        />
        <StatCard
          icon={Users}
          label="Groups"
          value={String(stats.totalGroups)}
          detail={`${stats.totalMembers} members total`}
        />
        <StatCard
          icon={Activity}
          label="Commands"
          value={String(stats.totalCommands)}
          detail="Lifetime"
        />
        <StatCard
          icon={ShieldAlert}
          label="Owner"
          value={tenant.owner_jid?.split('@')[0] || '—'}
          detail={tenant.owner_jid?.endsWith('@pair') ? 'Not yet adopted' : 'Bound'}
        />
      </div>

      {/* Connection panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="size-4 text-primary" />
            Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Status" value={tenant.status} />
          <Row label="Live status" value={live?.status || 'not running'} />
          <Row label="Connected JID" value={live?.connectedJid || tenant.owner_jid || '—'} />
          <Row label="Connected at" value={formatTime(tenant.connected_at)} />
          <Row label="Disconnected at" value={formatTime(tenant.disconnected_at)} />
          <Row label="Created at" value={formatTime(tenant.created_at)} />
          <Row label="Live groups" value={String(live?.groupCount ?? 0)} />
          {live?.lastError && (
            <Row label="Last error" value={live.lastError} />
          )}
          {live?.qr?.dataUrl && (
            <div className="mt-4 rounded-xl border border-primary/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Scan to connect
              </p>
              <img
                src={live.qr.dataUrl}
                alt="Pair QR"
                className="mx-auto size-48"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-column: top commands + recent activity */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top commands</CardTitle>
          </CardHeader>
          <CardContent>
            {commandStats.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No commands logged yet.
              </p>
            ) : (
              <div className="space-y-2">
                {commandStats.map((c, i) => (
                  <div
                    key={c.command}
                    className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{i + 1}
                      </span>
                      <span className="font-mono text-sm">
                        .{c.command}
                      </span>
                    </span>
                    <span className="font-mono text-sm text-primary">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No activity yet.
              </p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-border/70 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-primary">
                        .{a.command}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(a.created_at)}
                      </span>
                    </div>
                    {a.message_body && a.message_body !== a.command && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {a.message_body}
                      </p>
                    )}
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {a.actor_jid || 'unknown'}
                      {a.group_id ? ` · ${a.group_id.split('@')[0]}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Groups ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              This bot is not in any groups yet.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div
                  key={g.group_id}
                  className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{g.name || 'Unnamed group'}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {g.group_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{g.member_count} members</span>
                    <span>{g.admins_count} admins</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection events */}
      <Card>
        <CardHeader>
          <CardTitle>Connection history</CardTitle>
        </CardHeader>
        <CardContent>
          {connectionEvents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No connection events recorded.
            </p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {connectionEvents.map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg border border-border/70 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        e.event === 'connected'
                          ? 'text-primary'
                          : e.event === 'disconnected'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }
                    >
                      {e.event}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(e.created_at)}
                    </span>
                  </div>
                  {e.details && (
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {e.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Bot
  label: string
  value: string
  detail: string
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate font-mono text-2xl font-semibold">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="truncate font-mono text-xs">{value}</span>
    </div>
  )
}