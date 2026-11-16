import { useEffect, useRef } from 'react'
import dialogStyles from './Dialog.module.css'
import styles from './ErrorModal.module.css'

export function ErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={dialogStyles.dialog}
      aria-labelledby="error-title"
      aria-describedby="error-message"
      onCancel={onClose}
      onClose={onClose}
    >
      <h2 id="error-title">Cannot complete this action</h2>
      <p id="error-message" className={styles.message}>{message}</p>
      <button type="button" autoFocus onClick={onClose}>Close</button>
    </dialog>
  )
}
