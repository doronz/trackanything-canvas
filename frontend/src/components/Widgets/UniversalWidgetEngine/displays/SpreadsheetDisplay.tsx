/**
 * SpreadsheetDisplay - Universal Widget System Spreadsheet Display Component
 * Renders data as an editable spreadsheet with add/remove columns and rows
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateWidget } from '@/store/widgetSlice';
import { PlusIcon, TrashIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface SpreadsheetDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface SpreadsheetData {
  columns: string[];
  rows: string[][];
}

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

export default function SpreadsheetDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: SpreadsheetDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();

  // Initialize spreadsheet data with default structure if empty
  const getInitialData = (): SpreadsheetData => {
    if (widget.content?.columns && widget.content?.rows) {
      return {
        columns: widget.content.columns,
        rows: widget.content.rows,
      };
    }

    // Default: 3 columns, 2 rows
    return {
      columns: ['Column 1', 'Column 2', 'Column 3'],
      rows: [
        ['', '', ''],
        ['', '', ''],
      ],
    };
  };

  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData>(getInitialData());
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

  // Use ref to store the latest onDataChange callback to avoid stale closures
  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  // Debounced save function - make it stable by using ref for onDataChange
  const debouncedSave = useCallback(
    debounce((data: SpreadsheetData) => {
      const updatedContent = {
        ...widget.content,
        columns: data.columns,
        rows: data.rows,
      };

      dispatch(
        updateWidget({
          id: widget.id,
          data: { content: updatedContent },
        })
      );

      // Also call onDataChange for compatibility using ref to get latest version
      onDataChangeRef.current({
        columns: data.columns,
        rows: data.rows,
      });
    }, 500),
    [dispatch, widget.id, widget.content] // Stable dependencies
  );

  // Save data whenever it changes
  useEffect(() => {
    debouncedSave(spreadsheetData);
  }, [spreadsheetData]); // Removed debouncedSave from dependencies to prevent infinite loop

  // Add a new column
  const addColumn = () => {
    const newColumnName = `Column ${spreadsheetData.columns.length + 1}`;
    const newColumns = [...spreadsheetData.columns, newColumnName];
    const newRows = spreadsheetData.rows.map(row => [...row, '']);

    setSpreadsheetData({
      columns: newColumns,
      rows: newRows,
    });
  };

  // Remove a column
  const removeColumn = (columnIndex: number) => {
    if (spreadsheetData.columns.length <= 1) return; // Keep at least one column

    const newColumns = spreadsheetData.columns.filter((_, index) => index !== columnIndex);
    const newRows = spreadsheetData.rows.map(row =>
      row.filter((_, index) => index !== columnIndex)
    );

    setSpreadsheetData({
      columns: newColumns,
      rows: newRows,
    });
  };

  // Add a new row
  const addRow = () => {
    const newRow = new Array(spreadsheetData.columns.length).fill('');
    setSpreadsheetData({
      ...spreadsheetData,
      rows: [...spreadsheetData.rows, newRow],
    });
  };

  // Remove a row
  const removeRow = (rowIndex: number) => {
    if (spreadsheetData.rows.length <= 1) return; // Keep at least one row

    const newRows = spreadsheetData.rows.filter((_, index) => index !== rowIndex);
    setSpreadsheetData({
      ...spreadsheetData,
      rows: newRows,
    });
  };

  // Update column header
  const updateColumnHeader = (columnIndex: number, newName: string) => {
    const newColumns = [...spreadsheetData.columns];
    newColumns[columnIndex] = newName;
    setSpreadsheetData({
      ...spreadsheetData,
      columns: newColumns,
    });
  };

  // Update cell content
  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const newRows = [...spreadsheetData.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][columnIndex] = value;
    setSpreadsheetData({
      ...spreadsheetData,
      rows: newRows,
    });
  };

  const handleCellClick = (rowIndex: number, columnIndex: number) => {
    setEditingCell({ row: rowIndex, col: columnIndex });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, columnIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Move to next cell
      const nextCol = columnIndex + 1;
      const nextRow = nextCol >= spreadsheetData.columns.length ? rowIndex + 1 : rowIndex;
      const finalCol = nextCol >= spreadsheetData.columns.length ? 0 : nextCol;

      if (nextRow < spreadsheetData.rows.length) {
        setEditingCell({ row: nextRow, col: finalCol });
      } else {
        setEditingCell(null);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg p-4"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
        backgroundColor: styleProps?.backgroundColor || '#ffffff',
      }}
    >
      {/* Table Controls */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          onClick={addColumn}
          className="flex items-center px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Column
        </button>
        <button
          onClick={addRow}
          className="flex items-center px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Row
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4 mr-1" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse border border-gray-300 min-w-full">
          {/* Header */}
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              {spreadsheetData.columns.map((column, columnIndex) => (
                <th
                  key={columnIndex}
                  className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left relative group"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={column}
                      onChange={e => updateColumnHeader(columnIndex, e.target.value)}
                      className="bg-transparent border-none outline-none w-full font-medium text-gray-900 dark:text-white"
                      style={{
                        fontSize: `${styleProps?.fontSize || 14}px`,
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    />
                    {spreadsheetData.columns.length > 1 && (
                      <button
                        onClick={() => removeColumn(columnIndex)}
                        className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-red-500 hover:text-red-700 transition-opacity"
                        title="Remove column"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-12"></th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {spreadsheetData.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="group hover:bg-gray-50 dark:hover:bg-gray-700">
                {row.map((cell, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="border border-gray-300 dark:border-gray-600 px-2 py-2"
                  >
                    {editingCell?.row === rowIndex && editingCell?.col === columnIndex ? (
                      <input
                        type="text"
                        value={cell}
                        onChange={e => updateCell(rowIndex, columnIndex, e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={e => handleCellKeyDown(e, rowIndex, columnIndex)}
                        className="w-full border-none outline-none bg-transparent text-gray-900 dark:text-white"
                        style={{
                          fontSize: `${styleProps?.fontSize || 14}px`,
                          fontFamily: 'Poppins, sans-serif',
                        }}
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(rowIndex, columnIndex)}
                        className="min-h-[20px] cursor-text hover:bg-blue-50 dark:hover:bg-blue-900 px-1 py-0.5 rounded text-gray-900 dark:text-white"
                        style={{
                          fontSize: `${styleProps?.fontSize || 14}px`,
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        {cell || ''}
                      </div>
                    )}
                  </td>
                ))}
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center">
                  {spreadsheetData.rows.length > 1 && (
                    <button
                      onClick={() => removeRow(rowIndex)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 transition-opacity"
                      title="Remove row"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Instructions */}
      {spreadsheetData.rows.length === 1 && spreadsheetData.rows[0].every(cell => !cell.trim()) && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Getting started:</strong> Click on any cell to edit it. Use the buttons above to
            add more columns or rows. Press Tab to move to the next cell, Enter to finish editing.
          </p>
        </div>
      )}
    </div>
  );
}
