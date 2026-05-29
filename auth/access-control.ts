import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  userAc,
} from 'better-auth/plugins/admin/access'

const accessStatement = {
  ...defaultStatements,
  waitlist: ['manage'],
  slack: ['use'],
} as const

export const ac = createAccessControl(accessStatement)

const adminRole = ac.newRole({
  ...adminAc.statements,
  waitlist: ['manage'],
  slack: ['use'],
})

const userRole = ac.newRole({
  ...userAc.statements,
})

export const roles = {
  admin: adminRole,
  user: userRole,
} as const

export const waitlistManagePermission = {
  waitlist: ['manage'] as 'manage'[],
}

export const slackIntegrationPermission = {
  slack: ['use'] as 'use'[],
}
