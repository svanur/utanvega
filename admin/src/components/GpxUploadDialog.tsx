import { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, Alert, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { supabase } from '../hooks/supabase';
import { generateSlug } from '../utils/slugify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface SimilarityMatch {
    trailId: string;
    trailName: string;
    matchPercentage: number;
    message: string;
}

interface DetectedLocation {
    id: string;
    name: string;
    type: string;
    distanceMeters: number;
}

export default function GpxUploadDialog({ open, onClose, onUploadSuccess }: { open: boolean, onClose: () => void, onUploadSuccess: (trail?: { id: string, slug: string, name: string }, detectedLocations?: DetectedLocation[]) => void }) {
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [matches, setMatches] = useState<SimilarityMatch[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        setFile(selectedFile);
        setMatches([]); // Reset matches on new file
        setError(null);
        
        if (selectedFile) {
            // Try to extract name from GPX
            const reader = new FileReader();
            reader.onload = async (event) => {
                let extractedName = '';
                try {
                    const content = event.target?.result as string;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, "text/xml");
                    
                    // Try to find <name> in <metadata> or elsewhere
                    const nameNode = xmlDoc.querySelector('metadata > name') || xmlDoc.querySelector('name');
                    if (nameNode && nameNode.textContent) {
                        extractedName = nameNode.textContent.trim();
                    } else {
                        // Fallback to filename without extension
                        extractedName = selectedFile.name.replace(/\.[^/.]+$/, "");
                    }
                } catch (_err) {
                    // Fallback to filename on error
                    extractedName = selectedFile.name.replace(/\.[^/.]+$/, "");
                }
                
                setName(extractedName);
                
                // Trigger similarity check immediately after selection
                await checkSimilarity(selectedFile, extractedName);
            };
            reader.readAsText(selectedFile);
        }
    };

    const checkSimilarity = async (selectedFile: File, currentName: string) => {
        setChecking(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_URL}/api/v1/admin/trails/check-similarity?name=${encodeURIComponent(currentName)}`, {
                method: 'POST',
                headers,
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                setError(`Similarity check failed (${response.status}): ${errorText.substring(0, 100)}`);
                return;
            }

            const result = await response.json();
            setMatches(result || []);
        } catch (err) {
            console.error('[ERROR] Similarity check exception:', err);
        } finally {
            setChecking(false);
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

            const result = await response.json();
            
            // Success — pass detected locations to caller
            onUploadSuccess(
                { id: result.id, slug: result.slug || generateSlug(name), name },
                result.detectedLocations || []
            );
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setName('');
        setFile(null);
        setMatches([]);
        setError(null);
        onClose();
    };

    const sortedMatches = [...matches].sort((a, b) => b.matchPercentage - a.matchPercentage);

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>Upload GPX Trail</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    
                    {checking && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="caption">Checking for existing trails...</Typography>
                        </Box>
                    )}
                    
                    {sortedMatches.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                Warning: Potential Duplicates Detected
                            </Typography>
                            {sortedMatches.map((match, idx) => {
                                // Calculate background color based on percentage (0-100)
                                // Higher percentage = more intense orange/warning color
                                const opacity = Math.max(0.1, match.matchPercentage / 100);
                                return (
                                    <Alert 
                                        key={idx} 
                                        severity="warning" 
                                        sx={{ 
                                            mb: 1,
                                            backgroundColor: `rgba(255, 152, 0, ${opacity})`,
                                            '& .MuiAlert-icon': {
                                                color: match.matchPercentage > 70 ? 'inherit' : 'warning.main'
                                            }
                                        }}
                                    >
                                        {match.message}
                                    </Alert>
                                );
                            })}
                            <Typography variant="caption" display="block">
                                You can still upload if you believe this is a different trail.
                            </Typography>
                        </Box>
                    )}

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
                <Button onClick={handleClose} disabled={uploading}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleUpload} 
                    variant="contained" 
                    disabled={uploading || checking || !name || !file}
                    startIcon={uploading ? <CircularProgress size={20} /> : null}
                    color={matches.length > 0 ? "warning" : "primary"}
                >
                    {uploading ? 'Uploading...' : 'Upload'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
