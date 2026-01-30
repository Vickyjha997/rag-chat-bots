import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import { isTracingEnabled, getLangSmithProject } from "./modules/common/langsmith"
import indexRouter from "./modules/index/indexRoutes"
import sessionRouter from "./modules/program_counselor/session/sessionRoutes"
import chatRouter from "./modules/program_counselor/chat/chatRoutes"

const app = express()

// CORS: allow frontend origin so browser allows fetch from 5173 to 8080. Configure in .env (CORS_ORIGIN).
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173"
app.use(
  cors({
    origin: corsOrigin.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use("/api", indexRouter)
app.use("/api", sessionRouter)
app.use("/api", chatRouter)

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

const PORT = Number(process.env.PORT)

if (!PORT || Number.isNaN(PORT)) {
  throw new Error("Invalid PORT in .env file")
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  const tracing = isTracingEnabled()
  const project = getLangSmithProject()
  if (tracing) {
    console.log(`📊 LangSmith tracing ON → project: "${project}"`)
  } else {
    console.log(
      `📊 LangSmith tracing OFF (set LANGSMITH_TRACING=true & LANGSMITH_API_KEY to enable)`
    )
  }
})

