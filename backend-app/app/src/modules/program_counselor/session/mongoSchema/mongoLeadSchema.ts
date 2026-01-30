import mongoose from "mongoose"
import { connectOneHome } from "../../../common/db/mongoDB/oneHomeDB"

/** oneHomeDB. No sessionId — Lead is independent. */
export interface LeadDoc {
  _id: mongoose.Types.ObjectId
  cohort_key: string
  full_name: string
  email: string
  phone_number: string
  country_code?: string
  current_designation?: string
  source?: string
  created_at?: Date
  updated_at?: Date
}

let LeadModel: mongoose.Model<LeadDoc> | null = null

const leadSchemaDefinition = {
  cohort_key: { type: String, required: true, index: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  phone_number: { type: String, required: true },
  country_code: { type: String, required: false },
  current_designation: { type: String, required: false },
  source: { type: String, required: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}

export async function getLeadModel(): Promise<mongoose.Model<LeadDoc>> {
  if (LeadModel) return LeadModel

  const db = await connectOneHome()
  const schema = new mongoose.Schema(leadSchemaDefinition, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  })

  const model = db.model<LeadDoc>("Lead", schema)
  LeadModel = model
  return model
}
