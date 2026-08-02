export function hashText(text: string): string {
    let h = 5381;
    for (let i = 0; i < text.length; i++) {
        h = ((h << 5) + h) ^ text.charCodeAt(i);
        h >>>= 0; // keep unsigned 32-bit
    }
    return h.toString(36);
}
