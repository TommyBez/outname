export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '$0.00'
  }
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`
  }
  if (amount >= 0.01) {
    return `$${amount.toFixed(3)}`
  }
  if (amount === 0) {
    return '$0.00'
  }
  return `$${amount.toFixed(4)}`
}
