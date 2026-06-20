import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeSlash, UserPlus, CheckCircle } from '@phosphor-icons/react'
import { useRegister } from '@/hooks/useAuth'
import { getApiError } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [acceptedTos, setAcceptedTos] = useState(false)
  const register = useRegister()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ confirm?: string; tos?: string }>({})
  const [success, setSuccess] = useState(false)

  const clearError = () => { if (error) setError(''); if (fieldErrors.confirm) setFieldErrors({}) }

  // Password strength hints
  const passwordChecks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
    { label: 'Special character (!@#$%...)', ok: /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`]/.test(password) },
  ]
  const passwordStrong = passwordChecks.every((c) => c.ok)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (password !== confirmPassword) {
      setFieldErrors({ confirm: 'Passwords do not match' })
      return
    }

    if (!acceptedTos) {
      setFieldErrors({ tos: 'You must accept the Terms of Service to continue' })
      return
    }

    try {
      await register.mutateAsync({ email, password, full_name: fullName, accepted_tos: acceptedTos })
      setSuccess(true)
    } catch (err) {
      setError(getApiError(err))
    }
  }

  if (success) {
    return (
      <div className="dark min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <span className="text-neutral-900 font-bold text-lg">R</span>
            </div>
            <span className="font-semibold text-2xl tracking-tight text-foreground">Reconny</span>
          </div>
          <Card className="border-border/50 shadow-2xl shadow-black/20 backdrop-blur-sm text-center">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <CheckCircle className="h-14 w-14 text-green-400" weight="fill" />
              <h2 className="text-xl font-semibold text-neutral-100">Account created!</h2>
              <p className="text-sm text-neutral-400 max-w-xs">
                Your account has been created. You can now sign in to start using Reconny.
              </p>
              <Link
                to="/login"
                className="mt-2 inline-flex items-center justify-center w-full h-11 rounded-md bg-primary text-sidebar-bg font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Sign In
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-neutral-800/20 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/20">
            <span className="text-neutral-900 font-bold text-lg">R</span>
          </div>
          <span className="font-semibold text-2xl tracking-tight text-foreground">Reconny</span>
        </div>

        <Card className="border-border/50 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription className="text-base">
              Get started with Reconny
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearError() }}
                  placeholder="John Doe"
                  autoComplete="name"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError() }}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  placeholder="Strong password"
                  required
                  maxLength={128}
                  autoComplete="new-password"
                />
                {/* Password strength checklist */}
                {password.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {passwordChecks.map((c) => (
                      <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-400' : 'text-neutral-500'}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.ok ? 'bg-green-400' : 'bg-neutral-600'}`} />
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearError() }}
                  placeholder="Re-enter your password"
                  required
                  maxLength={128}
                  autoComplete="new-password"
                />
                {fieldErrors.confirm && (
                  <p className="text-xs text-destructive">{fieldErrors.confirm}</p>
                )}
              </div>

              {/* Terms of Service checkbox */}
              <div className="space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    id="acceptedTos"
                    checked={acceptedTos}
                    onChange={(e) => { setAcceptedTos(e.target.checked); setFieldErrors({}) }}
                    className="mt-0.5 h-4 w-4 accent-yellow-400 cursor-pointer"
                    required
                  />
                  <span className="text-sm text-muted-foreground leading-snug">
                    I agree to the{' '}
                    <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                      Terms of Service &amp; Privacy Policy
                    </Link>
                    . I confirm that I have legal authorization to scan any domains I submit.
                  </span>
                </label>
                {fieldErrors.tos && (
                  <p className="text-xs text-destructive pl-6">{fieldErrors.tos}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={register.isPending || !passwordStrong || !acceptedTos}
                className="w-full h-11"
              >
                {register.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create Account
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Reconny. All rights reserved.{' '}
          <Link to="/privacy" className="hover:text-muted-foreground transition-colors">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
