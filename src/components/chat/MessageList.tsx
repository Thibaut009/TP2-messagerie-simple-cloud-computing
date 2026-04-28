import { useEffect, useRef } from 'react'
import type { Message } from '../../types'

interface MessageListProps {
  messages: Message[]
  loading: boolean
  currentUserId: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Aujourd\'hui'
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function MessageList({ messages, loading, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mb-3">
          <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-gray-400 font-medium">Aucun message</p>
        <p className="text-gray-600 text-sm mt-1">Soyez le premier à écrire quelque chose</p>
      </div>
    )
  }

  // Grouper par date
  const groups: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const dateLabel = formatDate(msg.created_at)
    const last = groups[groups.length - 1]
    if (!last || last.date !== dateLabel) {
      groups.push({ date: dateLabel, messages: [msg] })
    } else {
      last.messages.push(msg)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {groups.map((group) => (
        <div key={group.date}>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500 bg-gray-800 px-2">{group.date}</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <div className="space-y-3">
            {group.messages.map((msg, idx) => {
              const isOwn = msg.sender_id === currentUserId
              const prevMsg = group.messages[idx - 1]
              const showSender = !prevMsg || prevMsg.sender_id !== msg.sender_id
              const senderName =
                msg.profiles?.display_name ??
                msg.profiles?.email?.split('@')[0] ??
                'Inconnu'

              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                    {showSender && !isOwn && (
                      <span className="text-xs text-gray-400 px-1">{senderName}</span>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl break-words ${
                      isOwn
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-700 text-gray-100 rounded-bl-md'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <span className={`text-[10px] mt-1 block text-right ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
