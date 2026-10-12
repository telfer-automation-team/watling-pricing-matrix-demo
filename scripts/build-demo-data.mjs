import { readFileSync, writeFileSync } from "node:fs";

function parseCSV(text){const rows=[];let row=[],f="",q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else{if(c==='"')q=true;else if(c===","){row.push(f);f="";}else if(c==="\n"){row.push(f);rows.push(row);row=[];f="";}else if(c==="\r"){}else f+=c;}}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const num=s=>parseFloat(String(s).replace(/,/g,"").trim())||0;

const SQT="/mnt/user-data/uploads/products_export__1___1_.csv";
const PRICE="/mnt/user-data/uploads/APR26_Price_File_xls_-_APR26_Price_File_xls.csv";

// choose a representative set of models
const MODELS=new Set(["TM110","540-170","3CX STV","TM320 STV"]);

const sqtRows=parseCSV(readFileSync(SQT,"utf8"));
const sH=sqtRows[0].map(x=>x.trim()); const si=n=>sH.indexOf(n);
const lines=[]; const partsNeeded=new Set();
for(let i=1;i<sqtRows.length;i++){const r=sqtRows[i]; const model=r[si("Model")]; if(!MODELS.has(model))continue;
  const pn=(r[si("Part No.")]||"").trim(); partsNeeded.add(pn);
  lines.push({product:r[si("Product")],model,variant:r[si("Variant")],serviceInterval:r[si("Service Interval")],serviceDescription:r[si("Service Description")],labourHours:num(r[si("Labour Hours")]),partNo:pn,partDescription:r[si("Part Description")],quantity:num(r[si("Quantity")])});
}

const priceRows=parseCSV(readFileSync(PRICE,"utf8"));
const ph=priceRows.findIndex(r=>r.map(x=>x.trim()).includes("Part number"));
const pH=priceRows[ph].map(x=>x.trim()); const pc=n=>pH.indexOf(n);
const prices=[];
for(let i=ph+1;i<priceRows.length;i++){const r=priceRows[i]; const pn=(r[pc("Part number")]||"").trim(); if(!pn||!partsNeeded.has(pn))continue;
  prices.push({partNo:pn,description:(r[pc("Description")]||"").trim(),cost:num(r[pc("Stock Price")]),retail:num(r[pc("List Price")])});
}

const out={ generatedAt:new Date().toISOString(), models:[...MODELS], sqt:lines, prices };
writeFileSync("src/data/demo-data.json", JSON.stringify(out));
console.log("models:",[...MODELS].join(", "));
console.log("sqt lines:",lines.length," prices:",prices.length," variants:",new Set(lines.map(l=>l.model+" | "+l.variant)).size);
