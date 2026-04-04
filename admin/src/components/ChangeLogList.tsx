import { useState, useEffect } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Divider, CircularProgress, Chip, Collapse } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, History as HistoryIcon } from '@mui/icons-material';
import { apiFetch } from '../hooks/api';

export type ChangeLogDto = {
    id: string;
    entityName: string;
    entityId: string;
    action: string;
    description: string;
    changes: string | null;
    userId: string | null;
    timestampUtc: string;
};

interface ChangeLogListProps {
    entityName?: string;
    entityId?: string;
    limit?: number;
    title?: string;
}

export default function ChangeLogList({ entityName, entityId, limit = 50, title }: ChangeLogListProps) {
    const [logs, setLogs] = useState<ChangeLogDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                let url = `/api/v1/admin/history?limit=${limit}`;
                if (entityName) url += `&entityName=${entityName}`;
                if (entityId) url += `&entityId=${entityId}`;
                
                const data = await apiFetch<ChangeLogDto[]>(url);
                setLogs(data);
            } catch (err) {
                console.error('Failed to fetch logs', err);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [entityName, entityId, limit]);

    if (loading) return <CircularProgress size={24} />;
    if (logs.length === 0) return <Typography variant="body2" color="textSecondary">No history found.</Typography>;

    const toggleExpand = (id: string) => {
        setExpanded(expanded === id ? null : id);
    };

    const formatChanges = (changesJson: string | null) => {
        if (!changesJson) return null;
        try {
            const obj = JSON.parse(changesJson);
            return (
                <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {Object.entries(obj).map(([prop, val]) => {
                        const change = val as { From: unknown; To: unknown };
                        return (
                        <div key={prop}>
                            <strong>{prop}</strong>: <span style={{ color: '#d32f2f' }}>{JSON.stringify(change.From)}</span> → <span style={{ color: '#2e7d32' }}>{JSON.stringify(change.To)}</span>
                        </div>
                        );
                    })}
                </Box>
            );
        } catch (_e) {
            return changesJson;
        }
    };

    return (
        <Box sx={{ mt: 2 }}>
            {title && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <HistoryIcon sx={{ mr: 1, fontSize: 20 }} color="action" />
                    <Typography variant="subtitle2">{title}</Typography>
                </Box>
            )}
            <Paper variant="outlined">
                <List dense>
                    {logs.map((log, index) => (
                        <div key={log.id}>
                            <ListItem alignItems="flex-start" sx={{ 
                                cursor: log.changes ? 'pointer' : 'default',
                                '&:hover': log.changes ? { bgcolor: 'rgba(0,0,0,0.02)' } : {}
                            }} onClick={() => log.changes && toggleExpand(log.id)}>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip 
                                                    size="small" 
                                                    label={log.action} 
                                                    color={log.action === 'Create' ? 'success' : log.action === 'Delete' ? 'error' : 'primary'} 
                                                    variant="outlined" 
                                                />
                                                <Typography variant="body2">{log.description}</Typography>
                                            </Box>
                                            <Typography variant="caption" color="textSecondary">
                                                {new Date(log.timestampUtc).toLocaleString()}
                                            </Typography>
                                        </Box>
                                    }
                                    secondary={
                                        <Box component="span">
                                            <Typography variant="caption" display="block">User: {log.userId || 'system'}</Typography>
                                            {log.changes && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
                                                    <Typography variant="caption">
                                                        {expanded === log.id ? 'Hide details' : 'View details'}
                                                    </Typography>
                                                    {expanded === log.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                </Box>
                                            )}
                                        </Box>
                                    }
                                />
                            </ListItem>
                            {log.changes && (
                                <Collapse in={expanded === log.id} timeout="auto" unmountOnExit>
                                    <Box sx={{ px: 2, pb: 2 }}>
                                        {formatChanges(log.changes)}
                                    </Box>
                                </Collapse>
                            )}
                            {index < logs.length - 1 && <Divider component="li" />}
                        </div>
                    ))}
                </List>
            </Paper>
        </Box>
    );
}
