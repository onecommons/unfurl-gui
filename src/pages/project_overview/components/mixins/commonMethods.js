// eslint-disable-next-line filenames/match-regex
export default {
    methods: {
        detectIcon(str) {
            const searchPhrases = ["dns", "email", "mail"];
            const lowerTitle = str.toLowerCase();
            let idx = null;
            searchPhrases.forEach((e, i) => {
                if(lowerTitle.search(e) !== -1){
                    idx = i;
                }
            });
            switch(searchPhrases[idx]) {
                case 'dns':
                    return "file-tree";
                case 'email':
                case 'mail':
                    return "mail"
                default:
                    return "pod";
            }

        }
    }
};
