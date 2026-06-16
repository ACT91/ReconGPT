import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useChangePassword, useApiKeys } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Moon, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import type { APIKeyFull } from '@/types'

function ProfileSection() {
  const user = useAuthStore((s) => s.user)

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Profile</CardTitle>
        <CardDescription className="text-zinc-400">Your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Full Name</label>
            <Input
              value={user?.full_name || ''}
              readOnly
              className="bg-zinc-800/50 border-zinc-700 text-zinc-300"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Email</label>
            <Input
              value={user?.email || ''}
              readOnly
              className="bg-zinc-800/50 border-zinc-700 text-zinc-300"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Role</label>
            <Input
              value={user?.role || ''}
              readOnly
              className="bg-zinc-800/50 border-zinc-700 text-zinc-300 capitalize"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Member Since</label>
            <Input
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
              readOnly
              className="bg-zinc-800/50 border-zinc-700 text-zinc-300"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const changePassword = useChangePassword()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Failed to change password')
    }
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Change Password</CardTitle>
        <CardDescription className="text-zinc-400">Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-zinc-300 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-zinc-300 pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-zinc-300"
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            disabled={changePassword.isPending}
            className="bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90"
          >
            {changePassword.isPending ? 'Updating...' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ApiKeyItem({
  keyItem,
  onRevoke,
}: {
  keyItem: { id: string; name: string; key_prefix: string; is_active: boolean; created_at: string }
  onRevoke: (id: string) => void
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
      <div className="flex items-center gap-3">
        <Key className="h-4 w-4 text-zinc-500" />
        <div>
          <p className="text-sm text-zinc-200 font-medium">{keyItem.name}</p>
          <p className="text-xs text-zinc-500">
            {keyItem.key_prefix}... &middot; Created {new Date(keyItem.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <button
        onClick={() => onRevoke(keyItem.id)}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title="Revoke key"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function ApiKeysSection() {
  const { keys, isLoading, create, revoke } = useApiKeys()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [expiresIn, setExpiresIn] = useState('90')
  const [newKeyResult, setNewKeyResult] = useState<APIKeyFull | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!keyName.trim()) return
    try {
      const result = await create.mutateAsync({
        name: keyName.trim(),
        expires_in_days: expiresIn ? parseInt(expiresIn, 10) : undefined,
      })
      setNewKeyResult(result)
      setKeyName('')
      toast.success('API key created')
    } catch {
      toast.error('Failed to create API key')
    }
  }

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm('Revoke this API key? This action cannot be undone.')) return
    try {
      await revoke.mutateAsync(keyId)
      toast.success('API key revoked')
    } catch {
      toast.error('Failed to revoke API key')
    }
  }

  const copyKey = async () => {
    if (newKeyResult) {
      await navigator.clipboard.writeText(newKeyResult.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-zinc-100">API Keys</CardTitle>
          <CardDescription className="text-zinc-400">
            Manage API keys for programmatic access
          </CardDescription>
        </div>
        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open)
            if (!open) setNewKeyResult(null)
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90 gap-2">
              <Plus className="h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">
                {newKeyResult ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                {newKeyResult
                  ? 'Copy this key now — you will not be able to see it again.'
                  : 'Give your key a name and optionally set an expiration.'}
              </DialogDescription>
            </DialogHeader>

            {newKeyResult ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                  <code className="text-sm text-sidebar-active break-all select-all">
                    {newKeyResult.key}
                  </code>
                </div>
                <Button
                  onClick={copyKey}
                  className="w-full gap-2 bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Key'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Key Name</label>
                  <Input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. CI/CD Pipeline"
                    className="bg-zinc-800/50 border-zinc-700 text-zinc-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Expiration (days)</label>
                  <Input
                    type="number"
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    placeholder="90"
                    min={1}
                    className="bg-zinc-800/50 border-zinc-700 text-zinc-300"
                  />
                  <p className="text-xs text-zinc-500">Leave empty for no expiration</p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreate}
                    disabled={create.isPending || !keyName.trim()}
                    className="bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90"
                  >
                    {create.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[52px] rounded-lg bg-zinc-800/20 animate-pulse" />
            ))}
          </div>
        ) : keys && keys.length > 0 ? (
          <div className="space-y-2">
            {keys.map((key) => (
              <ApiKeyItem key={key.id} keyItem={key} onRevoke={handleRevoke} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Key className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No API keys yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Create a key to use the Reconny API programmatically
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ThemeSection() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  const toggleTheme = () => {
    const newDark = !isDark
    setIsDark(newDark)
    document.documentElement.classList.toggle('dark', newDark)
    localStorage.setItem('theme', newDark ? 'dark' : 'light')
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Appearance</CardTitle>
        <CardDescription className="text-zinc-400">Toggle between light and dark mode</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? (
              <Moon className="h-5 w-5 text-zinc-400" />
            ) : (
              <Sun className="h-5 w-5 text-zinc-400" />
            )}
            <span className="text-sm text-zinc-300">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isDark ? 'bg-sidebar-active' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isDark ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your account and API keys</p>
      </div>

      <ProfileSection />
      <ChangePasswordSection />
      <ApiKeysSection />
      <ThemeSection />
    </div>
  )
}
