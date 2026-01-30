import { Router } from "express"
import { verifyToken } from "../../common/authMiddleware"
import { createSessionController } from "./sessionControllers"

const router = Router()

router.post("/createSession/:cohortKey", verifyToken, createSessionController)

export default router
