import keyCodes from "./keycodes";

export const ArrayEquals = (a: Array<any>, b: Array<any>) =>
  a.length === b.length && a.every((v, i) => v === b[i])
export const keyArrayToString = (keyArray: Array<string>) => {
  let string = "";
  for (let i = 0; i < keyArray.length; i++) {
    string += keyCodes[keyArray[i]];
    if (i < keyArray.length - 1) string += " + ";
  }
  return string;
}

const utils = {
  ArrayEquals,
  keyArrayToString,
};
export default utils;