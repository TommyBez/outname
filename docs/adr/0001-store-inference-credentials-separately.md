# Store inference credentials separately from tool connections

OUTNA.ME will store inference provider credentials in a dedicated user-scoped
inference credential store instead of adding provider-specific columns to the
user table or reusing `user_connections`. Inference credentials govern the
language model runtime itself, while `user_connections` is oriented around
tool and connector access; keeping the boundary explicit avoids overloading the
connector model and lets inference providers carry verification status,
metadata, and future provider-specific runtime policy.
