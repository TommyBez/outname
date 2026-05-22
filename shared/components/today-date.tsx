interface TodayDateProps {
  label: string
}

export function TodayDate({ label }: TodayDateProps) {
  return <span className="inline-block min-h-[1em]">{label}</span>
}
