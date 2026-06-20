import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import type { LoginRequest, RegisterRequest } from '@/types'

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: async (tokens) => {
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      try {
        const user = await authApi.me()
        setUser(user)
        navigate('/dashboard')
      } catch {
        setUser(null)
      }
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
  })
}


export function useLogout() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return () => {
    logout()
    navigate('/login')
  }
}

export function useCurrentUser() {
  const { user, setUser, setLoading, isAuthenticated } = useAuthStore()

  const query = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token')
      if (!token) {
        setLoading(false)
        return null
      }
      try {
        const user = await authApi.me()
        setUser(user)
        return user
      } catch {
        setUser(null)
        return null
      }
    },
    enabled: isAuthenticated || !!localStorage.getItem('access_token'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  return { user, isLoading: query.isLoading, isAuthenticated }
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current_password, new_password }: { current_password: string; new_password: string }) =>
      authApi.changePassword(current_password, new_password),
  })
}

export function useApiKeys() {
  const query = useQuery({
    queryKey: ['api-keys'],
    queryFn: authApi.listApiKeys,
  })

  const createMutation = useMutation({
    mutationFn: authApi.createApiKey,
    onSuccess: () => query.refetch(),
  })

  const revokeMutation = useMutation({
    mutationFn: authApi.revokeApiKey,
    onSuccess: () => query.refetch(),
  })

  return { keys: query.data, isLoading: query.isLoading, create: createMutation, revoke: revokeMutation }
}