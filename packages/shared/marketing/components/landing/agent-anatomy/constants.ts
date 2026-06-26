import type { AnatomyStepId } from '@outname/shared/marketing/data/agent-anatomy'
import {
  BrainIcon,
  CpuIcon,
  GitBranchIcon,
  HammerIcon,
  HeartPulseIcon,
  type LucideIcon,
  PuzzleIcon,
  RadioTowerIcon,
  WalletIcon,
} from 'lucide-react'

export const stepIcons: Record<AnatomyStepId, LucideIcon> = {
  budget: WalletIcon,
  channels: RadioTowerIcon,
  heartbeat: HeartPulseIcon,
  memory: BrainIcon,
  model: CpuIcon,
  skills: PuzzleIcon,
  subagents: GitBranchIcon,
  tools: HammerIcon,
}
