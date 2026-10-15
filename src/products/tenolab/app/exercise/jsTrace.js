/* サンプルのコードを1行ずつ追う（2026-10-15、モック devhub-lesson-quiz.html の ②）。
   - acorn でコードを読み、文ごとの前に「ここを動かす直前」の印（__t）を差し込む。印は、その時に見える変数の値も一緒に送る
   - 動かすのは演習と同じ、画面から切り離した枠（jsRunner の buildJsDocument）。console.log・alert の出力は、そのときの段に付ける
   - 教材のデータは要らない（サンプルのコードがあれば、開いたときにその場で作る）。読めない・動かないコードは null を返し、画面はふつうの作業台にする */
import { parse } from "acorn";
import { buildJsDocument } from "./jsRunner.js";

const MAX_STEPS = 400;
let seq = 0;

// 宣言された名前（変数・引数・catch の名前）を集める
function collectNames(node, out) {
  if (!node || typeof node !== "object") return;
  const addPattern = p => {
    if (!p) return;
    if (p.type === "Identifier") out.add(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach(x => addPattern(x.type === "RestElement" ? x.argument : x.value));
    else if (p.type === "ArrayPattern") p.elements.forEach(addPattern);
    else if (p.type === "AssignmentPattern") addPattern(p.left);
    else if (p.type === "RestElement") addPattern(p.argument);
  };
  if (node.type === "VariableDeclarator") addPattern(node.id);
  if (/Function/.test(node.type)) (node.params || []).forEach(addPattern);
  if (node.type === "CatchClause") addPattern(node.param);
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(x => collectNames(x, out));
    else if (v && typeof v.type === "string") collectNames(v, out);
  }
}

// 文の前に印を入れる場所を集める。ブロックでない本体（if (x) a++;）は { } で包む
function collectPoints(node, points) {
  if (!node || typeof node !== "object") return;
  const mark = st => points.push({ pos: st.start, line: st.loc.start.line, wrapEnd: null });
  const body = list => list.forEach(st => { if (st.type !== "FunctionDeclaration" && st.type !== "EmptyStatement") mark(st); });
  if (node.type === "Program" || node.type === "BlockStatement" || node.type === "StaticBlock") body(node.body);
  if (node.type === "SwitchCase") body(node.consequent);
  for (const key of ["consequent", "alternate", "body"]) {
    const b = node[key];
    if (b && !Array.isArray(b) && typeof b.type === "string" && /Statement$/.test(b.type) && b.type !== "BlockStatement" && node.type !== "SwitchCase"
      && /^(If|For|ForIn|ForOf|While|DoWhile|Labeled)Statement$/.test(node.type)) {
      points.push({ pos: b.start, line: b.loc.start.line, wrapEnd: b.end });
    }
  }
  for (const k of Object.keys(node)) {
    if (k === "loc") continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(x => collectPoints(x, points));
    else if (v && typeof v.type === "string") collectPoints(v, points);
  }
}

export function instrumentJs(js) {
  const src = String(js || "");
  const ast = parse(src, { ecmaVersion: "latest", sourceType: "script", locations: true, allowReturnOutsideFunction: false });
  const names = new Set();
  collectNames(ast, names);
  const points = [];
  collectPoints(ast, points);
  if (!points.length) return null;
  const vars = [...names].filter(n => !n.startsWith("__")).slice(0, 24);
  const getter = `()=>[${vars.map(n => `[${JSON.stringify(n)},__g(()=>${n})]`).join(",")}]`;
  const ins = [];
  for (const p of points) {
    ins.push({ pos: p.pos, text: `${p.wrapEnd != null ? "{" : ""}__t(${p.line},${getter});` });
    if (p.wrapEnd != null) ins.push({ pos: p.wrapEnd, text: "}" });
  }
  ins.sort((a, b) => b.pos - a.pos);
  let out = src;
  for (const x of ins) out = out.slice(0, x.pos) + x.text + out.slice(x.pos);
  return out;
}

// 枠の中で使う関数（印・値の写し・終わりの合図）
// __W：ブラウザがもともと持っている名前（name・status など）。宣言前の変数がそれを拾って変な値を出さないよう、見せない
const tracePrelude = token => `var __NA={};var __steps=0;var __W=window.__W0||Object.create(null);
function __g(f){try{return f()}catch(e){return __NA}}
function __s1(v){var k=typeof v;if(k==="string")return JSON.stringify(v);if(v===null)return"null";if(Array.isArray(v))return"["+v.length+"]";if(k==="object")return"{…}";if(k==="function")return"ƒ";return String(v)}
function __ser(v){if(v===__NA)return null;var k=typeof v;if(k==="function")return null;
 if(Array.isArray(v))return{k:"arr",items:v.slice(0,12).map(__s1),more:v.length>12};
 if(v&&k==="object"){if(typeof Element!=="undefined"&&v instanceof Element)return{k:"el",t:"<"+v.tagName.toLowerCase()+">"};try{var s=JSON.stringify(v);return{k:"obj",t:s.length>60?s.slice(0,57)+"…":s}}catch(e){return{k:"obj",t:"{…}"}}}
 return{k:k==="number"?"num":k==="string"?"str":k,t:k==="string"?JSON.stringify(v):String(v)}}
function __t(line,get){if(++__steps>${MAX_STEPS})throw new Error("__trace_limit");var l=get(),vs=[];for(var i=0;i<l.length;i++){if(__W[l[i][0]])continue;var s=__ser(l[i][1]);if(s)vs.push([l[i][0],s])}
 try{parent.postMessage({__djs:${JSON.stringify(token)},t:"step",d:{line:line,vars:vs}},"*")}catch(e){}}
function __end(err){var vs=[];try{parent.postMessage({__djs:${JSON.stringify(token)},t:"tend",d:{err:err||""}},"*")}catch(e){}}
`;

/* 動かして、段の並び（[{ line, vars: [[名前, 値]], out: [出力] }]）を返す。最後に「終わったあと」の段を足す。
   読めない・1段も無いときは null */
export function runJsTrace({ html = "", js = "", timeoutMs = 4000 }) {
  let code;
  try { code = instrumentJs(js); } catch { return Promise.resolve(null); }
  if (!code) return Promise.resolve(null);
  return new Promise(resolve => {
    const token = `trc-${Date.now()}-${++seq}`;
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none";
    f.setAttribute("sandbox", "allow-scripts allow-modals allow-forms");
    document.body.appendChild(f);
    const steps = [];
    let pre = [], done = false, error = "";
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
      setTimeout(() => f.remove(), 0);
      if (!steps.length) return resolve(null);
      const lastVars = steps[steps.length - 1].vars;
      steps.push({ line: 0, vars: lastVars, out: [], end: true, error });
      if (pre.length) steps[0].out.unshift(...pre);
      resolve({ steps });
    };
    const onMsg = e => {
      const m = e.data;
      if (!m || m.__djs !== token || e.source !== f.contentWindow) return;
      if (m.t === "step") steps.push({ line: m.d.line, vars: m.d.vars, out: [] });
      else if (m.t === "tend") finish();
      else if (m.t === "log" || m.t === "alert" || m.t === "error") {
        const text = m.t === "error" ? (typeof m.d === "object" ? m.d.msg : String(m.d)) : String(m.d);
        if (/__trace_limit/.test(text)) return finish();
        if (m.t === "error") error = text;
        const item = { t: m.t, s: text };
        // 出力はその出力を出した文の段に付ける（印は文の前に入るので、直前の段）
        if (steps.length) steps[steps.length - 1].out.push(item); else pre.push(item);
      }
    };
    window.addEventListener("message", onMsg);
    const timer = setTimeout(finish, timeoutMs);
    const body = `${tracePrelude(token)}\ntry{\n${code}\n}catch(__e){if(String(__e&&__e.message)!=="__trace_limit")console.error(__e&&__e.message||String(__e))}\n__end();`;
    // __W0 は受講生のコードより前の枠で取る（同じ枠だと var で宣言した名前まで入ってしまう）
    const w0 = "<script>window.__W0=Object.create(null);Object.getOwnPropertyNames(window).forEach(function(n){window.__W0[n]=1});</" + "script>";
    const h = String(html || "");
    const html2 = /<html[\s>]/i.test(h) ? (/<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, m => m + w0) : h.replace(/<html[^>]*>/i, m => m + "<head>" + w0 + "</head>")) : w0 + h;
    f.srcdoc = buildJsDocument({ html: html2, js: body, token });
  });
}
