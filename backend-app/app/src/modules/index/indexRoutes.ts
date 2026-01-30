import express from "express"
import { verifyToken } from "../common/authMiddleware"
import { updateVectorDBController, deleteVectorDBController } from "./indexController"

const router = express.Router()

router.post("/updateVectorDB/:cohortKey", verifyToken, updateVectorDBController)
router.delete("/deleteVectorDB/:cohortKey", verifyToken, deleteVectorDBController)

export default router
