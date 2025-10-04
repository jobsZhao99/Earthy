// ==========================
// src/auth/jwt.ts
// ==========================
import jwt from 'jsonwebtoken'


const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '7d'


type JwtPayload = { userId: string; role: string }


export function signAccessToken(payload: JwtPayload) {
return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}


export function verifyAccessToken<T = JwtPayload>(token: string) {
return jwt.verify(token, JWT_SECRET) as T
}


export function signRefreshToken(payload: JwtPayload) {
return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN })
}