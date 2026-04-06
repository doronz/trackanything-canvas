/**
 * Hook for validating data against the Universal Widget data schema
 */

import { useMemo } from 'react';
import { UniversalDataSchema, UniversalField } from '@/types/universalWidget';

interface UseDataValidationReturn {
  validatedData: any;
  validationErrors: string[];
  isValid: boolean;
}

export function useDataValidation(data: any, schema: UniversalDataSchema): UseDataValidationReturn {
  const validation = useMemo(() => {
    const errors: string[] = [];
    let validatedData = data;

    // If no data, return empty array/object
    if (!data) {
      validatedData = Array.isArray(data) ? [] : {};
      return { validatedData, validationErrors: errors, isValid: true };
    }

    // If no schema or schema has no fields, return data as-is
    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      return { validatedData: data, validationErrors: [], isValid: true };
    }

    // Validate array of items
    if (Array.isArray(data)) {
      validatedData = data.map((item, index) => {
        return validateItem(item, schema.fields, errors, `Item ${index + 1}`);
      });
    }
    // Validate single item
    else if (typeof data === 'object') {
      // For completely empty objects on new widgets, skip validation
      if (Object.keys(data).length === 0) {
        validatedData = data;
      } else {
        validatedData = validateItem(data, schema.fields, errors, 'Data');
      }
    }
    // Invalid data type
    else {
      errors.push('Data must be an object or array of objects');
      validatedData = {};
    }

    return {
      validatedData,
      validationErrors: errors,
      isValid: errors.length === 0,
    };
  }, [data, schema]);

  return validation;
}

function validateItem(
  item: any,
  fields: UniversalField[],
  errors: string[],
  itemLabel: string
): any {
  const validatedItem: any = {};

  for (const field of fields) {
    const value = item[field.id];

    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${itemLabel}: ${field.name} is required`);
      continue;
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      validatedItem[field.id] = field.defaultValue || null;
      continue;
    }

    // Type validation and conversion
    let validatedValue = value;

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'richtext':
      case 'email':
      case 'url':
        validatedValue = String(value);
        break;

      case 'number':
        validatedValue = Number(value);
        if (isNaN(validatedValue)) {
          errors.push(`${itemLabel}: ${field.name} must be a valid number`);
          continue;
        }
        break;

      case 'boolean':
        validatedValue = Boolean(value);
        break;

      case 'date':
      case 'datetime':
        if (!(value instanceof Date) && typeof value === 'string') {
          validatedValue = new Date(value);
          if (isNaN(validatedValue.getTime())) {
            errors.push(`${itemLabel}: ${field.name} must be a valid date`);
            continue;
          }
        }
        break;

      case 'select':
        if (field.options && !field.options.includes(String(value))) {
          errors.push(`${itemLabel}: ${field.name} must be one of: ${field.options.join(', ')}`);
          continue;
        }
        validatedValue = String(value);
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          errors.push(`${itemLabel}: ${field.name} must be an array`);
          continue;
        }
        if (field.options) {
          const invalidOptions = value.filter(v => !field.options!.includes(String(v)));
          if (invalidOptions.length > 0) {
            errors.push(
              `${itemLabel}: ${field.name} contains invalid options: ${invalidOptions.join(', ')}`
            );
            continue;
          }
        }
        validatedValue = value.map(String);
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          errors.push(`${itemLabel}: ${field.name} must be a valid email address`);
          continue;
        }
        validatedValue = String(value);
        break;

      case 'url':
        try {
          new URL(String(value));
          validatedValue = String(value);
        } catch {
          errors.push(`${itemLabel}: ${field.name} must be a valid URL`);
          continue;
        }
        break;

      case 'color':
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!colorRegex.test(String(value))) {
          errors.push(`${itemLabel}: ${field.name} must be a valid hex color (e.g., #FF0000)`);
          continue;
        }
        validatedValue = String(value);
        break;

      case 'json':
        if (typeof value === 'string') {
          try {
            validatedValue = JSON.parse(value);
          } catch {
            errors.push(`${itemLabel}: ${field.name} must be valid JSON`);
            continue;
          }
        } else if (typeof value === 'object') {
          validatedValue = value;
        } else {
          errors.push(`${itemLabel}: ${field.name} must be a JSON object`);
          continue;
        }
        break;

      default:
        validatedValue = value;
    }

    // Validation rules
    if (field.validation) {
      const validation = field.validation;

      // Min/Max validation for numbers
      if (field.type === 'number' && typeof validatedValue === 'number') {
        if (validation.min !== undefined && validatedValue < validation.min) {
          errors.push(`${itemLabel}: ${field.name} must be at least ${validation.min}`);
          continue;
        }
        if (validation.max !== undefined && validatedValue > validation.max) {
          errors.push(`${itemLabel}: ${field.name} must be at most ${validation.max}`);
          continue;
        }
      }

      // Length validation for strings
      if (typeof validatedValue === 'string') {
        if (validation.min !== undefined && validatedValue.length < validation.min) {
          errors.push(`${itemLabel}: ${field.name} must be at least ${validation.min} characters`);
          continue;
        }
        if (validation.max !== undefined && validatedValue.length > validation.max) {
          errors.push(`${itemLabel}: ${field.name} must be at most ${validation.max} characters`);
          continue;
        }
      }

      // Pattern validation
      if (validation.pattern && typeof validatedValue === 'string') {
        const pattern = new RegExp(validation.pattern);
        if (!pattern.test(validatedValue)) {
          errors.push(
            `${itemLabel}: ${field.name} ${validation.message || 'does not match the required pattern'}`
          );
          continue;
        }
      }
    }

    validatedItem[field.id] = validatedValue;
  }

  return validatedItem;
}
