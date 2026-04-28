// Types métier de l'application de messagerie

export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Conversation {
  id: string
  name: string | null
  is_group: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConversationParticipant {
  conversation_id: string
  user_id: string
  joined_at: string
  profiles?: Profile
}

export interface ConversationWithParticipants extends Conversation {
  conversation_participants: (ConversationParticipant & { profiles: Profile })[]
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  created_at: string
  profiles?: Profile | null
}

export interface SendMessageResponse {
  data?: Message
  error?: string
}

export interface GetMessagesResponse {
  data?: Message[]
  meta?: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
  error?: string
}
