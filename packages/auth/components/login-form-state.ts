export type LoginFormStep = 'request' | 'verify'

export interface LoginFormState {
  email: string
  isRequestingOtp: boolean
  isVerifyingOtp: boolean
  otp: string
  statusMessage: string | null
  step: LoginFormStep
}

export type LoginFormAction =
  | { type: 'set_email'; value: string }
  | { type: 'set_otp'; value: string }
  | { type: 'set_requesting_otp'; value: boolean }
  | { type: 'set_verifying_otp'; value: boolean }
  | { type: 'otp_sent'; message: string }
  | { type: 'back_to_request' }

export const initialLoginFormState: LoginFormState = {
  email: '',
  otp: '',
  isRequestingOtp: false,
  isVerifyingOtp: false,
  step: 'request',
  statusMessage: null,
}

export function loginFormReducer(
  state: LoginFormState,
  action: LoginFormAction
): LoginFormState {
  switch (action.type) {
    case 'set_email':
      return { ...state, email: action.value, statusMessage: null }
    case 'set_otp':
      return { ...state, otp: action.value }
    case 'set_requesting_otp':
      return { ...state, isRequestingOtp: action.value }
    case 'set_verifying_otp':
      return { ...state, isVerifyingOtp: action.value }
    case 'otp_sent':
      return {
        ...state,
        step: 'verify',
        otp: '',
        statusMessage: action.message,
        isRequestingOtp: false,
      }
    case 'back_to_request':
      return {
        ...state,
        step: 'request',
        otp: '',
        statusMessage: null,
      }
    default:
      return state
  }
}
