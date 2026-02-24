import React, { useState, useRef } from 'react';
import { Paperclip, X, Image, FileText, File, Upload, Loader2 } from 'lucide-react';

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'file';
  size: number;
  data: string;
  preview?: string;
}

interface FileAttachmentsProps {
  onAttach: (files: Attachment[]) => void;
  maxSize?: number;
  allowedTypes?: string[];
}

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (type: Attachment['type']) => {
  switch (type) {
    case 'image':
      return Image;
    case 'pdf':
      return FileText;
    default:
      return File;
  }
};

export const FileAttachments: React.FC<FileAttachmentsProps> = ({
  onAttach,
  maxSize = 10 * 1024 * 1024, // 10MB default
  allowedTypes = ['image/*', 'application/pdf', '.txt', '.md', '.json', '.js', '.ts'],
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<Attachment | null> => {
    if (file.size > maxSize) {
      console.warn(`File ${file.name} exceeds max size of ${formatFileSize(maxSize)}`);
      return null;
    }

    const type: Attachment['type'] = file.type.startsWith('image/')
      ? 'image'
      : file.type === 'application/pdf'
      ? 'pdf'
      : 'file';

    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const attachment: Attachment = {
          id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type,
          size: file.size,
          data: reader.result as string,
        };

        if (type === 'image') {
          attachment.preview = reader.result as string;
        }

        resolve(attachment);
      };

      reader.onerror = () => {
        console.error(`Failed to read file: ${file.name}`);
        resolve(null);
      };

      if (type === 'image') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    setIsLoading(true);
    const newAttachments: Attachment[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const attachment = await processFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    if (newAttachments.length > 0) {
      const updated = [...attachments, ...newAttachments];
      setAttachments(updated);
      onAttach(updated);
    }

    setIsLoading(false);
  };

  const handleRemove = (id: string) => {
    const updated = attachments.filter(a => a.id !== id);
    setAttachments(updated);
    onAttach(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          accept={allowedTypes.join(',')}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center gap-2">
          {isLoading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processing files...</p>
            </>
          ) : (
            <>
              <Upload className={cn(
                'w-8 h-8 transition-colors',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )} />
              <p className="text-sm text-muted-foreground">
                Drag & drop files here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-muted-foreground">
                Images, PDFs, and code files up to {formatFileSize(maxSize)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.type);
            
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 bg-muted rounded-lg"
              >
                {attachment.type === 'image' && attachment.preview ? (
                  <div className="w-10 h-10 rounded overflow-hidden bg-background flex-shrink-0">
                    <img
                      src={attachment.preview}
                      alt={attachment.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-background flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.type.toUpperCase()} • {formatFileSize(attachment.size)}
                  </p>
                </div>
                
                <button
                  onClick={() => handleRemove(attachment.id)}
                  className="p-1 hover:bg-background rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileAttachments;
