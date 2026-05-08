import 'server-only'
import type { z } from 'zod'
import type {
  ApiKeyConnector,
  ApiKeyFieldDescriptor,
  ApiKeyValidateResult,
  ConnectorBroker,
} from './types'

interface DefineConnectorArgs<TSchema extends z.ZodTypeAny> {
  broker: ConnectorBroker<z.infer<TSchema>>
  credential: TSchema
  description: string
  displayName: string
  fields: ApiKeyFieldDescriptor[]
  validate?(values: z.infer<TSchema>): Promise<ApiKeyValidateResult>
}

export function defineConnector<
  const TProvider extends string,
  TSchema extends z.ZodTypeAny,
>(
  provider: TProvider,
  args: DefineConnectorArgs<TSchema>
): ApiKeyConnector<z.infer<TSchema>, TProvider> {
  const validateFn = args.validate
  const validate = validateFn
    ? async (values: Record<string, string>) =>
        validateFn(args.credential.parse(values))
    : undefined

  return {
    provider,
    kind: 'api_key',
    displayName: args.displayName,
    description: args.description,
    broker: args.broker,
    apiKey: {
      formSchema: args.credential,
      fields: args.fields,
      validate,
    },
  }
}
