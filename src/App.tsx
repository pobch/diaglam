import { useLayoutEffect, useRef, useState } from 'react'
import { Drawable } from 'roughjs/bin/core'
import rough from 'roughjs/bundled/rough.esm'
import { CanvasForSelection } from './CanvasForSelection'
import { CanvasForRect } from './CanvasForRect'
import { CanvasForLine } from './CanvasForLine'
import { CanvasForPencil } from './CanvasForPencil'
import getStroke from 'perfect-freehand'
import { CanvasForText } from './CanvasForText'

export type TElementData =
  | {
      type: 'line' | 'rectangle'
      id: number
      x1: number
      y1: number
      x2: number
      y2: number
      roughElement: Drawable
    }
  | {
      type: 'pencil'
      id: number
      points: { x: number; y: number }[]
    }
  | {
      type: 'text'
      id: number
      isWriting: boolean
      lines: {
        lineX1: number
        lineY1: number
        lineWidth: number
        lineHeight: number
        lineContent: string
      }[]
    }
  | {
      type: 'removed'
      id: number
    }

export type TSnapshot = TElementData[]

function useHistory() {
  const [history, setHistory] = useState<TSnapshot[]>([[]])
  const [currentIndex, setCurrentIndex] = useState(0)

  function addNewHistory(newSnapshot: TSnapshot) {
    setHistory((prevHistory) => [...prevHistory.slice(0, currentIndex + 1), newSnapshot])
    setCurrentIndex((prev) => prev + 1)
  }

  function replaceCurrentHistory(newSnapshot: TSnapshot) {
    setHistory((prevHistory) => [...prevHistory.slice(0, currentIndex), newSnapshot])
  }

  function undo() {
    setCurrentIndex((prev) => {
      return prev >= 1 ? prev - 1 : 0
    })
  }

  function redo() {
    setCurrentIndex((prev) => {
      return prev <= history.length - 2 ? prev + 1 : history.length - 1
    })
  }

  return {
    elementsSnapshot: history[currentIndex],
    addNewHistory,
    replaceCurrentHistory,
    undo,
    redo,
  }
}

// copy from perfect-freehand doc
function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )

  d.push('Z')
  return d.join(' ')
}

export function App() {
  const [tool, setTool] = useState<'selection' | 'line' | 'rectangle' | 'pencil' | 'text'>(
    'selection'
  )
  const { elementsSnapshot, addNewHistory, replaceCurrentHistory, undo, redo } = useHistory()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [zoomLevel, setZoomLevel] = useState(1)

  // * ----------- Clear Canvas -------------

  function handleClickClear() {
    if (!canvasRef.current) return

    addNewHistory([])
  }

  // * ------------ Canvas Drawing ------------

  useLayoutEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    const dpr = window.devicePixelRatio || 1
    context.save()
    context.scale(dpr * zoomLevel, dpr * zoomLevel)
    context.clearRect(0, 0, canvas.width / zoomLevel, canvas.height / zoomLevel)

    // for debug
    // context.strokeStyle = 'red'
    // context.lineWidth = 5
    // context.strokeRect(0, 0, canvas.width / zoomLevel, canvas.height / zoomLevel)

    const roughCanvas = rough.canvas(canvas)
    elementsSnapshot.forEach((element) => {
      if (element.type === 'line' || element.type === 'rectangle') {
        roughCanvas.draw(element.roughElement)
      } else if (element.type === 'pencil') {
        const stroke = getSvgPathFromStroke(getStroke(element.points, { size: 4 }))
        // context.fillStyle = 'red'
        context.fill(new Path2D(stroke))
      } else if (element.type === 'text' && !element.isWriting) {
        context.textBaseline = 'top'
        context.font = '1.5rem "Nanum Pen Script"'
        for (let i = 0; i < element.lines.length; i++) {
          context.fillText(
            element.lines[i].lineContent,
            element.lines[i].lineX1,
            element.lines[i].lineY1
          )
        }
      } else if (element.type === 'removed') {
        // don't draw
      }
    })
    context.restore()
  }, [
    elementsSnapshot,
    zoomLevel,
    // ! also add tool as dependencies even though it's not being used inside useLayoutEffect()
    tool,
  ])

  // * --------------- Reusable renderProps ---------------
  function renderCanvas({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClick,
    styleCursor,
  }: {
    onPointerDown?: (e: React.PointerEvent) => void
    onPointerMove?: (e: React.PointerEvent) => void
    onPointerUp?: (e: React.PointerEvent) => void
    onClick?: (e: React.MouseEvent) => void
    styleCursor?: 'default' | 'move' | 'nesw-resize' | 'nwse-resize' | 'text'
  }) {
    // Get the device pixel ratio, falling back to 1.
    const dpr = window.devicePixelRatio || 1
    return (
      <canvas
        ref={canvasRef}
        style={{
          backgroundColor: 'AliceBlue',
          display: 'block',
          width: window.innerWidth,
          height: window.innerHeight,

          // disable all touch behavior from browser, e.g. touch to scroll
          touchAction: 'none',

          ...(styleCursor ? { cursor: styleCursor } : {}),
        }}
        width={window.innerWidth * dpr}
        height={window.innerHeight * dpr}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
      >
        My Canvas
      </canvas>
    )
  }
  // * ---------------------- Others ------------------------

  function viewportCoordsToSceneCoords({
    viewportX,
    viewportY,
  }: {
    viewportX: number
    viewportY: number
  }) {
    return { sceneX: viewportX / zoomLevel, sceneY: viewportY / zoomLevel }
  }

  function sceneCoordsToViewportCoords({ sceneX, sceneY }: { sceneX: number; sceneY: number }) {
    return { viewportX: sceneX * zoomLevel, viewportY: sceneY * zoomLevel }
  }

  // * --------------------- Rendering -----------------------
  return (
    <div>
      {/* Top Menu */}
      <fieldset style={{ position: 'fixed', top: 0, margin: '0.5rem', padding: '0.25rem' }}>
        <legend>Tool</legend>
        <span style={{ paddingInlineEnd: '0.5rem' }}>
          <input
            type="radio"
            id="selection"
            checked={tool === 'selection'}
            onChange={() => setTool('selection')}
            style={{ marginInlineEnd: '0.25rem' }}
          />
          <label htmlFor="selection">Selection</label>
        </span>
        <span style={{ paddingInlineEnd: '0.5rem' }}>
          <input
            type="radio"
            id="line"
            checked={tool === 'line'}
            onChange={() => setTool('line')}
            style={{ marginInlineEnd: '0.25rem' }}
          />
          <label htmlFor="line">Line</label>
        </span>
        <span style={{ paddingInlineEnd: '0.5rem' }}>
          <input
            type="radio"
            id="rectangle"
            checked={tool === 'rectangle'}
            onChange={() => setTool('rectangle')}
            style={{ marginInlineEnd: '0.25rem' }}
          />
          <label htmlFor="rectangle">Rectangle</label>
        </span>
        <span style={{ paddingInlineEnd: '0.5rem' }}>
          <input
            type="radio"
            id="pencil"
            checked={tool === 'pencil'}
            onChange={() => setTool('pencil')}
            style={{ marginInlineEnd: '0.25rem' }}
          />
          <label htmlFor="pencil">Pencil</label>
        </span>
        <span style={{ paddingInlineEnd: '0.5rem' }}>
          <input
            type="radio"
            id="text"
            checked={tool === 'text'}
            onChange={() => setTool('text')}
            style={{ marginInlineEnd: '0.25rem' }}
          />
          <label htmlFor="text">Text</label>
        </span>
      </fieldset>
      {/* Footer Menu */}
      <div style={{ position: 'fixed', bottom: 0, padding: '1rem' }}>
        <span style={{ paddingInlineEnd: '0.5rem' }}>
          <button onClick={() => undo()}>Undo</button>
        </span>
        <span style={{ paddingInlineEnd: '1rem' }}>
          <button onClick={() => redo()}>Redo</button>
        </span>
        <span style={{ paddingInlineEnd: '1rem' }}>|</span>
        <span style={{ paddingInlineEnd: '1rem' }}>
          <button onClick={handleClickClear}>Clear</button>
        </span>
        <span style={{ paddingInlineEnd: '1rem' }}>|</span>
        <span style={{ paddingInlineEnd: '1rem' }}>
          <button
            onClick={() => {
              setZoomLevel((prev) => {
                if (prev >= 0.2) {
                  return prev - 0.1
                } else {
                  // min
                  return 0.1
                }
              })
            }}
          >
            Zoom Out
          </button>
        </span>
        <span style={{ paddingInlineEnd: '1rem' }}>
          <button
            onClick={() => {
              setZoomLevel(1)
            }}
          >
            100%
          </button>
        </span>
        <span style={{ paddingInlineEnd: '1rem' }}>
          <button
            onClick={() => {
              setZoomLevel((prev) => prev + 0.1)
            }}
          >
            Zoom In
          </button>
        </span>
      </div>

      {/* Canvas */}
      {(() => {
        switch (tool) {
          case 'selection':
            return (
              <CanvasForSelection
                renderCanvas={renderCanvas}
                elementsSnapshot={elementsSnapshot}
                addNewHistory={addNewHistory}
                replaceCurrentHistory={replaceCurrentHistory}
                viewportCoordsToSceneCoords={viewportCoordsToSceneCoords}
              />
            )
          case 'rectangle':
            return (
              <CanvasForRect
                renderCanvas={renderCanvas}
                elementsSnapshot={elementsSnapshot}
                addNewHistory={addNewHistory}
                replaceCurrentHistory={replaceCurrentHistory}
                viewportCoordsToSceneCoords={viewportCoordsToSceneCoords}
              />
            )
          case 'line':
            return (
              <CanvasForLine
                renderCanvas={renderCanvas}
                elementsSnapshot={elementsSnapshot}
                addNewHistory={addNewHistory}
                replaceCurrentHistory={replaceCurrentHistory}
                viewportCoordsToSceneCoords={viewportCoordsToSceneCoords}
              />
            )
          case 'pencil':
            return (
              <CanvasForPencil
                renderCanvas={renderCanvas}
                elementsSnapshot={elementsSnapshot}
                addNewHistory={addNewHistory}
                replaceCurrentHistory={replaceCurrentHistory}
                viewportCoordsToSceneCoords={viewportCoordsToSceneCoords}
              />
            )
          case 'text':
            return (
              <CanvasForText
                renderCanvas={renderCanvas}
                elementsSnapshot={elementsSnapshot}
                addNewHistory={addNewHistory}
                replaceCurrentHistory={replaceCurrentHistory}
                undoHistory={undo}
                viewportCoordsToSceneCoords={viewportCoordsToSceneCoords}
                sceneCoordsToViewportCoords={sceneCoordsToViewportCoords}
              />
            )
        }
      })()}
    </div>
  )
}
