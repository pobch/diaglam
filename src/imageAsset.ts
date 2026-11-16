export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_SIDE = 2000

// Elements and history entries share this immutable object. Moving, resizing,
// and duplicating an element must not copy or resample its image.
export type ImageAsset = Readonly<{
  blob: Blob
  bitmap: ImageBitmap
}>

export async function imageMimeType(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) {
    return 'image/png'
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  const header = new TextDecoder().decode(bytes)
  if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return 'image/webp'
  throw new Error('Select a PNG, JPEG, or WebP image.')
}

export async function prepareUploadedImage(file: File): Promise<ImageAsset> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('The image is larger than 10 MiB (10,485,760 bytes). Select a smaller file.')
  }
  const type = await imageMimeType(file)
  const blob = file.slice(0, file.size, type)
  const bitmap = await createImageBitmap(blob)
  const longestSide = Math.max(bitmap.width, bitmap.height)
  if (longestSide <= MAX_IMAGE_SIDE) return { blob, bitmap }

  let resized: ImageBitmap | undefined
  try {
    const scale = MAX_IMAGE_SIDE / longestSide
    resized = await createImageBitmap(bitmap, {
      resizeWidth: Math.max(1, Math.round(bitmap.width * scale)),
      resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
      resizeQuality: 'high',
    })
    const canvas = document.createElement('canvas')
    canvas.width = resized.width
    canvas.height = resized.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Cannot resize this image.')
    context.drawImage(resized, 0, 0)
    // PNG avoids another lossy compression step and preserves transparency.
    const resizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('Cannot resize this image.'))
      }, 'image/png')
    })
    return { blob: resizedBlob, bitmap: resized }
  } catch (error) {
    resized?.close()
    throw error
  } finally {
    bitmap.close()
  }
}
