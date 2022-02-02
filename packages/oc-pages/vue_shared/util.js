export function slugify(text) {
    return text && text
        .toString() 
        .toLowerCase()
        .normalize('NFD')
        .trim()
        .replace(/\s+/g, '-')
    // eslint-disable-next-line no-useless-escape
        .replace(/[^\w\-]+/g, '')
    // eslint-disable-next-line no-useless-escape
        .replace(/\-\-+/g, '-');
}

export const USER_HOME_PROJECT = 'dashboard';