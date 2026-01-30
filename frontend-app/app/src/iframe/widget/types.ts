export type WidgetConfig = {
  apiBase: string
  cohortKey: string
  source: string
  agentName: string
  profileImage: string
  parentOrigin: string
  voiceHttpBase: string
  voiceWsBase: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

