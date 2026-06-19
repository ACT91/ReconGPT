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
import { Key, Plus, Trash, Copy, Check, Eye, EyeSlash, User, Lock } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import type { APIKeyFull } from '@/types'

function ProfileSection() {
  const user = useAuthStore((s) => s.user)

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-neutral-100">Profile</CardTitle>
        <CardDescription className="text-neutral-400">Your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm text-neutral-400">Full Name</label>
            <Input
              value={user?.full_name || ''}
              readOnly
              className="bg-neutral-800/50 border-neutral-700 text-neutral-300"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-neutral-400">Email</label>
            <Input
              value={user?.email || ''}
              readOnly
              className="bg-neutral-800/50 border-neutral-700 text-neutral-300"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm text-neutral-400">Role</label>
            <Input
              value={user?.role || ''}
              readOnly
              className="bg-neutral-800/50 border-neutral-700 text-neutral-300 capitalize"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-neutral-400">Member Since</label>
            <Input
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
              readOnly
              className="bg-neutral-800/50 border-neutral-700 text-neutral-300"
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
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-neutral-100">Change Password</CardTitle>
        <CardDescription className="text-neutral-400">Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-neutral-400">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-neutral-800/50 border-neutral-700 text-neutral-300 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                {showCurrent ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-neutral-400">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-neutral-800/50 border-neutral-700 text-neutral-300 pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                {showNew ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-neutral-400">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-neutral-800/50 border-neutral-700 text-neutral-300"
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            disabled={changePassword.isPending}
            className="bg-primary text-sidebar-bg hover:bg-primary/90/90"
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
    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 border border-neutral-800">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-neutral-500" />
        <div>
          <p className="text-sm text-neutral-200 font-medium">{keyItem.name}</p>
          <p className="text-xs text-neutral-500">
            {keyItem.key_prefix}... &middot; Created {new Date(keyItem.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <button
        onClick={() => onRevoke(keyItem.id)}
        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors"
        title="Revoke key"
      >
        <Trash className="h-4 w-4" />
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
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-neutral-100">API Keys</CardTitle>
          <CardDescription className="text-neutral-400">
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
            <Button className="bg-primary text-sidebar-bg hover:bg-primary/90/90 gap-2">
              <Plus className="h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle className="text-neutral-100">
                {newKeyResult ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                {newKeyResult
                  ? 'Copy this key now — you will not be able to see it again.'
                  : 'Give your key a name and optionally set an expiration.'}
              </DialogDescription>
            </DialogHeader>

            {newKeyResult ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-neutral-800 border border-neutral-700">
                  <code className="text-sm text-primary break-all select-all">
                    {newKeyResult.key}
                  </code>
                </div>
                <Button
                  onClick={copyKey}
                  className="w-full gap-2 bg-primary text-sidebar-bg hover:bg-primary/90/90"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Key'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-neutral-400">Key Name</label>
                  <Input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. CI/CD Pipeline"
                    className="bg-neutral-800/50 border-neutral-700 text-neutral-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-neutral-400">Expiration (days)</label>
                  <Input
                    type="number"
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    placeholder="90"
                    min={1}
                    className="bg-neutral-800/50 border-neutral-700 text-neutral-300"
                  />
                  <p className="text-xs text-neutral-500">Leave empty for no expiration</p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreate}
                    disabled={create.isPending || !keyName.trim()}
                    className="bg-primary text-sidebar-bg hover:bg-primary/90/90"
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
              <div key={i} className="h-[52px] rounded-lg bg-neutral-800/20 animate-pulse" />
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
            <Key className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No API keys yet</p>
            <p className="text-xs text-neutral-600 mt-1">
              Create a key to use the Reconny API programmatically
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Change Password', icon: Lock },
    { id: 'api-keys', label: 'API Keys', icon: Key },
  ]
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">Manage your account and API keys</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-neutral-800">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-neutral-50 border-neutral-50'
                  : 'text-neutral-400 border-transparent hover:text-neutral-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'profile' && <ProfileSection />}
      {activeTab === 'password' && <ChangePasswordSection />}
      {activeTab === 'api-keys' && <ApiKeysSection />}
    </div>
  )
}
