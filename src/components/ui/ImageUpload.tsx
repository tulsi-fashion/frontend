'use client';
import { useRef, useState, useCallback } from 'react';
import { X, ImageIcon, CheckCircle2, AlertCircle, Loader2, Plus, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { api } from '../../lib/api';
import { showToast } from './Toast';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

type FileEntry = {
  id: string;
  file: File;
  previewUrl: string;
  status: FileStatus;
  publicUrl?: string;
  errorMsg?: string;
};

type Props = {
  value?: string;
  onChange?: (url: string) => void;
  onMultipleChange?: (urls: string[]) => void;
  existingUrls?: string[];
  onRemoveExisting?: (url: string) => void;
  multiple?: boolean;
  folder?: string;
  label?: string;
  compact?: boolean;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ImageUpload({
  value,
  onChange,
  onMultipleChange,
  existingUrls,
  onRemoveExisting,
  multiple = false,
  folder = 'products',
  label,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const existingImages: string[] = existingUrls && existingUrls.length > 0
    ? existingUrls
    : value ? [value] : [];

  const setStatus = useCallback((id: string, patch: Partial<FileEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  async function startUpload(newEntries: FileEntry[]) {
    setBusy(true);
    try {
      const presignRes = await api.post('/api/uploads/presign', {
        folder,
        files: newEntries.map(e => ({
          filename: e.file.name,
          contentType: e.file.type,
          size: e.file.size,
        })),
      });

      const slots: Array<{ uploadUrl: string; publicUrl: string; key: string }> =
        presignRes?.success?.data?.files ?? [];

      if (slots.length !== newEntries.length) {
        newEntries.forEach(e =>
          setStatus(e.id, { status: 'error', errorMsg: 'Server did not return upload URLs' })
        );
        showToast('Failed to get upload URLs', 'error');
        setBusy(false);
        return;
      }

      const uploaded: string[] = [];

      for (let i = 0; i < newEntries.length; i++) {
        const entry = newEntries[i];
        const { uploadUrl, publicUrl } = slots[i];
        setStatus(entry.id, { status: 'uploading' });
        try {
          await axios.put(uploadUrl, entry.file, {
            headers: { 'Content-Type': entry.file.type },
          });
          setStatus(entry.id, { status: 'done', publicUrl });
          uploaded.push(publicUrl);
        } catch (err: any) {
          const status = err?.response?.status;
          const msg = !status
            ? 'CORS error — check R2 bucket CORS settings'
            : `Upload failed: ${status}`;
          setStatus(entry.id, { status: 'error', errorMsg: msg });
        }
      }

      if (uploaded.length > 0) {
        if (multiple && onMultipleChange) {
          onMultipleChange(uploaded);
        } else if (onChange) {
          onChange(uploaded[0]);
        }
        showToast(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} uploaded`);
      }

      // clear done entries — they now appear in existingUrls
      setEntries(prev => {
        prev.filter(e => e.status === 'done').forEach(e => URL.revokeObjectURL(e.previewUrl));
        return prev.filter(e => e.status !== 'done');
      });
    } catch {
      showToast('Upload failed. Check your connection.', 'error');
      newEntries.forEach(e => setStatus(e.id, { status: 'error', errorMsg: 'Upload failed' }));
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(fileList: FileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    const newEntries: FileEntry[] = files.map(f => ({
      id: uid(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'pending',
    }));
    setEntries(prev => multiple ? [...prev, ...newEntries] : newEntries);
    startUpload(newEntries);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!busy && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }

  function removeEntry(id: string) {
    setEntries(prev => {
      const entry = prev.find(e => e.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter(e => e.id !== id);
    });
  }

  function retryEntry(entry: FileEntry) {
    setStatus(entry.id, { status: 'pending', errorMsg: undefined });
    startUpload([entry]);
  }

  // ── Compact mode ──────────────────────────────────────────────────────
  if (compact) {
    const displayUrl = entries.find(e => e.status === 'done')?.publicUrl || value;
    const compactBusy = entries.some(e => e.status === 'uploading' || e.status === 'pending');

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {displayUrl && (
          <div className="relative group">
            <img src={displayUrl} alt="photo" className="w-10 h-10 rounded-lg object-cover border border-[#e5e9f0]" />
            <button
              type="button"
              onClick={() => { removeEntry(entries[0]?.id); if (onChange) onChange(''); }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#b32642] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => !compactBusy && inputRef.current?.click()}
          disabled={compactBusy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e9f0] text-xs text-[#798397] hover:border-[#237a59] hover:text-[#237a59] transition-colors disabled:opacity-60"
        >
          {compactBusy
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
            : <>{displayUrl ? 'Change' : 'Upload'}</>
          }
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          multiple={multiple} className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)} />
      </div>
    );
  }

  // ── Full grid mode ────────────────────────────────────────────────────
  const hasAny = existingImages.length > 0 || entries.length > 0;

  return (
    <div>
      {label && (
        <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}

      {hasAny ? (
        <div className="flex flex-wrap gap-2">
          {/* Existing (uploaded) images */}
          {existingImages.map((url, idx) => (
            <div key={url + idx} className="relative group w-20 h-20 shrink-0">
              <img
                src={url}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full rounded-xl object-cover border-2 border-[#237a59]"
              />
              <div className="absolute bottom-1 right-1 pointer-events-none">
                <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" fill="#237a59" />
              </div>
              {onRemoveExisting && (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(url)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#b32642] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}

          {/* In-progress entries */}
          {entries.map(entry => (
            <div key={entry.id} className="relative group w-20 h-20 shrink-0">
              <img
                src={entry.previewUrl}
                alt={entry.file.name}
                className={`w-full h-full rounded-xl object-cover border-2 transition-all ${
                  entry.status === 'error' ? 'border-[#b32642]' : 'border-[#237a59]/40'
                }`}
              />

              {/* Status overlay */}
              {(entry.status === 'uploading' || entry.status === 'pending') && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
              {entry.status === 'done' && (
                <div className="absolute bottom-1 right-1 pointer-events-none">
                  <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" fill="#237a59" />
                </div>
              )}
              {entry.status === 'error' && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center gap-1">
                  <AlertCircle className="w-5 h-5 text-white" />
                  <button
                    type="button"
                    onClick={() => retryEntry(entry)}
                    className="flex items-center gap-0.5 text-[10px] text-white font-bold"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Retry
                  </button>
                </div>
              )}

              {/* Remove */}
              {entry.status !== 'uploading' && entry.status !== 'pending' && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#20283b] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}

          {/* Add more / replace button */}
          <button
            type="button"
            onClick={() => !busy && inputRef.current?.click()}
            disabled={busy}
            className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-[#e5e9f0] hover:border-[#237a59] flex flex-col items-center justify-center gap-1 text-[#b0bac9] hover:text-[#237a59] transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-medium">{multiple ? 'Add more' : 'Replace'}</span>
          </button>
        </div>
      ) : (
        /* Empty drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => !busy && inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-[#e5e9f0] hover:border-[#237a59] hover:bg-[#f9feff] cursor-pointer transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-[#f0f4f8] flex items-center justify-center">
            {busy
              ? <Loader2 className="w-5 h-5 text-[#237a59] animate-spin" />
              : <ImageIcon className="w-5 h-5 text-[#b0bac9]" />
            }
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#20283b]">
              {busy ? 'Uploading…' : `Click to upload${multiple ? ' multiple photos' : ' a photo'}`}
            </p>
            {!busy && <p className="text-xs text-[#b0bac9] mt-0.5">or drag & drop here</p>}
            {!busy && <p className="text-[11px] text-[#c2cad6] mt-1">JPEG · PNG · WebP · GIF · max 10 MB each</p>}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
