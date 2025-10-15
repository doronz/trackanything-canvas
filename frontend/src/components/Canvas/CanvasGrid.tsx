interface CanvasGridProps {
  gridSize: number;
  zoom: number;
  pan: { x: number; y: number };
}

export default function CanvasGrid({ gridSize, zoom, pan }: CanvasGridProps) {
  const adjustedGridSize = gridSize * zoom;

  // Only show grid if it's not too small or too large
  if (adjustedGridSize < 5 || adjustedGridSize > 200) {
    return null;
  }

  const offsetX = ((pan.x % adjustedGridSize) + adjustedGridSize) % adjustedGridSize;
  const offsetY = ((pan.y % adjustedGridSize) + adjustedGridSize) % adjustedGridSize;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        backgroundImage: `
          radial-gradient(circle, rgba(156, 163, 175, 0.3) 1px, transparent 1px)
        `,
        backgroundSize: `${adjustedGridSize}px ${adjustedGridSize}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
      }}
    />
  );
}
