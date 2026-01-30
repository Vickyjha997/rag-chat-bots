import { QdrantClient } from "@qdrant/js-client-rest";
import * as dotenv from "dotenv";

dotenv.config();

const QDRANT_URL = process.env.QDRANT_CLUSTER_END_POINT;
const QDRANT_API_KEY = process.env.QDRANT_CLOUD_API_KEY;

if (!QDRANT_URL || !QDRANT_API_KEY) {
  throw new Error("QDRANT_CLUSTER_END_POINT and QDRANT_CLOUD_API_KEY must be set in .env");
}

export const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

export async function checkQdrantConnection() {
  try {
    const info = await qdrantClient.getCollections();
    console.log("✅ Qdrant connected:", info.collections.length, "collections");
  } catch (err) {
    console.error("❌ Qdrant connection failed");
    console.error(err);
  }
}
