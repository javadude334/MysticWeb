const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
if (!root) throw new Error('Output repository required');
const out = path.join(root, 'public', 'mystic-night');
fs.mkdirSync(out, { recursive: true });
const colors = { dim: '#7973af', purple: '#c674ff', cyan: '#6ee7f2', white: '#ede8ff' };
const sgr = { dim: '0;35', purple: '1;35', cyan: '1;36', white: '1;37' };
const name = 'New Mystic BBS'; // Verified read-only from A48 RecConfig.BBSName.
const font = {
 N:['█ █','███','███','███','█ █'], E:['███','█  ','██ ','█  ','███'],
 W:['█ █','█ █','███','███','█ █'], M:['█ █','███','███','█ █','█ █'],
 Y:['█ █','█ █',' █ ',' █ ',' █ '], S:['███','█  ','███','  █','███'],
 T:['███',' █ ',' █ ',' █ ',' █ '], I:['███',' █ ',' █ ',' █ ','███'],
 C:['███','█  ','█  ','█  ','███'], B:['██ ','█ █','██ ','█ █','██ '],
 ' ':['   ','   ','   ','   ','   '],
};
const title = Array.from({length:5}, (_,r) => [...name.toUpperCase()].map(c=>font[c][r]).join(' '));
function centered(s) { return ' '.repeat(Math.max(0, Math.floor((76-s.length)/2)))+s; }
function screen(kind, subtitle, content) {
 const rows = Array.from({length:24},()=>({text:'',color:'dim'}));
 function put(row,text,color='white') { if(text.length>(row===0||row===23?78:76)) throw new Error('ANSI width'); rows[row]={text,color}; }
 put(0,'╔'+'═'.repeat(76)+'╗','purple');
 put(1,centered('·       *                 .          +                  *'),'dim');
 title.forEach((line,i)=>put(i+3,centered(line),i<2?'purple':'cyan'));
 put(9,centered('T H E   S I G N A L   L I V E S   O N'),'white');
 put(10,centered('────────────────────────────────────────────────────────'),'purple');
 put(12,centered(subtitle),'cyan');
 content.forEach((line,i)=>put(14+i,centered(line),'white'));
 put(21,centered('MYSTIC NIGHT  /  COMMUNITY BEYOND THE TERMINAL'),'dim');
 put(23,'╚'+'═'.repeat(76)+'╝','purple');
 // 78 columns, 24 rows. CP437, standard 16-color SGR only; no OSC or macros.
 const rendered=rows.map((row,i)=> i===0||i===23 ? row.text : '║'+row.text.padEnd(76)+'║');
 const map={'╔':201,'═':205,'╗':187,'║':186,'╚':200,'╝':188,'█':219,'─':196,'·':250};
 const ansi='\x1b[0m\x1b[2J\x1b[H'+rendered.map((line,i)=>'\x1b['+sgr[rows[i].color]+'m'+line).join('\r\n')+'\x1b[0m';
 fs.writeFileSync(path.join(out,kind+'.ans'),Buffer.from([...ansi].map(c=>map[c]??c.charCodeAt(0))));
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1248" height="768" viewBox="0 0 1248 768"><rect width="1248" height="768" fill="#0b0819"/><g font-family="Consolas, monospace" font-size="24" xml:space="preserve">'+rendered.map((line,i)=>[...line].map((ch,col)=>ch===' '?'':`<text x="${col*16}" y="${26+i*32}" fill="${colors[rows[i].color]}">${escape(ch)}</text>`).join('')).join('')+'</g></svg>';
 fs.writeFileSync(path.join(out,kind+'.svg'),svg);
 return {kind,svg};
}
const screens=[
 screen('welcome','WELCOME TO THE BOARD', ['A place for late-night conversations and new connections.','','Log in with your Mystic account to join the board.']),
 screen('main-menu','YOUR NEXT CONNECTION', ['[M] Messages           [F] File library','[E] Electronic mail    [D] Door games','[C] Chat               [G] Goodbye']),
 screen('message-areas','MESSAGES / FIND YOUR FREQUENCY', ['Read the latest. Pick up a conversation.','','Choose a message area from the list below.']),
];
// Web art uses SVG geometry so the palette and typography remain crisp.
const hero=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640" viewBox="0 0 1600 640"><defs><radialGradient id="sky"><stop stop-color="#31204f"/><stop offset="1" stop-color="#0b0819"/></radialGradient><linearGradient id="ink" x2="0" y2="1"><stop stop-color="#c674ff"/><stop offset="1" stop-color="#6ee7f2"/></linearGradient></defs><rect width="1600" height="640" fill="url(#sky)"/>${Array.from({length:65},(_,i)=>`<circle cx="${(i*193+47)%1560+20}" cy="${(i*97+21)%580+20}" r="${i%4===0?2:1}" fill="${i%3===0?'#c674ff':'#6ee7f2'}" opacity="${i%2?'.5':'.8'}"/>`).join('')}<path d="M90 520H1510M160 560H1440M240 600H1360" stroke="#684080" opacity=".5"/><rect x="94" y="113" width="1412" height="404" rx="4" fill="#0b0819" fill-opacity=".6" stroke="#9d5ed0"/><path d="M94 160V113H160M1440 113H1506V160M94 470V517H160M1440 517H1506V470" fill="none" stroke="#6ee7f2" stroke-width="4"/><g fill="url(#ink)">${title.map((line,r)=>[...line].map((c,x)=>c==='█'?`<rect x="${270+x*20}" y="${200+r*24}" width="18" height="22"/>`:'').join('')).join('')}</g><text x="800" y="385" text-anchor="middle" fill="#ede8ff" font-family="monospace" font-size="20" letter-spacing="7">THE SIGNAL LIVES ON</text><text x="800" y="448" text-anchor="middle" fill="#6ee7f2" font-family="monospace" font-size="15" letter-spacing="3">MESSAGES · COMMUNITY · CONNECTION</text></svg>`;
fs.writeFileSync(path.join(out,'web-hero.svg'),hero);
fs.writeFileSync(path.join(out,'preview.html'),'<!doctype html><meta charset="utf-8"><title>Mystic Night — New Mystic BBS</title><style>body{margin:0;background:#0b0819;color:#ede8ff;font:16px system-ui;padding:32px}main{max-width:1250px;margin:auto}img{width:100%;height:auto;border:1px solid #684080;margin:12px 0 36px}h2{color:#6ee7f2}a{color:#c674ff}</style><main><h1>Mystic Night / New Mystic BBS</h1><p>Original ANSI screens and matching web artwork. Menu lettering is a design proposal; live menu commands are not installed.</p><h2>Web banner</h2><img src="web-hero.svg" alt="New Mystic BBS under a purple and cyan starfield">'+screens.map(s=>`<h2>${s.kind}</h2><a href="${s.kind}.ans">Download CP437 ANSI</a><img src="${s.kind}.svg" alt="${s.kind} ANSI screen preview">`).join('')+'</main>');
console.log('Created three CP437 ANSI screens, SVG previews, web banner, and preview.html');
