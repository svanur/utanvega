import { Fragment } from 'react';
import { Link } from '@mui/material';
import { tokenizeLinks } from '../utils/linkify';

interface LinkifiedTextProps {
    text: string | null | undefined;
}

// Thin renderer around tokenizeLinks (utils/linkify.ts): maps plain-text tokens straight through
// (newlines stay inside the string, so a caller's `whiteSpace: 'pre-line'` Typography still works
// unchanged) and link tokens to an MUI Link -- which renders as a real <a>, picking its color up
// from the theme rather than a hardcoded hex -- opening in a new tab. Never dangerouslySetInnerHTML:
// only a validated http(s) candidate from tokenizeLinks ever becomes an href (#1072).
export default function LinkifiedText({ text }: LinkifiedTextProps) {
    if (!text) return null;

    return (
        <>
            {tokenizeLinks(text).map((token, index) =>
                token.type === 'link' ? (
                    <Link key={index} href={token.url} target="_blank" rel="noopener noreferrer">
                        {token.label}
                    </Link>
                ) : (
                    <Fragment key={index}>{token.value}</Fragment>
                )
            )}
        </>
    );
}
