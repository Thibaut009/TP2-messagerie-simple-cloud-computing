import { useState, useRef, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ConversationList } from '../components/chat/ConversationList'
import { MessageList } from '../components/chat/MessageList'
import { MessageInput } from '../components/chat/MessageInput'
import { NewConversationModal } from '../components/chat/NewConversationModal'
import { AddParticipantModal } from '../components/chat/AddParticipantModal'
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
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const { conversations, loading: convsLoading, createConversation, addParticipant, updateConversationName } = useConversations(userId)
  const { messages, loading: msgsLoading, sendMessage } = useMessages(selectedConvId, userId)

  const selectedConv = conversations.find((c) => c.id === selectedConvId)

  // Focus l'input quand on passe en mode édition
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingName])

  // Quitter le mode édition si on change de conversation
  useEffect(() => {
    setEditingName(false)
  }, [selectedConvId])

  const handleStartEditName = () => {
    setNameInput(convTitle ?? '')
    setEditingName(true)
  }

  const handleSaveName = async () => {
    if (!selectedConvId) return
    setEditingName(false)
    if (nameInput.trim() !== (convTitle ?? '')) {
      await updateConversationName(selectedConvId, nameInput)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName()
    if (e.key === 'Escape') setEditingName(false)
  }

  const convTitle = selectedConv
    ? selectedConv.is_group
      ? (selectedConv.name ?? 'Groupe')
      : (selectedConv.conversation_participants
            ?.find((p) => p.user_id !== userId)
            ?.profiles?.display_name ??
          selectedConv.conversation_participants
            ?.find((p) => p.user_id !== userId)
            ?.profiles?.email ??
          selectedConv.name ??
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

              <div className="flex-1 min-w-0">
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={handleNameKeyDown}
                    className="w-full bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-white text-sm font-semibold focus:outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <h2 className="text-white font-semibold text-sm truncate">{convTitle}</h2>
                    <button
                      onClick={handleStartEditName}
                      title="Modifier le nom"
                      className="p-1 rounded text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-gray-400 text-xs">
                  {selectedConv.conversation_participants?.length ?? 0} participant(s)
                  {' · '}
                  <span className="text-green-400">● Temps réel activé</span>
                </p>
              </div>

              <button
                onClick={() => setShowAddParticipant(true)}
                title="Ajouter un participant"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
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

      {showAddParticipant && selectedConvId && (
        <AddParticipantModal
          onClose={() => setShowAddParticipant(false)}
          onAdd={(email) => addParticipant(selectedConvId, email)}
        />
      )}
    </div>
  )
}
