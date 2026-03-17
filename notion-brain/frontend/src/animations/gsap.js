import gsap from "gsap";

export function playIntroAnimation(fgRef) {
  // Animate the canvas opacity up
  gsap.fromTo("#universe-canvas",
    { opacity: 0, scale: 0.95 },
    { opacity: 1, scale: 1, duration: 1.5, ease: "power3.out" }
  );

  // Zoom to fit after graph stabilizes
  setTimeout(() => {
    if (fgRef.current) {
        fgRef.current.zoomToFit(800, 60);
    }
  }, 1500);
}
