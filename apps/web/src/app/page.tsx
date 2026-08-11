export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          MELA
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Middle East Lead Agent — AI-assisted B2B lead generation
        </p>
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Application shell — ready for development
          </p>
        </div>
      </main>
    </div>
  );
}
