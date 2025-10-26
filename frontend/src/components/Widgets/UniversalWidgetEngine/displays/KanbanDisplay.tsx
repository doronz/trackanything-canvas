/**
 * KanbanDisplay - Universal Widget System Display Component
 * Renders rich Kanban board with drag-and-drop task management
 */

import { AppDispatch } from '@/store';
import { updateWidgetContent } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

interface KanbanDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  tags: string[];
  createdAt: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color: string;
}

interface KanbanBoardContent {
  columns: KanbanColumn[];
}

export default function KanbanDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: KanbanDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();
  const content = widget.content as KanbanBoardContent;

  // Initialize default columns with some sample data for better UX
  const defaultColumns: KanbanColumn[] = [
    {
      id: '1',
      title: 'To Do',
      cards: [],
      color: 'bg-gray-100',
    },
    {
      id: '2',
      title: 'In Progress',
      cards: [],
      color: 'bg-blue-100',
    },
    {
      id: '3',
      title: 'Done',
      cards: [],
      color: 'bg-green-100',
    },
  ];

  const [columns, setColumns] = useState<KanbanColumn[]>(() => {
    // If content exists and has columns, use them; otherwise use defaults
    return content?.columns && content.columns.length > 0 ? content.columns : defaultColumns;
  });
  const [showAddCard, setShowAddCard] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<{ columnId: string; cardId: string } | null>(null);
  const [newCardData, setNewCardData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assignee: '',
    tags: '',
  });
  const [draggedCard, setDraggedCard] = useState<{ card: KanbanCard; fromColumn: string } | null>(
    null
  );

  // Prevent wheel events from propagating to canvas to avoid zoom conflicts
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  // Update columns when widget content changes (e.g., from database load)
  useEffect(() => {
    if (content?.columns && content.columns.length > 0) {
      // Only update if columns are actually different (deep comparison)
      const contentColumnsStr = JSON.stringify(content.columns);
      const currentColumnsStr = JSON.stringify(columns);
      if (contentColumnsStr !== currentColumnsStr) {
        setColumns(content.columns);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]); // Removed 'columns' to prevent infinite loop

  // Save content when it changes
  useEffect(() => {
    const newContent: KanbanBoardContent = {
      columns,
    };

    dispatch(
      updateWidgetContent({
        widgetId: widget.id,
        content: newContent,
      })
    );
  }, [columns, dispatch, widget.id]);

  const addCard = (columnId: string) => {
    if (!newCardData.title.trim()) return;

    const newCard: KanbanCard = {
      id: uuidv4(),
      title: newCardData.title.trim(),
      description: newCardData.description.trim(),
      priority: newCardData.priority,
      assignee: newCardData.assignee.trim() || undefined,
      tags: newCardData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
    };

    setColumns(prev =>
      prev.map(col => (col.id === columnId ? { ...col, cards: [...col.cards, newCard] } : col))
    );

    setNewCardData({
      title: '',
      description: '',
      priority: 'medium',
      assignee: '',
      tags: '',
    });
    setShowAddCard(null);
  };

  const updateCard = (columnId: string, cardId: string, updatedCard: Partial<KanbanCard>) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId
          ? {
              ...col,
              cards: col.cards.map(card =>
                card.id === cardId ? { ...card, ...updatedCard } : card
              ),
            }
          : col
      )
    );
    setEditingCard(null);
  };

  const deleteCard = (columnId: string, cardId: string) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, cards: col.cards.filter(card => card.id !== cardId) } : col
      )
    );
  };

  const moveCard = (cardId: string, fromColumnId: string, toColumnId: string) => {
    const fromColumn = columns.find(col => col.id === fromColumnId);
    const card = fromColumn?.cards.find(c => c.id === cardId);

    if (!card) return;

    setColumns(prev =>
      prev.map(col => {
        if (col.id === fromColumnId) {
          return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
        }
        if (col.id === toColumnId) {
          return { ...col, cards: [...col.cards, card] };
        }
        return col;
      })
    );
  };

  const handleDragStart = (card: KanbanCard, columnId: string) => {
    setDraggedCard({ card, fromColumn: columnId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toColumnId: string) => {
    e.preventDefault();
    if (draggedCard) {
      moveCard(draggedCard.card.id, draggedCard.fromColumn, toColumnId);
      setDraggedCard(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const CardForm = ({ columnId, card }: { columnId: string; card?: KanbanCard }) => {
    const [formData, setFormData] = useState({
      title: card?.title || newCardData.title,
      description: card?.description || newCardData.description,
      priority: card?.priority || newCardData.priority,
      assignee: card?.assignee || newCardData.assignee,
      tags: card?.tags.join(', ') || newCardData.tags,
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (card) {
        updateCard(columnId, card.id, {
          ...formData,
          tags: formData.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
        });
      } else {
        setNewCardData(formData);
        addCard(columnId);
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="bg-white p-3 rounded-lg border border-gray-200 space-y-3"
      >
        <input
          type="text"
          placeholder="Card title..."
          value={formData.title}
          onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        <textarea
          placeholder="Description..."
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex space-x-2">
          <select
            value={formData.priority}
            onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <input
            type="text"
            placeholder="Assignee..."
            value={formData.assignee}
            onChange={e => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <input
          type="text"
          placeholder="Tags (comma separated)..."
          value={formData.tags}
          onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => {
              setShowAddCard(null);
              setEditingCard(null);
            }}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formData.title.trim()}
            className="px-3 py-1 text-xs bg-gradient-to-r from-[#FF5A78] to-[#FFC850] text-white rounded hover:shadow-lg disabled:opacity-50"
          >
            {card ? 'Update' : 'Add'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div
      className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex flex-col"
      onWheel={handleWheel}
      style={{
        backgroundColor: styleProps?.backgroundColor || '#f9fafb',
        color: styleProps?.textColor || '#374151',
        fontSize: `${styleProps?.fontSize || 14}px`,
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {/* Columns */}
      <div className="flex-1 flex overflow-x-auto p-4 space-x-4">
        {columns.map(column => (
          <div
            key={column.id}
            className="min-w-80 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col"
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className={`p-3 ${column.color} dark:bg-gray-700 rounded-t-lg`}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {column.title} ({column.cards.length})
                </h3>
                <button
                  onClick={() => setShowAddCard(column.id)}
                  className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
              {column.cards.map(card => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => handleDragStart(card, column.id)}
                  className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-move hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {card.title}
                    </h4>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setEditingCard({ columnId: column.id, cardId: card.id })}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <PencilIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteCard(column.id, card.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {card.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {card.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${getPriorityColor(card.priority)}`}
                      >
                        {card.priority}
                      </span>
                      {card.assignee && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          @{card.assignee}
                        </span>
                      )}
                    </div>
                  </div>

                  {card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {card.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Add Card Form */}
              {showAddCard === column.id && <CardForm columnId={column.id} />}

              {/* Edit Card Form */}
              {editingCard?.columnId === column.id && (
                <CardForm
                  columnId={column.id}
                  card={column.cards.find(c => c.id === editingCard.cardId)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
