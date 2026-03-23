import { Box, Button, Stack, Typography } from '@mui/material';

export default function Header() {
    return (
        <Stack spacing={2}>
            <Box>
                <Typography variant="overline" color="primary">
                    Hlaupaleiðir
                </Typography>
                <Typography variant="h4" component="h1" gutterBottom>
                    Route planning made simple
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    A clean starting point for building the frontend with React, Vite, and MUI.
                </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained">Get started</Button>
                <Button variant="outlined">Learn more</Button>
            </Stack>
        </Stack>
    );
}