import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Message } from '../types'

interface UseMessagesReturn {
  messages: Message[]
  loading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<{ error: string | null }>
}

export function useMessages(
  conversationId: string | null,
  userId: string | undefined
): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messageIds = useRef<Set<string>>(new Set())

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    setError(null)
    messageIds.current.clear()

    const { data, error: fetchError } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        profiles:sender_id (
          id,
          display_name,
          email,
          avatar_url
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const msgs = (data as unknown as Message[]) ?? []
    msgs.forEach((m) => messageIds.current.add(m.id))
    setMessages(msgs)
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    setMessages([])
    fetchMessages()
  }, [fetchMessages])

  // Abonnement Realtime — mise à jour automatique des nouveaux messages
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message

          if (messageIds.current.has(newMsg.id)) return
          messageIds.current.add(newMsg.id)

          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, display_name, email, avatar_url, created_at')
            .eq('id', newMsg.sender_id ?? '')
            .single()

          const enriched: Message = { ...newMsg, profiles: profileData ?? undefined }
          setMessages((prev) => [...prev, enriched])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Envoi via l'Edge Function send-message (FaaS)
  const sendMessage = useCallback(async (
    content: string
  ): Promise<{ error: string | null }> => {
    if (!conversationId || !userId) return { error: 'Non connecté' }

    const trimmed = content.trim()
    if (!trimmed) return { error: 'Le message ne peut pas être vide' }

    const { data, error: fnError } = await supabase.functions.invoke('send-message', {
      body: { conversation_id: conversationId, content: trimmed },
    })

    if (fnError) return { error: fnError.message }
    if (data?.error) return { error: data.error }

    // Optimistic update avant que Realtime ne reçoive l'INSERT
    if (data?.data) {
      const msg = data.data as Message
      if (!messageIds.current.has(msg.id)) {
        messageIds.current.add(msg.id)
        setMessages((prev) => [...prev, msg])
      }
    }

    return { error: null }
  }, [conversationId, userId])

  return { messages, loading, error, sendMessage }
}
