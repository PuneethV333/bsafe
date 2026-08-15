import { SosPanel } from '../components/SosPanel';

export function HomePage() {
  return (
    <div className="mx-auto max-w-xl animate-rise">
      <header className="text-center">
        <p className="eyebrow">Emergency trigger</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-chalk sm:text-4xl">
          Silent SOS
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-mist">
          Tap once or press and hold. Your contacts receive a live location link —
          nothing plays, nothing pops up on this screen.
        </p>
      </header>
      <SosPanel />
    </div>
  );
}
