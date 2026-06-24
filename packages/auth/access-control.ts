import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  userAc,
} from 'better-auth/plugins/admin/access'

const accessStatement = {
  ...defaultStatements,
  slack: ['use'],
} as const

export const ac = createAccessControl(accessStatement)

const adminRole = ac.newRole({
  ...adminAc.statements,
  slack: ['use'],
})

const userRole = ac.newRole({
  ...userAc.statements,
})

export const roles = {
  admin: adminRole,
  user: userRole,
} as const

export const slackIntegrationPermission = {
  slack: ['use'] as 'use'[],
}
