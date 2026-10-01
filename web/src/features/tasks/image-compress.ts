import { fitWithin, shouldCompressImage } from '@/domain/attachments'

/**
 * Reduz fotos grandes antes do envio (diretriz §16: "compressão quando apropriado").
 * Mantém o nome e o formato (PNG vira WebP só se ficar menor). Se o navegador não suportar,
 * ou se o resultado não ficar menor, envia o arquivo original.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    if (!shouldCompressImage(file.type, file.size, bitmap.width, bitmap.height)) return file
    const size = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    const type = file.type === 'image/png' ? 'image/webp' : file.type
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
    if (!blob || blob.size >= file.size) return file
    const name = type === file.type ? file.name : file.name.replace(/\.[^.]+$/, '.webp')
    return new File([blob], name, { type, lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
