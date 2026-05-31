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
  // 顔(目・口あたり)中心に寄せてクロップ。
  // 1402x1122 画像で顔の中心 ≈ (横55%, 縦25%) あたり。
  // cropSize = 高さの 65% → 頭〜胸まで入る正方形
  const cropSize = Math.round(h * 0.65)
  const centerX = Math.round(w * 0.56)
  const centerY = Math.round(h * 0.30)
  const left = Math.max(0, Math.min(w - cropSize, centerX - Math.round(cropSize / 2)))
  const top = Math.max(0, Math.min(h - cropSize, centerY - Math.round(cropSize / 2)))
  await sharp(srcPath)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 90 })
    .toFile(join(publicDir, outName))
  console.log('wrote', outName, `crop=${cropSize}@(${left},${top})`)
}

await makeAvatar('/tmp/_master-raw.png', 'master.png')
await makeAvatar('/tmp/_apprentice-raw.png', 'apprentice.png')
console.log('done')
