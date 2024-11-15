import { ExternalTokenizer } from "@lezer/lr";
import { DocumentMarkup, Flag, CodeBlock } from "./syntax.grammar.terms";

const newline = 10,
  carriage = 13,
  space = 32,
  tab = 9;

function currentLine(input, offset = 0) {
  let value = "";
  let off = offset - 1;
  while (![newline, -1, 0].includes(input.peek(off))) {
    value += String.fromCharCode(input.peek(off));
    off--;
    if (off < 0) {
      break;
    }
  }
  value = value.split("").reverse().join("");
  off = offset;
  while (![newline, -1, 0].includes(input.peek(off))) {
    value += String.fromCharCode(input.peek(off));
    off++;
  }
  return value;
}

function readIdentifier(input, offset, delta = -1) {
  let value = "";
  while ([space, tab, carriage].includes(input.peek(offset))) {
    offset += delta;
  }
  if (input.peek(offset) < 0) {
    return value;
  }

  while (![space, tab, newline, carriage, -1, 0].includes(input.peek(offset))) {
    value += String.fromCharCode(input.peek(offset));
    offset += delta;
  }
  if (delta < 0) {
    return value.split("").reverse().join("");
  }
  return value;
}

function consume(input, offset, cb) {
  let char = input.peek(offset);
  let value = "";
  let tempValue = String.fromCharCode(char);
  let index = 0;
  while (
    char > 0 &&
    cb({
      code: char,
      char: String.fromCharCode(char),
      index,
      offset,
      value: tempValue,
    })
  ) {
    value = tempValue;
    offset++;
    index++;
    char = input.peek(offset);
    tempValue += String.fromCharCode(char);
  }
  return [offset, value];
}

function isDate(value) {
  return /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value.trim());
}

function isAccount(value) {
  return /^[A-Z][a-z]+:([A-Z0-9][A-Za-z0-9-]*:)*[A-Z0-9][A-Za-z0-9-]*$/.test(
    value.trim(),
  );
}

function isDirective(value) {
  value = value.trim();
  return (
    isDate(value) ||
    /^[A-Z!*]?\s*[a-z][a-zA-Z0-9_-]+\s*:/.test(value) ||
    /^[A-Z!*]?\s*[A-Z][a-z]+:([A-Z0-9][A-Za-z0-9-]*:)*[A-Z0-9][A-Za-z0-9-]*/.test(
      value,
    ) ||
    /^(option|plugin)\s*["`]/.test(value)
  );
}

function spaceBefore(input) {
  let count = 0;
  const chars = input.split("");
  for (let i = 0; i < chars.length; i++) {
    if (/\s/.test(chars[i])) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export const markup = new ExternalTokenizer(
  (input) => {
    if (input.next < 0) {
      return;
    }

    const line = currentLine(input, 0).trim();
    if (!isDirective(line)) {
      for (let off = 0; ; off++) {
        let next = input.peek(off);
        if (next == newline) {
          input.acceptToken(DocumentMarkup, off + 1);
          return;
        } else if (next < 0) {
          input.acceptToken(DocumentMarkup, off);
          return;
        }
      }
    }
  },
  { fallback: true },
);

export const flag = new ExternalTokenizer(
  (input) => {
    // !, *, [A-Z]
    if (input.next < 0) {
      return;
    }

    const [_, posFlag] = consume(input, 0, ({ value }) =>
      /^\s*([!*#]|[A-Z]|[txn]{1,3})\s*$/.test(value),
    );
    if (posFlag) {
      const before = readIdentifier(input, -1, -1);
      const after = readIdentifier(input, posFlag.length, 1);
      input.advance(spaceBefore(posFlag));

      if (isDate(before) && input.peek(posFlag.length) === 34) {
        input.acceptToken(Flag, posFlag.trim().length);
      } else if (isAccount(after)) {
        input.acceptToken(Flag, posFlag.trim().length);
      }
    }
  },
  { fallback: true },
);

export const codeBlock = new ExternalTokenizer(
  (input) => {
    if (input.next < 0) {
      return;
    }
    const [openOffset, openBlock] = consume(
      input,
      0,
      ({ char }) => char === "`",
    );
    if (openBlock.length >= 3) {
      const [bodyOffset] = consume(input, openOffset, ({ char, offset }) => {
        if (char !== "`") {
          return true;
        }
        const token = consume(
          input,
          offset,
          ({ char, index }) => char === "`" && index < openBlock.length,
        );
        if (token[1] === openBlock) {
          return false;
        }
        return true;
      });
      const [closeOffset, closeBlock] = consume(
        input,
        bodyOffset,
        ({ char, index }) => char === "`" && index < openBlock.length,
      );
      if (closeBlock === openBlock) {
        return input.acceptToken(CodeBlock, closeOffset);
      }
    }
  },
  { fallback: false },
);
