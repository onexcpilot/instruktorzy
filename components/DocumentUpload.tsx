
import React, { useState } from 'react';
import { DOCUMENT_LABELS, MAX_FILE_SIZE } from '../constants';
import { DocumentRecord, DocumentAttachment } from '../types';

interface Props {
  onUpload: (doc: DocumentRecord) => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

const DocumentUpload: React.FC<Props> = ({ onUpload }) => {
  const [type, setType] = useState<DocumentRecord['type']>('medical');
  const [expiry, setExpiry] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length > 3) {
      setError('Możesz wybrać maksymalnie 3 skany (strony) dla jednego dokumentu.');
      return;
    }

    const largeFile = selectedFiles.find(f => f.size > MAX_FILE_SIZE);
    if (largeFile) {
      setError(`Plik ${largeFile.name} przekracza 10MB.`);
      return;
    }

    // Sprawdzenie typu MIME
    const invalidFile = selectedFiles.find(f => !f.type.match(/image|pdf/));
    if (invalidFile) {
      setError('Dozwolone tylko obrazy i PDF.');
      return;
    }

    setFiles(selectedFiles);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Wybierz co najmniej jeden plik.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Funkcja do odczytania pliku jako base64 z Promise
      const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error(`Błąd odczytu: ${file.name}`));
          reader.readAsDataURL(file);
        });
      };

      // Funkcja do wysłania pliku na backend
      const uploadFile = async (file: File, base64: string): Promise<DocumentAttachment> => {
        const response = await fetch(`${API_URL}/api/upload-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileData: base64,
            mimeType: file.type
          })
        });

        if (!response.ok) {
          throw new Error(`Błąd wysyłki: ${file.name}`);
        }

        const data = await response.json();
        return {
          id: Math.random().toString(36).substring(7),
          fileName: file.name,
          fileSize: file.size,
          fileUrl: data.fileUrl // Vercel Blob returns absolute URL
        };
      };

      // Promise.all - czeka aż WSZYSTKIE pliki będą uploaded
      const uploadPromises = files.map(async (file) => {
        const base64 = await readFileAsBase64(file);
        return uploadFile(file, base64);
      });

      const attachments = await Promise.all(uploadPromises);

      // Teraz gdy wszystkie pliki są uploaded - dodaj dokument
      const newDoc: DocumentRecord = {
        id: Math.random().toString(36).substring(7),
        name: DOCUMENT_LABELS[type],
        type,
        expiryDate: expiry || undefined,
        attachments,
        uploadDate: new Date().toISOString(),
        status: 'pending_review',
      };

      onUpload(newDoc);
      setFiles([]);
      setExpiry('');
      setIsUploading(false);
      alert('Dokument (z wszystkimi stronami) został przesłany.');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Błąd podczas wysyłki dokumentu.');
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
      <h3 className="text-lg font-bold mb-4 flex items-center text-slate-800">
        <i className="fas fa-folder-plus mr-2 text-blue-600"></i>
        Dodaj Dokument (Max 3 strony)
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Typ dokumentu</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none transition"
          >
            {Object.entries(DOCUMENT_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data ważności</label>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Skany / Zdjęcia (wybierz do 3 plików)
          </label>
          <div className="relative border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-blue-400 transition group bg-slate-50">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center">
              <i className="fas fa-images text-2xl text-slate-400 mb-2 group-hover:text-blue-500 transition"></i>
              <p className="text-xs text-slate-500">
                {files.length > 0 ? `${files.length} wybranych plików` : 'Kliknij, aby wybrać do 3 skanów'}
              </p>
            </div>
          </div>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="text-xs text-blue-600 flex items-center">
                  <i className="fas fa-paperclip mr-1"></i> {f.name} ({(f.size / 1024 / 1024).toFixed(2)}MB)
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-red-600 text-xs font-bold animate-pulse">{error}</p>}

        <button
          type="submit"
          disabled={isUploading}
          className={`w-full font-bold py-2 rounded-lg transition shadow-lg active:scale-95 flex items-center justify-center ${isUploading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'} mr-2`}></i>
          {isUploading ? 'Wysyłam...' : 'Zapisz Dokument'}
        </button>
      </form>
    </div>
  );
};

export default DocumentUpload;
