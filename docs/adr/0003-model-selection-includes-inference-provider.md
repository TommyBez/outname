# Model selection includes the inference provider

OUTNA.ME treats a model selection as the combination of an inference provider and
a model id, rather than treating model ids as globally meaningful. The same
model-looking string can have different availability, routing, pricing, and
usage metadata through Vercel AI Gateway versus OpenRouter, so agents and usage
records must persist the inference provider alongside the model id.
