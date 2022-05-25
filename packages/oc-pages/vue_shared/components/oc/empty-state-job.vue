<script>
export default {
    name: 'EmptyStateJob',
    props: {
        scale: {
            type: Number,
            default: 1
        }
    }
}
</script>
<template>
    <div :style="{width: scale * 185 + 'px', height: scale * 76 + 'px'}">
        <span :style="{transform: `scale(${scale})`}">
            <div v-pre>
                <!---------------------------------- hand drawn 'U' animated ---------------------------------->
                <svg 
                    width="66"
                    height="66"
                    viewBox="0 0 66 66"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">

                    <title>Unfurl</title>
                    <defs>
                        <g id="unfurl-mask">
                            <mask id="mask-unfurl-U">
                                <path 
                                    class="mask" 
                                    id="mask-U" 
                                    d="M23.5 14.5L18.5 40L21 46L29.5 45.5L36 44L41.5 30.5L42.5 21.5L43 17L43.5 14L39.5 47.5L44 49.5L50 47.5L54.5 45.5L59 40L61 33.5L60 27.5L59 21L55 16L50.5 10L43.5 6L37 4.5H31L22.5 5.5L17.5 8.5L12 12.5L8.5 17L5 23L4 31.5L5 41L10.5 50.5L16 56L22.5 59.5L32.5 61L41 59.5L47.5 56.5L53.5 55L59 50" stroke="black" stroke-width="10"/>  
                            </mask>
                        </g>
                    </defs>
                    <g class="unfurl">
                        <path
                            mask="url(#mask-unfurl-U)" 
                            id="markerting-char-U" 
                            d="M53.4 42C50.9 44.8 47.3 46.9 44 45.6C42.8 45.1 42.5 44 42.6 42.8C42.7 41.2 43 39.6 43.3 38L47.3 17H39.7L36.4 35.7C35.9 37.9 35 39.8 33.3 41.3C31.7 42.8 29.7 43.6 27.2 43.6C24.2 43.6 22.8 42.2 22.8 39.6C22.8 39.1 22.9 38.3 23.1 37.4L27 16.8H19.3L15.4 37.7C15.2 39.1 15.1 40.1 15.1 41C15.1 43.8 15.8 46.1 17.4 47.6C19 49.1 21.2 49.9 24 49.9C28.2 49.9 31.5 48.9 34.2 46.9C34.2 46.9 34.6 51.1 41.8 51.9C43.9 52.1 46.5 52.1 49.8 51.6C52.3 51.1 54.4 50.1 56.4 48.8C62.5 44.7 65.3 37.3 64.8 30.2C64.4 23.8 62 17.6 58.1 12.6C54.3 7.6 49 3.8 43 1.8C39.6 0.6 36 0 32.5 0H32.3C23.7 0 15.5 3.5 9.4 9.6C3.3 15.8 0 23.9 0 32.5C0.1 50.3 14.6 64.8 32.4 64.8H32.6C39.1 64.8 45.4 62.9 50.7 59.4C54.6 56.8 57.2 53.5 59.1 50.8C54.9 53.8 49.7 55.5 44.8 55.5C43.6 55.5 42.5 55.4 41.3 55.2C39.2 55.9 36 56.7 32.5 56.7H32.3C18.8 56.7 8.2 46.1 8.1 32.5C8.2 18.9 18.8 8.2 32.4 8.1H32.6C42.3 8.1 51.3 14 54.9 23C56.7 27.4 57.6 32.7 56.2 37.3C55.7 38.8 54.7 40.5 53.4 42Z"/>
                    </g>
                </svg>  

                <!---------------------------------- hand drawn 'n' animated ---------------------------------->
                <svg 
                    id="n"
                    width="31"
                    height="41"
                    viewBox="0 0 31 41"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">


                    <title>Unfurl</title>
                    <defs>
                        <g id="unfurl-mask">
                            <mask id="mask-unfurl-n">
                                <path 
                                    class="mask" 
                                    id="mask-n" 
                                    d="M2 19.5L29 22" stroke="black" stroke-width="45"/>  
                            </mask>
                        </g>
                    </defs>
                    <g class="unfurl">
                        <path
                            mask="url(#mask-unfurl-n)" 
                            id="markerting-char-n" 
                            d="M25.4 29.6H18.4L21.5 12.8C21.8 11.5 21.9 10.3 21.9 9.4C21.9 7 20.5 5.8 17.7 5.8C15.3 5.8 13.1 6.8 11.2 8.8L7.4 29.5H0.700005L4.7 8.1C4.8 7.7 4.8 7.2 4.8 6.5C4.8 4.9 4.5 3.2 4 1.4L10.6 0.200001L11.2 3.4C13.6 1.3 16.5 0.300001 20.1 0.300001C26 0.300001 29 3.1 29 8.6C29 9.6 28.9 10.7 28.6 12.1L25.4 29.6Z"/>
                    </g>
                </svg>  

                <!---------------------------------- hand drawn 'f' animated ---------------------------------->
                <svg 
                    id="f"
                    width="37"
                    height="73"
                    viewBox="0 0 37 73"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">


                    <title>Unfurl</title>
                    <defs>
                        <g id="unfurl-mask">
                            <mask id="mask-unfurl-f">
                                <path 
                                    class="mask" 
                                    id="mask-f" 
                                    d="M1.28265 54L37.5512 3.5949" stroke="black" stroke-width="80"/>  
                            </mask>
                        </g>
                    </defs>
                    <g class="unfurl">
                        <path
                            mask="url(#mask-unfurl-f)" 
                            id="markerting-char-f" 
                            d="M27.2 6.5C25.7 5.9 24.5 5.5 23.5 5.5C20.9 5.5 19.1 7.6 18.2 11.8H24.8L24.1 17.2H17.3L13 42.4C12.5 45.1 11.3 47.4 9.2 49.2C7.1 51 4.7 51.9 2 51.9L0.600006 47.4C1.90001 47.1 3 46.5 4 45.5C5 44.5 5.6 43.4 5.9 42.1L10.4 17.2H6.3L7.2 11.8H11.2C13 3.9 17.2 0 23.8 0C25.7 0 27.3 0.400001 28.6 1.2L27.2 6.5Z"/>
                    </g>
                </svg>  

                <!---------------------------------- hand drawn 'u' animated ---------------------------------->
                <svg 
                    id="u2"
                    width="34"
                    height="41"
                    viewBox="0 0 34 41"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">


                    <title>Unfurl</title>
                    <defs>
                        <g id="unfurl-mask">
                            <mask id="mask-unfurl-u2">
                                <path 
                                    class="mask" 
                                    id="mask-u2" 
                                    d="M2 4L30.0301 22.9684" stroke="black" stroke-width="40"/>  
                            </mask>
                        </g>
                    </defs>
                    <g class="unfurl">
                        <path
                            mask="url(#mask-unfurl-u2)" 
                            id="markerting-char-u2" 
                            d="M23.4 29.7H16.7L17.1 27.6C14.7 29.3 11.7 30.2 8.10001 30.2C5.60001 30.2 3.7 29.5 2.3 28.1C0.900003 26.7 0.200005 24.7 0.200005 22.2C0.200005 21.4 0.3 20.5 0.5 19.4L4 0.9H10.8L7.3 19.1C7.2 19.9 7.10001 20.5 7.10001 21.1C7.10001 23.4 8.4 24.6 11 24.6C13.1 24.6 14.9 23.9 16.4 22.5C17.8 21.1 18.7 19.4 19.1 17.5L22.1 0.9H28.8L23.4 29.7Z"/>
                    </g>
                </svg> 

                <!---------------------------------- hand drawn 'r' animated ---------------------------------->
                <svg 
                    id="r"
                    width="24"
                    height="30"
                    viewBox="0 0 24 30"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">

                    <title>Unfurl</title>
                    <defs>
                        <g id="unfurl-mask">
                            <mask id="mask-unfurl-r">
                                <path 
                                    class="mask" 
                                    id="mask-r" 
                                    d="M2 10L34 20" stroke="black" stroke-width="65"/>  
                            </mask>
                        </g>
                    </defs>
                    <g class="unfurl">
                        <path
                            mask="url(#mask-unfurl-r)" 
                            id="markerting-char-r" 
                            d="M21.5 7.7C19.9 6.5 18.5 5.9 17.3 5.9C15.6 5.9 14 6.7 12.5 8.2C11 9.7 10.1 11.4 9.8 13.4L6.8 29.7H0.100006L5.5 0.9H12.2L11.7 3.4C14.1 1.4 16.7 0.4 19.6 0.4C20.3 0.4 21.7 0.6 23.6 0.9L21.5 7.7Z"/>
                    </g>
                </svg>   

                <!---------------------------------- hand drawn 'l' animated ---------------------------------->
                <svg 
                    id="l"
                    width="14"
                    height="41"
                    viewBox="0 0 14 41"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">

                    <title>Unfurl</title>
                    <defs>
                        <g id="unfurl-mask">
                            <mask id="mask-unfurl-l">
                                <path 
                                    class="mask" 
                                    id="mask-l" 
                                    d="M0 25L14.5 26.5" stroke="black" stroke-width="100"/>  
                            </mask>
                        </g>
                    </defs>
                    <g class="unfurl">
                        <path
                            mask="url(#mask-unfurl-l)" 
                            id="markerting-char-l" 
                            d="M10.6 38.4C9.50001 40.1 7.9 40.9 5.8 40.9C4.2 40.9 2.9 40.4 2 39.3C1.1 38.2 0.600006 36.9 0.600006 35.2C0.600006 33 1.00001 29.9 1.90001 25.8L7.3 0.1H14L8.5 26.9C7.7 30.7 7.3 33.4 7.3 35.1C7.3 36.1 7.6 37 8.3 37.6C8.8 38.1 9.60001 38.4 10.6 38.4Z"/>
                    </g>
                </svg>   
            </div>
        </span>
    </div>
</template>
<style scoped>
span {
    transform-origin: top left;
    display: inline-block;
}

.mask {
    fill: none;
    stroke: #fff;
}

.mask {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
}

.container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100vw;
    height: 100vh;
}

.unfurl {
    cursor: pointer;
    fill: #00D2D9;
    position: absolute;
    left: 0;
    top: 0;
}

.unfurl .mask {
    fill: none;
    stroke: #fff;
    stroke-miterlimit: 10;
}

/* -------------------------------- Animation CSS -------------------------------- */
@keyframes strokeOffset {
    to {
        stroke-dashoffset: 0;
    }
}

#mask-U {
    animation: strokeOffset 2.5s linear forwards;
}

#mask-n {
    animation: strokeOffset 2s forwards 1s;
    transition-timing-function: ease-in-out;
    transition-timing-function: cubic-bezier(1, 0, 0.58, 1);
}

#mask-f {
    animation: strokeOffset 2s forwards 1.2s;
    transition-timing-function: ease-in-out;
    transition-timing-function: cubic-bezier(1, 0, 0.58, 1);
}

#mask-u2 {
    animation: strokeOffset 2s forwards 1.4s;
    transition-timing-function: ease-in-out;
    transition-timing-function: cubic-bezier(1, 0, 0.58, 1);
}

#mask-r {
    animation: strokeOffset 2s forwards 1.6s;
    transition-timing-function: ease-in-out;
    transition-timing-function: cubic-bezier(1, 0, 0.58, 1);
}

#mask-l {
    animation: strokeOffset 2s forwards 1.8s;
    transition-timing-function: ease-in-out;
    transition-timing-function: cubic-bezier(1, 0, 0.58, 1);
}

#n {
    position: relative;
    top: -9px;
    left: -3px;
}

#f {
    position: relative;
    top: 10px;
    left: -11px;
}

#u2 {
    position: relative;
    top: -9px;
    left: -27px;
}

#r {
    position: relative;
    top: -20px;
    left: -35px;
}

#l {
    position: relative;
    top: -20px;
    left: -38px;
}

/* 
#nfurl {
position: relative;
left: -4px;
} */
</style>
