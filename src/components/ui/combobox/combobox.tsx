'use client'

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useState,
} from 'react'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import * as Popover from '@radix-ui/react-popover'
import styles from './combobox.module.css'

// ── Context ────────────────────────────────────────────────────────────────

type ComboboxCtx = {
  selectedValue: string | undefined
  handleSelect: (value: string, label: string) => void
  registerItem: (value: string, label: string) => void
  search: string
}

const ComboboxContext = createContext<ComboboxCtx | null>(null)

function useComboboxContext(): ComboboxCtx {
  const ctx = useContext(ComboboxContext)
  if (!ctx) throw new Error('Combobox subcomponents must be used inside <Combobox>')
  return ctx
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ComboboxProps = {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  error?: boolean
  size?: 'sm' | 'base' | 'lg'
  variant?: 'default' | 'chip' | 'inline' | 'ghost'
  disabled?: boolean
  id?: string
  'aria-label'?: string
  children: React.ReactNode
}

export type ComboboxItemProps = {
  value: string
  disabled?: boolean
  /** Explicit filter text when children is not a plain string */
  textValue?: string
  children: React.ReactNode
}

export type ComboboxSectionProps = {
  heading: string
  children: React.ReactNode
}

// ── Root ───────────────────────────────────────────────────────────────────

function ComboboxRoot({
  value,
  onChange,
  placeholder = 'Select…',
  error = false,
  size = 'base',
  variant = 'default',
  disabled = false,
  id,
  'aria-label': ariaLabel,
  children,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map())
  const [search, setSearch] = useState('')
  const listboxId = useId()

  // Reset search when popover closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setSearch('')
      setOpen(nextOpen)
    },
    [],
  )

  const registerItem = useCallback((itemValue: string, label: string) => {
    setLabelMap((prev) => {
      if (prev.get(itemValue) === label) return prev
      return new Map(prev).set(itemValue, label)
    })
  }, [])

  const handleSelect = useCallback(
    (itemValue: string, label: string) => {
      setLabelMap((prev) => new Map(prev).set(itemValue, label))
      onChange(itemValue)
      setOpen(false)
    },
    [onChange],
  )

  const selectedLabel = value ? labelMap.get(value) : undefined

  const variantClass =
    variant === 'chip' ? styles.chip
    : variant === 'inline' ? styles.inline
    : variant === 'ghost' ? styles.ghost
    : size !== 'base' ? styles[size] : ''
  const triggerClass = [styles.trigger, variantClass, error ? styles.error : '']
    .filter(Boolean)
    .join(' ')

  // Compute empty state: check all registered labels against current search
  const allLabels = Array.from(labelMap.values())
  const hasMatch =
    !search ||
    allLabels.some((label) => label.toLowerCase().includes(search.toLowerCase()))

  return (
    <ComboboxContext.Provider value={{ selectedValue: value, handleSelect, registerItem, search }}>
      {/* modal-while-open: a surrounding modal Dialog/Drawer's scroll lock
          otherwise blocks wheel/touch scrolling on the body-portaled list
          (radix-ui/primitives#1159 — `modal` is the canonical fix). It can't
          be unconditional: our forceMount portal would keep the modal
          wrapper's RemoveScroll mounted (and the page locked) even while
          closed, since Radix gates it on render, not on open state. */}
      <Popover.Root modal={open} open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={triggerClass}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-label={selectedLabel ? undefined : (ariaLabel ?? placeholder)}
          >
            <span className={selectedLabel ? styles.triggerValue : styles.triggerPlaceholder}>
              {selectedLabel ?? placeholder}
            </span>
            <svg
              className={[styles.chevron, open ? styles.chevronOpen : ''].filter(Boolean).join(' ')}
              aria-hidden="true"
              width="12"
              height="8"
              viewBox="0 0 12 8"
              fill="none"
            >
              <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </Popover.Trigger>

        <Popover.Portal forceMount>
          <Popover.Content
            forceMount
            hidden={!open}
            className={styles.popover}
            sideOffset={4}
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <div className={styles.searchWrap}>
                <svg
                  className={styles.searchIcon}
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <CommandInput
                  className={styles.searchInput}
                  placeholder="Search…"
                  onValueChange={setSearch}
                />
              </div>
              <div className={styles.divider} aria-hidden="true" />
              <CommandList id={listboxId} className={styles.list} role="listbox">
                {!hasMatch && (
                  <div className={styles.empty} role="status">
                    {search ? `No results for "${search}"` : 'No results'}
                  </div>
                )}
                {children}
              </CommandList>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </ComboboxContext.Provider>
  )
}

// ── Item ───────────────────────────────────────────────────────────────────

function ComboboxItem({ value: itemValue, disabled, textValue, children }: ComboboxItemProps) {
  const { selectedValue, handleSelect, registerItem, search } = useComboboxContext()
  const label = textValue ?? (typeof children === 'string' ? children : '')
  const isSelected = selectedValue === itemValue
  const matches = !search || label.toLowerCase().includes(search.toLowerCase())

  useLayoutEffect(() => {
    if (label) registerItem(itemValue, label)
  }, [itemValue, label, registerItem])

  return (
    <CommandItem
      forceMount
      value={label}
      disabled={disabled}
      onSelect={() => handleSelect(itemValue, label)}
      className={styles.item}
      hidden={!matches}
      data-selected={isSelected || undefined}
      role="option"
      aria-selected={isSelected}
    >
      {children}
      {isSelected && (
        <svg
          className={styles.checkIcon}
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </CommandItem>
  )
}

// ── Section ────────────────────────────────────────────────────────────────

function ComboboxSection({ heading, children }: ComboboxSectionProps) {
  return <CommandGroup forceMount heading={heading}>{children}</CommandGroup>
}

// ── Compose ────────────────────────────────────────────────────────────────

export const Combobox = Object.assign(ComboboxRoot, {
  Item: ComboboxItem,
  Section: ComboboxSection,
})
