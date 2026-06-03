# OUTNA.ME

This context defines the language for OUTNA.ME personal agents, their model
runtime choices, and the external capabilities they use.

## Language

**Inference Provider**:
A service selected to run language model requests for agents and assistant
workflows.
_Avoid_: AI provider, provider

**Default Inference Provider**:
The user's preferred inference provider for assistant workflows that are not tied
to a specific agent.
_Avoid_: General provider, global provider

**Agent Inference Provider**:
The inference provider selected for a specific agent's runtime.
_Avoid_: Agent provider, runtime provider

**Enabled Inference Provider**:
An inference provider whose credential has been accepted and verified for use.
_Avoid_: Configured provider, saved provider

**Inference Credential**:
A user-provided secret that authorizes OUTNA.ME to use an inference provider on
that user's behalf.
_Avoid_: Tool connection, connector credential

**Tool Provider**:
A third-party service or API exposed to agents through tools or connections.
_Avoid_: Inference provider, provider

**Upstream Provider**:
The backend provider endpoint that actually serves or bills a model generation
behind an inference provider.
_Avoid_: Inference provider, model provider, provider

**Model**:
A provider-scoped language model identifier that an agent can use at runtime.
_Avoid_: Provider, engine

**Model Selection**:
The complete runtime choice of an inference provider and one of its models.
_Avoid_: Model id, model

**Estimated Cost**:
A projected model generation cost calculated before the actual billed cost is
known.
_Avoid_: Spend, actual cost

**Actual Cost**:
The billed model generation cost reported by an inference provider after a run.
_Avoid_: Estimated cost, spend

**Budget**:
A user-defined operational guardrail for limiting agent spend; it is not a
billing ledger or financial guarantee.
_Avoid_: Billing, invoice, charge
