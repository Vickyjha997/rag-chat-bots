import mongoose from "mongoose"

let oneHomeConnection: mongoose.Connection | null = null;

export async function connectOneHome(): Promise<mongoose.Connection> {
  if (oneHomeConnection?.readyState === 1) return oneHomeConnection

  const uri = process.env.MONGODB_ONEHOME_URI
  if (!uri) throw new Error("MONGODB_ONEHOME_URI is not set in .env")

  oneHomeConnection = await mongoose.createConnection(uri)
  console.log("Connected to OneHome MongoDB")
  return oneHomeConnection
}

export function getOneHome(): mongoose.Connection {
  if (!oneHomeConnection)
    throw new Error("OneHome not connected. Call connectOneHome() first.")
  return oneHomeConnection
}
