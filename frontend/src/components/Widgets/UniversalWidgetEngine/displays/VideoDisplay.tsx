/**
 * VideoDisplay - Universal Widget System Display Component
 * Renders video player with support for YouTube, Vimeo, and direct video URLs
 */

import { AppDispatch } from '@/store';
import { updateWidgetContent } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import {
    PlayIcon,
    SpeakerXMarkIcon
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

interface VideoDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface VideoContent {
  url: string;
  title?: string;
  autoplay?: boolean;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
}

export default function VideoDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: VideoDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();

  const content = widget.content as VideoContent;
  const [videoUrl, setVideoUrl] = useState(content?.url || '');
  const [title, setTitle] = useState(content?.title || '');
  const [autoplay, setAutoplay] = useState(content?.autoplay || false);
  const [controls, setControls] = useState(content?.controls !== false); // Default to true
  const [muted, setMuted] = useState(content?.muted || false);
  const [loop, setLoop] = useState(content?.loop || false);
  const [isEditing, setIsEditing] = useState(!content?.url);
  const [embedUrl, setEmbedUrl] = useState('');

  // Save content to backend
  const saveContent = useCallback(
    (updates: Partial<VideoContent>) => {
      const newContent = { ...content, ...updates };

      dispatch(
        updateWidgetContent({
          widgetId: widget.id,
          content: newContent,
        })
      );
    },
    [dispatch, widget.id, content]
  );

  // Convert various video URLs to embeddable format
  const getEmbedUrl = (url: string): string => {
    if (!url) return '';

    // YouTube URLs
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';

      if (url.includes('youtube.com/watch')) {
        const match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
        videoId = match ? match[1] : '';
      } else if (url.includes('youtu.be/')) {
        const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        videoId = match ? match[1] : '';
      }

      if (videoId) {
        const params = new URLSearchParams();
        if (autoplay) params.set('autoplay', '1');
        if (muted) params.set('mute', '1');
        if (loop) params.set('loop', '1');
        if (!controls) params.set('controls', '0');

        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
      }
    }

    // Vimeo URLs
    if (url.includes('vimeo.com')) {
      const match = url.match(/vimeo\.com\/(\d+)/);
      if (match) {
        const videoId = match[1];
        const params = new URLSearchParams();
        if (autoplay) params.set('autoplay', '1');
        if (muted) params.set('muted', '1');
        if (loop) params.set('loop', '1');
        if (!controls) params.set('controls', '0');

        return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
      }
    }

    // Direct video URLs or other embeddable URLs
    return url;
  };

  // Update embed URL when video URL or settings change
  useEffect(() => {
    setEmbedUrl(getEmbedUrl(videoUrl));
  }, [videoUrl, autoplay, controls, muted, loop]);

  const handleSave = () => {
    if (!videoUrl.trim()) return;

    saveContent({
      url: videoUrl.trim(),
      title: title.trim(),
      autoplay,
      controls,
      muted,
      loop,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setVideoUrl(content?.url || '');
    setTitle(content?.title || '');
    setAutoplay(content?.autoplay || false);
    setControls(content?.controls !== false);
    setMuted(content?.muted || false);
    setLoop(content?.loop || false);
    setIsEditing(false);
  };

  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  const isVimeo = videoUrl.includes('vimeo.com');
  const isDirectVideo = videoUrl && !isYouTube && !isVimeo;

  const interactions = blueprint.viewSchema.interactions || {};

  if (isEditing) {
    return (
      <div className="w-full h-full p-4 bg-white dark:bg-gray-800 overflow-y-auto">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Video Settings</h3>

          {/* Video URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video URL</label>
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or direct video URL"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Supports YouTube, Vimeo, and direct video URLs
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Video title..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Playback Settings</h4>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={e => setAutoplay(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Autoplay</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={controls}
                onChange={e => setControls(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show controls</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={muted}
                onChange={e => setMuted(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Muted</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={loop}
                onChange={e => setLoop(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Loop</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-4">
            <button
              onClick={handleSave}
              disabled={!videoUrl.trim()}
              className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-md hover:bg-gray-600 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
        <div className="text-center">
          <PlayIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No video configured</p>
          {interactions.allowEdit !== false && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700"
            >
              Add Video
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-gray-800"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
        backgroundColor: styleProps?.backgroundColor || undefined,
      }}
    >
      {/* Header */}
      {title && (
        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-3 text-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
            {interactions.allowEdit !== false && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video */}
      <div className="flex-1 relative">
        {isDirectVideo ? (
          <video
            src={embedUrl}
            controls={controls}
            autoPlay={autoplay}
            muted={muted}
            loop={loop}
            className="w-full h-full object-contain"
          />
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title || 'Video player'}
          />
        )}

        {/* Edit overlay on hover */}
        {interactions.allowEdit !== false && !title && (
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-white bg-opacity-90 text-gray-900 rounded-md hover:bg-opacity-100"
            >
              Edit Video
            </button>
          </div>
        )}
      </div>

      {/* Video info */}
      {(isYouTube || isVimeo) && (
        <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 p-2 text-xs">
          <div className="flex items-center justify-between">
            <span>
              {isYouTube && '📺 YouTube'}
              {isVimeo && '🎬 Vimeo'}
            </span>
            <div className="flex items-center space-x-2 text-xs">
              {autoplay && <span>▶️ Auto</span>}
              {muted && <SpeakerXMarkIcon className="w-3 h-3" />}
              {loop && <span>🔄 Loop</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
