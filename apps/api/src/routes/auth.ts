// ==========================
// src/routes/auth.ts
// ==========================
import { Router } from 'express'
import { prisma } from '../prisma.js'
import { verifyPassword, hashPassword } from '../auth/hash.js'
import { signAccessToken, signRefreshToken } from '../auth/jwt.js'
import { requireAuth, requireRole, AuthedRequest } from '../auth/auth.js'


export const authRouter = Router()


// POST /auth/login
authRouter.post('/login', async (req, res) => {
const { email, password } = req.body as { email?: string; password?: string }
if (!email || !password) return res.status(400).json({ message: 'email & password required' })
const user = await prisma.user.findUnique({ where: { email } })
if (!user) return res.status(401).json({ message: 'Invalid credentials' })
const ok = await verifyPassword(password, user.password)
if (!ok) return res.status(401).json({ message: 'Invalid credentials' })


const accessToken = signAccessToken({ userId: user.id, role: user.role })
const refreshToken = signRefreshToken({ userId: user.id, role: user.role })
return res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, name: user.name } })
})


// POST /auth/register (ADMIN only)
authRouter.post('/register', requireAuth, requireRole('ADMIN'), async (req: AuthedRequest, res) => {
const { email, password, name, phone, role } = req.body as { email: string; password: string; name?: string; phone?: string; role?: string }
if (!email || !password) return res.status(400).json({ message: 'email & password required' })
const exists = await prisma.user.findUnique({ where: { email } })
if (exists) return res.status(409).json({ message: 'Email already used' })
const hashed = await hashPassword(password)
const user = await prisma.user.create({ data: { email, password: hashed, name, phone, role: (role as any) ?? 'STAFF' } })
return res.status(201).json({ id: user.id, email: user.email, role: user.role })
})


// GET /auth/me
authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, email: true, role: true, name: true, phone: true } })
return res.json(me)
})