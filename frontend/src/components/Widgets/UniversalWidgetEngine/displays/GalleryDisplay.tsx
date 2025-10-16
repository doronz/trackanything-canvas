/**
 * GalleryDisplay - Universal Widget System Display Component
 * Renders images in gallery format with upload, preview, and management features
 */

import { AppDispatch } from '@/store';
import { updateWidgetContent } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    EyeIcon,
    PhotoIcon,
    PlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

interface GalleryDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface ImageItem {
  id: string;
  url: string;
  alt?: string;
  caption?: string;
  title?: string;
}

export default function GalleryDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: GalleryDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();

  // Handle both single image and gallery formats
  const getImagesFromContent = () => {
    const content = widget.content;

    // Single image format
    if (content?.url) {
      return [
        {
          id: '1',
          url: content.url,
          alt: content.alt,
          caption: content.caption,
          title: content.title,
        },
      ];
    }

    // Gallery format
    if (content?.images && Array.isArray(content.images)) {
      return content.images;
    }

    // Data array format
    if (content?.data && Array.isArray(content.data)) {
      return content.data;
    }

    return [];
  };

  const [images, setImages] = useState<ImageItem[]>(getImagesFromContent());
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Update local state when widget content changes
  useEffect(() => {
    setImages(getImagesFromContent());
  }, [widget.content]);

  // Save images to backend
  const saveImages = useCallback(
    (newImages: ImageItem[]) => {
      const content = {
        images: newImages,
        data: newImages, // For compatibility with data field mapping
        // If single image widget, also store as top-level fields
        ...(newImages.length === 1 && {
          url: newImages[0].url,
          alt: newImages[0].alt,
          caption: newImages[0].caption,
          title: newImages[0].title,
        }),
      };

      dispatch(
        updateWidgetContent({
          widgetId: widget.id,
          content,
        })
      );
    },
    [dispatch, widget.id]
  );

  const addImage = () => {
    if (!newImageUrl.trim()) return;

    const newImage: ImageItem = {
      id: Date.now().toString(),
      url: newImageUrl.trim(),
      alt: '',
      caption: '',
      title: '',
    };

    const newImages = [...images, newImage];
    setImages(newImages);
    saveImages(newImages);
    setNewImageUrl('');
    setIsAddingImage(false);
  };

  const deleteImage = (id: string) => {
    const newImages = images.filter(img => img.id !== id);
    setImages(newImages);
    saveImages(newImages);
  };

  const updateImage = (id: string, updates: Partial<ImageItem>) => {
    const newImages = images.map(img => (img.id === id ? { ...img, ...updates } : img));
    setImages(newImages);
    saveImages(newImages);
  };

  const openModal = (image: ImageItem) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedImage(null);
    setIsModalOpen(false);
  };

  const handleImageError = (id: string) => {
    updateImage(id, { url: '' }); // Clear broken image
  };

  // Carousel navigation
  const nextImage = () => {
    setCurrentIndex(prev => (prev + 1) % images.length);
  };

  const previousImage = () => {
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (images.length <= 1) return;

      if (e.key === 'ArrowLeft') {
        previousImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [images.length]);

  // Reset current index if it's out of bounds
  useEffect(() => {
    if (currentIndex >= images.length && images.length > 0) {
      setCurrentIndex(0);
    }
  }, [images.length, currentIndex]);

  const interactions = blueprint.viewSchema.interactions || {};
  const layout = blueprint.viewSchema.layout || {};
  const columns = layout.columns || 2;

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-gray-800"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-white">
          {blueprint.settings.title || 'Gallery'}
          {images.length > 0 && (
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({images.length})</span>
          )}
        </h3>

        {interactions.allowAdd !== false && (
          <button
            onClick={() => setIsAddingImage(true)}
            className="p-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700"
            title="Add image"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Add image form */}
      {isAddingImage && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center space-x-2">
            <input
              type="url"
              value={newImageUrl}
              onChange={e => setNewImageUrl(e.target.value)}
              placeholder="Enter image URL..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={addImage}
              disabled={!newImageUrl.trim()}
              className="px-3 py-2 bg-green-500 dark:bg-green-600 text-white rounded-md hover:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAddingImage(false);
                setNewImageUrl('');
              }}
              className="px-3 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-md hover:bg-gray-600 dark:hover:bg-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Carousel */}
      <div className="flex-1 overflow-hidden relative">
        {images.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <PhotoIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-sm">No images yet</p>
              <p className="text-xs mt-1">Add your first image to get started</p>
            </div>
          </div>
        ) : (
          <>
            {/* Main image display */}
            <div className="h-full flex items-center justify-center bg-gray-50 relative">
              <img
                src={images[currentIndex]?.url}
                alt={images[currentIndex]?.alt || 'Gallery image'}
                className="max-w-full max-h-full object-contain cursor-pointer"
                onClick={() => openModal(images[currentIndex])}
                onError={() => handleImageError(images[currentIndex]?.id)}
              />

              {/* Navigation arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={previousImage}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
                    title="Previous image"
                  >
                    <ChevronLeftIcon className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
                    title="Next image"
                  >
                    <ChevronRightIcon className="w-5 h-5 text-gray-700" />
                  </button>
                </>
              )}

              {/* Action buttons overlay */}
              <div className="absolute top-4 right-4 flex space-x-2">
                <button
                  onClick={() => openModal(images[currentIndex])}
                  className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg transition-all"
                  title="View fullscreen"
                >
                  <EyeIcon className="w-4 h-4 text-gray-700" />
                </button>

                {interactions.allowDelete !== false && (
                  <button
                    onClick={() => deleteImage(images[currentIndex]?.id)}
                    className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg transition-all"
                    title="Delete image"
                  >
                    <XMarkIcon className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Image info and controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 bg-opacity-95 dark:bg-opacity-95 border-t border-gray-200 dark:border-gray-700 p-3">
              {/* Caption */}
              {images[currentIndex]?.caption && (
                <p className="text-sm text-gray-700 dark:text-gray-300 text-center mb-3">
                  {images[currentIndex].caption}
                </p>
              )}

              {/* Dots indicator */}
              {images.length > 1 && (
                <div className="flex items-center justify-center space-x-2 mb-2">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToImage(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentIndex
                          ? 'bg-blue-500 w-3 h-3'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      title={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Image counter */}
              <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                {images.length > 1 && (
                  <span>
                    {currentIndex + 1} of {images.length}
                  </span>
                )}
                {images.length === 1 && <span>1 image</span>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="max-w-4xl max-h-full p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {selectedImage.title || 'Image Preview'}
                </h4>
                <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.alt || 'Gallery image'}
                  className="max-w-full max-h-96 mx-auto"
                />

                {selectedImage.caption && (
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">{selectedImage.caption}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
