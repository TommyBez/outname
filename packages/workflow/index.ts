import type { AgentRuntimeSpec as AgentRuntimeSpecType } from '@outname/ai/agent-runtime/workflows/session/runtime-spec-types'
import { agentEventWorkflow as runAgentEventWorkflow } from './agent-events/workflow'
import { buildToolSandboxWorkflow as runBuildToolSandboxWorkflow } from './tool-sandbox-builds/workflow'

export const agentEventWorkflow = runAgentEventWorkflow
export const buildToolSandboxWorkflow = runBuildToolSandboxWorkflow
export type AgentRuntimeSpec = AgentRuntimeSpecType
