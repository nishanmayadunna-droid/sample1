export default function AnnouncementBar() {
  return (
    <div className="bg-blaze text-white">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center font-mono text-[0.66rem] uppercase tracking-[0.16em]">
        <span>Flash sale — up to 30% off</span>
        <span aria-hidden="true" className="opacity-60">
          ·
        </span>
        <span>Free shipping over $75</span>
      </p>
    </div>
  );
}
