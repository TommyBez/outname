import 'server-only'
import type { z } from 'zod'
import type {
  ApiKeyConnector,
  ApiKeyFieldDescriptor,
  ApiKeyValidateResult,
  ConnectorBroker,
  OAuth2Connector,
} from './types'

interface DefineConnectorArgs<TSchema extends z.ZodTypeAny> {
  broker: ConnectorBroker<z.infer<TSchema>>
  credential: TSchema
  description: string
  displayName: string
  fields: ApiKeyFieldDescriptor[]
  providerGroup?: string
  surface?: string
  validate?(values: z.infer<TSchema>): Promise<ApiKeyValidateResult>
}

export function defineConnector<
  const TConnectorId extends string,
  TSchema extends z.ZodTypeAny,
>(
  connectorId: TConnectorId,
  args: DefineConnectorArgs<TSchema>
): ApiKeyConnector<z.infer<TSchema>, TConnectorId> {
  const validateFn = args.validate
  const validate = validateFn
    ? async (values: Record<string, string>) =>
        validateFn(args.credential.parse(values))
    : undefined
  const providerGroup = args.providerGroup ?? providerGroupFrom(connectorId)

  return {
    connectorId,
    providerGroup,
    surface: args.surface ?? 'api_key',
    authKind: 'api_key',
    displayName: args.displayName,
    description: args.description,
    broker: args.broker,
    apiKey: {
      formSchema: args.credential as unknown as z.ZodType<z.infer<TSchema>>,
      fields: args.fields,
      validate,
    },
  }
}

export function defineOAuth2Connector<const TConnectorId extends string>(
  connectorId: TConnectorId,
  args: Omit<OAuth2Connector<TConnectorId>, 'authKind' | 'connectorId'>
): OAuth2Connector<TConnectorId> {
  return {
    ...args,
    connectorId,
    authKind: 'oauth2',
  }
}

function providerGroupFrom(connectorId: string): string {
  return connectorId.split('.')[0] ?? connectorId
}
