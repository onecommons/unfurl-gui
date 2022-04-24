export default function slugify(text) {
    return text && text
        .toString() 
        .toLowerCase()
        .normalize('NFD')
        .trim()
        .replace(/(\-\-+|_|\s+)/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/^\d+/, '')
}
