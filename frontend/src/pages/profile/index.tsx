import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, getApiError } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Envelope, ShieldCheck, Calendar } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: { full_name?: string }) => authApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      toast.success('Profile updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate({ full_name: fullName.trim() || undefined })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-100">Profile</h1>
        <p className="text-sm text-neutral-400 mt-1">Manage your personal information</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-neutral-900/50 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-neutral-100">Personal Information</CardTitle>
            <CardDescription className="text-neutral-400">Update your name and view your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm text-neutral-400">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-neutral-800/50 border-neutral-700 text-neutral-100"
                placeholder="Your name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-neutral-400">Email</label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-neutral-800/30 border border-neutral-700/50 text-neutral-400 text-sm">
                  <Envelope className="h-4 w-4 text-neutral-500" />
                  {user?.email}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-neutral-400">Role</label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-neutral-800/30 border border-neutral-700/50 text-neutral-400 text-sm capitalize">
                  <ShieldCheck className="h-4 w-4 text-neutral-500" />
                  {user?.role || 'user'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-neutral-400">Member Since</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-neutral-800/30 border border-neutral-700/50 text-neutral-400 text-sm">
                <Calendar className="h-4 w-4 text-neutral-500" />
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={updateMutation.isPending || fullName === (user?.full_name || '')}
                className="bg-primary text-sidebar-bg hover:bg-primary/90/90"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
