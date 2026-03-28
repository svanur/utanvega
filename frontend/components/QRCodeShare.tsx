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
    Link
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeShareProps {
    slug: string;
    trailName: string;
}

export default function QRCodeShare({ slug, trailName }: QRCodeShareProps) {
    const [open, setOpen] = useState(false);
    
    // Construct the URL that we want the QR code to point to.
    // For now, we'll point to the trail detail page itself.
    // Garmin Connect can import from a URL if it's a GPX file, 
    // but usually users just want to open the page on their phone.
    // A more advanced version would point directly to a GPX export endpoint if available.
    const baseUrl = window.location.origin;
    const trailUrl = `${baseUrl}/trail/${slug}`;
    
    // Garmin Connect "import" doesn't have a simple public URL-based deep link for generic GPX files
    // that works across all devices easily without a backend helper.
    // However, if we provide the page URL, the user can open it on their phone 
    // and then use the "Share" -> "Garmin Connect" if the app is installed.
    // Or we can provide a direct link to the GPX if we know the pattern.
    
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const gpxUrl = `${apiBaseUrl}/api/v1/trails/${slug}/gpx`;

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <Tooltip title="Show QR Code">
                <IconButton onClick={handleClickOpen} color="primary" size="small">
                    <QrCode2Icon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ textAlign: 'center' }}>
                    Open "{trailName}" on Phone
                </DialogTitle>
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
                                value={trailUrl} 
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </Box>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                            Scan this code with your phone's camera to open this trail. 
                            From there, you can send it to Garmin Connect or other apps.
                        </Typography>
                        
                        <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Link href={gpxUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                                <Typography variant="caption">
                                    Direct GPX Download Link
                                </Typography>
                            </Link>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
