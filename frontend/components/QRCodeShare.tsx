import React, { useState } from 'react';
import { 
    Box, 
    Typography, 
    IconButton, 
    Tooltip, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button,
    Tabs,
    Tab,
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import DownloadIcon from '@mui/icons-material/Download';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeShareProps {
    slug: string;
    trailName: string;
}

export default function QRCodeShare({ slug, trailName }: QRCodeShareProps) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState(0);
    
    const baseUrl = window.location.origin;
    const trailUrl = `${baseUrl}/trails/${slug}`;
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const gpxUrl = `${apiBaseUrl}/api/v1/trails/${slug}/gpx`;

    return (
        <>
            <Tooltip title="Show QR Code">
                <IconButton onClick={() => setOpen(true)} color="primary" size="small">
                    <QrCode2Icon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                    {trailName}
                </DialogTitle>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        centered
                        variant="fullWidth"
                    >
                        <Tab 
                            icon={<PhoneAndroidIcon fontSize="small" />} 
                            label="Trail Page" 
                            iconPosition="start" 
                            sx={{ textTransform: 'none', minHeight: 44, fontSize: '0.8rem' }} 
                        />
                        <Tab 
                            icon={<DownloadIcon fontSize="small" />} 
                            label="GPX File" 
                            iconPosition="start" 
                            sx={{ textTransform: 'none', minHeight: 44, fontSize: '0.8rem' }} 
                        />
                    </Tabs>
                </Box>
                <DialogContent>
                    <Box 
                        display="flex" 
                        flexDirection="column" 
                        alignItems="center" 
                        justifyContent="center"
                        py={2}
                    >
                        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2 }}>
                            <QRCodeSVG 
                                value={tab === 0 ? trailUrl : gpxUrl} 
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </Box>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                            {tab === 0
                                ? 'Scan to open this trail on your phone.'
                                : 'Scan to download the GPX file. Your phone will offer to open it in Garmin Connect, Coros, Suunto, or other GPS apps.'
                            }
                        </Typography>
                        {tab === 1 && (
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<DownloadIcon />}
                                href={gpxUrl}
                                download
                                sx={{ mt: 2, textTransform: 'none' }}
                            >
                                Download GPX
                            </Button>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
