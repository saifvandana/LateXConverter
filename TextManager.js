const symbols = require('./Assets/symbols.json');
const expressions = require('./Assets/expressions.json');
const words = require('./Assets/words.json');


// variables
const noSpaceTokens = new Set(["^", "_", "{", "}"]);
const parens = new Set(["[", "]", "{", "}", "(", ")", " "]);
const infixes = new Set(["+", "-", "*", "\\frac_curry", "/", "^", "=", "_", "\\frac", "\\pm"]);

const ignoredCommands = new Set(["\\left", "\\right", "\\limits", "\\right.", "\\left.", "&", "\\big"]);

const openingBrackets = new Set(["{", "("]);
const closingBrackets = new Set(["}", ")"]);
const wordset = initializeWordBag();

const extraLstr = new Set(["&","\\label", "\\displaystyle", "\\textstyle", "\\scriptstyle", "\\begin{align}", "\\end{align}", "\\begin{equation}", "\\end{equation}", "{equation}", "{align}", "\\begin{aligned}", "\\end{aligned}", "\\rm"]);


// functions
function listToString( tokens) {
  let string = "";

  for(let token of tokens) {
    string += token;
  }

  return string;
}

function normalizeSpaces( string) {
  let newStr = string[0];

  for(let i = 1; i < string.length; i++) {
    if(!(string[i] === " " && string [i - 1] === " ")) {
      newStr += string[i];
    }
  }

  return newStr;
}

function normalizeBrackets( tokens) {
  let index = tokens.indexOf("{");
  let open = index;

  for(; index < tokens.length && index > 0; index++) {

    if(tokens[index] === "}") {

      if(index - open <= 3) {
        tokens.splice(open, 1, " ");
        tokens.splice(index, 1, " ");
      } else {
        tokens.splice(open, 1, " open bracket ");
        tokens.splice(index, 1, " close bracket , ");
      }
    }

    if(tokens[index] === "{") {
      open = index;
    }
  }

  return tokens;
}

function convertWords( tokens) {

  for (let [key, value] of Object.entries(words)) {
    let change = true;

    while(change) {
      const latIndex = tokens.indexOf(key);
      if( latIndex !== -1){
        tokens.splice(latIndex, 1, value);
      } else {
        change = false;
      }
    }
  }

  return tokens;
}

function convertSymbols( tokens) {

  for (let [key, value] of Object.entries(symbols)) {
    let change = true;

    while(change) {
      const latIndex = tokens.indexOf(key);
      if( latIndex !== -1){
        tokens.splice(latIndex, 1, " " + value + " ");
      } else {
        change = false;
      }
    }
  }

  return tokens;
}

function convertEquations( tokens) {

  for (let [key, value] of Object.entries(expressions)) {

    let change = true;
    let index = 0;

    while(change) {
      const latIndex = tokens.indexOf(value.latex, index);
      change = false;

      if( latIndex !== -1){
        change = true;
        index = latIndex + 1;

        if(value.layers > 1) {
          const preLatex = value.preLatex;
          const preText = value.preText;

          for(let i = 0; i < preLatex.length; i++) {

            if(tokens[latIndex - 1] === preLatex[i]) {
              tokens = convert(tokens, latIndex, value, preText[i] + " " + value.text, 1);
            }
          }

        } else {
          tokens = convert(tokens, latIndex, value, value.text, 0);
        }
      }
    }
  }

  return tokens;
}

function convert(tokens, latIndex, value, text, dif) {
  let index = latIndex + 1;
  const prms = value.prms;
  const separation = value.separation;
  let sepIndex = -1;

  for( s = 0; s < separation.length; s++) {
    if(separation[s][0] === tokens[index] || (separation[s][0] === "" && sepIndex === -1)){
      sepIndex = s;
    }
  }

  if( sepIndex < 0) {
    return tokens;
  }

  const prmBrackets = [];
  const prmStrings = [];

  for( prm = 0; prm < prms; prm++){
    const startIndex = index;
    let subPowCount = 0;
    let prmStr = "";
    let balance = 1;

    if(separation[sepIndex][3 * prm] !== "") {
      index++;
    }

    while(true) {

      if(tokens[index] === separation[sepIndex][3 * prm] && separation[sepIndex][3 * prm] !== separation[sepIndex][3 * prm + 1]) {
        balance++;
      }

      if(tokens[index] === separation[sepIndex][3 * prm + 1]) {
        balance--;
      }

      if(tokens[index] === "^" || tokens[index] === "_") {
        subPowCount++;
      }

      // console.log(index,tokens[index], balance)

      if(balance !== 0) {
        prmStr += tokens[index]
      } else {
        break;
      }

      if(index >= tokens.length - 1) {
        if(separation[sepIndex][3 * prm + 1] === " ") {
          index++;
          break;
        } else {
          return tokens
        }
      }

      index++;
    }

    prmStrings[prm] = prmStr;

    prmBrackets[prm] = !!(value.add_bracket && index - startIndex > 3 + 2 * subPowCount);

    index += separation[sepIndex][3 * prm + 2];
  }

  for( prm = 0; prm < prms; prm++){

    if(prmBrackets[prm]) {
      text = text.split("prm" + prm).join(" , open bracket " + prmStrings[prm] + " close bracket , ");
    } else {
      text = text.split("prm" + prm).join(" , " + prmStrings[prm] + " , ");
    }
  }

  tokens.splice(latIndex - dif, (index - latIndex), ...tokenise(text + " , "));

  return tokens;
}

function initializeWordBag() {
  const wordSet = new Set();

  for (let [key, value] of Object.entries(words)) {
    wordSet.add(key);
  }

  for (let [key, value] of Object.entries(expressions)) {
    const text = value.text.split(' ');

    for(let t of text) {
      wordSet.add(t)
    }
  }

  for(let i = 0; wordSet.has("prm" + i); i++) {
    wordSet.delete("prm" + i);
    wordSet.delete("\\prm" + i);
  }

  return wordSet;
}

function cleanExtraSpace(tokens) {
  for (let item of noSpaceTokens) {
    let change = true;
    let index = 0;

    while(change) {
      const latIndex = tokens.indexOf(item, index);

      if( latIndex !== -1){

        if(latIndex > 0 && tokens[latIndex - 1] === " ") {
          tokens.splice(latIndex - 1, 1);
        }

        else if (latIndex < tokens.length - 1 && tokens[latIndex + 1] === " ") {
          tokens.splice(latIndex + 1, 1);
          index--;
        }

        else {
          index++;
        }

      } else {
        change = false;
      }
    }
  }

  return tokens;
}

const tokenise = (s) => {
  let tokens = [];
  let token = "";
  let inCommand = false;

  const checkThenPush = (token) => {
    if (token.length > 0 && !ignoredCommands.has(token)) {
      tokens.push(token);
    }
  };

  for (let i = 0; i < s.length; i++) {
    let c = s.charAt(i);

    if (parens.has(c) || infixes.has(c)) {
      checkThenPush(token);
      inCommand = false;
      checkThenPush(c);
      token = "";

    } else if (c === "\\") {

      if(token !== "\\") {
        checkThenPush(token);
        inCommand = true;
        token = "\\";
      }
      else {
        token = "\\\\";
        inCommand = false;
      }

    } else if (inCommand) {
      token += c;

    } else {
      tokens.push(c);
    }
  }

  checkThenPush(token);
  return tokens;
};

function makeCommand(string){

  for (item of wordset.values()){
    if (string.includes(item)){
      string = string.split(item).join("\\" + item);
    }
  }
  return string;
}

function cleanLatex(string){

  for (item of extraLstr.values()){
    if (string.includes(item)){
      string = string.split(item).join("");
    }
  }
  return string;
}

function cleanCommands(tokens) {

  for(let i = 0; i < tokens.length; i++) {
    tokens[i] = tokens[i].replace("\\", "");
  }

  return tokens;
}

function main( str) {

  str = cleanLatex(str);
  str = makeCommand(str);
  let tokens = tokenise(str);
  tokens = cleanExtraSpace(tokens);
  tokens = convertEquations(tokens);
  tokens = normalizeBrackets(tokens);
  tokens = convertSymbols(tokens);
  tokens = cleanCommands(tokens);
  tokens = convertWords(tokens);
  str = listToString(tokens);
  str = normalizeSpaces(str);

  return str;
}

module.exports.txtConvert = main;