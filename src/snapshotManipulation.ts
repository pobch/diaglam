import { useReducer, useRef } from 'react'
import { ImageAsset } from './imageAsset'
import { Drawable } from 'roughjs/bin/core'

export type TElementData =
  | {
      type: 'line' | 'rectangle' | 'arrow'
      id: number
      x1: number
      y1: number
      x2: number
      y2: number
      roughElements: Drawable[]
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
      type: 'image'
      id: number
      x1: number
      y1: number
      x2: number
      y2: number
      data: ImageAsset
    }

export type TSnapshot = TElementData[]

type THistoryState = {
  history: TSnapshot[]
  currentIndex: number
}

type THistoryAction =
  | { type: 'replaceEntireHistory'; history: TSnapshot[] }
  | { type: 'undo' | 'redo' }
  | { type: 'loadSnapshot'; snapshot: TSnapshot }

function historyReducer(state: THistoryState, action: THistoryAction): THistoryState {
  switch (action.type) {
    case 'replaceEntireHistory':
      return { history: action.history, currentIndex: action.history.length - 1 }
    case 'undo':
    case 'redo': {
      const offset = action.type === 'undo' ? -1 : 1
      const currentIndex = Math.max(
        0,
        Math.min(state.history.length - 1, state.currentIndex + offset)
      )
      return currentIndex === state.currentIndex ? state : { ...state, currentIndex }
    }
    case 'loadSnapshot':
      return { history: [state.history[state.currentIndex]!, action.snapshot], currentIndex: 1 }
  }
}

let lastElementId = 0
function nextElementId() {
  lastElementId += 1
  return lastElementId
}

function closeDiscardedBitmaps(discardedSnapshots: TSnapshot[], remainingSnapshots: TSnapshot[]) {
  const discardedBitmaps = new Set<ImageBitmap>()
  for (const snapshot of discardedSnapshots) {
    for (const element of snapshot) {
      if (element.type === 'image') discardedBitmaps.add(element.data.bitmap)
    }
  }
  if (discardedBitmaps.size === 0) return

  for (const snapshot of remainingSnapshots) {
    for (const element of snapshot) {
      if (element.type === 'image') discardedBitmaps.delete(element.data.bitmap)
    }
    if (discardedBitmaps.size === 0) return
  }
  for (const bitmap of discardedBitmaps) bitmap.close()
}

export function useHistory() {
  const [historyState, dispatch] = useReducer(historyReducer, {
    history: [[]],
    currentIndex: 0,
  })
  const { history, currentIndex } = historyState
  const currentSnapshot = history[currentIndex]!

  // Actions can run multiple times before the next render, so we save the latest state in ref.
  // It can be used outside state updaters and reducer.
  const latestHistoryState = useRef(historyState)

  function dispatchWithEffects(action: THistoryAction, discardedSnapshots?: TSnapshot[]) {
    const previous = latestHistoryState.current
    const next = historyReducer(previous, action)
    if (next === previous) return
    latestHistoryState.current = next
    dispatch(action)

    // Close bitmaps (run side-effects)
    if (discardedSnapshots?.length) {
      closeDiscardedBitmaps(discardedSnapshots, next.history)
    }
  }

  type DistributiveOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never

  function commitNewSnapshot(
    options:
      | { mode: 'clone' }
      | { mode: 'addElements'; newElementWithoutIds: DistributiveOmit<TElementData, 'id'>[] }
      | { mode: 'removeElements'; elementIds: number[] }
      | { mode: 'removeAllElements' }
      | { mode: 'modifyElement'; modifiedElement: TElementData }
  ) {
    const newElements =
      options.mode === 'addElements'
        ? options.newElementWithoutIds.map((element) => ({
            ...element,
            id: nextElementId(),
          }))
        : []
    const { history, currentIndex } = latestHistoryState.current
    const snapshot = history[currentIndex]!
    let newSnapshot: TSnapshot
    switch (options.mode) {
      case 'clone':
        newSnapshot = [...snapshot]
        break
      case 'addElements':
        newSnapshot = [...snapshot, ...newElements]
        break
      case 'removeElements': {
        const removedIds = new Set(options.elementIds)
        newSnapshot = snapshot.filter((element) => !removedIds.has(element.id))
        break
      }
      case 'removeAllElements':
        newSnapshot = []
        break
      case 'modifyElement':
        newSnapshot = snapshot.map((element) => {
          if (element.id !== options.modifiedElement.id) return element
          return { ...options.modifiedElement }
        })
        break
    }
    const remainingSnapshots = history.slice(0, currentIndex + 1)
    const discardedSnapshots = history.slice(currentIndex + 1)
    dispatchWithEffects(
      { type: 'replaceEntireHistory', history: [...remainingSnapshots, newSnapshot] },
      discardedSnapshots
    )
    if (options.mode === 'addElements') return newElements.map((element) => element.id)
    return
  }

  function replaceCurrentSnapshotByModifyingElements(elements: TElementData[]) {
    if (elements.length === 0) return
    const replacements = new Map(elements.map((element) => [element.id, element]))
    const { history, currentIndex } = latestHistoryState.current
    let currentSnapshotMayLoseImageReferences = false
    const newSnapshot = history[currentIndex]!.map((element) => {
      const replacement = replacements.get(element.id)
      if (!replacement) return element
      if (
        element.type === 'image' &&
        (replacement.type !== 'image' || replacement.data.bitmap !== element.data.bitmap)
      ) {
        currentSnapshotMayLoseImageReferences = true
      }
      return { ...replacement }
    })
    const cleanupStartIndex = currentSnapshotMayLoseImageReferences ? currentIndex : currentIndex + 1
    dispatchWithEffects(
      { type: 'replaceEntireHistory', history: [...history.slice(0, currentIndex), newSnapshot] },
      history.slice(cleanupStartIndex)
    )
  }

  function replaceCurrentSnapshotByRemovingElement(elementIdToRemove: number) {
    const { history, currentIndex } = latestHistoryState.current
    let currentSnapshotMayLoseImageReferences = false
    const newSnapshot = history[currentIndex]!.filter((element) => {
      if (element.id !== elementIdToRemove) return true
      if (element.type === 'image') currentSnapshotMayLoseImageReferences = true
      return false
    })
    const cleanupStartIndex = currentSnapshotMayLoseImageReferences ? currentIndex : currentIndex + 1
    dispatchWithEffects(
      { type: 'replaceEntireHistory', history: [...history.slice(0, currentIndex), newSnapshot] },
      history.slice(cleanupStartIndex)
    )
  }

  function undo() {
    dispatchWithEffects({ type: 'undo' })
  }

  function redo() {
    dispatchWithEffects({ type: 'redo' })
  }

  function loadSnapshot(newSnapshot: TSnapshot) {
    const { history, currentIndex } = latestHistoryState.current
    const snapshot = newSnapshot.map((element) => ({ ...element, id: nextElementId() }))
    dispatchWithEffects(
      { type: 'loadSnapshot', snapshot },
      history.filter((_, index) => index !== currentIndex)
    )
  }

  return {
    currentSnapshot,
    commitNewSnapshot,
    replaceCurrentSnapshotByModifyingElements,
    replaceCurrentSnapshotByRemovingElement,
    undo,
    redo,
    loadSnapshot,
  }
}

export type TCommitNewSnapshotFn = ReturnType<typeof useHistory>['commitNewSnapshot']
export type TReplaceCurrentSnapshotByModifyingElementsFn = ReturnType<
  typeof useHistory
>['replaceCurrentSnapshotByModifyingElements']

export function getSingleElementInSnapshot({
  snapshot,
  elementId,
}: {
  snapshot: TSnapshot
  elementId: number
}) {
  return snapshot.find((element) => element.id === elementId)
}

export function getMultiElementsInSnapshot({
  snapshot,
  elementIds,
}: {
  snapshot: TSnapshot
  elementIds: number[]
}): TElementData[] {
  const elementIdsMap = elementIds.reduce(
    (prev, elementId) => {
      prev[elementId] = true
      return prev
    },
    {} as { [elementId: number]: boolean }
  )
  const foundElementsInSnapshot = snapshot.filter((element) => {
    return elementIdsMap[element.id]
  })
  return foundElementsInSnapshot
}
