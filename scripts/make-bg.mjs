// /deshi /shisho の背景用画像。元画像を程よくリサイズして JPEG 化。
import sharp from 'sharp'

await sharp('/tmp/_workshop-raw.png')
  .resize(1600, 1280, { fit: 'cover' })
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile('public/icons/workshop-bg.jpg')

console.log('done')
