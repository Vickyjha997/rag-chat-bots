import mongoose from "mongoose"
import { connectAgentDB } from "../../../common/db/mongoDB/agentDB"

/** agentDB. session_id references ChatSession._id (sessionId). */
export interface ChatMessageDoc {
  _id: mongoose.Types.ObjectId
  session_id: string
  question: string
  answer: string
  message_order: number
  created_at?: Date
  updated_at?: Date
}

let ChatMessageModel: mongoose.Model<ChatMessageDoc> | null = null

const chatMessageSchemaDefinition = {
  session_id: { type: String, required: true, index: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  message_order: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}

export async function getChatMessageModel(): Promise<
  mongoose.Model<ChatMessageDoc>
> {
  if (ChatMessageModel) return ChatMessageModel

  const db = await connectAgentDB()
  const schema = new mongoose.Schema(chatMessageSchemaDefinition, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  })
  schema.index({ session_id: 1, created_at: 1 })

  ChatMessageModel = db.model<ChatMessageDoc>("ChatMessage", schema)
  return ChatMessageModel
}
