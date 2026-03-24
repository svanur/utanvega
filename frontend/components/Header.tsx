import { Box, Button, Stack, Typography } from '@mui/material';

export default function Header() {
    return (
        <Stack spacing={2}>
            <Box>
                <Typography variant="overline" color="primary">
                    🌄Utanvega🏃‍♂️🚴‍
                </Typography>
                <Typography variant="h4" component="h1" gutterBottom>
                    Sumir elska malbik, en allir elska Utanvega
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Vefur til að finna skemmtilegar leiðir og deila með vinum. 
                </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained">Get started</Button>
                <Button variant="outlined">Learn more</Button>
            </Stack>
        </Stack>
    );
}