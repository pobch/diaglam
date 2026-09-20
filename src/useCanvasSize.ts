import { useEffect, useState } from 'react'

export type TCanvasSize = { width: number; height: number }

function measureViewport(): TCanvasSize {
  return {
    // innerWidth/Height vs clientWidth/Height: https://github.com/pobch/react-diagram/pull/35
    // What we want:
    // 1. Exclude scrollbars
    // 2. The correct height when we open the page by <a target="_blank"/>.
    //    In Chrome iOS, `clientHeight` returns a wrong value (it's a height when there is no address bar).
    //    https://github.com/pobch/react-diagram/issues/46
    // So, visualViewport to the rescue! Only remaining issue is when iOS virtual keyboard is open,
    // visualViewport.height will reduce the size. We fix this in `findCanvasSize()`.
    width: visualViewport?.width ?? 0,
    height: visualViewport?.height ?? 0,
  }
}

function isEditingText() {
  const active = document.activeElement
  return (
    active instanceof HTMLElement &&
    (active.tagName === 'TEXTAREA' ||
      (active instanceof HTMLInputElement && active.type === 'text') ||
      active.isContentEditable)
  )
}

export function useCanvasSize() {
  const [canvasSize, setCanvasSize] = useState(measureViewport)

  useEffect(() => {
    function findCanvasSize() {
      const next = measureViewport()
      const keepHeight = isEditingText()

      setCanvasSize((previous) => {
        // If the iOS virtual keyboard is open, we will not update the height of the canvas.
        if (keepHeight && previous.width === next.width) {
          return previous
        } else {
          return { ...next }
        }
      })
    }

    visualViewport?.addEventListener('resize', findCanvasSize)
    findCanvasSize()

    return () => {
      visualViewport?.removeEventListener('resize', findCanvasSize)
    }
  }, [])

  return canvasSize
}
