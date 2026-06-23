import { pixelBasedPreset } from 'react-email'

export const transactionalEmailTailwind = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        canvas: '#f2f2f2',
        card: '#ffffff',
        ink: '#000000',
        subtle: '#4a4a4a',
        signal: '#ff3000',
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
}
