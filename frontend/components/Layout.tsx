import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';
import type { PropsWithChildren } from 'react';

export default function Layout({ children }: PropsWithChildren) {
    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="sticky" elevation={0}>
                <Toolbar>
                    <Typography variant="h6" component="div">
                        Hlaupaleiðir
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth="md" sx={{ py: 4 }}>
                {children}
            </Container>
        </Box>
    );
}
