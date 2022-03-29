import * as React from 'react'
import { useState } from 'react'
import rough from 'roughjs/bundled/rough.esm'
import { TElementData, TSnapshot } from './App'

const generator = rough.generator()

export function createLineElement({
  id,
  x1,
  y1,
  x2,
  y2,
}: Omit<TElementData, 'roughElement' | 'type'>): TElementData {
  const roughElement = generator.line(x1, y1, x2, y2)
  return { id: id, x1: x1, y1: y1, x2: x2, y2: y2, type: 'line', roughElement }
}

/**
 * * -----------------------------------------
 * *               Component
 * * -----------------------------------------
 */
export const CanvasForLine = React.forwardRef(function CanvasForLine(
  {
    elementsSnapshot,
    addNewHistory,
    replaceCurrentHistory,
  }: {
    elementsSnapshot: TSnapshot
    addNewHistory: (arg: TSnapshot) => void
    replaceCurrentHistory: (arg: TSnapshot) => void
  },
  canvasRef: React.Ref<HTMLCanvasElement>
) {
  const [action, setAction] = useState<'none' | 'drawing'>('none')

  function handlePointerDown(e: React.PointerEvent) {
    if (action === 'none') {
      const { clientX, clientY } = e
      const nextIndex = elementsSnapshot.length
      const newElement = createLineElement({
        id: nextIndex,
        x1: clientX,
        y1: clientY,
        x2: clientX,
        y2: clientY,
      })
      const newElementsSnapshot = [...elementsSnapshot, newElement]
      addNewHistory(newElementsSnapshot)
      setAction('drawing')
      return
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (action === 'drawing') {
      const { clientX, clientY } = e
      // replace last element
      const lastIndex = elementsSnapshot.length - 1
      const { x1: currentX1, y1: currentY1 } = elementsSnapshot[lastIndex]
      const newElementsSnapshot = [...elementsSnapshot]

      const newElement = createLineElement({
        id: lastIndex,
        x1: currentX1,
        y1: currentY1,
        x2: clientX,
        y2: clientY,
      })
      newElementsSnapshot[lastIndex] = newElement

      replaceCurrentHistory(newElementsSnapshot)
      return
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (action === 'drawing') {
      // clear action
      setAction('none')
      return
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        backgroundColor: 'azure',
        display: 'block',
        width: window.innerWidth,
        height: window.innerHeight,
        // disable all touch behavior from browser, e.g. touch to scroll
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      My Canvas
    </canvas>
  )
})
