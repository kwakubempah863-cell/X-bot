import crypto from 'node:crypto'

const buckets = new Map()
const WINDOW_MS = Number(process.env.X_RATE_WINDOW_MS || 60_000)
const MAX_REQUESTS = Number(process.env.X_RATE_MAX || 120)

export function rateLimit(key, limit=MAX_REQUESTS, windowMs=WINDOW_MS) {
  const now = Date.now(); const bucket = buckets.get(key) || []
  const fresh = bucket.filter(t => now - t < windowMs); fresh.push(now); buckets.set(key, fresh)
  return { allowed: fresh.length <= limit, remaining: Math.max(0, limit - fresh.length), retryAfter: fresh.length > limit ? Math.ceil((windowMs - (now - fresh[0])) / 1000) : 0 }
}
export function clientKey(req) { return String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim() }
export function secureEqual(a,b){const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
export function requireApiKey(req,reply){
  const configured=process.env.X_API_KEY
  if(!configured) return true
  const supplied=req.headers['x-api-key'] || (String(req.headers.authorization||'').startsWith('Bearer ')?String(req.headers.authorization).slice(7):'')
  if(secureEqual(supplied,configured)) return true
  reply.code(401).send({error:'Unauthorized'})
  return false
}
export function securityHeaders(reply){
  reply.header('X-Content-Type-Options','nosniff').header('X-Frame-Options','DENY').header('Referrer-Policy','no-referrer').header('Permissions-Policy','camera=(),microphone=(),geolocation=()')
}
