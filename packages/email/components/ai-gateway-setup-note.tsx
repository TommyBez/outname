import { Link, Text } from 'react-email'

const VERCEL_AI_GATEWAY_URL = 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai'

export function AiGatewaySetupNote() {
  return (
    <>
      <Text className="m-0 mt-[16px] text-[14px] text-subtle leading-[22px]">
        Before you run agents, create your personal Vercel AI Gateway API key
        and save it in Settings / AI Gateway (BYOK) after you sign in.
      </Text>
      <Text className="m-0 mt-[16px] text-[12px] text-subtle leading-[20px]">
        Create the key here:{' '}
        <Link className="text-signal no-underline" href={VERCEL_AI_GATEWAY_URL}>
          Vercel AI Gateway dashboard
        </Link>
      </Text>
    </>
  )
}
