# Cut over AI Gateway credentials to the inference credential store

OUTNA.ME will migrate existing AI Gateway credentials into the dedicated
inference credential store and remove the legacy user-column path in the same
integration. This avoids a long-lived dual-read runtime, keeps credential state
unambiguous, and accepts a sharper migration boundary in exchange for simpler
provider selection and verification semantics.
