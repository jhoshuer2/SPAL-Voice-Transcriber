"use client";

import { MeshGradient } from "@paper-design/shaders-react";

/**
 * Page background — an animated mesh gradient (Paper Shaders), replacing
 * the earlier illustration. Rendered as a fixed, full-viewport layer behind
 * everything (see .bg-shader / .bg-shader__wash in globals.css for the
 * stacking), so — same as the corner illustrations before it — it takes up
 * no document space and can't ever overlap or interrupt page content.
 *
 * A translucent white wash sits between the canvas and the page content so
 * the gradient reads as color and motion behind the UI rather than a fully
 * saturated canvas competing with it, and so existing text colors (tuned
 * for a light background) keep their contrast.
 */
export function ShaderBackground() {
  return (
    <div className="bg-shader" aria-hidden="true">
      <MeshGradient
        style={{ width: "100%", height: "100%" }}
        colors={["#e0eaff", "#241d9a", "#f75092", "#9f50d3"]}
        distortion={0.8}
        swirl={0.1}
        grainMixer={0}
        grainOverlay={0}
        speed={1}
        scale={1}
        rotation={0}
        offsetX={0}
        offsetY={0}
      />
      <div className="bg-shader__wash" />
    </div>
  );
}
