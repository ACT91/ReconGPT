import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

type AdminGuardProps = {
  children: ReactNode
  requiredRole?: 'admin' | 'analyst'
}

export function AdminGuard({ children, requiredRole = 'admin' }: AdminGuardProps) {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  if (requiredRole === 'analyst' && user.role !== 'admin' && user.role !== 'analyst') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
