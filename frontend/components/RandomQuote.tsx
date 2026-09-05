import { useState, useMemo } from 'react';
import { Box, Stack, Typography, Collapse, IconButton, FormControlLabel, Checkbox, Paper } from '@mui/material';
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
        <Collapse in={isVisible} unmountOnExit sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Paper elevation={4} sx={{ py: { xs: 1.5, sm: 2 }, pl: { xs: 3, sm: 4 }, pr: { xs: 1.5, sm: 2 }, mb: 4 }}>
                <Box sx={{ position: 'relative' }}>
                    <Stack direction="row" alignItems="center" sx={{ position: 'absolute', top: -8, right: -8 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={dontShowAgain}
                                    onChange={(e) => setDontShowAgain(e.target.checked)}
                                />
                            }
                            label={<Typography variant="caption">{t('header.dontShowAgain')}</Typography>}
                            sx={{ mr: 0 }}
                        />
                        <IconButton onClick={handleClose} aria-label="close">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <Box sx={{ pr: 14 }}>
                        <Typography variant="body1" component="h1" fontWeight={700} gutterBottom>
                            {quote.text}
                        </Typography>
                        {quote.author && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                — {quote.author}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Paper>
        </Collapse>
    );
}