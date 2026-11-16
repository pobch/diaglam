import { useEffect, useRef, useState } from 'react'
import { diagramFilename, nativeSavePicker, parseDiagram, saveDiagram } from './diagramFile'
import { TSnapshot } from './snapshotManipulation'
import dialogStyles from './Dialog.module.css'
import styles from './SnapshotFileMenu.module.css'
import moreIcon from './assets/more.svg'
import importIcon from './assets/import.svg'
import exportIcon from './assets/export.svg'

export function SnapshotFileMenu({ snapshot, onImport, onError }: {
  snapshot: TSnapshot
  onImport: (snapshot: TSnapshot) => void
  onError: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [askFilename, setAskFilename] = useState(false)
  const [filename, setFilename] = useState('untitled.diaglam')
  const containerRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const filenameDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [open])

  useEffect(() => {
    if (askFilename) filenameDialogRef.current?.showModal()
  }, [askFilename])

  function report(error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    onError(error instanceof Error ? error.message : 'Cannot read or save this diagram.')
  }

  async function exportFile(name: string) {
    setBusy(true)
    try {
      await saveDiagram(snapshot, name, nativeSavePicker())
    } catch (error) {
      report(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span ref={containerRef} className={styles.menu}>
      <button
        type="button"
        aria-label="More"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((previous) => !previous)}
      >
        <img src={moreIcon} alt="" width={20} style={{ verticalAlign: 'bottom' }} />
      </button>
      {open && (
        <div className={styles.menuItems}>
          <button type="button" aria-label="Import" title="Import" onClick={() => {
            setOpen(false)
            inputRef.current?.click()
          }}>
            <img src={importIcon} alt="" width={20} />
          </button>
          <button type="button" aria-label="Export" title="Export" onClick={() => {
            setOpen(false)
            if (nativeSavePicker()) void exportFile('untitled.diaglam')
            else {
              setFilename('untitled.diaglam')
              setAskFilename(true)
            }
          }}>
            <img src={exportIcon} alt="" width={20} />
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".diaglam"
        aria-label="Import diagram"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          try {
            onImport(await parseDiagram(file))
          } catch (error) {
            report(error)
          } finally {
            setBusy(false)
          }
        }}
      />
      {askFilename && (
        <dialog
          ref={filenameDialogRef}
          className={dialogStyles.dialog}
          aria-labelledby="save-title"
          onCancel={() => setAskFilename(false)}
        >
          <form className={styles.filenameForm} onSubmit={(event) => {
            event.preventDefault()
            setAskFilename(false)
            void exportFile(diagramFilename(filename))
          }}>
            <h2 id="save-title">Export diagram</h2>
            <label htmlFor="diagram-filename">File name</label>
            <input id="diagram-filename" value={filename} autoFocus onChange={(event) => setFilename(event.target.value)} />
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setAskFilename(false)}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </dialog>
      )}
    </span>
  )
}
