/**
 * One requestAnimationFrame loop for every animated avatar on screen (cheaper
 * than one loop each). It stops when nobody is subscribed and while the tab is
 * hidden, so a call in a background tab costs nothing.
 */

type Frame = (now: number) => void;

const callbacks = new Set<Frame>();
let frame = 0;

function tick(now: number) {
  callbacks.forEach((cb) => cb(now));
  frame = requestAnimationFrame(tick);
}

function update() {
  const shouldRun = callbacks.size > 0 && !document.hidden;
  if (shouldRun && !frame) frame = requestAnimationFrame(tick);
  if (!shouldRun && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

if (typeof document !== "undefined") document.addEventListener("visibilitychange", update);

/** Call `cb` every frame until the returned function is called. */
export function onFrame(cb: Frame): () => void {
  callbacks.add(cb);
  update();
  return () => {
    callbacks.delete(cb);
    update();
  };
}

/** True when the user asked for less motion (checked live, so changing the setting applies at once). */
const motionQuery = typeof window === "undefined" ? null : window.matchMedia("(prefers-reduced-motion: reduce)");
export function reducedMotion(): boolean {
  return motionQuery?.matches ?? false;
}
