
export function getColorCode(color: string): string {
    switch (color) {
        case 'red': return '\x1b[31m';
        case 'green': return '\x1b[32m';
        case 'blue': return '\x1b[34m';
        case 'yellow': return '\x1b[33m';
        case 'cyan': return '\x1b[36m';
        case 'white': return '\x1b[37m';
        case 'black': return '\x1b[30m';
        default: return '';
    }
}

export function getBackgroundColorCode(color: string): string {
    switch (color) {
        case 'red': return '\x1b[41m';
        case 'green': return '\x1b[42m';
        case 'blue': return '\x1b[44m';
        case 'yellow': return '\x1b[43m';
        case 'cyan': return '\x1b[46m';
        case 'white': return '\x1b[47m';
        case 'black': return '\x1b[40m';
        default: return '';
    }
}

export function stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}
