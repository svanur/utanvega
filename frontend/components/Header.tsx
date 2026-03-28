import { useState, useEffect } from 'react';
import { Box, Button, Stack, Typography, Collapse, IconButton, FormControlLabel, Checkbox, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function Header() {
    const [isVisible, setIsVisible] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        const hideSplash = localStorage.getItem('hideSplash');
        if (hideSplash !== 'true') {
            setIsVisible(true);
        }
    }, []);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem('hideSplash', 'true');
        }
        setIsVisible(false);
    };

    return (
        <Collapse in={isVisible} unmountOnExit>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 4 }, mb: 4 }}>
                <Stack spacing={2} sx={{ position: 'relative' }}>
                    <IconButton 
                        onClick={handleClose} 
                        sx={{ position: 'absolute', top: -8, right: -8 }}
                        aria-label="close"
                    >
                        <CloseIcon />
                    </IconButton>
                    <Box>
                        <Typography variant="overline" color="primary">
                            🌄Utanvega🏃‍♂️🚴‍
                        </Typography>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Sumir elska malbik, allir elska utanvega.
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Vefur til að finna skemmtilegar leiðir og deila með vinum. 
                        </Typography>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                        <Button variant="contained" onClick={handleClose}>Loka</Button>
                        <FormControlLabel
                            control={
                                <Checkbox 
                                    size="small" 
                                    checked={dontShowAgain} 
                                    onChange={(e) => setDontShowAgain(e.target.checked)} 
                                />
                            }
                            label={<Typography variant="caption">Ekki sýna aftur</Typography>}
                        />
                    </Stack>
                </Stack>
            </Paper>
        </Collapse>
    );
}