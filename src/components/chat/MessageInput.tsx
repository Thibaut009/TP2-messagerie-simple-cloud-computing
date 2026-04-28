import { useState, type FormEvent, type KeyboardEvent } from 'react'

interface MessageInputProps {
  onSend: (content: string) => Promise<{ error: string | null }>
  disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    const trimmed = value.trim()
    if (!trimmed || sending || disabled) return
    setSending(true)
    setError(null)
    const { error } = await onSend(trimmed)
    if (error) { setError(error) } else { setValue('') }
    setSending(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const isOverLimit = value.length > 2000

  return (
    <div className="border-t border-gray-700 px-4 py-3">
      {error && (
        <div className="mb-2 px-3 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-xs">
          {error}
        </div>
      )}
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleSend() }} className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez un message… (Entrée pour envoyer)"
            disabled={disabled || sending}
            rows={1}
            style={{ resize: 'none' }}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-50 min-h-[44px] max-h-32 overflow-y-auto"
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
          />
          {value.length > 1800 && (
            <span className={`absolute right-3 bottom-2 text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
              {value.length}/2000
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!value.trim() || sending || disabled || isOverLimit}
          className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-2xl transition flex items-center justify-center flex-shrink-0"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
      <p className="text-center text-gray-600 text-xs mt-2">Shift+Entrée pour aller à la ligne</p>
    </div>
  )
}
