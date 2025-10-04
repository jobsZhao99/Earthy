import { prisma as ps } from '../src/prisma.js'
import { hashPassword as hpw } from '../src/auth/hash.js'


async function main() {
const email = process.env.ADMIN_EMAIL || 'admin@example.com'
const pass = process.env.ADMIN_PASSWORD || 'admin123'
const hashed = await hpw(pass)
const user = await ps.user.upsert({
where: { email },
update: {},
create: { email, password: hashed, role: 'ADMIN', name: 'Super Admin' }
})
console.log('Seeded admin:', user.email)
}


main().finally(() => ps.$disconnect())