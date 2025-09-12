'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

interface ImageOverlayProps {
  src: string;
  children: (props: { imageWidth: number; imageHeight: number }) => ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
}

export function ImageOverlay({ src, children, onLoad, onError, onClick, className }: ImageOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    if (onLoad) onLoad();
  };

  const getImageDisplayDimensions = () => {
    if (imageSize.width === 0 || containerSize.width === 0) {
      return { width: 0, height: 0, top: 0, left: 0 };
    }

    const imageAspectRatio = imageSize.width / imageSize.height;
    const containerAspectRatio = containerSize.width / containerSize.height;

    let displayWidth, displayHeight;

    if (imageAspectRatio > containerAspectRatio) {
      displayWidth = containerSize.width;
      displayHeight = displayWidth / imageAspectRatio;
    } else {
      displayHeight = containerSize.height;
      displayWidth = displayHeight * imageAspectRatio;
    }

    const top = (containerSize.height - displayHeight) / 2;
    const left = (containerSize.width - displayWidth) / 2;

    return { width: displayWidth, height: displayHeight, top, left };
  };

  const { width, height, top, left } = getImageDisplayDimensions();

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className || ''}`}>
      <img
        src={src}
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
        onLoad={handleImageLoad}
        onError={onError}
        alt="Camera View"
      />
      {width > 0 && (
        <div
          className="absolute"
          onClick={onClick}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            top: `${top}px`,
            left: `${left}px`,
          }}
        >
          {children({ imageWidth: width, imageHeight: height })}
        </div>
      )}
    </div>
  );
}