"use client";

export function PrometheusIllustration({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        maskImage: [
          "radial-gradient(ellipse 88% 82% at 62% 52%, black 28%, rgba(0,0,0,0.6) 55%, transparent 100%)",
        ].join(", "),
        WebkitMaskImage: [
          "radial-gradient(ellipse 88% 82% at 62% 52%, black 28%, rgba(0,0,0,0.6) 55%, transparent 100%)",
        ].join(", "),
      }}
    >
      {/* The image */}
      <img
        src="/prometheus.png"
        alt="Prometheus bearing fire to mankind"
        className="w-full h-full object-cover"
        style={{ objectPosition: "62% center" }}
        draggable={false}
      />

      {/* Left-side fade into the sidebar boundary */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, #0A0A0A 0%, rgba(10,10,10,0.55) 18%, transparent 42%)",
        }}
      />
      {/* Bottom fade into page floor */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.4) 18%, transparent 45%)",
        }}
      />
      {/* Top fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, #0A0A0A 0%, rgba(10,10,10,0.2) 12%, transparent 35%)",
        }}
      />
      {/* Right-edge vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to left, rgba(10,10,10,0.5) 0%, transparent 30%)",
        }}
      />
    </div>
  );
}
