import { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, Alert, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { supabase } from '../hooks/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function GpxUploadDialog({ open, onClose, onUploadSuccess }: { open: boolean, onClose: () => void, onUploadSuccess: () => void }) {
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        setFile(selectedFile);
        
        if (selectedFile) {
            // Try to extract name from GPX
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, "text/xml");
                    
                    // Try to find <name> in <metadata> or elsewhere
                    const nameNode = xmlDoc.querySelector('metadata > name') || xmlDoc.querySelector('name');
                    if (nameNode && nameNode.textContent) {
                        setName(nameNode.textContent.trim());
                    } else {
                        // Fallback to filename without extension
                        const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
                        setName(fileName);
                    }
                } catch (err) {
                    // Fallback to filename on error
                    const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
                    setName(fileName);
                }
            };
            reader.readAsText(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!name || !file) {
            setError('Please provide a name and a GPX file.');
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_URL}/api/v1/admin/trails/upload-gpx?name=${encodeURIComponent(name)}`, {
                method: 'POST',
                headers,
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Upload failed');
            }

            setName('');
            setFile(null);
            onUploadSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Upload GPX Trail</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField
                        label="Trail Name"
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Button
                        variant="outlined"
                        component="label"
                        startIcon={<UploadFileIcon />}
                    >
                        {file ? file.name : 'Select GPX File'}
                        <input
                            type="file"
                            accept=".gpx"
                            hidden
                            onChange={handleFileChange}
                        />
                    </Button>
                    {file && (
                        <Typography variant="caption" color="textSecondary">
                            Ready to upload: {file.name}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={uploading}>Cancel</Button>
                <Button 
                    onClick={handleUpload} 
                    variant="contained" 
                    disabled={uploading || !name || !file}
                    startIcon={uploading ? <CircularProgress size={20} /> : null}
                >
                    {uploading ? 'Uploading...' : 'Upload'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
