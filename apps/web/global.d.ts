// Ambient declarations so `tsc --noEmit` (and CI typecheck) pass without a prior
// `next build` generating next-env.d.ts. Next/SWC handles the real CSS at build time.
declare module '*.css';
