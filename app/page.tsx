import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-12 p-8 bg-amber-50">
      <h1 className="text-4xl font-bold text-amber-900">AI 弟子 & AI 師匠</h1>
      <p className="text-lg text-stone-700 max-w-md text-center">
        職人の暗黙知を、音声対話で集めて伝える。
      </p>
      <div className="flex flex-col sm:flex-row gap-6">
        <Link
          href="/deshi"
          className="px-10 py-6 bg-amber-700 text-white text-2xl rounded-2xl shadow-lg hover:bg-amber-800 transition"
        >
          AI弟子 として聞く
        </Link>
        <Link
          href="/shisho"
          className="px-10 py-6 bg-stone-700 text-white text-2xl rounded-2xl shadow-lg hover:bg-stone-800 transition"
        >
          AI師匠 から学ぶ
        </Link>
      </div>
    </main>
  )
}
