import { Link, Text } from 'react-email'

const VERCEL_AI_GATEWAY_URL = 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai'
const LLM_GATEWAY_URL = 'https://llmgateway.io/'
const OPENROUTER_URL = 'https://openrouter.ai/settings/keys'

export function InferenceProviderSetupNote() {
  return (
    <>
      <Text className="m-0 mt-[16px] text-[14px] text-subtle leading-[22px]">
        Before you run agents, save at least one personal inference provider key
        in Settings / Inference providers after you sign in.
      </Text>
      <Text className="m-0 mt-[16px] text-[12px] text-subtle leading-[20px]">
        You can use{' '}
        <Link className="text-signal no-underline" href={VERCEL_AI_GATEWAY_URL}>
          Vercel AI Gateway
        </Link>
        {', '}
        <Link className="text-signal no-underline" href={LLM_GATEWAY_URL}>
          LLM Gateway
        </Link>
        {', or '}
        <Link className="text-signal no-underline" href={OPENROUTER_URL}>
          OpenRouter
        </Link>
        .
      </Text>
    </>
  )
}
