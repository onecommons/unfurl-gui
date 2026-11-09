export default function slugify(text: string): string
export default function slugify<T extends null | undefined>(text: T): T
export default function slugify(text: string | null | undefined): string | null | undefined
export default function slugify(text: string | null | undefined) {
    return text && text
        .toString() 
        .toLowerCase()
        .normalize('NFD')
        .trim()
        .replace(/(\-\-+|_|\s+)/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/(\-\-+|_|\s+)/g, '-')
        .replace(/^\d+/, '')
}
