import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { showConnectionModal } from '@/store/connectionSlice';

interface ConnectionButtonProps {
  widgetId: number;
  isVisible: boolean;
  position?: 'right' | 'left' | 'top' | 'bottom';
}

export default function ConnectionButton({
  widgetId,
  isVisible,
  position = 'right',
}: ConnectionButtonProps) {
  const dispatch = useDispatch<AppDispatch>();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dispatch(showConnectionModal({ widgetId, direction: position }));
  };

  const positionClasses = {
    right: 'absolute top-1/2 -right-3 transform -translate-y-1/2',
    left: 'absolute top-1/2 -left-3 transform -translate-y-1/2',
    top: 'absolute -top-3 left-1/2 transform -translate-x-1/2',
    bottom: 'absolute -bottom-3 left-1/2 transform -translate-x-1/2',
  };

  return (
    <button
      onClick={handleClick}
      className={`
        ${positionClasses[position]}
        w-6 h-6 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] hover:shadow-lg text-white rounded-full
        shadow-lg hover:shadow-xl transition-all duration-200
        flex items-center justify-center z-10
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}
        hover:scale-110 active:scale-95
      `}
      title="Create connection"
    >
      <PlusIcon className="w-4 h-4" />
    </button>
  );
}

// Component to show on AI chat messages
interface MessageConnectionButtonProps {
  widgetId: number;
  messageContent: string;
  messageIndex: number;
  isVisible: boolean;
}

export function MessageConnectionButton({
  widgetId,
  messageContent,
  messageIndex,
  isVisible,
}: MessageConnectionButtonProps) {
  const dispatch = useDispatch<AppDispatch>();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Store the specific message content for conversion
    // TODO: We might want to store this in a separate state or pass it directly
    dispatch(showConnectionModal({ widgetId, direction: 'right' }));
  };

  return (
    <button
      onClick={handleClick}
      className={`
        absolute top-2 right-2 w-6 h-6 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] hover:shadow-lg text-white rounded-full
        shadow-md hover:shadow-lg transition-all duration-200
        flex items-center justify-center z-10
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}
        hover:scale-110 active:scale-95
      `}
      title="Convert message to widget"
    >
      <PlusIcon className="w-3 h-3" />
    </button>
  );
}
