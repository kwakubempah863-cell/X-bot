import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Check,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  X
} from 'lucide-react'

export const Route = createFileRoute('/pair')({
  head: () => ({
    meta: [
      { title: 'Pair your X bot' },
      {
        name: 'description',
        content: 'Pair your WhatsApp number to run your own X bot.'
      }
    ]
  }),
  component: PairPage
})

type SessionState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'waiting_qr'; qr: { value: string; dataUrl: string } }
  | { status: 'connected' }
  | { status: 'expired' }
  | { status: 'error'; message: string }

const POLL_INTERVAL_MS = 2000

function PairPage() {
  const [name, setName] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [state, setState] = useState<SessionState>({ status: 'idle' })
  const pollRef = useRef<number | null>(null)

  /*
   * Stop polling on unmount so we don't leak an interval
   * if the user navigates away mid-pair.
   */
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  async function startPairing() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }

    setState({ status: 'starting' })

    try {
      const res = await fetch('/api/pairing/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null })
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()

      if (!data?.sessionId) {
        throw new Error('No session ID returned')
      }

      setSessionId(data.sessionId)

      beginPolling(data.sessionId)
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Could not start pairing'
      })
    }
  }

  function beginPolling(id: string) {
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/pairing/${id}`)

        if (res.status === 404) {
          setState({ status: 'expired' })
          if (pollRef.current) {
            window.clearInterval(pollRef.current)
            pollRef.current = null
          }
          return
        }

        if (!res.ok) return

        const data = await res.json()

        if (data.status === 'connected') {
          if (pollRef.current) {
            window.clearInterval(pollRef.current)
            pollRef.current = null
          }

          /*
           * Finalize — bind the owner JID. The runtime knows
           * the JID; we fetch it from the tenant status.
           */
          await finalize(id)

          setState({ status: 'connected' })
          toast.success('Bot paired successfully')
          return
        }

        if (data.status === 'waiting_qr' && data.qr) {
          setState({ status: 'waiting_qr', qr: data.qr })
          return
        }

        if (data.status === 'error') {
          setState({
            status: 'error',
            message: data.error || 'Pairing failed'
          })
          if (pollRef.current) {
            window.clearInterval(pollRef.current)
            pollRef.current = null
          }
        }
      } catch {
        /* transient network error — keep polling */
      }
    }, POLL_INTERVAL_MS)
  }

  async function finalize(id: string) {
  try {
    await fetch(`/api/pairing/${id}/finalize`, {
      method: 'POST'
    })
  } catch {
    /* not fatal */
  }
}

  function reset() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }

    if (sessionId) {
      fetch(`/api/pairing/${sessionId}`, { method: 'DELETE' }).catch(() => {})
    }

    setSessionId(null)
    setState({ status: 'idle' })
    setName('')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-lg border-primary/25">
        <CardHeader>
          <div className="mb-3 flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-primary/40 bg-black shadow-[0_0_22px_rgba(0,212,255,0.22)]">
            <img src="/x-icon.png" alt="X Bot" className="h-full w-full object-cover" />
          </div>
          <CardTitle className="font-serif text-3xl">Pair your X bot</CardTitle>
          <p className="text-sm text-muted-foreground">
            Link your WhatsApp number to run your own personal X bot.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* IDLE */}
          {state.status === 'idle' && (
            <>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                autoComplete="off"
              />
              <Button className="w-full" onClick={() => void startPairing()}>
                <QrCode className="mr-2 size-4" />
                Pair my WhatsApp
              </Button>
              <p className="text-xs text-muted-foreground">
                You&apos;ll need to scan a QR code with WhatsApp. This takes
                about a minute.
              </p>
            </>
          )}

          {/* STARTING */}
          {state.status === 'starting' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Starting a new bot session…
              </p>
            </div>
          )}

          {/* WAITING FOR QR */}
          {state.status === 'waiting_qr' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl border-2 border-primary/30 bg-white p-4">
                <img
                  src={state.qr.dataUrl}
                  alt="WhatsApp pairing QR code"
                  className="size-64"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <Smartphone className="size-4 text-primary" />
                <span>
                  WhatsApp → Settings → Linked Devices → Link a Device
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="mr-1 size-4" />
                Cancel
              </Button>
            </div>
          )}

          {/* CONNECTED */}
          {state.status === 'connected' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="rounded-full bg-primary/15 p-4">
                <Check className="size-10 text-primary" />
              </div>
              <div>
                <p className="font-medium">Your bot is live</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add it to a group to get started. Run <code>.menu</code> in
                  a group to see the commands.
                </p>
              </div>
              <Button variant="outline" onClick={reset}>
                <RefreshCw className="mr-2 size-4" />
                Pair another bot
              </Button>
            </div>
          )}

          {/* EXPIRED */}
          {state.status === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="font-medium">This session expired</p>
              <p className="text-sm text-muted-foreground">
                Pairing sessions last 10 minutes.
              </p>
              <Button onClick={reset}>
                <RefreshCw className="mr-2 size-4" />
                Try again
              </Button>
            </div>
          )}

          {/* ERROR */}
          {state.status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="font-medium text-destructive">
                {state.message}
              </p>
              <Button onClick={reset}>
                <RefreshCw className="mr-2 size-4" />
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}