import {randomBytes} from 'node:crypto';
export function isolatedPreview(files){
if(!files||['index.html','style.css','app.js'].some(f=>typeof files[f]!=='string'))throw new Error('Incomplete preview files');
const nonce=randomBytes(24).toString('base64');
const css=files['style.css'].replace(/<\/style/gi,'<\\/style');
const js=files['app.js'].replace(/<\/script/gi,'<\\/script');
let styles=0,scripts=0;
const html=files['index.html'].replace(/<link\b[^>]*\bhref=["']style\.css["'][^>]*>/gi,()=>{styles++;return `<style nonce="${nonce}">${css}</style>`;}).replace(/<script\b[^>]*\bsrc=["']app\.js["'][^>]*>\s*<\/script>/gi,()=>{scripts++;return `<script nonce="${nonce}">${js}</script>`;});
if(styles!==1||scripts!==1)throw new Error('Preview requires exactly one local stylesheet and script');
return {html,csp:`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; sandbox allow-scripts; frame-ancestors 'self'`};
}
