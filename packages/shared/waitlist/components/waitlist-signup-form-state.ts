import type {
  WaitlistPrimaryInterest,
  WaitlistProfileType,
} from '@outname/shared/waitlist/server/constants'

export interface WaitlistSignupFormState {
  company: string
  email: string
  isSubmitting: boolean
  name: string
  primaryInterest: WaitlistPrimaryInterest | ''
  profileType: WaitlistProfileType | ''
  submittedMessage: string | null
  useCase: string
}

export type WaitlistSignupFormAction =
  | { type: 'set_email'; value: string }
  | { type: 'set_name'; value: string }
  | { type: 'set_primary_interest'; value: WaitlistPrimaryInterest | '' }
  | { type: 'set_profile_type'; value: WaitlistProfileType | '' }
  | { type: 'set_use_case'; value: string }
  | { type: 'set_company'; value: string }
  | { type: 'set_is_submitting'; value: boolean }
  | { type: 'set_submitted_message'; value: string | null }

export const initialWaitlistSignupFormState: WaitlistSignupFormState = {
  email: '',
  name: '',
  primaryInterest: '',
  profileType: '',
  useCase: '',
  company: '',
  isSubmitting: false,
  submittedMessage: null,
}

export function waitlistSignupFormReducer(
  state: WaitlistSignupFormState,
  action: WaitlistSignupFormAction
): WaitlistSignupFormState {
  switch (action.type) {
    case 'set_email':
      return { ...state, email: action.value }
    case 'set_name':
      return { ...state, name: action.value }
    case 'set_primary_interest':
      return { ...state, primaryInterest: action.value }
    case 'set_profile_type':
      return { ...state, profileType: action.value }
    case 'set_use_case':
      return { ...state, useCase: action.value }
    case 'set_company':
      return { ...state, company: action.value }
    case 'set_is_submitting':
      return { ...state, isSubmitting: action.value }
    case 'set_submitted_message':
      return { ...state, submittedMessage: action.value }
    default:
      return state
  }
}
