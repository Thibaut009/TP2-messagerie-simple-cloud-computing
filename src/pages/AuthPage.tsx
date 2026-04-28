import { AuthForm } from '../components/auth/AuthForm'

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>
  onSignUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>
}

export function AuthPage({ onSignIn, onSignUp }: AuthPageProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-2xl">
          <AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />
        </div>
        <p className="text-center text-gray-600 text-xs mt-6">
          TP Cloud Computing — Sujet 2 · Supabase BaaS · Architecture Serverless
        </p>
      </div>
    </div>
  )
}
