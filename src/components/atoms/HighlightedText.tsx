type Props = { text: string; indices: number[]; className?: string }

export function HighlightedText({ text, indices, className }: Props) {
  const marked = new Set(indices)
  const parts: { text: string; marked: boolean }[] = []

  for (let index = 0; index < text.length; index++) {
    const last = parts.at(-1)
    if (last && last.marked === marked.has(index)) last.text += text[index]
    else parts.push({ text: text[index], marked: marked.has(index) })
  }

  return (
    <span className={className}>
      {parts.map((part, index) => (part.marked ? <mark key={index}>{part.text}</mark> : part.text))}
    </span>
  )
}
