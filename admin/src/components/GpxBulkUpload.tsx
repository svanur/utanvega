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
  TextField,
  Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { apiFetch } from '../hooks/api';

interface GpxBulkUploadProps {
  onUploadSuccess: () => void;
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

interface GpxFile {
  file: File;
  name: string;
  matches?: SimilarityMatch[];
}

interface SimilarityMatch {
  trailId: string;
  trailName: string;
  matchPercentage: number;
  message: string;
}

const GpxBulkUpload: React.FC<GpxBulkUploadProps> = ({ onUploadSuccess, onNotify }) => {
  const [files, setFiles] = useState<GpxFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const extractNameFromGpx = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, "text/xml");
          
          // Try to find <name> in <metadata> or elsewhere
          const nameNode = xmlDoc.querySelector('metadata > name') || xmlDoc.querySelector('name');
          if (nameNode && nameNode.textContent) {
            resolve(nameNode.textContent.trim());
          } else {
            // Fallback to filename without extension
            resolve(file.name.replace(/\.[^/.]+$/, ""));
          }
        } catch (err) {
          // Fallback to filename on error
          resolve(file.name.replace(/\.[^/.]+$/, ""));
        }
      };
      reader.onerror = () => resolve(file.name.replace(/\.[^/.]+$/, ""));
      reader.readAsText(file);
    });
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const gpxFiles = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.gpx'));
      if (gpxFiles.length === 0) {
        onNotify('Please drop only .gpx files', 'error');
        return;
      }
      
      const newFiles: GpxFile[] = await Promise.all(
        gpxFiles.map(async (file) => ({
          file,
          name: await extractNameFromGpx(file)
        }))
      );
      
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      
      // Trigger similarity check for newly added files
      checkSimilarity(newFiles);
    }
  }, [onNotify, files]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const gpxFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.gpx'));
      
      const newFiles: GpxFile[] = await Promise.all(
        gpxFiles.map(async (file) => ({
          file,
          name: await extractNameFromGpx(file)
        }))
      );
      
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);

      // Trigger similarity check for newly added files
      checkSimilarity(newFiles);
    }
  };

  const checkSimilarity = async (newFiles: GpxFile[]) => {
    if (newFiles.length === 0) return;
    
    setChecking(true);
    const formData = new FormData();
    newFiles.forEach((item) => {
      formData.append('files', item.file);
      formData.append('names', item.name);
    });

    try {
      const results = await apiFetch<any[]>('/api/v1/admin/trails/bulk-check-similarity', {
        method: 'POST',
        body: formData,
      });

      setFiles(prev => {
        const next = [...prev];
        results.forEach(res => {
          const index = next.findIndex(f => f.file.name === res.fileName);
          if (index !== -1) {
            next[index] = { ...next[index], matches: res.matches };
          }
        });
        return next;
      });
    } catch (err) {
      console.error('[ERROR] Bulk similarity check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleNameChange = (index: number, newName: string) => {
    setFiles(prev => {
      const next = [...prev];
      next[index] = { ...next[index], name: newName };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach((item) => {
      formData.append('files', item.file);
      formData.append('names', item.name);
    });

    try {
      await apiFetch('/api/v1/admin/trails/bulk-upload-gpx', {
        method: 'POST',
        body: formData,
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
          <List dense sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
            {files.map((item, index) => (
              <React.Fragment key={`${item.file.name}-${index}`}>
                <ListItem alignItems="flex-start">
                  <ListItemText 
                    primary={
                      <TextField
                        fullWidth
                        variant="standard"
                        value={item.name}
                        onChange={(e) => handleNameChange(index, e.target.value)}
                        disabled={uploading}
                        size="small"
                        sx={{ input: { fontWeight: 'bold' } }}
                      />
                    } 
                    secondary={
                      <Box component="div">
                        <Typography variant="caption" display="block" color="text.secondary">
                          {item.file.name} ({(item.file.size / 1024).toFixed(1)} KB)
                        </Typography>
                        {item.matches && item.matches.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            {item.matches.sort((a,b) => b.matchPercentage - a.matchPercentage).map((match, mIdx) => {
                              const opacity = Math.max(0.1, match.matchPercentage / 100);
                              return (
                                <Alert 
                                  key={mIdx} 
                                  severity="warning" 
                                  icon={false}
                                  sx={{ 
                                    py: 0, 
                                    px: 1, 
                                    mb: 0.5, 
                                    fontSize: '0.75rem',
                                    backgroundColor: `rgba(255, 152, 0, ${opacity})`,
                                  }}
                                >
                                  {match.message}
                                </Alert>
                              );
                            })}
                          </Box>
                        )}
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {checking && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption">Checking similarity...</Typography>
              </Box>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: 'flex', gap: 2 }}>
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
                disabled={uploading || checking}
                color={files.some(f => f.matches && f.matches.length > 0) ? "warning" : "primary"}
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {uploading ? 'Uploading...' : 'Submit All Trails'}
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default GpxBulkUpload;
