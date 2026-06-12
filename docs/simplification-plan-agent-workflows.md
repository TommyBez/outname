# Piano di semplificazione: workflow agent-events e interazione agenti

> Stato: PROPOSTA — nessuna modifica applicata.
> Data analisi: 2026-06-12
> Scope: `packages/ai/agent-runtime/**`, `packages/ai/tools/sub-agents/**`, route API collegate.
> Baseline misurata sui file toccati dal piano: **5.142 righe**.
> Riduzione stimata: **~1.550–1.700 righe (~30–33%)** + eliminazione di **10 file** e **1 colonna DB**.

---

## 1. Obiettivo e criteri

1. Eliminare **tutto** il codice difensivo su stati impossibili (stati che il type system o il flusso di chiamata già escludono).
2. Eliminare codice morto verificato (zero call-site in produzione).
3. Collassare duplicazioni e indirezioni che non pagano (3 copie della stessa logica di stream-writer, 2 pipeline identiche di build dello spec, micro-moduli da 3–5 righe).
4. Non toccare la logica di recovery distribuita che è legittimamente complessa (vedi §6).

Ogni intervento sotto indica: file, modifica esatta, righe stimate risparmiate, rischio, verifica.

---

## 2. FASE A — Codice morto (rimozione pura, rischio basso)

### A1. Forwarding del trace figlio→genitore mai attivo
**Evidenza:** `handleInvocation` ha un solo call-site in produzione — [workflow.ts:97](packages/ai/agent-runtime/workflows/agent-events/workflow.ts) — che passa sempre `parentStream: null`. Il branch `if (parentStream && parentToolCallId)` in [handle-invocation.ts:122](packages/ai/agent-runtime/workflows/session/handlers/handle-invocation.ts) non si attiva mai. Il tailing lato genitore avviene già via `collectSubAgentMessages` in [invocation-stream.ts](packages/ai/tools/sub-agents/invocation-stream.ts) (il tool sub-agent legge il namespace `streamToken` del run figlio).

**Azioni:**
- Eliminare il file [forward-child-trace.ts](packages/ai/agent-runtime/workflows/session/handlers/handle-invocation/forward-child-trace.ts) (102 righe).
- In `handle-invocation.ts`: rimuovere i parametri `parentStream`, la variabile `forwardPromise`, l'import dinamico del forwarding, e il `forwardPromise.catch` in `failInvocation`.
- In `workflow.ts`: rimuovere `parentStream: null` dalla chiamata.
- `parentToolCallId`/`parentToolId`/`parentRunId` restano nel payload evento (usati per idempotency key e breadcrumb `emitRun`).

**Risparmio:** ~135 righe. **Rischio:** basso (codice mai eseguito). **Verifica:** `pnpm test` workflow unit + grep `parentStream` = zero hit fuori da realtime.

### A2. Step di dispatch mai importato
**Evidenza:** `dispatchInvocationForWorkflow` in [dispatch-sub-agent-invocation.ts](packages/ai/agent-runtime/workflows/events/steps/dispatch-sub-agent-invocation.ts) non ha import in tutto il repo (il dispatch reale passa da [workflow-agent-tool.ts](packages/ai/tools/sub-agents/workflow-agent-tool.ts)).

**Azione:** eliminare il file (27 righe). **Rischio:** nullo.

### A3. Catena `publisherWorkflowRunId` mai scritta
**Evidenza:** `setEventPublisherWorkflowRunId` ([agent-event-store.ts:156](packages/ai/agent-runtime/server/agent-event-store.ts)) e `setAgentEventPublisherWorkflowRunIdStep` ([event-store.ts:75](packages/ai/agent-runtime/workflows/events/steps/event-store.ts)) non hanno call-site. La colonna `publisher_workflow_run_id` ([agents.ts:117](packages/db/schema/agents.ts)) non viene mai scritta.

**Azioni:**
- Rimuovere le due funzioni e il campo da `WorkflowAgentEvent`.
- Migrazione Drizzle: `DROP COLUMN publisher_workflow_run_id`.

**Risparmio:** ~35 righe + colonna. **Rischio:** basso; la migrazione è irreversibile → confermare prima del deploy che nessun consumer esterno legga la colonna.

### A4. Export e alias morti minori
| Simbolo | File | Evidenza |
|---|---|---|
| `runEventToAgentChatMessage` | [event-transcript.ts:21](packages/ai/agent-runtime/shared/event-transcript.ts) | export mai importato |
| `releaseSandbox` | [agent-sandbox.ts:148](packages/ai/agent-runtime/server/agent-sandbox.ts) | export mai importato |
| `workflowRunIdOrNull` | [session-events.ts:9](packages/ai/agent-runtime/server/session-events.ts) | funzione identità |
| `const buildWorkflowSubAgentTool = buildWorkflowAgentTool` | [workflow.ts:115](packages/ai/agent-runtime/workflows/agent-events/workflow.ts) | alias 1:1, usare direttamente |
| `scheduledConcurrencyKey` | [agent-event-keys.ts:20](packages/ai/agent-runtime/server/agent-event-keys.ts) | alias 1:1 di `scheduledBucketKey` — tenerne uno |
| `eventActivityNamespace` | [agent-event-keys.ts:5](packages/ai/agent-runtime/server/agent-event-keys.ts) | duplica `runEventsNamespace` ([run-events.ts:30](packages/ai/agent-runtime/server/run-events.ts)) — stessa stringa `events:${id}` in due moduli; tenerne uno |
| `readLiveMemory` | [read.ts:42](packages/ai/agent-runtime/workflows/session/tools/sandbox-file-helpers/read.ts) | alias 1:1 di `readLiveFile` |
| `replyNamespace` in `EnqueueAgentEventResult` | [agent-event-start.ts:36](packages/ai/agent-runtime/server/agent-event-start.ts) | campo restituito ma mai letto dai consumer |
| `bashToolModuleName()` | [system-bash-tool.ts:75](packages/ai/agent-runtime/workflows/session/tools/file-tools/system-bash-tool.ts) | funzione che ritorna una stringa costante |

**Risparmio:** ~60 righe. **Rischio:** nullo.

### A5. Mirror `replyToken` nelle invocation mai letto
**Evidenza:** per gli eventi `invocation`, sia la route stream ([stream/route.ts:48](apps/api/app/api/agents/[agentId]/events/[eventId]/stream/route.ts)) sia la persistenza transcript usano `outputNamespaceForAgentEvent`, che per le invocation ritorna **`streamToken`** ([agent-event-transcript.ts:31](packages/ai/agent-runtime/server/agent-event-transcript.ts)). Le scritture mirror sul namespace `reply:eventId` fatte da `handleInvocation` (error/finish/step-limit su `streamNamespaces`) non hanno alcun lettore.

**Azioni:**
- In `handle-invocation.ts`: rimuovere `replyToken`, `uniqueNamespaces`, `isString`, `finishInvocationStreams`, e tutti i loop `Promise.all(streamNamespaces.map(...))` in `failInvocation`/`refuseBudgetExceeded` → singola scrittura su `streamToken`.
- In `workflow.ts`: smettere di passare `replyToken` al ramo invocation. **Nota:** per heartbeat/dreaming `replyToken` È letto (lì `outputNamespaceForAgentEvent` ritorna `reply:eventId`) — non toccare quel ramo; anzi rendere `replyToken` **obbligatorio** in `handleHeartbeat` ed eliminare il fallback difensivo `?? runId` ([handle-heartbeat.ts:53](packages/ai/agent-runtime/workflows/session/handlers/handle-heartbeat.ts)), mai usato perché l'unico caller lo passa sempre.

**Risparmio:** ~70 righe. **Rischio:** medio-basso. **Verifica:** test E2E invocazione sub-agent: il genitore riceve il transcript, la UI eventi mostra il run; heartbeat continua a streamare.

---

## 3. FASE B — Difese su stati impossibili (obbligatorio: rimuoverle TUTTE)

### B1. Doppio check ownership nel realtime runner
[realtime-chat-runner.ts](packages/ai/agent-runtime/server/realtime-chat-runner.ts): `prepareRealtimeChatTurn` chiama `assertRealtimeAgentOwnership` (fetch agent + confronto userId, riga 170) e poi ri-verifica `spec.userId !== input.userId` (riga 190) sullo spec costruito **dalla stessa riga DB**. Inoltre `buildAgentRuntimeSpec` ri-fetcha l'agente appena caricato.

**Azione:** un solo fetch: caricare la riga agente una volta, verificare ownership una volta, passare la riga a `buildAgentRuntimeSpec` (vedi C1). Eliminare il secondo `throw`.
**Risparmio:** ~25 righe + 1 query DB per turno chat.

### B2. Ramo `userId: null` nel budget heartbeat
[handle-heartbeat/budget.ts:25](packages/ai/agent-runtime/workflows/session/handlers/handle-heartbeat/budget.ts): se l'agente non esiste ritorna `{ kind: 'continue', userId: null }` e il run prosegue **saltando il budget check**; poi `buildAgent` rilancia comunque "agent not found". A valle, [handle-heartbeat.ts:118](packages/ai/agent-runtime/workflows/session/handlers/handle-heartbeat.ts) guarda `if (budgetCheck.userId)` per registrare l'usage — stato impossibile che, se mai si verificasse, salterebbe silenziosamente la contabilizzazione token.

**Azione:** `checkBudgetOrFinalize` lancia subito `nonRetryableStepError` se l'agente manca; il tipo di ritorno diventa `{ kind: 'continue'; userId: string } | { kind: 'exceeded'; ... }`; rimuovere l'`if (budgetCheck.userId)`. Bonus: la riga agente caricata qui va riusata da `buildAgent` (oggi `loadAgentStep` gira 2 volte per heartbeat — vedi C1).
**Risparmio:** ~20 righe + 1 step DB per heartbeat.

### B3. Guard `if (!execute)` sui tool bash
[file-steps.ts:32,60](packages/ai/agent-runtime/workflows/session/tools/file-tools/file-steps.ts) e [skill-tools.ts:156](packages/ai/agent-runtime/workflows/session/tools/skill-tools.ts): `createBashTool` ritorna sempre tool con `execute` definito; il cast `as BashToolExecutor | undefined` crea lui stesso lo "stato impossibile" che poi viene difeso. Sparisce da solo con C3 (eliminazione del wrapping bash-tool). Se C3 slittasse: tipizzare il ritorno senza `| undefined` e rimuovere i tre guard.

### B4. Re-check hash dopo query già filtrata
[maintainer-tools.ts:153](packages/ai/agent-runtime/workflows/session/steps/resolve-tool-plan/maintainer-tools.ts): `if (snapshot && snapshot.manifestHash === desiredHash)` — la query ha già `eq(toolSandboxSnapshots.manifestHash, desiredHash)`. Sostituire con `if (snapshot)`.

### B5. Ri-validazione runtime di un tipo già garantito
[use-agent-event-transcript.ts:19-59](packages/ai/agent-runtime/hooks/use-agent-event-transcript.ts): lo `useMemo` controlla `event?.id && event.queuedAt && ... && event.attempt !== null` su un `AgentEventSummary` già tipato (nessun campo è nullable tra quelli controllati) e ricopia a mano 12 campi con 12 dipendenze.

**Azione:** rimuovere il memo; usare `event` direttamente (il caller passa già `AgentEventSummary | null`). Se serve stabilità referenziale per l'effect del live-transcript, memoizzare su `event?.id` + `event?.status` + `event?.workflowRunId` soltanto, documentando il perché.
**Risparmio:** ~45 righe.

### B6. Catch impossibile in `resolveSkillPlan`
[resolve-skill-plan.ts:32](packages/ai/agent-runtime/workflows/session/steps/resolve-skill-plan.ts): il ramo `isMissingSkillSandboxError` è irraggiungibile — `getSkillSandbox` lancia quell'errore solo quando `sandboxSkillsId` è null, ma siamo nel ramo in cui `readSkillSandboxName` ha appena ritornato non-null **dalla stessa colonna**. In più la colonna viene letta due volte (`readSkillSandboxName` + `getSkillSandbox`→`readSandboxId`).

**Azione:** una sola lettura: `getSkillSandbox` accetta (o espone) il nome già letto; rimuovere il ramo missing; lasciare il catch generico che degrada a `skills: []`.
**Risparmio:** ~15 righe + 1 query.

### B7. Re-check di precondizioni del chiamante
- [start-next-queued-event.ts:10](packages/ai/agent-runtime/workflows/events/steps/start-next-queued-event.ts): `if (!input.concurrencyKey) return` duplicato — lo step chiamante [workflow.ts:128](packages/ai/agent-runtime/workflows/agent-events/workflow.ts) fa lo stesso check due righe prima. Con A2 il file degli step resta con questa sola funzione: **inlinare tutto nel workflow** ed eliminare il file.
- `startForwardingChildTrace` re-check di `parentStream && parentToolCallId` — sparisce con A1.
- [realtime-chat-runner.ts:222](packages/ai/agent-runtime/server/realtime-chat-runner.ts): `turn.buildSubAgentTool ?? missingRealtimeSubAgentTool` duplica il default già applicato dentro `buildRealtimeAgentRuntime` ([realtime-agent-runtime.ts:36](packages/ai/agent-runtime/server/realtime-agent-runtime.ts)); rimuovere il default nel runner e la costante duplicata `missingRealtimeSubAgentTool` (definita identica in entrambi i file).

### B8. Espressione identità
[agent-event-summaries.ts:286](packages/ai/agent-runtime/server/agent-event-summaries.ts): `event.source === 'manual' ? 'manual' : event.source` → `event.source`.

### B9. Flag `active` ridondante nel live transcript
[use-agent-event-live-transcript.ts](packages/ai/agent-runtime/hooks/use-agent-event-live-transcript.ts): `active` viene messo a `false` solo nello stesso cleanup che chiama `controller.abort()`; ogni check è `active && !controller.signal.aborted` — i due predicati sono sempre equivalenti. Tenere solo `controller.signal.aborted`.
**Risparmio:** ~15 righe e 6 predicati composti in meno.

---

## 4. FASE C — Duplicazioni e indirezioni (refactor, rischio medio)

### C1. Doppia pipeline di build dello spec agente
[agent-factory.ts:42-96](packages/ai/agent-runtime/workflows/session/agent-factory.ts) (`buildAgent`) e [runtime-spec.ts:31-77](packages/ai/agent-runtime/server/runtime-spec.ts) (`buildAgentRuntimeSpec`) sono la **stessa sequenza** duplicata riga per riga: load agent → throw not-found → `resolveToolPlan` → `resolveSkillPlan` → `composeSystemPrompt` → assemblaggio `AgentRuntimeSpec`.

**Azione:** un'unica `buildAgentRuntimeSpec(input & { agentRow?: Agent })` in un modulo importabile da entrambi i contesti (gli step `resolveToolPlan`/`resolveSkillPlan`/`composeSystemPrompt` sono già `'use step'`, quindi callable dal workflow); `buildAgent` diventa: spec → `buildDurableAgentRuntime(spec, options)`. Il parametro opzionale `agentRow` permette ai chiamanti che hanno già la riga (B1, B2) di evitare il re-fetch.

**Vincolo WDK (bundle workflow):** il modulo unificato entra nel grafo del bundle workflow via `agent-factory.ts`. Il marker `import 'server-only'` è **compatibile** col bundle workflow (risolve a no-op via condition `react-server`; provato in repo: `workflow-run-id.ts` lo ha ed è chiamato nel corpo workflow) — può restare. Il vincolo vero è l'**I/O nel corpo workflow**: sostituire la chiamata diretta `getAgentById` con `loadAgentStep`, così ogni accesso DB resta dietro le funzioni `'use step'` esistenti.
**Vincolo WDK (serializzazione):** `agentRow` attraversa il boundary step→workflow→step; è già provato serializzabile oggi (`loadAgentStep` ritorna la riga `Agent` con campi `Date`).
**Risparmio:** ~55 righe + query duplicate. **Verifica:** unit test handle-heartbeat + test realtime runner esistenti + run integration workflow (conferma che il bundle compila senza moduli server).

### C2. Tre copie della logica "scrivi tool-output-available preliminare"
1. [agent-tool.ts:153-197](packages/ai/tools/sub-agents/agent-tool.ts) `emitPreliminarySubAgentOutput`
2. [invocation-stream.ts:50-108](packages/ai/tools/sub-agents/invocation-stream.ts) `emitProgressUpdate`
3. `forward-child-trace.ts` `writeParentSubAgentOutput` (sparisce con A1)

Le prime due hanno identico schema: risolvi target (writer UI o namespace workflow) → scrivi chunk `{ type: 'tool-output-available', preliminary: true }` → try/catch best-effort.

**Azione:** una funzione `writePreliminarySubAgentOutput(target, toolCallId, output)` in `progress-target.ts`; le due call-site passano solo l'output. Stessa occasione: unificare `upsertMessage`, oggi copiato **4 volte** (invocation-stream, forward-child-trace, [agent-event-transcript.ts:80](packages/ai/agent-runtime/server/agent-event-transcript.ts), use-agent-event-live-transcript) → un'utility in `shared/`.

**Vincolo WDK (serializzazione):** l'helper condiviso deve restare una **funzione plain, NON `'use step'`**, invocata dall'interno degli step esistenti (`emitPreliminarySubAgentOutput`, `collectSubAgentMessages`). Motivo: `SubAgentProgressTarget` include la variante `{ writer: UIMessageStreamWriter }` che non è serializzabile — oggi non rompe perché in contesto workflow il target è sempre la variante stringa (`workflow-parent-stream`/`none`) e in contesto realtime gli step eseguono come funzioni normali (nessun boundary reale). Introdurre un nuovo boundary `'use step'` qui romperebbe il path realtime. Inoltre `getWritable` va chiamato solo da codice step (vincolo già documentato in run-events.ts) — l'helper eredita il contesto step del chiamante.
**Risparmio:** ~90 righe.

### C3. Wrapping `bash-tool` per tool che non sono bash
[system-bash-tool.ts](packages/ai/agent-runtime/workflows/session/tools/file-tools/system-bash-tool.ts) costruisce un bash-tool **con bash disabilitato** (`executeCommand` ritorna sempre exit 126, `maxFiles: 0`) al solo scopo di ottenere `readFile`/`writeFile`, che [file-steps.ts](packages/ai/agent-runtime/workflows/session/tools/file-tools/file-steps.ts) ri-estrae via cast `as unknown as` + guard `if (!execute)`. Ma il lavoro vero (path-safety, read, mkdir -p, write) è già tutto nell'adapter locale (`readLiveFile`, `assertWritableSandboxPath`, `ensureParentDirectories`).

**Azione:** implementare `readFileStep`/`writeFileStep` direttamente sopra l'adapter (le funzioni esistono già nei sandbox-file-helpers), eliminando la dipendenza da `bash-tool` per il system sandbox, i cast, i guard B3 e l'errore-sentinella `SystemSandboxFileNotFoundError` (sostituito dal ritorno `{ exists: false }` diretto di `readLiveFile === null`).
**Attenzione:** preservare il formato esatto dell'output dei tool visti dal modello (snapshot test sui risultati di `readFile`/`writeFile` prima/dopo).
**Vincolo WDK:** mantenere invariata la struttura `'use step'` di `file-steps.ts` — le chiamate all'SDK `@vercel/sandbox` devono restare **dentro i corpi step** (il compiler estrae nel bundle step gli import usati solo lì; spostarle fuori porterebbe moduli Node-native nel bundle workflow). Output dei nuovi step: solo oggetti JSON piatti.
**Risparmio:** ~140 righe nette + una dipendenza in meno sul percorso caldo. **Rischio:** medio — è il percorso file-tools usato da ogni evento.

### C4. Skill bash tool ricreato a ogni comando + adapter duplicato
[skill-tools.ts:142-202](packages/ai/agent-runtime/workflows/session/tools/skill-tools.ts): ogni `bash` step reimporta `bash-tool`, ricrea l'adapter e il tool. Inoltre `createSkillSandboxAdapter`, `ensureParentDirectories`, `pathDirname`, `decodeUtf8` duplicano le versioni di system-bash-tool/sandbox-file-helpers.

**Azione:** qui bash è reale, quindi `bash-tool` resta; ma: (a) estrarre l'adapter condiviso e le utility duplicate nei sandbox-file-helpers; (b) il guard B3 sparisce. La ricreazione per-step è forzata dal modello `'use step'` (niente stato tra step) — documentarla con una riga, non "ottimizzarla".
**Risparmio:** ~60 righe.

### C5. Sentinella `starting:` nel `workflowRunId`
`claimQueuedEvent` scrive `workflowRunId = "starting:evt_x"` come marcatore di claim; lo stato è già codificato da `status='starting'` + `claimExpiresAt`. La sentinella costringe 4 siti a fare string-sniffing: `realWorkflowRunId` ([agent-event-start.ts:134](packages/ai/agent-runtime/server/agent-event-start.ts)), `readableWorkflowRunId` ([agent-event-summaries.ts:290](packages/ai/agent-runtime/server/agent-event-summaries.ts)), `requiresPersistedTranscript` ([agent-event-transcript.ts:91](packages/ai/agent-runtime/server/agent-event-transcript.ts)), route stream ([stream/route.ts:25](apps/api/app/api/agents/[agentId]/events/[eventId]/stream/route.ts)).

**Azione:** claim con `workflowRunId = null`; settare il run id reale solo in `setEventWorkflowRunId` post-start (già esiste). Rimuovere le 4 funzioni/check di sniffing. **Transizione:** mantenere per un deploy una `WHERE`-clause di bonifica (UPDATE righe `starting:%` → NULL) oppure tolleranza in lettura, poi rimuoverla.
**Risparmio:** ~35 righe e un'invariante in meno da conoscere. **Rischio:** medio — toccare con test integration workflow attivi.

### C6. Catena starter a tre moduli
`agent-events.ts` (binding) → `agent-event-start.ts` (varianti `*WithStarter`) → `agent-events/starter.ts` (lambda di start). L'iniezione `startWorkflowRun` serve davvero solo a rompere il ciclo import workflow↔store e per il mock nei test — ma tre file per due funzioni è eccessivo.

**Azione:** fondere `starter.ts` dentro `agent-events.ts` (il modulo `server-only` che fa il binding); `agent-event-start.ts` resta con le funzioni iniettabili. Da 3 file a 2, ~20 righe.

### C7. Micro-moduli da inlinare
| File | Contenuto | Destinazione |
|---|---|---|
| [handle-heartbeat/messages.ts](packages/ai/agent-runtime/workflows/session/handlers/handle-heartbeat/messages.ts) (5 r.) | `activityMessage` + tipo | dentro `handle-heartbeat.ts` (unico fan-out: budget.ts, che con B2 si può anch'esso valutare di inlinare) |
| [handle-invocation/run-helpers.ts](packages/ai/agent-runtime/workflows/session/handlers/handle-invocation/run-helpers.ts) (3 r.) | `invocationMessageId` | dentro `handle-invocation.ts` |
| [file-tools/types.ts](packages/ai/agent-runtime/workflows/session/tools/file-tools/types.ts) (3 r.) | `FileToolsContext` | dentro `file-tools.ts` |
| [skills/paths.ts](packages/ai/agent-runtime/skills/paths.ts) (3 r.) | costanti | valutare merge in `skill-tools.ts`/discovery |

`createAssistantTextMessage` è copiata 3 volte (handle-invocation, handle-heartbeat, realtime-chat-runner) → una utility condivisa. `payloadAs` è duplicata (workflow.ts + agent-event-store.ts) → tenerne una.
**Risparmio:** ~50 righe e 4 file in meno.

### C8. Sandbox system vs skills: modulo fotocopia
[agent-sandbox.ts](packages/ai/agent-runtime/server/agent-sandbox.ts) e [agent-skill-sandbox.ts](packages/ai/agent-runtime/server/agent-skill-sandbox.ts) duplicano `nameFor`/`readSandboxId`/`writeSandboxId`/`missing*Message`/`isMissing*Error`/`get*Sandbox`/`destroy*Sandbox` con sole differenze: colonna DB, suffisso nome, opzioni create.

**Azione:** factory parametrizzata `createAgentSandboxAccessor({ column, suffix, createOptions, missingMessage })` che ritorna le sei funzioni; i due moduli diventano due istanze. In più [realtime-cleanup.ts:58](packages/ai/agent-runtime/server/realtime-cleanup.ts) definisce un **secondo** `isMissingSystemSandboxError` con semantica diversa (HTTP 404 strutturale vs confronto stringa) e stesso nome — rinominarlo (`isSandboxGoneError`) o unificare la detection.
**Risparmio:** ~80 righe. **Rischio:** basso (pure refactor, API invariata).

### C9. `WorkflowAgentEvent` pick manuale
[event-store.ts:17-40](packages/ai/agent-runtime/workflows/events/steps/event-store.ts): `loadAgentEventStep` ricopia a mano 10 campi per restringere il tipo. Il valore attraversa comunque la serializzazione dello step.

**Azione:** ritornare la riga intera (`AgentEvent`) o, se si vuole il payload snello, costruire il pick con una sola destrutturazione. Con A3 il pick perde un campo comunque.
**Nota WDK:** la riga intera è serializzabile (i `Date` attraversano già il boundary in `loadAgentStep`), ma il pick minimizza il payload serializzato dello step — item **opzionale**, applicare solo la destrutturazione singola se si preferisce mantenere il payload snello.
**Risparmio:** ~15 righe.

### C10. Scheduler: contatori e doppio recovery
[event-scheduler.ts](packages/ai/agent-runtime/server/event-scheduler.ts): 8 contatori threadati a mano in 4 funzioni solo per il JSON della route cron; `recoverRunningEvents` deduce l'esito confrontando `status`/`lastError` prima/dopo `reconcileActiveAgentEvent` (fragile: distingue i casi tramite la **stringa** `'running event heartbeat is stale'`).

**Azione (conservativa):** far ritornare a `reconcileActiveAgentEvent` un esito esplicito `{ event, outcome: 'unchanged' | 'completed' | 'failed-stale' | 'failed-workflow' | 'requeued' }` e derivare i contatori dall'outcome, eliminando il confronto before/after e il matching sulla stringa. Non ridurre i meccanismi di recovery (claim TTL, starting scaduti, running stantii): coprono guasti distinti e reali.
**Risparmio:** ~25 righe e una fragilità in meno.

---

## 5. Ordine di esecuzione e verifiche

Sequenza pensata per PR piccole e indipendenti, ciascuna verde su `pnpm lint && pnpm test` (+ suite `vitest.workflow*`):

| # | PR | Item | Righe stimate | Rischio |
|---|---|---|---|---|
| 1 | Dead code puro | A1, A2, A4, B7(parte), B8 | ~250 | basso |
| 2 | Colonna publisher | A3 (+migrazione) | ~35 | basso |
| 3 | Mirror replyToken invocation | A5 + B7 fallback heartbeat | ~80 | medio-basso |
| 4 | Stati impossibili runtime | B1, B2, B4, B6 | ~70 | basso |
| 5 | Hook client | B5, B9 + upsertMessage condiviso | ~80 | basso |
| 6 | Build spec unificato | C1 (+B1/B2 ricablati su agentRow) | ~70 | medio |
| 7 | Progress writer unico | C2 | ~90 | medio |
| 8 | File tools senza bash-tool | C3 + B3 | ~140 | medio |
| 9 | Skill tools dedup | C4 | ~60 | medio-basso |
| 10 | Sentinella starting: | C5 | ~35 | medio |
| 11 | Starter + micro-moduli + pick | C6, C7, C9 | ~85 | basso |
| 12 | Sandbox factory + scheduler outcome | C8, C10 | ~105 | basso/medio |

**Totale stimato: ~1.100 righe rimosse direttamente**, più ~400–500 righe di semplificazione strutturale (firme ridotte, parametri eliminati, import in meno) = **~1.550–1.700 su 5.142 (≈30–33%)**, 10 file eliminati:
`forward-child-trace.ts`, `dispatch-sub-agent-invocation.ts`, `start-next-queued-event.ts`, `handle-heartbeat/messages.ts`, `handle-invocation/run-helpers.ts`, `file-tools/types.ts`, `system-bash-tool.ts` (assorbito), `agent-events/starter.ts` (assorbito), `skills/paths.ts` (assorbito), `session-events.ts` ridotto o assorbito.

**Verifiche trasversali per ogni PR:**
1. `pnpm test` + suite workflow (`vitest.workflow-unit.config.ts`, `vitest.workflow.config.ts`, integration se toccati gli step).
2. Smoke manuale: heartbeat manuale (`pokeHeartbeat`), chat realtime con sub-agent, pagina eventi con live transcript.
3. `grep` del simbolo rimosso = zero hit.
4. Per PR 3/8/10: test integration con workflow runtime reale prima del merge.

---

## 5-bis. Vincoli Workflow DevKit (checklist per ogni PR)

Due regole del WDK governano tutto il refactor; ogni PR delle fasi C va validata contro entrambe:

1. **Boundary `'use step'` = solo dati serializzabili.** Input e output degli step attraversano la serializzazione WDK (JSON + `Date`; provato in produzione da `loadAgentStep` che ritorna la riga `Agent` con `Date`). Vietato far passare: writer/stream (`UIMessageStreamWriter`, `WritableStream`), funzioni/closure (`BuildAgentTool`, callback), istanze SDK (`Sandbox`). Le eccezioni apparenti nel codice attuale (es. `progressTarget` con writer in input a `collectSubAgentMessages`) funzionano solo perché in contesto realtime gli step eseguono come funzioni plain — nessun boundary reale. Regola pratica: se un parametro non-serializzabile entra in una funzione `'use step'`, quel codice gira solo in realtime; non promuovere mai a step condiviso una funzione che lo riceve (vedi C2).
2. **Niente I/O o moduli Node-native eseguiti nel corpo workflow.** Il codice che esegue nel corpo del workflow (fuori dai corpi step) non può fare accesso DB, rete, filesystem, né valutare SDK con binding nativi (`@outname/db`, `@vercel/sandbox`): ogni I/O passa da una funzione `'use step'`. Il compiler estrae nel bundle step gli import usati esclusivamente dentro corpi `'use step'` — per questo `file-steps.ts` può importare `agent-sandbox.ts` top-level. Nota: il marker `import 'server-only'` è **compatibile** col bundle workflow (risolve a no-op via condition `react-server`; prova in repo: `workflow-run-id.ts` lo contiene ed è chiamato nel corpo workflow in handle-invocation/handle-heartbeat) — non serve rimuoverlo. Conseguenze sul piano: il modulo unificato di C1 usa `loadAgentStep` al posto di `getAgentById`; C3 mantiene l'SDK sandbox dentro i corpi step; gli shim con dynamic import (§6) restano.

Verifica meccanica per le PR 6–10: build del bundle workflow (`vitest.workflow*` integration la esegue) + smoke run di un evento heartbeat e di una invocation.

---

## 6. Esplicitamente NON toccare (complessità legittima)

- **Recovery a tre livelli dello scheduler** (claim TTL, requeue starting scaduti, fail running stantii): coprono crash del processo in punti diversi del ciclo di vita; ridondanti solo in apparenza.
- **`withRedisLock` + idempotencyKey + `onConflictDoNothing`**: idempotenza multi-replica reale (cron concorrenti).
- **Step shim `'use step'` con dynamic import** (es. `events/steps/event-store.ts`): pattern richiesto dal Workflow DevKit per tenere i moduli `server-only` fuori dal bundle workflow. Si può solo **uniformare lo stile** (alcuni shim usano import statici, altri dinamici) — non rimuovere.
- **Retry/backoff del live transcript hook** (`runStreamWithRetry`, 409/503): gestisce stati reali del workflow remoto.
- **`isPgUniqueViolation` con walk della catena `cause`**: i driver Postgres annidano l'errore davvero.
- **Switch esaustivi con `never`** (`dispatchAgentEvent`, `previewAgentEvent`, ecc.): non sono difese su stati impossibili, sono enforcement compile-time — tenerli.
- **Overload `runRealtimeChatTurn`** (ui-message vs text-only): due canali di consegna reali (web UI vs canali esterni).

---

## 7. Metriche di accettazione

- [ ] Riduzione ≥30% righe sui file in scope (baseline 5.142 → target ≤3.600).
- [ ] Zero guard su stati impossibili residui: ogni `if` difensivo rimasto nel runtime deve corrispondere a uno stato raggiungibile documentabile in una riga di commento.
- [ ] Nessuna funzione esportata senza call-site in `packages/ai/agent-runtime` e `packages/ai/tools/sub-agents` (verifica con `knip` o grep script).
- [ ] Una sola implementazione per: upsert messaggi stream, preliminary tool-output writer, build spec agente, accessor sandbox, assistant text message.
- [ ] Suite test e smoke invariati (stesso comportamento osservabile da UI e da modello).
