// src/components/account-page.tsx

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Clock,
  KeyRound,
  LogOut,
  Bot,
  ShieldCheck,
  UserRound
} from 'lucide-react'

type WhoAmI = {
  username: string
  role: 'super_admin' | 'tenant_owner'
  tenantId: string | null
  isSuperAdmin: boolean
}

type TenantSnapshot = {
  tenantId: string
  status: string
  connectedJid: string | null
  groupCount: number
  totalCommands: number
} | null

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

export function AccountPage({ onLogout }: { onLogout: () => void }) {
  const [who, setWho] = useState<WhoAmI | null>(null)
  const [snapshot, setSnapshot] = useState<TenantSnapshot>(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const me = await apiFetch<WhoAmI>('/api/auth/whoami')
      setWho(me)
      if (me.tenantId) {
        try {
          const detail = await apiFetch<any>(
            `/api/tenants/${encodeURIComponent(me.tenantId)}/detail`
          )
          setSnapshot({
            tenantId: me.tenantId,
            status: detail.tenant.status,
            connectedJid: detail.tenant.owner_jid,
            groupCount: detail.stats.totalGroups,
            totalCommands: detail.stats.totalCommands
          })
        } catch {}
      }
    } catch (error) {
      toast.error('Could not load account info', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function changePassword() {
    if (!oldPassword || !newPassword || !confirm) {
      toast.error('Fill in all password fields')
      return
    }
    if (newPassword !== confirm) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      })
      toast.success('Password updated')
      setOldPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (error) {
      toast.error('Change failed', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
  if (!who) return <div className="rounded-2xl border border-destructive/40 p-8 text-center text-sm">Could not load account.</div>

  return (
    <section className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">your account</p>
        <h1 className="mt-2 font-serif text-4xl">Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your credentials and see who you are on the dashboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Username</p>
          <p className="mt-2 font-mono text-lg font-semibold">{who.username}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Role</p>
          <p className="mt-2 font-mono text-lg font-semibold">
            {who.isSuperAdmin ? 'Super admin' : 'Tenant owner'}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tenant</p>
          <p className="mt-2 truncate font-mono text-sm">{who.tenantId || '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Session</p>
          <p className="mt-2 font-mono text-sm">Active</p>
        </CardContent></Card>
      </div>

      {snapshot && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2">
            <Bot className="size-4 text-primary" /> Your bot
          </CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="mt-1 font-mono text-sm">{snapshot.status}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Groups</p>
              <p className="mt-1 font-mono text-sm">{snapshot.groupCount}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Commands</p>
              <p className="mt-1 font-mono text-sm">{snapshot.totalCommands}</p></div>
            {snapshot.connectedJid && (
              <div className="sm:col-span-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Connected number</p>
                <p className="mt-1 truncate font-mono text-xs">{snapshot.connectedJid}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" /> Change password
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="Current password" value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" />
          <Input type="password" placeholder="New password (min 8 chars)" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          <Input type="password" placeholder="Confirm new password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <Button onClick={() => void changePassword()} disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">
          <LogOut className="size-4 text-destructive" /> Session
        </CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}