import { useState } from 'react';
import { Box, Chip, Collapse, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export interface HealthBannerCheck {
  label: string;
  passed: boolean;
  tooltip: string;
}

interface HealthStatusBannerProps {
  /** Already filtered to the applicable checks (e.g. EventHealth.tsx's `na` ones excluded). */
  checks: HealthBannerCheck[];
  /** The matching Health Dashboard's own score for this entity — never recomputed here. */
  score: number;
  scoreColor: (score: number) => 'success' | 'warning' | 'error';
  readyLabel?: string;
}

/**
 * #1842: compact, expandable completeness banner for a Trail/Event detail page — renders
 * whichever check list and score the caller already computed via TrailHealth.tsx's or
 * EventHealth.tsx's getHealthChecks (plus the matching score helper), so editing an entity
 * surfaces the same completeness signal its Health Dashboard shows, without navigating away.
 * Collapsed by default when there are failing checks; nothing to expand at 100%.
 */
export default function HealthStatusBanner({ checks, score, scoreColor, readyLabel = 'Ready to publish' }: HealthStatusBannerProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const failing = checks.filter(c => !c.passed);
  const color = scoreColor(score);
  const bg = alpha(theme.palette[color].main, 0.1);

  if (score >= 100) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderRadius: 1, bgcolor: bg, mb: 2 }}>
        <CheckCircleIcon fontSize="small" color="success" />
        <Typography variant="body2" fontWeight={600} color="success.main">{readyLabel}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ borderRadius: 1, bgcolor: bg, mb: 2 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <CancelIcon fontSize="small" color={color} />
        <Typography variant="body2" fontWeight={600} color={`${color}.main`} sx={{ flex: 1 }}>
          {failing.length} check{failing.length !== 1 ? 's' : ''} failing
        </Typography>
        <IconButton size="small" onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} aria-label={expanded ? 'Collapse failing checks' : 'Expand failing checks'}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1.5, pb: 1.25 }}>
          {failing.map(check => (
            <Tooltip key={check.label} title={`${check.label}: ${check.tooltip}`} arrow>
              <Chip
                icon={<CancelIcon />}
                label={check.label}
                size="small"
                color="error"
                variant="filled"
                sx={{ fontSize: '0.65rem', height: 24, '& .MuiChip-icon': { fontSize: 14 } }}
              />
            </Tooltip>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

interface HealthScoreBadgeProps {
  score: number;
  scoreColor: (score: number) => 'success' | 'warning' | 'error';
  tooltip?: string;
}

/**
 * #1842: compact score Chip for a row that's too small for the full banner above (edition
 * header, race row) — same score/scoreColor contract, no expandable detail of its own.
 */
export function HealthScoreBadge({ score, scoreColor, tooltip }: HealthScoreBadgeProps) {
  return (
    <Tooltip title={tooltip ?? `Health: ${score}%`} arrow>
      <Chip
        label={`${score}%`}
        size="small"
        color={scoreColor(score)}
        variant={score >= 100 ? 'outlined' : 'filled'}
        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, '& .MuiChip-label': { px: 0.75 } }}
      />
    </Tooltip>
  );
}
