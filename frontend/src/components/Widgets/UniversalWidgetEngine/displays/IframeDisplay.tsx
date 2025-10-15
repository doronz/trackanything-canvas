/**
 * IframeDisplay - Universal Widget System Display Component
 * Renders web pages with multiple preview modes (iframe, metadata)
 */

import { webpageAPI } from '@/services/api';
import { AppDispatch } from '@/store';
import { updateWidget, updateWidgetContent } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

interface IframeDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface WebpagePreviewContent {
  url: string;
  title?: string;
  description?: string;
  previewMode: 'iframe' | 'metadata';
  showControls: boolean;
  lastFetched?: string;
  metadata?: {
    title?: string;
    description?: string;
    favicon?: string;
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogType?: string;
    ogSiteName?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    twitterCard?: string;
    canonicalUrl?: string;
    contentType?: string;
    statusCode?: number;
    error?: string;
  };
}

export default function IframeDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: IframeDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();
  const content = widget.content as WebpagePreviewContent;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [url, setUrl] = useState(content?.url || '');
  const [title, setTitle] = useState(content?.title || '');
  const [previewMode, setPreviewMode] = useState<'iframe' | 'metadata'>(
    content?.previewMode || 'metadata'
  );
  const [showControls, setShowControls] = useState(content?.showControls !== false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [metadata, setMetadata] = useState(content?.metadata || {});
  const [lastFetched, setLastFetched] = useState(content?.lastFetched || '');
  const [copySuccess, setCopySuccess] = useState(false);

  // Save content when it changes (debounced)
  useEffect(() => {
    // Only save if content actually changed
    const currentContent = content || {};
    const newContent: WebpagePreviewContent = {
      url,
      title,
      previewMode,
      showControls,
      metadata,
      lastFetched,
    };

    // Compare stringified content to detect changes
    if (JSON.stringify(currentContent) === JSON.stringify(newContent)) return;

    const timeoutId = setTimeout(() => {
      // Update both local Redux state and backend database
      dispatch(
        updateWidgetContent({
          widgetId: widget.id,
          content: newContent,
        })
      );

      dispatch(
        updateWidget({
          id: widget.id,
          data: { content: newContent },
        })
      );
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [url, title, previewMode, showControls, metadata, lastFetched, dispatch, widget.id]);

  // Validate URL
  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Extract domain from URL for display
  const getDomain = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.hostname;
    } catch {
      return urlString;
    }
  };

  // Handle URL change and validation
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setHasError(false);

    if (newUrl && isValidUrl(newUrl)) {
      // Fetch webpage metadata from backend
      fetchWebpageMetadata(newUrl);
    }
  };

  // Fetch webpage metadata from backend API
  const fetchWebpageMetadata = async (websiteUrl: string) => {
    setIsLoading(true);
    setLastFetched(new Date().toISOString());

    try {
      const response = await webpageAPI.fetchMetadata(websiteUrl);
      const { metadata: backendMetadata, can_embed } = response.data;

      // Convert backend response to frontend format
      const fetchedMetadata = {
        title: backendMetadata.title,
        description: backendMetadata.description,
        favicon: backendMetadata.favicon,
        ogTitle: backendMetadata.og_title,
        ogDescription: backendMetadata.og_description,
        ogImage: backendMetadata.og_image,
        ogType: backendMetadata.og_type,
        ogSiteName: backendMetadata.og_site_name,
        twitterTitle: backendMetadata.twitter_title,
        twitterDescription: backendMetadata.twitter_description,
        twitterImage: backendMetadata.twitter_image,
        twitterCard: backendMetadata.twitter_card,
        canonicalUrl: backendMetadata.canonical_url,
        contentType: backendMetadata.content_type,
        statusCode: backendMetadata.status_code,
        error: backendMetadata.error,
      };

      setMetadata(fetchedMetadata);

      // Auto-set title if not manually set
      if (!title) {
        const autoTitle =
          fetchedMetadata.ogTitle ||
          fetchedMetadata.title ||
          fetchedMetadata.ogSiteName ||
          getDomain(websiteUrl);
        setTitle(autoTitle);
      }

      // If the webpage can't be embedded, automatically switch to metadata mode
      if (!can_embed && previewMode === 'iframe') {
        setPreviewMode('metadata');
        setHasError(true);
      } else {
        setHasError(false);
      }
    } catch (error) {
      console.error('Failed to fetch webpage metadata:', error);
      setHasError(true);

      // Fallback metadata in case of error
      const domain = getDomain(websiteUrl);
      setMetadata({
        title: domain,
        description: `Error loading ${websiteUrl}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle iframe load error (fallback to metadata mode)
  const handleIframeError = () => {
    setHasError(true);
    setPreviewMode('metadata');
  };

  // Refresh webpage content
  const handleRefresh = () => {
    if (url && isValidUrl(url)) {
      if (previewMode === 'iframe' && iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src; // Force reload
      } else {
        fetchWebpageMetadata(url);
      }
    }
  };

  // Open URL in new tab
  const openInNewTab = () => {
    if (url && isValidUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Copy URL to clipboard
  const copyUrlToClipboard = async () => {
    if (url && isValidUrl(url)) {
      try {
        await navigator.clipboard.writeText(url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
      } catch (error) {
        console.error('Failed to copy URL:', error);
      }
    }
  };

  const renderIframeMode = () => (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 z-10">
          <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        className="w-full h-full border-0 rounded"
        title={title || 'Webpage Preview'}
        sandbox="allow-scripts allow-same-origin allow-popups"
        onError={handleIframeError}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );

  const renderMetadataMode = () => (
    <div className="w-full h-full p-4 bg-gray-50 dark:bg-gray-800 flex flex-col">
      <div className="flex flex-col space-y-4 h-full">
        <div className="flex items-start space-x-3 flex-shrink-0">
          {metadata.favicon ? (
            <img
              src={metadata.favicon}
              alt="Favicon"
              className="w-6 h-6 rounded flex-shrink-0"
              onError={e => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <GlobeAltIcon className="w-6 h-6 text-gray-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
              {metadata.ogTitle || metadata.title || getDomain(url)}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{getDomain(url)}</p>
          </div>
        </div>

        {metadata.ogDescription || metadata.description ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 flex-shrink-0">
            {metadata.ogDescription || metadata.description}
          </p>
        ) : null}

        {metadata.ogImage ? (
          <div className="relative rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-1 min-h-0">
            <img
              src={metadata.ogImage}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={e => {
                const target = e.target as HTMLImageElement;
                target.parentElement?.classList.add('hidden');
              }}
            />
          </div>
        ) : metadata.ogDescription || metadata.description ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <GlobeAltIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No preview image available</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderContent = () => {
    if (!url) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <GlobeAltIcon className="w-16 h-16 mx-auto text-gray-400" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Enter Website URL
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Add a URL to preview the webpage
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (!isValidUrl(url)) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-400" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Invalid URL</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Please enter a valid HTTP or HTTPS URL
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (hasError && previewMode === 'iframe') {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Cannot Embed Page
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This website cannot be embedded. Try metadata mode instead.
              </p>
              <div className="mt-4 space-x-2">
                <button
                  onClick={() => setPreviewMode('metadata')}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  View Metadata
                </button>
                <button
                  onClick={openInNewTab}
                  className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex inline-flex items-center space-x-1"
                >
                  <span>Open</span>
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    switch (previewMode) {
      case 'iframe':
        return renderIframeMode();
      case 'metadata':
        return renderMetadataMode();
      default:
        return renderIframeMode();
    }
  };

  return (
    <div
      className="w-full h-full bg-white dark:bg-gray-800 rounded-lg flex flex-col"
      style={{
        backgroundColor: styleProps?.backgroundColor || '#ffffff',
        color: styleProps?.textColor || '#374151',
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
      }}
    >
      {/* Header */}
      {showControls && (
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <GlobeAltIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <input
              type="url"
              value={url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 ml-2">
            {url && isValidUrl(url) && (
              <>
                <button
                  onClick={copyUrlToClipboard}
                  title={copySuccess ? 'Copied!' : 'Copy URL'}
                  className={`p-1 rounded transition-colors ${
                    copySuccess
                      ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRefresh}
                  title="Refresh"
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={openInNewTab}
                  title="Open in new tab"
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </button>
              </>
            )}

            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setPreviewMode('iframe')}
                className={`px-2 py-1 text-xs rounded ${
                  previewMode === 'iframe'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setPreviewMode('metadata')}
                className={`px-2 py-1 text-xs rounded ${
                  previewMode === 'metadata'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>

      {/* Status Bar */}
      {showControls && url && isValidUrl(url) && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Domain: {getDomain(url)}</span>
              <span>Mode: {previewMode}</span>
              {lastFetched && <span>Updated: {new Date(lastFetched).toLocaleTimeString()}</span>}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">Webpage Preview</div>
          </div>

          {/* Note for iframe mode */}
          {previewMode === 'iframe' && (
            <div className="px-4 pb-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                📌 Note: Some websites may not load as they do not allow being embedded.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
