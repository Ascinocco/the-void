import type { ReactNode } from "react"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  // Simple markdown parser for basic formatting
  const parseMarkdown = (text: string): ReactNode[] => {
    const lines = text.split("\n")
    const elements: ReactNode[] = []
    let currentIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Headers
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={currentIndex++} className="text-xl font-semibold mt-6 mb-3 text-foreground">
            {line.substring(3)}
          </h2>,
        )
      } else if (line.startsWith("# ")) {
        elements.push(
          <h1 key={currentIndex++} className="text-2xl font-bold mt-6 mb-4 text-foreground">
            {line.substring(2)}
          </h1>,
        )
      }
      // Bold text with **
      else if (line.includes("**")) {
        const parts = line.split("**")
        const formattedLine: ReactNode[] = []

        for (let j = 0; j < parts.length; j++) {
          if (j % 2 === 0) {
            formattedLine.push(parts[j])
          } else {
            formattedLine.push(
              <strong key={`${currentIndex}-${j}`} className="font-semibold">
                {parts[j]}
              </strong>,
            )
          }
        }

        elements.push(
          <p key={currentIndex++} className="mb-3 text-foreground leading-relaxed">
            {formattedLine}
          </p>,
        )
      }
      // List items
      else if (line.startsWith("- ")) {
        const listItems: string[] = [line.substring(2)]

        // Collect consecutive list items
        while (i + 1 < lines.length && lines[i + 1].startsWith("- ")) {
          i++
          listItems.push(lines[i].substring(2))
        }

        elements.push(
          <ul key={currentIndex++} className="mb-4 ml-4 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-foreground leading-relaxed list-disc">
                {item}
              </li>
            ))}
          </ul>,
        )
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(line)) {
        const listItems: string[] = [line.replace(/^\d+\.\s/, "")]

        // Collect consecutive numbered items
        while (i + 1 < lines.length && /^\d+\.\s/.test(lines[i + 1])) {
          i++
          listItems.push(lines[i].replace(/^\d+\.\s/, ""))
        }

        elements.push(
          <ol key={currentIndex++} className="mb-4 ml-4 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-foreground leading-relaxed list-decimal">
                {item}
              </li>
            ))}
          </ol>,
        )
      }
      // Empty lines
      else if (line.trim() === "") {
        elements.push(<div key={currentIndex++} className="mb-2" />)
      }
      // Regular paragraphs
      else if (line.trim() !== "") {
        elements.push(
          <p key={currentIndex++} className="mb-3 text-foreground leading-relaxed">
            {line}
          </p>,
        )
      }
    }

    return elements
  }

  return <div className={`prose prose-invert max-w-none ${className}`}>{parseMarkdown(content)}</div>
}
