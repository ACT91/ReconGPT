import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useChangePassword, useApiKeys } from '@/hooks/useAuth'
import { authApi, getApiError } from '@/services/api'
import { AxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Key, Plus, Trash, Copy, Check, Eye, EyeSlash, Lock, ShieldCheck, DownloadSimple, Warning, Bell, Scan, WarningCircle, FileText } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import type { APIKeyFull } from '@/types'

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
    } catch (err) {
      toast.error(getApiError(err))
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
          <Empty variant="inline">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Key className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No API keys yet</EmptyTitle>
              <EmptyDescription>Create a key to use the Reconny API programmatically.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}

function DataPrivacySection() {
  const logout = useAuthStore((s) => s.logout)
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const data = await authApi.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reconny-data-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setExportLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'CONFIRM') return
    setDeleteLoading(true)
    try {
      await authApi.deleteAccount()
      toast.success('Account deleted. Your data has been anonymised.')
      localStorage.clear()
      logout()
      window.location.href = '/login'
    } catch (err) {
      toast.error(getApiError(err))
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DownloadSimple className="h-5 w-5 text-muted-foreground" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a complete copy of all data Reconny holds about you (GDPR Article 20).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Your profile, projects, scans, findings, API keys, and AI insights.
          </p>
          <Button
            onClick={handleExport}
            disabled={exportLoading}
            variant="outline"
            className="shrink-0 gap-2"
          >
            <DownloadSimple className="h-4 w-4" />
            {exportLoading ? 'Exporting...' : 'Download My Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <Trash className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and anonymise all personal data (GDPR Article 17). This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Removes your email, name, and password. Scan data is preserved anonymously.
          </p>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="shrink-0 gap-2">
                <Trash className="h-4 w-4" />
                Delete My Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Warning className="h-5 w-5 text-destructive" />
                  Delete Account
                </DialogTitle>
                <DialogDescription>
                  This will anonymise your email, full name, and deactivate your account. All your projects and scans will remain in the system but will no longer be linked to your identity. This action is irreversible.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm">
                  Type <strong className="text-destructive">CONFIRM</strong> to proceed:
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="CONFIRM"
                  className="font-mono"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteConfirm !== 'CONFIRM' || deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}

const notificationTypes = [
  {
    id: 'scan-completed',
    icon: Scan,
    title: 'Scan Completed',
    description: 'Get notified when a reconnaissance scan finishes',
    enabled: true,
  },
  {
    id: 'vuln-found',
    icon: WarningCircle,
    title: 'Vulnerabilities Found',
    description: 'Alerts when new vulnerabilities are discovered in your scans',
    enabled: true,
  },
  {
    id: 'ai-insights',
    icon: ShieldCheck,
    title: 'AI Insights Ready',
    description: 'Notification when AI analysis and risk scoring is complete',
    enabled: false,
  },
  {
    id: 'report-ready',
    icon: FileText,
    title: 'Reports Available',
    description: 'Let you know when generated reports are ready for download',
    enabled: false,
  },
]

function NotificationToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 ${
        checked ? 'bg-primary' : 'bg-neutral-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function NotificationsSection() {
  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-neutral-100">Notifications</CardTitle>
        <CardDescription className="text-neutral-400">
          Choose which events you want to be notified about
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0 divide-y divide-neutral-800/50">
        {notificationTypes.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                  <Icon className="h-4 w-4 text-neutral-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-200">{item.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>
                </div>
              </div>
              <NotificationToggle
                checked={item.enabled}
                onChange={() => {}}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const tabs = [
    { id: 'password', label: 'Change Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'privacy', label: 'Privacy & Data', icon: ShieldCheck },
  ]
  const [activeTab, setActiveTab] = useState('password')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">Manage your account security and preferences</p>
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

      {activeTab === 'password' && <ChangePasswordSection />}
      {activeTab === 'notifications' && <NotificationsSection />}
      {activeTab === 'api-keys' && <ApiKeysSection />}
      {activeTab === 'privacy' && <DataPrivacySection />}
    </div>
  )
}
