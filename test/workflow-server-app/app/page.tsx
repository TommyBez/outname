import { serverEchoWorkflow } from '../workflows/server-echo'

const registeredWorkflows = [serverEchoWorkflow]

export default function HomePage() {
  return <main>Registered workflows: {registeredWorkflows.length}</main>
}
