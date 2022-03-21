import { useLayoutEffect, useRef, useState } from 'react'
import rough from 'roughjs/bundled/rough.esm'
import { TElementData } from './App'

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

export function CanvasForLine({
  elements,
  setElements,
}: {
  elements: TElementData[]
  setElements: React.Dispatch<React.SetStateAction<TElementData[]>>
}) {
  const [action, setAction] = useState<'none' | 'drawing'>('none')

  function handlePointerDown(e: React.PointerEvent) {
    const { clientX, clientY } = e
    const nextIndex = elements.length
    const newElement = createLineElement({
      id: nextIndex,
      x1: clientX,
      y1: clientY,
      x2: clientX,
      y2: clientY,
    })
    setElements((prevState) => [...prevState, newElement])
    setAction('drawing')
    return
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (action === 'drawing') {
      const { clientX, clientY } = e
      // replace last element
      const lastIndex = elements.length - 1
      const { x1: currentX1, y1: currentY1 } = elements[lastIndex]
      const elementsCopy = [...elements]

      const newElement = createLineElement({
        id: lastIndex,
        x1: currentX1,
        y1: currentY1,
        x2: clientX,
        y2: clientY,
      })
      elementsCopy[lastIndex] = newElement

      setElements(elementsCopy)
      return
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    setAction('none')
    return
  }

  // * ------------ Canvas Drawing ------------
  // TODO: extract this into reusable hook
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useLayoutEffect(() => {
    if (!canvasRef.current) return

    function setupDPR(canvas: HTMLCanvasElement) {
      // Get the device pixel ratio, falling back to 1.
      var dpr = window.devicePixelRatio || 1
      // Get the size of the canvas in CSS pixels.
      var rect = canvas.getBoundingClientRect()
      // Give the canvas pixel dimensions of their CSS
      // size * the device pixel ratio.
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      var ctx = canvas.getContext('2d')
      // Scale all drawing operations by the dpr, so you
      // don't have to worry about the difference.
      ctx?.scale(dpr, dpr)
      return ctx
    }
    const canvas = canvasRef.current
    const context = setupDPR(canvas)

    context?.clearRect(0, 0, canvas.width, canvas.height)

    const roughCanvas = rough.canvas(canvas)
    elements.forEach((element) => {
      if (element.type === 'line' || element.type === 'rectangle') {
        roughCanvas.draw(element.roughElement)
      }
    })
  }, [elements])

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
}
