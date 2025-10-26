import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = 'bottom',
  delay = 300,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();

        let x = rect.left;
        let y = rect.top;

        switch (position) {
          case 'top':
            x = rect.left + rect.width / 2;
            y = rect.top - 8;
            break;
          case 'bottom':
            x = rect.left + rect.width / 2;
            y = rect.bottom + 8;
            break;
          case 'left':
            x = rect.left - 8;
            y = rect.top + rect.height / 2;
            break;
          case 'right':
            x = rect.right + 8;
            y = rect.top + rect.height / 2;
            break;
        }

        setCoords({ x, y });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={className || 'inline-block'}
      >
        {children}
      </div>

      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md shadow-lg pointer-events-none transition-opacity duration-200 text-center ${
              position === 'top'
                ? 'transform -translate-x-1/2 -translate-y-full'
                : position === 'bottom'
                  ? 'transform -translate-x-1/2'
                  : position === 'left'
                    ? 'transform -translate-x-full -translate-y-1/2'
                    : 'transform -translate-y-1/2'
            }`}
            style={{
              left: coords.x,
              top: coords.y,
            }}
          >
            {content.split('\n').map((line, index) => (
              <div key={index} className={index > 0 ? 'mt-1' : ''}>
                {line}
              </div>
            ))}

            {/* Arrow */}
            <div
              className={`absolute w-2 h-2 bg-gray-900 rotate-45 ${
                position === 'top'
                  ? 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2'
                  : position === 'bottom'
                    ? 'top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
                    : position === 'left'
                      ? 'right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2'
                      : 'left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2'
              }`}
            />
          </div>,
          document.body
        )}
    </>
  );
}
