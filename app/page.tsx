import Link from 'next/link'

export default function Home() {
  return (
    <main className="relative min-h-screen split-bg overflow-hidden">
      <div className="guild-top-bg" />

      <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-2">
        {/* 左：弟子 */}
        <section className="flex flex-col items-center justify-center gap-8 p-10 text-amber-950">
          <div className="text-xs tracking-[0.4em] opacity-70">— APPRENTICE —</div>
          <h2 className="script text-5xl font-bold drop-shadow-sm">AI 弟子</h2>
          <p className="text-center max-w-sm leading-relaxed">
            師匠から技を聞き取る。<br />
            言葉にしづらい勘どころを、<br />一問ずつ深く尋ねる。
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link
              href="/deshi"
              className="guild-frame block text-center py-4 bg-amber-800 text-amber-50 text-xl rounded-sm hover:bg-amber-900 transition"
            >
              弟子として聞く
            </Link>
            <Link
              href="/admin/deshi"
              className="text-center py-2 border border-amber-800/40 text-amber-900 rounded-sm hover:bg-amber-100/50 transition text-sm"
            >
              ⚙ 弟子の事前知識を整える
            </Link>
          </div>
        </section>

        {/* 中央の境界線（縦の細い金色帯） */}
        <div
          className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px"
          style={{ background: 'linear-gradient(to bottom, transparent, #b58e3a 20%, #b58e3a 80%, transparent)' }}
        />

        {/* 右：師匠 */}
        <section className="flex flex-col items-center justify-center gap-8 p-10 text-stone-900">
          <div className="text-xs tracking-[0.4em] opacity-70">— MASTER —</div>
          <h2 className="script text-5xl font-bold drop-shadow-sm">AI 師匠</h2>
          <p className="text-center max-w-sm leading-relaxed">
            蓄えられた技を、<br />
            次の代へ伝える。<br />言葉になった部分の、その範囲で答える。
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link
              href="/shisho"
              className="guild-frame block text-center py-4 bg-stone-800 text-stone-50 text-xl rounded-sm hover:bg-stone-900 transition"
            >
              師匠から学ぶ
            </Link>
            <Link
              href="/admin/shisho"
              className="text-center py-2 border border-stone-700/40 text-stone-800 rounded-sm hover:bg-stone-200/50 transition text-sm"
            >
              ⚙ 師匠の知識と教え方を整える
            </Link>
          </div>
        </section>
      </div>

      {/* タイトル帯 (上部) */}
      <div className="absolute top-0 left-0 right-0 z-20 py-4 text-center pointer-events-none">
        <div className="inline-block px-8 py-2 bg-[#fbf5e9]/70 backdrop-blur-sm border-y border-[#b58e3a]/60 script">
          <span className="text-xs tracking-[0.5em] text-stone-700">CRAFTSMEN'S GUILD</span>
        </div>
      </div>

      {/* フッター */}
      <div className="absolute bottom-2 left-0 right-0 z-20 text-center text-xs text-stone-600 opacity-70 pointer-events-none">
        職人の技を、次の代へ
      </div>
    </main>
  )
}
