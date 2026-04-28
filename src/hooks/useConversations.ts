import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ConversationWithParticipants } from '../types'

interface UseConversationsReturn {
  conversations: ConversationWithParticipants[]
  loading: boolean
  error: string | null
  createConversation: (recipientEmail: string) => Promise<{ id: string | null; error: string | null }>
  addParticipant: (convId: string, email: string) => Promise<{ error: string | null }>
  updateConversationName: (convId: string, name: string) => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

export function useConversations(userId: string | undefined): UseConversationsReturn {
  const [conversations, setConversations] = useState<ConversationWithParticipants[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants (
            user_id,
            joined_at,
            profiles (
              id,
              email,
              display_name,
              avatar_url
            )
          )
        `)
        .order('updated_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setConversations((data as ConversationWithParticipants[]) ?? [])
      }
    } catch {
      setError('Erreur de connexion à Supabase')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => { fetchConversations() }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => { fetchConversations() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchConversations])

  const createConversation = useCallback(async (
    recipientEmail: string
  ): Promise<{ id: string | null; error: string | null }> => {
    if (!userId) return { id: null, error: 'Non connecté' }

    const { data: recipientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('email', recipientEmail.trim().toLowerCase())
      .single()

    if (profileError || !recipientProfile) {
      return { id: null, error: 'Aucun utilisateur trouvé avec cet email' }
    }

    if (recipientProfile.id === userId) {
      return { id: null, error: 'Vous ne pouvez pas démarrer une conversation avec vous-même' }
    }

    // Vérifier si une conversation 1-à-1 existe déjà
    const { data: existing } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)

    if (existing && existing.length > 0) {
      const convIds = existing.map((e) => e.conversation_id)
      const { data: sharedConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', recipientProfile.id)
        .in('conversation_id', convIds)

      if (sharedConvs && sharedConvs.length > 0) {
        const { data: convData } = await supabase
          .from('conversations')
          .select('id, is_group')
          .in('id', sharedConvs.map((c) => c.conversation_id))
          .eq('is_group', false)
          .limit(1)
          .single()

        if (convData) return { id: convData.id, error: null }
      }
    }

    const { data: newConvId, error: convError } = await supabase
      .rpc('create_conversation', {
        recipient_id: recipientProfile.id,
        conv_name: null,
      })

    if (convError || !newConvId) {
      return { id: null, error: convError?.message ?? 'Erreur lors de la création' }
    }

    await fetchConversations()
    return { id: newConvId as string, error: null }
  }, [userId, fetchConversations])

  const addParticipant = useCallback(async (
    convId: string,
    email: string
  ): Promise<{ error: string | null }> => {
    if (!userId) return { error: 'Non connecté' }

    // Trouver l'utilisateur par email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('email', email.trim().toLowerCase())
      .single()

    if (profileError || !profile) return { error: 'Aucun utilisateur trouvé avec cet email' }
    if (profile.id === userId) return { error: 'Vous êtes déjà dans la conversation' }

    // Ajouter le participant via la fonction sécurisée
    const { error: addError } = await supabase.rpc('add_participant', {
      conv_id: convId,
      new_user_id: profile.id,
    })

    if (addError) return { error: addError.message }

    // Récupérer tous les participants pour générer le nom de groupe
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('profiles(display_name, email)')
      .eq('conversation_id', convId)

    if (participants && participants.length > 2) {
      const groupName = participants
        .map((p: any) => p.profiles?.display_name ?? p.profiles?.email ?? '')
        .filter(Boolean)
        .join(', ')

      await supabase
        .from('conversations')
        .update({ name: groupName, is_group: true })
        .eq('id', convId)
    }

    await fetchConversations()
    return { error: null }
  }, [userId, fetchConversations])

  const updateConversationName = useCallback(async (
    convId: string,
    name: string
  ): Promise<{ error: string | null }> => {
    const trimmed = name.trim()
    const { error } = await supabase
      .from('conversations')
      .update({ name: trimmed || null })
      .eq('id', convId)

    if (error) return { error: error.message }

    await fetchConversations()
    return { error: null }
  }, [fetchConversations])

  return {
    conversations,
    loading,
    error,
    createConversation,
    addParticipant,
    updateConversationName,
    refresh: fetchConversations,
  }
}
