import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | undefined

export function getAnthropicClient() {
  if (client) return client

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('La variable ANTHROPIC_API_KEY est manquante.')
  }

  client = new Anthropic({ apiKey })
  return client
}