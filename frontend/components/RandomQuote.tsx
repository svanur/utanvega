import { useState, useMemo } from 'react';
import { Box, Button, Stack, Typography, Collapse, IconButton, FormControlLabel, Checkbox, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { QuoteService } from '../services/QuoteService';

export default function RandomQuote() {
    const [isVisible, setIsVisible] = useState(() => localStorage.getItem('hideSplash') !== 'true');
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const { t } = useTranslation();

    const quote = useMemo(() => QuoteService.getRandomQuote(), []);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem('hideSplash', 'true');
        }
        setIsVisible(false);
    };

    return (
        <Collapse in={isVisible} unmountOnExit>
            <Paper elevation={4} sx={{ py: { xs: 1.5, sm: 2 }, pl: { xs: 3, sm: 4 }, pr: { xs: 1.5, sm: 2 }, mb: 4 }}>
                <Stack spacing={2} sx={{ position: 'relative' }}>
                    <IconButton 
                        onClick={handleClose} 
                        sx={{ position: 'absolute', top: -8, right: -8 }}
                        aria-label="close"
                    >
                        <CloseIcon />
                    </IconButton>
                    <Box>
                        <Typography variant="h6" component="h1" fontWeight={700} gutterBottom>
                            {quote.text}
                        </Typography>
                        {quote.author && (
                            <Typography variant="subtitle1" color="text.secondary" sx={{ fontStyle: 'italic', mt: -1 }}>
                                — {quote.author}
                            </Typography>
                        )}
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                        <Button variant="contained" onClick={handleClose}>{t('header.close')}</Button>
                        <FormControlLabel
                            control={
                                <Checkbox 
                                    size="small" 
                                    checked={dontShowAgain} 
                                    onChange={(e) => setDontShowAgain(e.target.checked)} 
                                />
                            }
                            label={<Typography variant="caption">{t('header.dontShowAgain')}</Typography>}
                        />
                    </Stack>
                </Stack>
            </Paper>
        </Collapse>
    );
}