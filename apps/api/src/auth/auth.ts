// ==========================
// src/auth/auth.ts
// ==========================
import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from './jwt.js'


export type AuthedRequest = Request & { user?: { userId: string; role: string } }


export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    // console.log(">>> req.headers.authorization =", req.headers.authorization)

const auth = req.headers.authorization
if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' })
try {
const token = auth.slice(7)
const payload = verifyAccessToken(token)
req.user = { userId: (payload as any).userId, role: (payload as any).role }
next()
} catch {
return res.status(401).json({ message: 'Invalid token' })
}
}


export function requireRole(...roles: string[]) {
return (req: AuthedRequest, res: Response, next: NextFunction) => {
if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
next()
}
}