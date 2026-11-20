"use client";

import { GrainGradient } from "@paper-design/shaders-react";

/**
 * Page background — an animated grain gradient (Paper Shaders), replacing
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
      <GrainGradient
        style={{ width: "100%", height: "100%" }}
        colors={["#7300ff", "#eba8ff", "#00bfff", "#2b00ff"]}
        colorBack="#000000"
        softness={0.5}
        intensity={0.5}
        noise={0.25}
        shape="corners"
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
