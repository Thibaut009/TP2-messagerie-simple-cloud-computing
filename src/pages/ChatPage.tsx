import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ConversationList } from '../components/chat/ConversationList'
import { MessageList } from '../components/chat/MessageList'
import { MessageInput } from '../components/chat/MessageInput'
import { NewConversationModal } from '../components/chat/NewConversationModal'
import { useConversations } from '../hooks/useConversations'
import { useMessages } from '../hooks/useMessages'
import type { Profile } from '../types'

interface ChatPageProps {
  session: Session
  profile: Profile | null
  onSignOut: () => Promise<void>
}

export function ChatPage({ session, profile, onSignOut }: ChatPageProps) {
  const userId = session.user.id
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const { conversations, loading: convsLoading, createConversation } = useConversations(userId)
  const { messages, loading: msgsLoading, sendMessage } = useMessages(selectedConvId, userId)

  const selectedConv = conversations.find((c) => c.id === selectedConvId)

  const convTitle = selectedConv
    ? (selectedConv.name ??
        selectedConv.conversation_participants
          ?.find((p) => p.user_id !== userId)
          ?.profiles?.display_name ??
        selectedConv.conversation_participants
          ?.find((p) => p.user_id !== userId)
          ?.profiles?.email ??
        'Conversation')
    : null

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50 w-72 flex-shrink-0
        bg-gray-800 border-r border-gray-700 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <ConversationList
          conversations={conversations}
          loading={convsLoading}
          selectedId={selectedConvId}
          currentUserId={userId}
          currentUserProfile={profile}
          onSelect={(id) => { setSelectedConvId(id); setMobileSidebarOpen(false) }}
          onNewChat={() => setShowNewChat(true)}
          onSignOut={onSignOut}
        />
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {selectedConvId && selectedConv ? (
          <>
            <header className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h2 className="text-white font-semibold text-sm">{convTitle}</h2>
                <p className="text-gray-400 text-xs">
                  {selectedConv.conversation_participants?.length ?? 0} participant(s)
                  {' · '}
                  <span className="text-green-400">● Temps réel activé</span>
                </p>
              </div>
            </header>

            <MessageList messages={messages} loading={msgsLoading} currentUserId={userId} />
            <MessageInput onSend={sendMessage} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="absolute top-4 left-4 md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-gray-300 font-semibold text-lg mb-2">Bienvenue sur MessageApp</h2>
            <p className="text-gray-500 text-sm max-w-xs mb-6">
              Sélectionnez une conversation ou démarrez-en une nouvelle.
            </p>
            <button
              onClick={() => setShowNewChat(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
            >
              Nouvelle conversation
            </button>
            <div className="mt-12 flex flex-wrap justify-center gap-2">
              {['Supabase BaaS', 'Edge Functions FaaS', 'Realtime', 'Auth JWT', 'RLS'].map((badge) => (
                <span key={badge} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {showNewChat && (
        <NewConversationModal
          onClose={() => setShowNewChat(false)}
          onCreate={createConversation}
          onCreated={(id) => { setSelectedConvId(id); setMobileSidebarOpen(false) }}
        />
      )}
    </div>
  )
}
