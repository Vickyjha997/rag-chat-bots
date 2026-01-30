import axios from "axios"

const baseUrl = () => (process.env.XITE_API_URL ?? "").replace(/\/$/, "")

export async function getJson<T = unknown>(cohortKey?: string): Promise<T> {
  const token = process.env.XITE_API_KEY ?? process.env.XITE_API_TOKEN
  if (!process.env.XITE_API_URL || !token) {
    throw new Error("Missing XITE_API_URL or XITE_API_KEY/XITE_API_TOKEN in .env")
  }
  const url = cohortKey ? `${baseUrl()}/${cohortKey}` : baseUrl()
  const { data } = await axios.get<T>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return data
}