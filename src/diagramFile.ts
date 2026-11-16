import { Drawable } from 'roughjs/bin/core'
import { ImageAsset, imageMimeType, MAX_IMAGE_SIDE } from './imageAsset'
import { TElementData, TSnapshot } from './snapshotManipulation'

type ImageElement = Extract<TElementData, { type: 'image' }>
type StoredElement = Exclude<TElementData, ImageElement> | (Omit<ImageElement, 'data'> & { assetId: string })
type StoredAsset = { mimeType: string; base64: string }

function invalid(): never {
  throw new Error('This file contains an invalid diagram element or image.')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid()
  return value
}

function string(value: unknown): string {
  if (typeof value !== 'string') invalid()
  return value
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalid()
  return value
}

function coordinates(value: Record<string, unknown>) {
  return { x1: number(value.x1), y1: number(value.y1), x2: number(value.x2), y2: number(value.y2) }
}

function drawable(value: unknown): Drawable {
  const drawing = record(value)
  string(drawing.shape)
  const options = record(drawing.options)
  const numericOptions = new Set([
    'maxRandomnessOffset', 'roughness', 'bowing', 'strokeWidth', 'curveFitting',
    'curveTightness', 'curveStepCount', 'fillWeight', 'hachureAngle', 'hachureGap',
    'simplification', 'dashOffset', 'dashGap', 'zigzagOffset', 'seed',
    'strokeLineDashOffset', 'fillLineDashOffset', 'fixedDecimalPlaceDigits', 'fillShapeRoughnessGain',
  ])
  const textOptions = new Set(['stroke', 'fill', 'fillStyle'])
  const booleanOptions = new Set(['disableMultiStroke', 'disableMultiStrokeFill', 'preserveVertices'])
  for (const [key, option] of Object.entries(options)) {
    if (numericOptions.has(key)) number(option)
    else if (textOptions.has(key)) string(option)
    else if (booleanOptions.has(key)) {
      if (typeof option !== 'boolean') invalid()
    } else if (key === 'strokeLineDash' || key === 'fillLineDash') {
      if (array(option).some((length) => number(length) < 0)) invalid()
    } else invalid()
  }
  string(options.stroke)
  string(options.fillStyle)
  number(options.strokeWidth)
  number(options.fillWeight)
  if (options.fixedDecimalPlaceDigits !== undefined) {
    const digits = number(options.fixedDecimalPlaceDigits)
    if (digits >= 0 && (!Number.isInteger(digits) || digits > 100)) invalid()
  }
  for (const entry of array(drawing.sets)) {
    const set = record(entry)
    if (!['path', 'fillPath', 'fillSketch'].includes(string(set.type))) invalid()
    if (set.path !== undefined) string(set.path)
    if (set.size !== undefined) {
      const size = array(set.size)
      if (size.length !== 2) invalid()
      size.forEach(number)
    }
    for (const entry of array(set.ops)) {
      const operation = record(entry)
      const lengths: Record<string, number> = { move: 2, lineTo: 2, bcurveTo: 6 }
      const length = lengths[string(operation.op)]
      const data = array(operation.data)
      if (!length || data.length !== length) invalid()
      data.forEach(number)
    }
  }
  return drawing as unknown as Drawable
}

function element(value: unknown): StoredElement {
  const item = record(value)
  const id = number(item.id)
  if (!Number.isSafeInteger(id) || id < 0) invalid()
  switch (item.type) {
    case 'line':
    case 'rectangle':
    case 'arrow':
      return { id, type: item.type, ...coordinates(item), roughElements: array(item.roughElements).map(drawable) }
    case 'pencil':
      return {
        id, type: 'pencil', points: array(item.points).map((value) => {
          const point = record(value)
          return { x: number(point.x), y: number(point.y) }
        }),
      }
    case 'text':
      if (typeof item.isWriting !== 'boolean') invalid()
      return {
        id, type: 'text', isWriting: false, lines: array(item.lines).map((value) => {
          const line = record(value)
          const lineWidth = number(line.lineWidth)
          const lineHeight = number(line.lineHeight)
          if (lineWidth < 0 || lineHeight < 0) invalid()
          return { lineX1: number(line.lineX1), lineY1: number(line.lineY1), lineWidth, lineHeight, lineContent: string(line.lineContent) }
        }),
      }
    case 'image': {
      const coords = coordinates(item)
      if (coords.x2 <= coords.x1 || coords.y2 <= coords.y1) invalid()
      return { id, type: 'image', ...coords, assetId: string(item.assetId) }
    }
    default:
      invalid()
  }
}

async function encodeBlob(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += 32768) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)))
  }
  return btoa(chunks.join(''))
}

export async function serializeDiagram(snapshot: TSnapshot): Promise<Blob> {
  const assetIds = new Map<ImageAsset, string>()
  const assets: Record<string, StoredAsset> = {}
  const elements: StoredElement[] = []
  for (const item of snapshot) {
    if (item.type === 'image') {
      let assetId = assetIds.get(item.data)
      if (!assetId) {
        assetId = `image-${assetIds.size + 1}`
        assetIds.set(item.data, assetId)
        assets[assetId] = { mimeType: item.data.blob.type, base64: await encodeBlob(item.data.blob) }
      }
      const { data: _data, ...properties } = item
      elements.push({ ...properties, assetId })
    } else if ('roughElements' in item) {
      elements.push({
        ...item,
        roughElements: item.roughElements.map((drawing) => {
          const { randomizer: _randomizer, ...options } = drawing.options
          return { ...drawing, options }
        }),
      })
    } else {
      elements.push(item.type === 'text' ? { ...item, isWriting: false } : item)
    }
  }
  return new Blob([JSON.stringify({ format: 'diaglam', version: 1, elements, assets })], { type: 'application/json' })
}

export async function parseDiagram(file: File): Promise<TSnapshot> {
  if (!/\.diaglam$/i.test(file.name)) throw new Error('Select a file with the .diaglam extension.')
  let value: unknown
  try {
    value = JSON.parse(await file.text())
  } catch {
    throw new Error('This file does not contain valid JSON.')
  }
  const document = record(value)
  if (document.format !== 'diaglam') throw new Error('This file is not a Diaglam diagram.')
  if (document.version !== 1) throw new Error('This diagram version is not supported.')
  const elements = array(document.elements).map(element)
  if (new Set(elements.map((item) => item.id)).size !== elements.length) invalid()
  const storedAssets = record(document.assets)
  const referencedIds = new Set(elements.flatMap((item) => item.type === 'image' ? [item.assetId] : []))
  if (referencedIds.size !== Object.keys(storedAssets).length) invalid()
  const assets = new Map<string, ImageAsset>()
  try {
    // Decode each asset once, even if many elements refer to it.
    for (const id of referencedIds) {
      if (!Object.hasOwn(storedAssets, id)) invalid()
      const stored = record(storedAssets[id])
      const mimeType = string(stored.mimeType)
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) invalid()
      const base64 = string(stored.base64)
      if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) invalid()
      const binary = atob(base64)
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
      const blob = new Blob([bytes], { type: mimeType })
      if (await imageMimeType(blob) !== mimeType) invalid()
      const bitmap = await createImageBitmap(blob)
      if (Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_SIDE) {
        bitmap.close()
        throw new Error(`An image in this diagram exceeds the ${MAX_IMAGE_SIDE.toLocaleString('en-US')} pixel limit.`)
      }
      assets.set(id, { blob, bitmap })
    }
    return elements.map((item) => {
      if (item.type !== 'image') return item
      const { assetId, ...properties } = item
      return { ...properties, data: assets.get(assetId)! }
    })
  } catch (error) {
    for (const asset of assets.values()) asset.bitmap.close()
    throw error instanceof Error ? error : new Error('Cannot open an image in this diagram.')
  }
}

type SaveHandle = { createWritable: () => Promise<{
  write: (blob: Blob) => Promise<void>
  close: () => Promise<void>
  abort?: () => Promise<void>
}> }
export type SavePicker = (options: {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
}) => Promise<SaveHandle>

export function nativeSavePicker(): SavePicker | undefined {
  return (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker?.bind(window)
}

export function diagramFilename(name: string): string {
  const filename = name.trim() || 'untitled'
  return /\.diaglam$/i.test(filename) ? filename : `${filename}.diaglam`
}

export async function saveDiagram(snapshot: TSnapshot, filename: string, picker?: SavePicker): Promise<void> {
  // Invoke the native picker before awaiting serialization to retain user activation.
  const handle = picker ? await picker({
    suggestedName: diagramFilename(filename),
    types: [{ description: 'Diaglam diagram', accept: { 'application/json': ['.diaglam'] } }],
  }) : undefined
  const blob = await serializeDiagram(snapshot)
  if (handle) {
    const writable = await handle.createWritable()
    try {
      await writable.write(blob)
      await writable.close()
    } catch (error) {
      await writable.abort?.().catch(() => {})
      throw error
    }
  } else {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = diagramFilename(filename)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
