import 'server-only'
import { createAgentBrowserTool } from '@/tools/providers/agent-browser'

export const agentBrowserLightTool = createAgentBrowserTool({
  id: 'agent_browser_light',
  displayName: 'agent-browser-light',
  displayDescription:
    'Browse websites with a lightweight engine — good for reading and simple interactions.',
  manifestId: 'agent-browser-light',
  commandDescription:
    'agent-browser subcommand. This sandbox pins agent-browser to the Lightpanda engine. See https://agent-browser.dev for the full reference. Common: open, close, snapshot, screenshot, click, type, press, eval, goto, reload, back, forward, wait, network, storage, list, select, hover, scroll, upload, download, cookies, frames.',
  argsDescription:
    'Positional + flag arguments to pass to the subcommand, in order. Example: ["https://example.com"] for `open`, or ["-i", "-c"] for `snapshot`. Quoting is handled by the runtime. Chrome-only flags such as headed mode, persistent profiles, storage state, and file access are unavailable under the Lightpanda engine.',
  description:
    'Drive a headless browser via the agent-browser CLI configured for the Lightpanda engine in this sandbox. The browser session persists across calls for the duration of this conversation, so you can chain `open` -> `snapshot` -> `click @ref` etc. Chrome-only features such as headed mode, persistent profiles, storage state, and file access are unavailable; screenshot support depends on Lightpanda CDP coverage. Returns exit code, stdout, and stderr per call.',
})
