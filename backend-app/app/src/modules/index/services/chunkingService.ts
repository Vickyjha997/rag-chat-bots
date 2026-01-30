export function splitIntoChunks(text: string, maxChars = 900) {
  // Split by headings but keep them
  const parts = text.split(/(?=\n## |\n### |\n#### )/)

  const chunks: string[] = []

  let currentSection = ""   // ##
  let currentSubsection = "" // ###

  for (let part of parts) {
    part = part.trim()

    // Track parent headings
    if (part.startsWith("## ")) {
      currentSection = part.split("\n")[0]
      currentSubsection = ""
    }

    if (part.startsWith("### ")) {
      currentSubsection = part.split("\n")[0]
    }

    const prefix = [
      currentSection,
      currentSubsection
    ].filter(Boolean).join("\n")

    const content = part

    const enriched =
      prefix && !part.startsWith("## ")
        ? `${prefix}\n${content}`
        : content

    // If small enough → keep as one chunk
    if (enriched.length <= maxChars) {
      chunks.push(enriched.trim())
      continue
    }

    // If large → split by sentences
    const sentences = enriched.split(/(?<=\.) /)

    let buffer = ""

    for (const s of sentences) {
      if ((buffer + s).length <= maxChars) {
        buffer += (buffer ? " " : "") + s
      } else {
        chunks.push(buffer.trim())
        buffer = s
      }
    }

    if (buffer) chunks.push(buffer.trim())
  }

  return chunks
}
