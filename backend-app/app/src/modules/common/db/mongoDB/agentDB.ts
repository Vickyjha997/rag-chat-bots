import mongoose from "mongoose"

let agentDBConnection: mongoose.Connection | null = null;

export async function connectAgentDB(): Promise<mongoose.Connection> {
  if (agentDBConnection?.readyState === 1) return agentDBConnection

  const uri = process.env.MONGODB_AGENTDB_URI
  if (!uri) throw new Error("MONGODB_AGENTDB_URI is not set in .env")

  agentDBConnection = await mongoose.createConnection(uri)
  console.log("Connected to AgentDB MongoDB")
  return agentDBConnection
}

export function getAgentDB(): mongoose.Connection {
  if (!agentDBConnection)
    throw new Error("AgentDB not connected. Call connectAgentDB() first.")
  return agentDBConnection
}
