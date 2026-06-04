'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  ButtonLink,
  Combobox,
  Dialog,
  FormField,
  Input,
} from '@/components/ui'
import { trpc } from '@/trpc/client'
import styles from './start-run-dialog.module.css'

export interface LegacyOption {
  id: string
  name: string
  slug: string
}

export interface StartRunDialogProps {
  challengeId: string
  challengeName: string
  /** The user's legacies, fetched server-side by the detail page. */
  legacies: LegacyOption[]
}

/**
 * "Start run" action on the challenge detail page. Picks one of the user's
 * legacies, names the run (pre-filled with the challenge name), and creates
 * the run via challengeRuns.link, then navigates to the legacy.
 */
export function StartRunDialog({ challengeId, challengeName, legacies }: StartRunDialogProps) {
  const [open, setOpen] = useState(false)
  const [legacyId, setLegacyId] = useState('')
  const [name, setName] = useState(challengeName)
  const [error, setError] = useState('')
  const router = useRouter()
  const link = trpc.challengeRuns.link.useMutation()

  async function start() {
    if (!legacyId) {
      setError('Choose a legacy first.')
      return
    }
    setError('')
    try {
      await link.mutateAsync({ legacyId, challengeId, name: name.trim() || undefined })
      const legacy = legacies.find((l) => l.id === legacyId)
      router.push(legacy ? `/app/legacies/${legacy.slug}` : '/app')
    } catch {
      setError('Could not start the run. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>Start run</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content size="sm">
          <Dialog.Title>Start run</Dialog.Title>
          <Dialog.Description>
            Run {challengeName} on one of your legacies.
          </Dialog.Description>

          {legacies.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                You need a legacy before you can start this challenge.
              </p>
              <ButtonLink variant="primary" size="sm" href="/app/legacies/new">
                Start a legacy
              </ButtonLink>
            </div>
          ) : (
            <div className={styles.form}>
              <FormField label="Legacy" htmlFor="start-run-legacy" required>
                <Combobox
                  id="start-run-legacy"
                  value={legacyId || undefined}
                  onChange={setLegacyId}
                  placeholder="Choose a legacy…"
                >
                  {legacies.map((legacy) => (
                    <Combobox.Item key={legacy.id} value={legacy.id}>
                      {legacy.name}
                    </Combobox.Item>
                  ))}
                </Combobox>
              </FormField>

              <FormField label="Run name" htmlFor="start-run-name">
                <Input
                  id="start-run-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.actions}>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button size="sm" onClick={start} disabled={link.isPending}>
                  {link.isPending ? 'Starting…' : 'Start run'}
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
