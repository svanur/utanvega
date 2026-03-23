import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';

export default function App() {
    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 6 }}>
            <Container maxWidth="md">
                <Paper elevation={4} sx={{ p: { xs: 3, sm: 4 } }}>
                    <Stack spacing={3}>
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
                </Paper>
            </Container>
        </Box>
    );
}