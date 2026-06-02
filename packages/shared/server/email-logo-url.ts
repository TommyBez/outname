import 'server-only'

import { buildEmailLogoUrl } from '@outname/email/email-logo'
import { withRelatedProject } from '@vercel/related-projects'
import {
  LOCAL_PROJECT_ORIGINS,
  PROJECT_NAMES,
} from '../vercel-related-projects'

function getWebBaseUrl(): string {
  return withRelatedProject({
    defaultHost: LOCAL_PROJECT_ORIGINS.web,
    projectName: PROJECT_NAMES.web,
  })
}

/** Absolute URL for the logo hosted by the marketing web app (`apps/web`). */
export function getEmailLogoUrl(): string {
  return buildEmailLogoUrl(getWebBaseUrl())
}
