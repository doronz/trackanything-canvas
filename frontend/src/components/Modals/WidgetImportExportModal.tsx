import React from 'react';
import BaseModal from './BaseModal';
import WidgetImportExport from '../Widgets/WidgetImportExport';
import { Widget } from '@/types';

interface WidgetImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget?: Widget;
  referencePosition?: { x: number; y: number };
  onImportSuccess?: (widget: Widget) => void;
  exportOnly?: boolean;
}

export default function WidgetImportExportModal({
  isOpen,
  onClose,
  widget,
  referencePosition,
  onImportSuccess,
  exportOnly = false,
}: WidgetImportExportModalProps) {
  const getTitle = () => {
    if (exportOnly && widget) return 'Export Widget';
    if (widget) return 'Export / Import Widget';
    return 'Import Widget';
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={getTitle()} size="md">
      <WidgetImportExport
        widget={widget}
        referencePosition={referencePosition}
        onImportSuccess={onImportSuccess}
        onClose={onClose}
        exportOnly={exportOnly}
      />
    </BaseModal>
  );
}
