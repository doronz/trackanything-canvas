/**
 * CardsDisplay - Universal Widget System Display Component
 * Renders flash cards with flip animation and learning features
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateWidgetContent, updateWidget } from '@/store/widgetSlice';
import { ArrowPathIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

interface CardsDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface FlashCardContent {
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lastReviewed: string;
  reviewCount: number;
  correctCount: number;
}

export default function CardsDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: CardsDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();
  const content = widget.content as FlashCardContent;

  const [isFlipped, setIsFlipped] = useState(false);
  const [front, setFront] = useState(content?.front || '');
  const [back, setBack] = useState(content?.back || '');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    content?.difficulty || 'medium'
  );
  const [isEditing, setIsEditing] = useState(!content?.front && !content?.back);
  const [reviewCount, setReviewCount] = useState(content?.reviewCount || 0);
  const [correctCount, setCorrectCount] = useState(content?.correctCount || 0);

  // Debounced save to backend to avoid too many API calls
  const saveToBackend = useCallback(
    debounce((newContent: FlashCardContent) => {
      dispatch(
        updateWidget({
          id: widget.id,
          data: { content: newContent },
        })
      );
    }, 1000), // Wait 1 second after last change before saving
    [dispatch, widget.id]
  );

  // Save content when it changes
  useEffect(() => {
    const newContent: FlashCardContent = {
      front,
      back,
      difficulty,
      lastReviewed: content?.lastReviewed || new Date().toISOString(),
      reviewCount,
      correctCount,
    };

    dispatch(
      updateWidgetContent({
        widgetId: widget.id,
        content: newContent,
      })
    );

    // Only save to backend if there's actual content (avoid saving empty initial state)
    if (front.trim() || back.trim() || reviewCount > 0) {
      saveToBackend(newContent);
    }
  }, [front, back, difficulty, reviewCount, correctCount, dispatch, widget.id, saveToBackend]); // Removed content?.lastReviewed from dependencies to prevent infinite loop

  const handleFlip = () => {
    if (!isEditing && front && back) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleReview = (correct: boolean) => {
    setReviewCount(prev => prev + 1);
    if (correct) {
      setCorrectCount(prev => prev + 1);
    }

    // Update last reviewed time
    const newContent: FlashCardContent = {
      front,
      back,
      difficulty,
      lastReviewed: new Date().toISOString(),
      reviewCount: reviewCount + 1,
      correctCount: correct ? correctCount + 1 : correctCount,
    };

    dispatch(
      updateWidgetContent({
        widgetId: widget.id,
        content: newContent,
      })
    );

    // Also save to backend immediately for review actions
    dispatch(
      updateWidget({
        id: widget.id,
        data: { content: newContent },
      })
    );

    setIsFlipped(false);
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'hard':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const successRate = reviewCount > 0 ? Math.round((correctCount / reviewCount) * 100) : 0;

  // Prevent wheel events from propagating to canvas to avoid zoom conflicts
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  if (isEditing) {
    return (
      <div
        className="w-full h-full bg-white dark:bg-gray-800 rounded-lg p-4 flex flex-col"
        onWheel={handleWheel}
        style={{
          backgroundColor: styleProps?.backgroundColor || '#ffffff',
          color: styleProps?.textColor || '#374151',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Edit Flash Card</h3>
          <button
            onClick={() => setIsEditing(false)}
            disabled={!front.trim() || !back.trim()}
            className="px-3 py-1 text-xs bg-gradient-to-r from-[#FF5A78] to-[#FFC850] text-white rounded hover:shadow-lg disabled:opacity-50"
          >
            Save
          </button>
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Front Side *
            </label>
            <textarea
              value={front}
              onChange={e => setFront(e.target.value)}
              placeholder="Enter question or prompt..."
              className="w-full h-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Back Side *
            </label>
            <textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder="Enter answer or explanation..."
              className="w-full h-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full bg-white dark:bg-gray-800 rounded-lg flex flex-col"
      onWheel={handleWheel}
      style={{
        backgroundColor: styleProps?.backgroundColor || '#ffffff',
        color: styleProps?.textColor || '#374151',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${getDifficultyColor(difficulty)}`}
          >
            {difficulty}
          </span>
          {reviewCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {successRate}% ({correctCount}/{reviewCount})
            </span>
          )}
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowPathIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Card Content */}
      <div className="flex-1 relative cursor-pointer" onClick={handleFlip}>
        <div
          className={`absolute inset-0 p-4 flex items-center justify-center text-center transition-opacity duration-300 ${
            isFlipped ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
            {front || 'Click to add front content...'}
          </div>
        </div>

        <div
          className={`absolute inset-0 p-4 flex items-center justify-center text-center transition-opacity duration-300 ${
            isFlipped ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
            {back || 'Click to add back content...'}
          </div>
        </div>
      </div>

      {/* Review Buttons - only show when flipped */}
      {isFlipped && front && back && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <button
              onClick={e => {
                e.stopPropagation();
                handleReview(false);
              }}
              className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 dark:bg-red-900 dark:text-red-200"
            >
              <XMarkIcon className="w-4 h-4 mr-1" />
              Incorrect
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                handleReview(true);
              }}
              className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 dark:bg-green-900 dark:text-green-200"
            >
              <CheckIcon className="w-4 h-4 mr-1" />
              Correct
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
