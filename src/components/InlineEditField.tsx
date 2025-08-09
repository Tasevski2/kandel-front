'use client';

import { useState } from 'react';

interface InlineEditFieldProps {
  label: string;
  value: string | number;
  onSave: (value: string) => Promise<void>;
  validate?: (value: string) => string | null;
  inputType?: 'text' | 'number';
  inputClass?: string;
  min?: string | number;
  max?: string | number;
  displayFormatter?: (value: string | number) => string;
  editTooltip?: string;
}

export function InlineEditField({
  label,
  value,
  onSave,
  validate,
  inputType = 'text',
  inputClass = 'w-20',
  min,
  max,
  displayFormatter,
  editTooltip = 'Edit',
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setTempValue(value.toString());
    setIsEditing(true);
    setError(null);
  };

  const handleSave = async () => {
    // Validate if validation function is provided
    if (validate) {
      const validationError = validate(tempValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave(tempValue);
      setIsEditing(false);
      setError(null);
    } catch (error) {
      setError('Failed to update value');
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setTempValue('');
    setError(null);
  };

  return (
    <div className='flex flex-col'>
      <span className='text-xs text-slate-500 mb-1'>{label}</span>
      <div className='flex items-center gap-2'>
        {isEditing ? (
          <>
            <input
              type={inputType}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className={`input text-sm h-8 ${inputClass}`}
              min={min}
              max={max}
              disabled={isSaving}
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className='text-green-400 hover:text-green-300 text-sm px-2 py-1 rounded disabled:opacity-50'
            >
              ✓
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className='text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded disabled:opacity-50'
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span className='text-slate-200 font-medium text-lg'>
              {displayFormatter ? displayFormatter(value) : value}
            </span>
            <button
              onClick={handleEdit}
              className='text-slate-400 hover:text-slate-200 text-sm px-2 py-1 rounded hover:bg-slate-700/50'
              title={editTooltip}
            >
              ✏️
            </button>
          </>
        )}
      </div>
      {error && (
        <div className='text-red-400 text-xs mt-1'>{error}</div>
      )}
    </div>
  );
}