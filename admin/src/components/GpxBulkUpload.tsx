import React, { useState, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction, 
  IconButton, 
  Button, 
  CircularProgress,
  Divider,
  Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { apiFetch } from '../hooks/api';

interface GpxBulkUploadProps {
  onUploadSuccess: () => void;
  onNotify: (message: string, severity?: 'success' | 'error') => void;
}

const GpxBulkUpload: React.FC<GpxBulkUploadProps> = ({ onUploadSuccess, onNotify }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.gpx'));
      if (newFiles.length === 0) {
        onNotify('Please drop only .gpx files', 'error');
        return;
      }
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, [onNotify]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const newFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.gpx'));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      await apiFetch('/api/v1/admin/trails/bulk-upload-gpx', {
        method: 'POST',
        body: formData,
        // No Content-Type header so browser sets it with boundary
      });
      onNotify(`Successfully uploaded ${files.length} trails`, 'success');
      setFiles([]);
      onUploadSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      onNotify('Failed to upload GPX files', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Paper
        variant="outlined"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 3,
          textAlign: 'center',
          backgroundColor: dragActive ? 'action.hover' : 'background.paper',
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'divider',
          cursor: 'pointer',
          mb: 2
        }}
        onClick={() => document.getElementById('gpx-upload-input')?.click()}
      >
        <input
          id="gpx-upload-input"
          type="file"
          multiple
          accept=".gpx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6">
          Drag 'n' drop GPX files here
        </Typography>
        <Typography variant="body2" color="text.secondary">
          or click to select files
        </Typography>
      </Paper>

      {files.length > 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
            Trails ready to be created ({files.length}):
          </Typography>
          <List dense sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
            {files.map((file, index) => (
              <React.Fragment key={`${file.name}-${index}`}>
                <ListItem>
                  <ListItemText 
                    primary={file.name} 
                    secondary={`${(file.size / 1024).toFixed(1)} KB`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" aria-label="delete" onClick={() => removeFile(index)} disabled={uploading}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < files.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
            <Button 
              variant="outlined" 
              onClick={() => setFiles([])} 
              disabled={uploading}
            >
              Clear All
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSubmit} 
              disabled={uploading}
              startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {uploading ? 'Uploading...' : 'Submit All Trails'}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default GpxBulkUpload;
