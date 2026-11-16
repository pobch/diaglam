import { TCommitNewSnapshotFn, TElementData } from './snapshotManipulation'
import iconSrc from './assets/image.svg'
import { ImageAsset, prepareUploadedImage } from './imageAsset'

export function ImageUploadButton({
  commitNewSnapshot,
  scenePositionToDrawImage,
  onUploadSuccess,
  onError,
}: {
  commitNewSnapshot: TCommitNewSnapshotFn
  scenePositionToDrawImage: { x1: number; y1: number }
  onUploadSuccess: () => void
  onError: (message: string) => void
}) {
  return (
    <>
      <label htmlFor="image-upload">
        <img src={iconSrc} alt="upload" width={24} style={{ verticalAlign: 'bottom' }} />
      </label>
      <input
        id="image-upload"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ width: '1px', height: '1px', opacity: 0 }}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          // Allow selecting the same file again, including after an error.
          e.target.value = ''
          if (!file) return
          try {
            const image = await prepareUploadedImage(file)
            commitNewSnapshot({
              mode: 'addElements',
              newElementWithoutIds: [
                {
                  type: 'image',
                  x1: scenePositionToDrawImage.x1,
                  y1: scenePositionToDrawImage.y1,
                  x2: scenePositionToDrawImage.x1 + image.bitmap.width,
                  y2: scenePositionToDrawImage.y1 + image.bitmap.height,
                  data: image,
                },
              ],
            })

            onUploadSuccess()
          } catch (error) {
            onError(error instanceof Error ? error.message : 'Cannot open this image.')
          }
        }}
      />
    </>
  )
}

export function createImageElementWithoutId({
  x1,
  y1,
  width,
  height,
  imageData,
}: {
  x1: number
  y1: number
  width: number
  height: number
  imageData: ImageAsset
}): Omit<Extract<TElementData, { type: 'image' }>, 'id'> {
  return {
    x1: x1,
    y1: y1,
    x2: x1 + width,
    y2: y1 + height,
    type: 'image',
    data: imageData,
  }
}
