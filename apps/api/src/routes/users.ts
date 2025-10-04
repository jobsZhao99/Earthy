// ==========================
// src/routes/users.ts (admin management)
// ==========================
import { Router as RouterUsers } from 'express'
import { prisma as p } from '../prisma.js'
import { requireAuth as ra, requireRole as rr, AuthedRequest as AR } from '../auth/auth.js'
import { hashPassword as hp } from '../auth/hash.js'


export const usersRouter = RouterUsers()


usersRouter.use(ra, rr('ADMIN'))


usersRouter.get('/', async (_req, res) => {
const list = await p.user.findMany({ select: { id: true, email: true, role: true, name: true, phone: true, createdAt: true } })
res.json(list)
})


usersRouter.put('/:id', async (req: AR, res) => {
const { id } = req.params
const { name, phone, role, password } = req.body as { name?: string; phone?: string; role?: string; password?: string }
const data: any = { name, phone, role }
if (password) data.password = await hp(password)
const user = await p.user.update({ where: { id }, data })
res.json({ id: user.id, email: user.email, role: user.role, name: user.name, phone: user.phone })
})


usersRouter.delete('/:id', async (req, res) => {
await p.user.delete({ where: { id: req.params.id } })
res.status(204).end()
})


usersRouter.post('/', rr('ADMIN'), async (req: AR, res) => {
    try {
      const { email, password, name, phone, role } =
        req.body as { email: string; password: string; name?: string; phone?: string; role?: string }
      if (!email || !password) return res.status(400).json({ message: 'email and password are required' })
      const hashed = await hp(password)
      const user = await p.user.create({
        data: { email, password: hashed, name, phone, role: (role as any) ?? 'STAFF' },
        select: { id: true, email: true, role: true, name: true, phone: true, createdAt: true },
      })
      res.status(201).json(user)
    } catch (e: any) {
      if (e.code === 'P2002') return res.status(409).json({ message: 'Email already exists' })
      console.error(e)
      res.status(500).json({ message: 'Failed to create user' })
    }
  })
  