import mongoose from "mongoose"
import { connectAgentDB } from "../../../common/db/mongoDB/agentDB"

/** agentDB. _id = sessionId. ChatMessage.session_id references this. */
export interface ChatSessionDoc {
  _id: string
  cohort_key: string
  full_name: string
  email: string
  current_designation: string
  phone_number: string
  country_code?: string
  expires_at: Date
  created_at?: Date
  updated_at?: Date
}

let ChatSessionModel: mongoose.Model<ChatSessionDoc> | null = null

const chatSessionSchemaDefinition = {
  _id: { type: String, required: true },
  cohort_key: { type: String, required: true, index: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  current_designation: { type: String, required: true },
  phone_number: { type: String, required: true },
  country_code: { type: String, required: false },
  expires_at: { type: Date, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}

export async function getChatSessionModel(): Promise<mongoose.Model<ChatSessionDoc>> {
  if (ChatSessionModel) return ChatSessionModel

  const db = await connectAgentDB()
  const schema = new mongoose.Schema(chatSessionSchemaDefinition, {
    _id: true,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  })

  ChatSessionModel = db.model<ChatSessionDoc>("ChatSession", schema)
  return ChatSessionModel
}
