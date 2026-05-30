// 師匠・弟子のキャラクタ画像をアバターアイコン (顔中心に正方形) に加工する。
// 元画像は人物が左寄り、顔は上半分にあるので、左側を顔中心にクロップ。
import sharp from 'sharp'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public', 'icons')

async function makeAvatar(srcPath, outName) {
  const meta = await sharp(srcPath).metadata()
  const w = meta.width || 1402
  const h = meta.height || 1122
  // 顔(頭の周り)が上半分・左中央付近 → 中央付近を正方形で切り取る
  // 元画像は背景白、左肩〜頭が中央付近にある
  const cropSize = Math.min(w, h)
  // 横位置: 中心より少し左寄り (顔が左寄りにあるため)
  const left = Math.max(0, Math.round(w * 0.42 - cropSize / 2))
  const top = 0 // 頭の頂上から
  const size = Math.min(cropSize, w - left)
  await sharp(srcPath)
    .extract({ left, top, width: size, height: size })
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 90 })
    .toFile(join(publicDir, outName))
  console.log('wrote', outName)
}

await makeAvatar('/tmp/_master-raw.png', 'master.png')
await makeAvatar('/tmp/_apprentice-raw.png', 'apprentice.png')
console.log('done')
