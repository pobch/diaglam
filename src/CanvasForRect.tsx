import * as React from 'react'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import rough from 'roughjs/bundled/rough.esm'
import { CONFIG } from './config'
import {
  getSingleElementInSnapshot,
  TCommitNewSnapshotFn,
  TElementData,
  TReplaceCurrentSnapshotParam,
  TSnapshot,
} from './snapshotManipulation'

const generator = rough.generator({
  options: { seed: CONFIG.SEED, roughness: CONFIG.ROUGHNESS, strokeWidth: CONFIG.STROKE_WIDTH },
})

export function createRectangleElementWithoutId({
  x1,
  y1,
  width,
  height,
}: {
  x1: number
  y1: number
  width: number
  height: number
}): Omit<Extract<TElementData, { type: 'line' | 'rectangle' | 'arrow' }>, 'id'> {
  const roughElement = generator.rectangle(x1, y1, width, height)
  return {
    x1: x1,
    y1: y1,
    x2: x1 + width,
    y2: y1 + height,
    type: 'rectangle',
    roughElements: [roughElement],
  }
}

// make (x1, y1) always on the top-left and (x2, y2) always on the bottom-right
export function adjustRectangleCoordinates(
  element: Extract<TElementData, { type: 'line' | 'rectangle' | 'arrow' }>
) {
  const { x1, x2, y1, y2 } = element
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  return { newX1: minX, newY1: minY, newX2: maxX, newY2: maxY }
}

/**
 * * -----------------------------------------
 * *               Component
 * * -----------------------------------------
 */
export function CanvasForRect({
  renderCanvas,
  currentSnapshot,
  commitNewSnapshot,
  replaceCurrentSnapshotByReplacingElements,
  viewportCoordsToSceneCoords,
}: {
  renderCanvas: (arg: {
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: (e: React.PointerEvent) => void
  }) => React.ReactElement
  currentSnapshot: TSnapshot
  commitNewSnapshot: TCommitNewSnapshotFn
  replaceCurrentSnapshotByReplacingElements: (arg: TReplaceCurrentSnapshotParam) => void
  viewportCoordsToSceneCoords: (arg: { viewportX: number; viewportY: number }) => {
    sceneX: number
    sceneY: number
  }
}) {
  const [uiState, setUiState] = useState<
    | { state: 'none' }
    | { state: 'initDraw'; data: { pointerDownAtX: number; pointerDownAtY: number } }
    | { state: 'drawing'; data: { elementId: number } }
  >({ state: 'none' })

  function handlePointerDown(e: React.PointerEvent) {
    if (!e.isPrimary) return

    // should come from onPointerUp() or initial state when mount
    if (uiState.state === 'none') {
      const { sceneX, sceneY } = viewportCoordsToSceneCoords({
        viewportX: e.clientX,
        viewportY: e.clientY,
      })

      setUiState({ state: 'initDraw', data: { pointerDownAtX: sceneX, pointerDownAtY: sceneY } })
      return
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!e.isPrimary) return

    // should come from onPointerDown()
    if (uiState.state === 'initDraw') {
      // wrap in flushSync because the following code need to be called at most once
      // https://github.com/pobch/react-diagram/issues/27
      flushSync(() => {
        const { sceneX, sceneY } = viewportCoordsToSceneCoords({
          viewportX: e.clientX,
          viewportY: e.clientY,
        })
        const newElementWithoutId = createRectangleElementWithoutId({
          x1: uiState.data.pointerDownAtX,
          y1: uiState.data.pointerDownAtY,
          width: sceneX - uiState.data.pointerDownAtX,
          height: sceneY - uiState.data.pointerDownAtY,
        })
        const newIds = commitNewSnapshot({
          mode: 'addElements',
          newElementWithoutIds: [newElementWithoutId],
        })
        if (newIds === undefined || newIds[0] == null) {
          throw new Error('ID of the drawing rectangle element is missing')
        }
        setUiState({ state: 'drawing', data: { elementId: newIds[0] } })
        return
      })
    }
    // should come from previous onPointerMove()
    if (uiState.state === 'drawing') {
      const { sceneX, sceneY } = viewportCoordsToSceneCoords({
        viewportX: e.clientX,
        viewportY: e.clientY,
      })
      // replace the drawing element
      const drawingElement = getSingleElementInSnapshot({
        snapshot: currentSnapshot,
        elementId: uiState.data.elementId,
      })
      if (!drawingElement || drawingElement.type !== 'rectangle') {
        throw new Error(
          'The drawing element in the current snapshot is missing or not a "rectangle" element'
        )
      }
      const { x1, y1 } = drawingElement
      const newElementWithoutId = createRectangleElementWithoutId({
        x1,
        y1,
        width: sceneX - x1,
        height: sceneY - y1,
      })

      replaceCurrentSnapshotByReplacingElements({
        replacedElement: { ...newElementWithoutId, id: uiState.data.elementId },
      })
      return
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!e.isPrimary) return

    // should come from onPointerDown()
    if (uiState.state === 'initDraw') {
      // no drawing occurs, do nothing with history
      setUiState({ state: 'none' })
      return
    }
    // should come from onPointerMove()
    if (uiState.state === 'drawing') {
      // adjust coord when finish drawing
      const drawnElement = getSingleElementInSnapshot({
        snapshot: currentSnapshot,
        elementId: uiState.data.elementId,
      })
      if (!drawnElement || drawnElement.type !== 'rectangle') {
        throw new Error(
          'The finishing drawing element in the current snapshot is missing or not a "rectangle" element'
        )
      }
      const { newX1, newX2, newY1, newY2 } = adjustRectangleCoordinates(drawnElement)
      const newElementWithoutId = createRectangleElementWithoutId({
        x1: newX1,
        y1: newY1,
        width: newX2 - newX1,
        height: newY2 - newY1,
      })
      replaceCurrentSnapshotByReplacingElements({
        replacedElement: { ...newElementWithoutId, id: uiState.data.elementId },
      })
      setUiState({ state: 'none' })
      return
    }
  }

  return renderCanvas({
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  })
}
