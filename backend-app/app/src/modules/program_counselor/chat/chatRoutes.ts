import { Router } from "express"
import { verifyToken } from "../../common/authMiddleware"
import { sendMessageController } from "./chatController"

const router = Router()

router.post("/chat/cohort/:cohortKey", verifyToken, sendMessageController)

export default router
