import type { ConversationWithParticipants, Profile } from '../../types'

interface ConversationListProps {
  conversations: ConversationWithParticipants[]
  loading: boolean
  selectedId: string | null
  currentUserId: string
  currentUserProfile: Profile | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onSignOut: () => void
}

function getConversationLabel(conv: ConversationWithParticipants, currentUserId: string): string {
  if (!conv.is_group) {
    const other = conv.conversation_participants?.find((p) => p.user_id !== currentUserId)
    return other?.profiles?.display_name ?? other?.profiles?.email ?? conv.name ?? 'Conversation'
  }
  return conv.name ?? 'Groupe'
}

function getInitials(label: string): string {
  return label.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600',
  'bg-yellow-600', 'bg-red-600', 'bg-pink-600',
]

function avatarColor(id: string): string {
  return AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length]
}

export function ConversationList({
  conversations, loading, selectedId, currentUserId,
  currentUserProfile, onSelect, onNewChat, onSignOut,
}: ConversationListProps) {
  const displayName =
    currentUserProfile?.display_name ??
    currentUserProfile?.email?.split('@')[0] ??
    'Utilisateur'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${avatarColor(currentUserId)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
            {getInitials(displayName)}
          </div>
          <span className="text-white text-sm font-medium truncate max-w-28">{displayName}</span>
        </div>
        <button
          onClick={onSignOut}
          title="Se déconnecter"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div className="px-3 py-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-gray-500 text-sm">Aucune conversation</p>
            <p className="text-gray-600 text-xs mt-1">Démarrez un chat avec un ami</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const label = getConversationLabel(conv, currentUserId)
            const isSelected = conv.id === selectedId
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
                  isSelected ? 'bg-blue-600/20 border border-blue-600/30' : 'hover:bg-gray-700/60'
                }`}
              >
                <div className={`w-9 h-9 rounded-full ${avatarColor(conv.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {getInitials(label)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {conv.is_group ? 'Groupe' : 'Conversation privée'}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
