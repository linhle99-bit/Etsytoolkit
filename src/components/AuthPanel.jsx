import { useState } from 'react'

export default function AuthPanel({ auth }) {
  const [mode, setMode] = useState(null) // null | 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState(null)

  if (!auth.enabled) {
    return (
      <span className="text-xs text-amber-200" title="Supabase env vars chưa set">
        ⚠ Cloud sync disabled
      </span>
    )
  }

  if (auth.loading) {
    return <span className="text-xs text-indigo-100">Đang load…</span>
  }

  // Đã login → hiển thị email + logout
  if (auth.user) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-indigo-100">
          👤 <span className="font-mono">{auth.user.email}</span>
        </span>
        <button
          onClick={auth.signOut}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white"
        >
          Logout
        </button>
      </div>
    )
  }

  // Chưa login + chưa mở form
  if (!mode) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => {
            setMode('login')
            setInfo(null)
          }}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white"
        >
          Login
        </button>
        <button
          onClick={() => {
            setMode('signup')
            setInfo(null)
          }}
          className="px-2 py-1 bg-white text-indigo-700 hover:bg-indigo-50 rounded font-medium"
        >
          Sign up
        </button>
      </div>
    )
  }

  // Đang mở form login/signup
  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    if (password.length < 6) {
      setInfo({ type: 'error', text: 'Password ≥ 6 ký tự' })
      return
    }
    setSubmitting(true)
    setInfo(null)
    try {
      if (mode === 'signup') {
        const r = await auth.signUp(email, password)
        if (r.error) {
          setInfo({ type: 'error', text: r.error })
        } else if (r.data?.user && !r.data?.session) {
          setInfo({
            type: 'success',
            text: 'Tạo account OK. Check email để confirm rồi login.'
          })
        } else {
          setInfo({ type: 'success', text: 'Signup thành công, đã login.' })
          setMode(null)
        }
      } else {
        const r = await auth.signIn(email, password)
        if (r.error) {
          setInfo({ type: 'error', text: r.error })
        } else {
          setMode(null)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute top-full right-4 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 p-4 w-80 z-50 text-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">
          {mode === 'signup' ? 'Đăng ký' : 'Đăng nhập'}
        </h3>
        <button
          onClick={() => {
            setMode(null)
            setInfo(null)
          }}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          required
          autoFocus
          placeholder="email@domain.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="password"
          required
          placeholder="Password (≥ 6 ký tự)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={6}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {info && (
          <div
            className={`text-xs p-2 rounded ${
              info.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {info.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-medium disabled:bg-slate-300"
        >
          {submitting
            ? 'Đang xử lý…'
            : mode === 'signup'
            ? 'Đăng ký'
            : 'Đăng nhập'}
        </button>
      </form>

      <div className="mt-3 text-center text-xs text-slate-500">
        {mode === 'signup' ? (
          <>
            Đã có account?{' '}
            <button
              onClick={() => {
                setMode('login')
                setInfo(null)
              }}
              className="text-indigo-600 hover:underline"
            >
              Login
            </button>
          </>
        ) : (
          <>
            Chưa có account?{' '}
            <button
              onClick={() => {
                setMode('signup')
                setInfo(null)
              }}
              className="text-indigo-600 hover:underline"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </div>
  )
}
