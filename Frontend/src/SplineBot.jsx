import { Suspense, lazy } from "react";

const Spline = lazy(() => import("@splinetool/react-spline"));

function SplineBot() {
  return (
    <Suspense fallback={<div className="splineFallback" />}>
      <Spline scene="https://prod.spline.design/wThbZ1TTPmeaduIy/scene.splinecode" />
    </Suspense>
  );
}

export default SplineBot;
