import { useAuth } from './hooks/useAuth'
import { AuthPage } from './pages/AuthPage'
import { ChatPage } from './pages/ChatPage'

export default function App() {
  const { session, profile, loading, signIn, signUp, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />
  }

  return <ChatPage session={session} profile={profile} onSignOut={signOut} />
}
