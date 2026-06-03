export interface PricingTier {
  cost: string
  max?: number
  min: number
}

export interface ModelPricing {
  cacheRead: string | null
  cacheReadTiers: PricingTier[]
  cacheWrite: string | null
  cacheWriteTiers: PricingTier[]
  input: string | null
  inputTiers: PricingTier[]
  output: string | null
  outputTiers: PricingTier[]
  reasoning: string | null
  reasoningTiers: PricingTier[]
}

export function emptyModelPricing(): ModelPricing {
  return {
    cacheRead: null,
    cacheReadTiers: [],
    cacheWrite: null,
    cacheWriteTiers: [],
    input: null,
    inputTiers: [],
    output: null,
    outputTiers: [],
    reasoning: null,
    reasoningTiers: [],
  }
}
