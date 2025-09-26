"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Filter, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface NewsFilterProps {
  selectedTopic: string
  onTopicChange: (topic: string) => void
  topicGroups: string[]
}

export function NewsFilter({ selectedTopic, onTopicChange, topicGroups }: NewsFilterProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const filteredTopics = useMemo(() => {
    if (!searchValue) return topicGroups
    return topicGroups.filter((topic) => topic.toLowerCase().includes(searchValue.toLowerCase()))
  }, [topicGroups, searchValue])

  const handleSelect = (topic: string) => {
    onTopicChange(topic)
    setOpen(false)
    setSearchValue("")
  }

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between bg-transparent"
          >
            {selectedTopic || "Filter by topic"}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search topics..." value={searchValue} onValueChange={setSearchValue} />
            <CommandList>
              <CommandEmpty>No topics found.</CommandEmpty>
              <CommandGroup>
                {filteredTopics.map((topic) => (
                  <CommandItem key={topic} value={topic} onSelect={() => handleSelect(topic)}>
                    <Check className={cn("mr-2 h-4 w-4", selectedTopic === topic ? "opacity-100" : "opacity-0")} />
                    {topic}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
