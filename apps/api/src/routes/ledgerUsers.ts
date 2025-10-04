// ==========================
// src/routes/ledgerUsers.ts
// ==========================
import { Router as RouterLU } from 'express'
import { prisma as p2 } from '../prisma.js'
import { requireAuth as ra2, requireRole as rr2 } from '../auth/auth.js'
import { z } from 'zod'

export const ledgerUsersRouter = RouterLU()

// 需要登录
ledgerUsersRouter.use(ra2)

/** 联想搜索（仅 ADMIN/MANAGER） */
ledgerUsersRouter.get('/search-users', rr2('ADMIN','MANAGER'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) return res.json([])
    const list = await p2.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name:  { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ]
      },
      select: { id: true, email: true, name: true, phone: true, role: true },
      take: 10,
    })
    res.json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to search users' })
  }
})

// GET /api/ledgerUsers/all-users  —— 仅返回必要字段
ledgerUsersRouter.get('/all-users', rr2('ADMIN','MANAGER'), async (_req, res) => {
    try {
      const list = await p2.user.findMany({
        select: { id: true, email: true, name: true, phone: true, role: true },
        orderBy: { createdAt: 'desc' },
        take: 1000, // 够用即可，用户多的话可分页
      })
      res.json(list)
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Failed to load users' })
    }
  })

/** 列出某个 Ledger 的成员 */
ledgerUsersRouter.get('/:ledgerId/users', async (req, res) => {
  try {
    const ledgerId = req.params.ledgerId
    const rows = await p2.ledgerUser.findMany({
      where: { ledgerId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { id: 'asc' },
    })
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to load members' })
  }
})

/** 添加成员（仅 ADMIN/MANAGER） */
ledgerUsersRouter.post('/:ledgerId/users', rr2('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const ledgerId = req.params.ledgerId
    const body = z.object({
      userId: z.string().min(1, 'userId is required'),
      role: z.enum(['ADMIN','MANAGER','STAFF','VIEWER']).default('VIEWER'),
    }).parse(req.body)

    // 外键存在性检查，避免 Prisma P2003
    await p2.user.findUniqueOrThrow({ where: { id: body.userId } })
    await p2.ledger.findUniqueOrThrow({ where: { id: ledgerId } })

    const row = await p2.ledgerUser.create({
      data: { ledgerId, userId: body.userId, role: body.role }
    })
    res.status(201).json(row)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ message: err.errors?.[0]?.message || 'Invalid body' })
    if (err.code === 'P2002') return res.status(409).json({ message: 'Member already exists' }) // @@unique([ledgerId,userId])
    if (err.name === 'NotFoundError') return res.status(404).json({ message: 'User or Ledger not found' })
    if (err.code === 'P2003') return res.status(400).json({ message: 'Invalid userId or ledgerId (FK failed)' })
    console.error(err)
    res.status(500).json({ message: 'Failed to add member' })
  }
})

/** 更新成员角色（仅 ADMIN/MANAGER） */
ledgerUsersRouter.put('/:ledgerId/users/:userId', rr2('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ledgerId, userId } = req.params
    const { role } = z.object({
      role: z.enum(['ADMIN','MANAGER','STAFF','VIEWER'])
    }).parse(req.body)

    const row = await p2.ledgerUser.update({
      where: { ledgerId_userId: { ledgerId, userId } }, // 依赖 @@unique([ledgerId, userId])
      data: { role }
    })
    res.json(row)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ message: 'Invalid role' })
    if (err.code === 'P2025') return res.status(404).json({ message: 'Member not found' })
    console.error(err)
    res.status(500).json({ message: 'Failed to update role' })
  }
})

/** 移除成员（仅 ADMIN/MANAGER） */
ledgerUsersRouter.delete('/:ledgerId/users/:userId', rr2('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ledgerId, userId } = req.params
    await p2.ledgerUser.delete({ where: { ledgerId_userId: { ledgerId, userId } } })
    res.status(204).end()
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Member not found' })
    console.error(err)
    res.status(500).json({ message: 'Failed to remove member' })
  }
})
