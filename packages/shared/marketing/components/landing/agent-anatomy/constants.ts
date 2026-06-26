import type { AnatomyStepId } from '@outname/shared/marketing/data/agent-anatomy'
import {
  BrainIcon,
  CalendarIcon,
  ContactIcon,
  ListChecksIcon,
  type LucideIcon,
  MoonIcon,
  ScrollTextIcon,
  SparklesIcon,
  TargetIcon,
  UserIcon,
} from 'lucide-react'

export const stepIcons: Record<AnatomyStepId, LucideIcon> = {
  calendar: CalendarIcon,
  dreams: MoonIcon,
  goals: TargetIcon,
  identity: ContactIcon,
  instructions: ScrollTextIcon,
  memory: BrainIcon,
  soul: SparklesIcon,
  tasks: ListChecksIcon,
  user: UserIcon,
}
