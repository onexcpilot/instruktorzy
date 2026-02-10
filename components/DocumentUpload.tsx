
import React, { useState } from 'react';
import { DOCUMENT_LABELS, MAX_FILE_SIZE } from '../constants';
import { DocumentRecord } from '../types';
import { apiUploadDocument } from '../services/api';

interface Props {
  userId: string;
  onUploadComplete: () => void;
}

const DocumentUpload: React.FC<Props> = ({ userId, onUploadComplete }) => {
  const [type, setType] = useState<DocumentRecord['type']>('medical');
  const [expiry, setExpiry] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length > 3) {
      setError('Mozesz wybrac maksymalnie 3 skany (strony) dla jednego dokumentu.');
      return;
    }

    const largeFile = selectedFiles.find(f => f.size > MAX_FILE_SIZE);
    if (largeFile) {
      setError(`Plik ${largeFile.name} przekracza 10MB.`);
      return;
    }

    const invalidFile = selectedFiles.find(f => !f.type.match(/image|pdf/));
    if (invalidFile) {
      setError('Dozwolone tylko obrazy i PDF.');
      return;
    }

    setFiles(selectedFiles);
    setError('');
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`Blad odczytu: ${file.name}`));
      reader.readAsDataURL(file);
    });
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
      // Przygotuj pliki jako base64
      const filePayloads = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          fileSize: file.size,
          fileData: await readFileAsBase64(file),
          mimeType: file.type,
        }))
      );

      // Wyslij do API (serwer uploaduje do Blob + zapisuje do MySQL)
      await apiUploadDocument(
        userId,
        DOCUMENT_LABELS[type],
        type,
        expiry || undefined,
        filePayloads
      );

      setFiles([]);
      setExpiry('');
      setIsUploading(false);
      alert('Dokument przeslany.');
      onUploadComplete();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Blad podczas wysylki dokumentu.');
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Data waznosci</label>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Skany / Zdjecia (wybierz do 3 plikow)
          </label>
          <p className="text-[10px] text-orange-600 font-bold mb-2 flex items-center">
            <i className="fas fa-exclamation-triangle mr-1"></i>
            Uwaga: Maksymalna wielkosc jednego pliku to 4.5MB (limit Vercel).
          </p>
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
                {files.length > 0 ? `${files.length} wybranych plikow` : 'Kliknij, aby wybrac do 3 skanow'}
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
          {isUploading ? 'Wysylam...' : 'Zapisz Dokument'}
        </button>
      </form>
    </div>
  );
};

export default DocumentUpload;
