import Tooltip from '@/components/UI/Tooltip';
import { AppDispatch, RootState } from '@/store';
import { openWidgetSettingsPanel } from '@/store/uiSlice';
import {
  deleteWidget,
  selectWidget,
  startDragging,
  startResizing,
  stopDragging,
  stopResizing,
  updateDragPosition,
  updateResizeSize,
  updateWidget,
} from '@/store/widgetSlice';
import { PluggableWidget, Widget } from '@/types';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ConnectionButton from './ConnectionButton';
import UniversalWidgetEngine from './UniversalWidgetEngine/UniversalWidgetEngine';
import WidgetFooter from './WidgetFooter';

interface WidgetRendererProps {
  widget: Widget | PluggableWidget;
  isSelected: boolean;
  zoom: number;
  snapToGrid: boolean;
  gridSize: number;
}

export default function WidgetRenderer({
  widget,
  isSelected,
  zoom,
  snapToGrid,
  gridSize,
}: WidgetRendererProps) {
  const dispatch = useDispatch<AppDispatch>();
  const resizeState = useSelector((state: RootState) => state.widget.resizeState);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(widget.title || '');
  const [editingInitPrompt, setEditingInitPrompt] = useState(false);
  const [initPromptValue, setInitPromptValue] = useState(widget.init_prompt || '');
  const [showInitPromptInput, setShowInitPromptInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [initialPosition, setInitialPosition] = useState({ x: widget.x, y: widget.y });
  const [initialSize, setInitialSize] = useState({ width: widget.width, height: widget.height });
  const isGeneratingRef = useRef(false); // Prevent multiple simultaneous generations

  // Sync initPromptValue when widget.init_prompt changes (e.g., when toggling header visibility)
  useEffect(() => {
    setInitPromptValue(widget.init_prompt || '');
  }, [widget.init_prompt]);

  // Helper function to check if widget has meaningful user-generated content
  const hasWidgetContent = () => {
    if (!widget.content || typeof widget.content !== 'object') {
      return false;
    }

    // Check for content property (used by markdown, sticky notes)
    if ('content' in widget.content) {
      const content = widget.content.content;
      if (content && typeof content === 'string') {
        const trimmedContent = content.trim();
        // Ignore default/placeholder content from Markdown Editor
        const markdownEditorDefaults = [
          '# Welcome to Markdown Editor\n\nStart writing your markdown here...',
          '# Welcome to Markdown Editor',
          '',
        ];
        if (trimmedContent && !markdownEditorDefaults.includes(trimmedContent)) {
          return true;
        }
      }
    }

    // Check for text property (used by some widgets)
    if ('text' in widget.content) {
      const text = widget.content.text;
      if (text && typeof text === 'string' && text.trim() && text.trim() !== 'Add your note...') {
        return true;
      }
    }

    // Check for items property (used by todo lists)
    if ('items' in widget.content && Array.isArray(widget.content.items)) {
      // Make sure items array has actual content (not empty items)
      const hasRealItems = widget.content.items.some((item: any) => {
        if (!item || typeof item !== 'object') return false;
        // Check if item has text content
        if ('text' in item && item.text && typeof item.text === 'string' && item.text.trim()) {
          return true;
        }
        // Check if item has any meaningful properties
        return Object.values(item).some(val => val !== null && val !== undefined && val !== '');
      });
      if (hasRealItems) return true;
    }

    // Check for cards property (used by flashcards)
    if ('cards' in widget.content && Array.isArray(widget.content.cards)) {
      // Make sure cards array has actual content (not empty cards)
      const hasRealCards = widget.content.cards.some((card: any) => {
        if (!card || typeof card !== 'object') return false;
        // Check if card has front/back content
        if (
          ('front' in card && card.front && typeof card.front === 'string' && card.front.trim()) ||
          ('back' in card && card.back && typeof card.back === 'string' && card.back.trim())
        ) {
          return true;
        }
        return false;
      });
      if (hasRealCards) return true;
    }

    // Check for columns property (used by kanban boards)
    if ('columns' in widget.content && Array.isArray(widget.content.columns)) {
      // Check if any column has cards with content
      const hasRealColumns = widget.content.columns.some((column: any) => {
        if (!column || typeof column !== 'object') return false;
        if ('cards' in column && Array.isArray(column.cards) && column.cards.length > 0) {
          return column.cards.some((card: any) => {
            if (!card || typeof card !== 'object') return false;
            return Object.values(card).some(val => val && typeof val === 'string' && val.trim());
          });
        }
        return false;
      });
      if (hasRealColumns) return true;
    }

    // Check for messages property (used by chat widgets)
    if ('messages' in widget.content && Array.isArray(widget.content.messages)) {
      if (widget.content.messages.length > 0) return true;
    }

    // Check for data property (used by data widgets, tables, etc.)
    if ('data' in widget.content && Array.isArray(widget.content.data)) {
      if (widget.content.data.length > 0) {
        const hasRealData = widget.content.data.some((item: any) => {
          if (!item || typeof item !== 'object') return typeof item === 'string' && item.trim();
          return Object.values(item).some(val => val !== null && val !== undefined && val !== '');
        });
        if (hasRealData) return true;
      }
    }

    // Check for url property (used by webpage/iframe widgets)
    if ('url' in widget.content) {
      const url = widget.content.url;
      if (url && typeof url === 'string' && url.trim() && url.trim() !== 'https://example.com') {
        return true;
      }
    }

    return false;
  };

  // Memoize the placeholder prompt so it doesn't change on every render
  const placeholderPrompt = useMemo(() => {
    const pluggableWidget = widget as PluggableWidget;
    const blueprintName = pluggableWidget.widget_blueprint?.name?.toLowerCase() || '';

    // Define sample prompts for each category
    const stickyNotePrompts = [
      'Generate 10 tweets offering pro tips from senior engineers to junior engineers',
      'Create 5 motivational quotes for solo founders working on their startup',
      'Write 8 productivity tips for remote workers',
      'Generate 7 code review best practices for development teams',
      'Create 6 time management strategies for busy professionals',
      'Write 10 debugging tips that every developer should know',
      'Generate 5 team collaboration principles for async work',
      'Create 8 mental health reminders for tech workers',
    ];

    const todoPrompts = [
      'Create a list of 5 tasks for preparing a production deployment',
      'Generate a checklist for onboarding a new team member',
      'Create 7 steps for conducting a security audit',
      'List 6 tasks for setting up a new development environment',
      'Generate a task list for planning a product launch',
      'Create 8 steps for implementing a new feature from scratch',
      'List 5 tasks for optimizing database performance',
      'Generate a checklist for code review before merging',
    ];

    const kanbanPrompts = [
      'Generate a sprint board with user stories for a mobile app feature',
      'Create a project board for building a landing page',
      'Generate a task board for migrating to a new tech stack',
      'Create a sprint plan for implementing user authentication',
      'Generate a board for organizing a hackathon project',
      'Create a workflow for processing customer feedback',
      'Generate tasks for building a RESTful API',
      'Create a board for planning a website redesign',
    ];

    const tablePrompts = [
      'Create a comparison table of 5 popular JavaScript frameworks',
      'Generate a feature matrix comparing 4 cloud hosting providers',
      'Create a table comparing SQL vs NoSQL databases',
      'Generate a pricing comparison of 5 SaaS tools',
      'Create a table of programming language features',
      'Generate a comparison of testing frameworks',
      'Create a table of design pattern pros and cons',
      'Generate a feature comparison of CI/CD platforms',
    ];

    const markdownPrompts = [
      'Write a technical specification for a REST API authentication system',
      'Create documentation for a React component library',
      'Write a guide on implementing microservices architecture',
      'Generate a README for an open source project',
      'Write an architecture decision record for database selection',
      'Create a tutorial on building a full-stack application',
      'Write a post-mortem analysis template',
      'Generate a technical blog post about GraphQL',
    ];

    const chatPrompts = [
      'Act as a Python expert who helps debug code issues',
      'Be a technical interviewer for senior engineer positions',
      'Act as a code reviewer focusing on best practices',
      'Be a DevOps consultant helping with infrastructure',
      'Act as a UI/UX expert providing design feedback',
      'Be a database architect optimizing queries',
      'Act as a security expert reviewing code for vulnerabilities',
      'Be a performance optimization specialist',
    ];

    // Select appropriate prompts array based on widget type
    let prompts: string[];
    if (blueprintName.includes('sticky') || blueprintName.includes('note')) {
      prompts = stickyNotePrompts;
    } else if (blueprintName.includes('todo') || blueprintName.includes('task')) {
      prompts = todoPrompts;
    } else if (blueprintName.includes('kanban') || blueprintName.includes('board')) {
      prompts = kanbanPrompts;
    } else if (blueprintName.includes('table') || blueprintName.includes('spreadsheet')) {
      prompts = tablePrompts;
    } else if (blueprintName.includes('markdown') || blueprintName.includes('editor')) {
      prompts = markdownPrompts;
    } else if (blueprintName.includes('chat')) {
      prompts = chatPrompts;
    } else {
      prompts = ['Generate content based on your specific needs'];
    }

    // Pick a random prompt (only computed once when component mounts)
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    return `Generate content with a prompt, e.g., "${randomPrompt}"`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id]); // Only recompute when widget.id changes (i.e., new widget)

  const handleWidgetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(selectWidget(widget.id));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Don't start dragging if user is interacting with editable elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true' ||
      target.isContentEditable ||
      target.closest('input, textarea, [contenteditable="true"], [contenteditable]')
    ) {
      // Still select the widget but don't start dragging
      e.stopPropagation();
      dispatch(selectWidget(widget.id));
      return;
    }

    e.stopPropagation();
    dispatch(selectWidget(widget.id));

    const parentRect = widgetRef.current?.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    // Store initial position and size for change detection
    setInitialPosition({ x: widget.x, y: widget.y });
    setInitialSize({ width: widget.width, height: widget.height });

    // Calculate offset from mouse position to widget's position in world coordinates
    const offsetX = (e.clientX - parentRect.left) / zoom - widget.x;
    const offsetY = (e.clientY - parentRect.top) / zoom - widget.y;

    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);

    dispatch(
      startDragging({
        widgetId: widget.id,
        offset: { x: offsetX, y: offsetY },
      })
    );
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();

    // Store initial position and size for change detection
    setInitialPosition({ x: widget.x, y: widget.y });
    setInitialSize({ width: widget.width, height: widget.height });

    setIsResizing(true);

    dispatch(
      startResizing({
        widgetId: widget.id,
        handle,
        startSize: { width: widget.width, height: widget.height },
        startPosition: { x: widget.x, y: widget.y },
      })
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dispatch(deleteWidget(widget.id));
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingTitle(true);
  };

  const handleTitleSubmit = () => {
    setEditingTitle(false);
    dispatch(
      updateWidget({
        id: widget.id,
        data: { title: titleValue },
      })
    );
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
      setTitleValue(widget.title || '');
    }
  };

  const handleInitPromptClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingInitPrompt(true);
    setShowInitPromptInput(true);

    // Clear the _showInitPrompt flag when user starts editing
    if (widget.settings?._showInitPrompt) {
      const newSettings = { ...widget.settings };
      delete newSettings._showInitPrompt;
      dispatch(
        updateWidget({
          id: widget.id,
          data: { settings: newSettings },
        })
      );
    }
  };

  const handleInitPromptSubmit = async () => {
    setEditingInitPrompt(false);

    // Issue #3: Check if the prompt actually changed
    const hasChanged = initPromptValue !== (widget.init_prompt || '');

    // If empty or not changed, just cancel
    if (!initPromptValue || !initPromptValue.trim() || !hasChanged) {
      // Clear the _showInitPrompt flag if we're canceling
      if (widget.settings?._showInitPrompt) {
        const newSettings = { ...widget.settings };
        delete newSettings._showInitPrompt;
        dispatch(
          updateWidget({
            id: widget.id,
            data: { settings: newSettings },
          })
        );
      }
      // Reset to original value if not changed
      if (!hasChanged) {
        setInitPromptValue(widget.init_prompt || '');
      }
      return;
    }

    // Issue #4: Ask for confirmation before updating (will trigger AI generation)
    const confirmed = window.confirm(
      'Updating the AI prompt will regenerate the widget content. Do you want to continue?'
    );

    if (!confirmed) {
      // User canceled, reset to original value
      setInitPromptValue(widget.init_prompt || '');
      return;
    }

    // Prevent multiple simultaneous generations
    if (isGeneratingRef.current) {
      return;
    }

    // Save the init_prompt to the backend (but don't update content yet)
    try {
      // Clear the _showInitPrompt flag when saving
      const newSettings = { ...widget.settings };
      delete newSettings._showInitPrompt;

      await dispatch(
        updateWidget({
          id: widget.id,
          data: {
            init_prompt: initPromptValue,
            settings: newSettings,
          },
        })
      ).unwrap();
    } catch (error) {
      return; // Silently fail
    }

    // Hide the input and start generating
    setShowInitPromptInput(false);
    setIsGenerating(true);
    isGeneratingRef.current = true;

    try {
      // First, check which AI provider is being used
      const aiConfigResponse = await fetch('http://localhost:8081/api/ai-configs/default/current');
      if (!aiConfigResponse.ok) {
        setIsGenerating(false);
        isGeneratingRef.current = false;
        return;
      }

      const aiConfig = await aiConfigResponse.json();
      const isOllama = aiConfig.provider === 'ollama';

      // For Ollama, use the simple endpoint without tools
      // For other providers (OpenAI, Anthropic, Gemini), use the chat endpoint with tools
      const endpoint = isOllama ? '/api/ai/generate' : '/api/ai/chat';
      const requestBody = isOllama
        ? { prompt: initPromptValue }
        : { message: initPromptValue, conversation_history: [] };

      const response = await fetch(`http://localhost:8081${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const generatedContent = data.response || data.message;

        // Update widget content based on widget type
        const pluggableWidget = widget as PluggableWidget;
        const blueprintName = pluggableWidget.widget_blueprint?.name?.toLowerCase() || '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let updatedContent: Record<string, any> = {};

        if (blueprintName.includes('markdown') || blueprintName.includes('editor')) {
          updatedContent = { content: generatedContent };
        } else if (blueprintName.includes('sticky') || blueprintName.includes('note')) {
          updatedContent = { content: generatedContent };
        } else if (blueprintName.includes('todo') || blueprintName.includes('task')) {
          // Parse the response as tasks
          const tasks = generatedContent
            .split('\n')
            .filter((line: string) => line.trim())
            .map((line: string, index: number) => ({
              id: String(index),
              text: line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''),
              completed: false,
            }));
          updatedContent = { items: tasks };
        } else {
          // Default: store as plain content
          updatedContent = { content: generatedContent };
        }

        // Update the widget with generated content
        await dispatch(
          updateWidget({
            id: widget.id,
            data: { content: updatedContent },
          })
        ).unwrap();
      }
    } catch (error) {
      // Failed to generate content - silently fail
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  };

  const handleInitPromptKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInitPromptSubmit();
    } else if (e.key === 'Escape') {
      setEditingInitPrompt(false);
      setInitPromptValue(widget.init_prompt || '');
    }
  };

  // Update local title value when widget title changes
  useEffect(() => {
    setTitleValue(widget.title || '');
  }, [widget.title]);

  // Update local init_prompt value when widget init_prompt changes
  useEffect(() => {
    setInitPromptValue(widget.init_prompt || '');
  }, [widget.init_prompt]);

  // Global mouse event handlers for smooth dragging and resizing
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging && !isResizing) return;

      e.preventDefault();
      const parentRect = widgetRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      if (isDragging) {
        // Calculate new position based on mouse position and drag offset
        let newX = (e.clientX - parentRect.left) / zoom - dragOffset.x;
        let newY = (e.clientY - parentRect.top) / zoom - dragOffset.y;

        // Snap to grid if enabled
        if (snapToGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        dispatch(updateDragPosition({ x: newX, y: newY }));
      } else if (isResizing && resizeState.isResizing) {
        // Handle resize based on the resize handle direction
        const currentX = (e.clientX - parentRect.left) / zoom;
        const currentY = (e.clientY - parentRect.top) / zoom;

        const { handle, startSize, startPosition } = resizeState;
        let newWidth = startSize.width;
        let newHeight = startSize.height;
        let newX = startPosition.x;
        let newY = startPosition.y;

        // Calculate new dimensions and position based on resize handle
        // Each handle keeps the opposite corner fixed while moving the dragged corner
        const fixedTopLeft = { x: startPosition.x, y: startPosition.y };
        const fixedTopRight = { x: startPosition.x + startSize.width, y: startPosition.y };
        const fixedBottomLeft = { x: startPosition.x, y: startPosition.y + startSize.height };
        const fixedBottomRight = {
          x: startPosition.x + startSize.width,
          y: startPosition.y + startSize.height,
        };

        switch (handle) {
          case 'nw': // Top-left - keep bottom-right fixed
            newWidth = Math.max(100, fixedBottomRight.x - currentX);
            newHeight = Math.max(80, fixedBottomRight.y - currentY);
            newX = fixedBottomRight.x - newWidth;
            newY = fixedBottomRight.y - newHeight;
            break;
          case 'ne': // Top-right - keep bottom-left fixed
            newWidth = Math.max(100, currentX - fixedBottomLeft.x);
            newHeight = Math.max(80, fixedBottomLeft.y - currentY);
            newX = fixedBottomLeft.x;
            newY = fixedBottomLeft.y - newHeight;
            break;
          case 'sw': // Bottom-left - keep top-right fixed
            newWidth = Math.max(100, fixedTopRight.x - currentX);
            newHeight = Math.max(80, currentY - fixedTopRight.y);
            newX = fixedTopRight.x - newWidth;
            newY = fixedTopRight.y;
            break;
          case 'se': // Bottom-right - keep top-left fixed
            newWidth = Math.max(100, currentX - fixedTopLeft.x);
            newHeight = Math.max(80, currentY - fixedTopLeft.y);
            newX = fixedTopLeft.x;
            newY = fixedTopLeft.y;
            break;
        }

        // Apply grid snapping if enabled
        if (snapToGrid) {
          // Snap the mouse position to grid first, then recalculate
          const snappedX = Math.round(currentX / gridSize) * gridSize;
          const snappedY = Math.round(currentY / gridSize) * gridSize;

          // Recalculate with snapped mouse position
          switch (handle) {
            case 'nw': // Top-left - keep bottom-right fixed
              newWidth = Math.max(100, fixedBottomRight.x - snappedX);
              newHeight = Math.max(80, fixedBottomRight.y - snappedY);
              newX = fixedBottomRight.x - newWidth;
              newY = fixedBottomRight.y - newHeight;
              break;
            case 'ne': // Top-right - keep bottom-left fixed
              newWidth = Math.max(100, snappedX - fixedBottomLeft.x);
              newHeight = Math.max(80, fixedBottomLeft.y - snappedY);
              newX = fixedBottomLeft.x;
              newY = fixedBottomLeft.y - newHeight;
              break;
            case 'sw': // Bottom-left - keep top-right fixed
              newWidth = Math.max(100, fixedTopRight.x - snappedX);
              newHeight = Math.max(80, snappedY - fixedTopRight.y);
              newX = fixedTopRight.x - newWidth;
              newY = fixedTopRight.y;
              break;
            case 'se': // Bottom-right - keep top-left fixed
              newWidth = Math.max(100, snappedX - fixedTopLeft.x);
              newHeight = Math.max(80, snappedY - fixedTopLeft.y);
              newX = fixedTopLeft.x;
              newY = fixedTopLeft.y;
              break;
          }
        }

        dispatch(
          updateResizeSize({
            width: newWidth,
            height: newHeight,
            x: newX,
            y: newY,
          })
        );
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dispatch(stopDragging());

        // Only save position to backend if it actually changed
        const positionChanged = widget.x !== initialPosition.x || widget.y !== initialPosition.y;
        if (positionChanged) {
          // Saving position to backend
          dispatch(
            updateWidget({
              id: widget.id,
              data: { x: widget.x, y: widget.y },
            })
          );
        }
      }

      if (isResizing) {
        setIsResizing(false);
        dispatch(stopResizing());

        // Check if size or position changed during resize
        const sizeChanged =
          widget.width !== initialSize.width || widget.height !== initialSize.height;
        const positionChanged = widget.x !== initialPosition.x || widget.y !== initialPosition.y;

        if (sizeChanged || positionChanged) {
          // Saving resize changes to backend
          const updateData: Record<string, number> = {};

          if (sizeChanged) {
            updateData.width = widget.width;
            updateData.height = widget.height;
          }

          if (positionChanged) {
            updateData.x = widget.x;
            updateData.y = widget.y;
          }

          dispatch(
            updateWidget({
              id: widget.id,
              data: updateData,
            })
          );
        }
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, isResizing, dragOffset, zoom, snapToGrid, gridSize, widget, dispatch]);

  const renderWidgetContent = () => {
    // Create style props that widgets can use to override hard-coded colors
    // Note: backgroundColor is intentionally removed - widgets should use their own default backgrounds
    const widgetStyleProps = {
      textColor: widget.settings?.textColor || '#000000',
      fontSize: widget.settings?.fontSize || 14,
    };

    const pluggableWidget = widget as PluggableWidget;

    // Check if this is a pluggable widget with a blueprint
    if (pluggableWidget.widget_blueprint) {
      // All widgets now use the Universal Widget Engine system
      return (
        <UniversalWidgetEngine
          widget={pluggableWidget}
          blueprint={pluggableWidget.widget_blueprint}
          isSelected={isSelected}
          styleProps={widgetStyleProps}
        />
      );
    }

    // For any widget without a blueprint, show an error message
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="text-lg font-medium text-gray-900">Missing Widget Blueprint</div>
          <p className="text-sm text-gray-500">This widget is missing its blueprint data.</p>
          <div className="text-xs text-gray-400 mt-2">Widget ID: {widget.id}</div>
        </div>
      </div>
    );
  };

  const widgetStyle = {
    position: 'absolute' as const,
    left: widget.x,
    top: widget.y,
    width: widget.width,
    height: widget.height,
    zIndex: widget.z_index,
    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
    transition: isDragging ? 'none' : 'transform 0.2s ease',
    borderColor: widget.color || '#e5e7eb',
    borderWidth: `${widget.settings?.borderWidth || 1}px`,
    borderStyle: 'solid',
    borderRadius:
      widget.shape === 'circle'
        ? '50%'
        : widget.shape === 'rounded'
          ? `${widget.settings?.borderRadius || 8}px`
          : '0px',
    opacity: (widget.settings?.opacity || 100) / 100,
    boxShadow:
      widget.settings?.shadow === 'sm'
        ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        : widget.settings?.shadow === 'md'
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          : widget.settings?.shadow === 'lg'
            ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            : widget.settings?.shadow === 'xl'
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              : 'none',
  };

  // Special handling for sticky notes (check blueprint name)
  const pluggableWidget = widget as PluggableWidget;
  const isStickyNote = pluggableWidget.widget_blueprint?.name === 'Sticky Note';
  const isFlashcard = pluggableWidget.widget_blueprint?.name === 'Flash Cards';

  // Title header styles
  const titleHeaderStyle = {
    backgroundColor:
      widget.settings?.titleBackgroundColor ||
      widget.settings?.backgroundColor ||
      (isStickyNote ? 'transparent' : '#ffffff'),
    color: widget.settings?.textColor || '#374151',
    fontSize: `${widget.settings?.fontSize || 14}px`,
    fontFamily: 'Poppins, sans-serif',
  };
  const shapeClass =
    widget.shape === 'circle'
      ? 'rounded-full'
      : widget.shape === 'rounded'
        ? 'rounded-lg'
        : 'rounded';

  // Check if init prompt header is visible
  const hasInitPromptHeaderVisible =
    !isFlashcard &&
    ((!widget.init_prompt && !hasWidgetContent()) ||
      showInitPromptInput ||
      isGenerating ||
      !!widget.settings?._showInitPrompt);

  return (
    <div
      ref={widgetRef}
      style={widgetStyle}
      className={
        isStickyNote
          ? 'widget-container sticky-note-widget'
          : `widget-container ${shapeClass} ${isSelected ? 'selected' : ''} ${hasInitPromptHeaderVisible ? 'has-init-prompt-header' : ''}`
      }
      data-widget-id={widget.id}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={(e) => {
        // Don't un-hover if moving to the floating toolbar above
        const rect = widgetRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseY = e.clientY;
          const mouseX = e.clientX;
          // Keep hovered if cursor is in the zone above the widget (toolbar area)
          if (mouseY >= rect.top - 55 && mouseY < rect.top && mouseX >= rect.left && mouseX <= rect.right) {
            return;
          }
        }
        setIsHovered(false);
      }}
    >
      {/* Invisible hover extension zone above widget for toolbar access */}
      {isHovered && !isSelected && (
        <div
          className="absolute left-0 right-0 z-10"
          style={{ top: '-55px', height: '55px' }}
          onMouseLeave={() => setIsHovered(false)}
        />
      )}
      {/* Init Prompt Header - DISABLED for cleaner UX */}
      {false && (
          <div
            className={`widget-init-prompt-header ${shapeClass === 'rounded-full' ? 'rounded-t-full' : isStickyNote ? '' : 'rounded-t-lg'} border-b transition-opacity duration-300 ${isGenerating ? 'animate-pulse' : ''}`}
            style={{
              backgroundColor: 'rgba(156, 163, 175, 0.1)',
              borderBottomColor: 'rgba(156, 163, 175, 0.2)',
              fontSize: '12px',
              padding: '12px 16px',
              color: isGenerating ? '#FF5A78' : '#6B7280',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {isGenerating ? (
              <div className="flex items-center space-x-2">
                <svg
                  className="animate-spin h-4 w-4"
                  style={{ color: '#FF5A78' }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm italic" style={{ color: '#FF5A78' }}>
                  Generating content...
                </span>
              </div>
            ) : editingInitPrompt ? (
              <input
                type="text"
                value={initPromptValue}
                onChange={e => setInitPromptValue(e.target.value)}
                onBlur={handleInitPromptSubmit}
                onKeyDown={handleInitPromptKeyPress}
                onMouseDown={e => e.stopPropagation()}
                className="w-full bg-white/50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-3 py-2"
                style={{
                  fontSize: '16px',
                  fontFamily: 'Poppins, sans-serif',
                  color: '#000000',
                }}
                autoFocus
                placeholder={placeholderPrompt}
              />
            ) : (
              <Tooltip
                content={widget.init_prompt || placeholderPrompt}
                position="top"
                className="block w-full"
              >
                <div
                  className="cursor-pointer hover:bg-gray-100/50 rounded px-2 py-1 transition-colors overflow-hidden text-ellipsis whitespace-nowrap w-full"
                  onClick={handleInitPromptClick}
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    fontSize: '12px',
                    fontFamily: 'Poppins, sans-serif',
                    fontStyle: widget.init_prompt ? 'normal' : 'italic',
                    color: widget.init_prompt ? '#374151' : '#9CA3AF',
                  }}
                >
                  {widget.init_prompt || placeholderPrompt}
                </div>
              </Tooltip>
            )}
          </div>
        )}

      {/* Widget Header - hidden for sticky notes or when hideTitle setting is on */}
      {!isStickyNote && !widget.settings?.hideTitle && (
        <div
          className={`widget-header ${shapeClass === 'rounded-full' ? 'rounded-t-full' : 'rounded-t-lg'}`}
          style={titleHeaderStyle}
        >
          {editingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyPress}
              onMouseDown={e => e.stopPropagation()}
              className="bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 mr-2"
              style={{
                fontSize: 'inherit',
                fontFamily: 'inherit',
                fontWeight: '500',
                color: 'inherit',
                minWidth: '120px',
                maxWidth: 'calc(100% - 40px)',
              }}
              autoFocus
              placeholder="Enter widget title..."
            />
          ) : (
            <h3
              className="cursor-pointer hover:opacity-80 transition-opacity mr-2"
              onClick={handleTitleClick}
              onMouseDown={e => e.stopPropagation()}
              title="Click to edit title"
              style={{
                fontSize: 'inherit',
                fontFamily: 'inherit',
                fontWeight: '500',
                color: 'inherit',
                maxWidth: 'calc(100% - 40px)',
              }}
            >
              {titleValue || 'Untitled Widget'}
            </h3>
          )}
          {/* Delete button removed - use floating toolbar on hover instead */}
        </div>
      )}

      {/* Widget Content */}
      <div
        className={
          isStickyNote
            ? 'widget-content w-full h-full'
            : `widget-content ${widget.title ? '' : shapeClass}`
        }
        onMouseDown={isStickyNote ? undefined : e => e.stopPropagation()}
        onClick={handleWidgetClick}
        style={{
          cursor: 'default',
        }}
      >
        {renderWidgetContent()}
      </div>

      {/* Resize Handles - only on hover when NOT selected */}
      {isHovered && !isSelected && widget.shape !== 'circle' && (
        <>
          <div
            className="absolute w-2.5 h-2.5 bg-violet-500 rounded-full cursor-nw-resize shadow-md opacity-70 hover:opacity-100 transition-opacity"
            style={{ top: '-5px', left: '-5px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'nw')}
          />
          <div
            className="absolute w-2.5 h-2.5 bg-violet-500 rounded-full cursor-ne-resize shadow-md opacity-70 hover:opacity-100 transition-opacity"
            style={{ top: '-5px', right: '-5px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'ne')}
          />
          <div
            className="absolute w-2.5 h-2.5 bg-violet-500 rounded-full cursor-sw-resize shadow-md opacity-70 hover:opacity-100 transition-opacity"
            style={{ bottom: '-5px', left: '-5px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'sw')}
          />
          <div
            className="absolute w-2.5 h-2.5 bg-violet-500 rounded-full cursor-se-resize shadow-md opacity-70 hover:opacity-100 transition-opacity"
            style={{ bottom: '-5px', right: '-5px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'se')}
          />
        </>
      )}

      {/* Floating toolbar - appears ABOVE widget on hover, hidden when selected */}
      {isHovered && !isSelected && !isStickyNote && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gray-900/90 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-lg border border-white/10"
          style={{ top: '-40px' }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => {
              dispatch(selectWidget(widget.id));
              dispatch(openWidgetSettingsPanel(widget.id));
            }}
            className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Configure"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
