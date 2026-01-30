export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface ClientMessage {
  type: 'audio' | 'connect' | 'disconnect' | 'ping';
  data?: any;
  sessionId?: string;
}

export interface ServerMessage {
  type: 'audio' | 'transcription' | 'status' | 'function_call' | 'function_result' | 'error' | 'pong';
  data?: any;
  sessionId?: string;
}

export interface TranscriptionData {
  text: string;
  isUser: boolean;
  isFinal: boolean;
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
  callId: string;
}

export interface FunctionResult {
  callId: string;
  result: any;
  error?: string;
}

export interface Session {
  id: string;
  userId?: string;
  createdAt: Date;
  geminiSession: any;
  memory: Array<{ role: 'user' | 'assistant'; content: string }>;
  ragContext?: {
    baseUrl: string;
    cohortKey: string;
    ragSessionId: string;
    agentName?: string;
  };
}
