// A fast drop-in replacement for csv-reader 1.0.0: run(input) returns csv-reader's exact reading of the
// case's input {text, header} — {columns, rows, errors} — with every quirk of its broken-row policy kept:
//
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled, "" inside it one quote, and
//     each CRLF or lone CR inside it is read as LF; what follows its closing quote, up to the next comma or
//     line break, is appended to it as it stands (quote_junk, when the field ends with characters appended);
//     a quote that never closes is read as a literal character and the text after it is read again as an
//     unquoted field (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never trimmed;
//   - columns is the first record when header is true, else null; rows holds the records after it (every
//     record when header is false), each padded with "" (short_row, with fields: its count) or cut
//     (long_row, with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every LF, CRLF and lone
//     CR inside a quoted field counted), row its record's index in rows (null for the header), in the order
//     met, a field's quote_junk when the field ends and a record's short_row or long_row when it ends.
//
// Where csv-reader walks one character at a time and builds each field a character at a time, this reader
// scans each run of ordinary characters in one tight loop and cuts the field out of the text with a single
// slice; only a field that actually meets a stray CR, an escaped quote or a CR inside quotes is assembled
// from pieces. The readings are the same; only the walking differs.

const COMMA_END = 0;
const BREAK_END = 1;
const TEXT_END = 2;

/** csv-reader 1.0.0's answer for one case's input, read faster. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // How the field just scanned ended, and how many characters that scan kept (the junk test reads it).
  let fieldEnd = TEXT_END;
  let fieldKept = 0;

  function fail(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters from pos up to the next comma or line break, dropping each CR that is not
  // followed by LF (stray_cr). `prefix` is a value already read that the characters extend (a quoted
  // field's value before its junk, or the literal quote of an unterminated field), or null. Sets pos,
  // line, fieldEnd and fieldKept (the characters this scan kept, the prefix not counted).
  function readUnquoted(prefix) {
    let start = pos;
    let parts = null;
    let kept = 0;
    for (;;) {
      let p = pos;
      while (p < n) {
        const c = text.charCodeAt(p);
        if (c === 44 || c === 10 || c === 13) break;
        p += 1;
      }
      if (p >= n) {
        pos = p;
        kept += p - start;
        fieldEnd = TEXT_END;
        fieldKept = kept;
        if (parts !== null) {
          parts.push(text.slice(start, p));
          return parts.join('');
        }
        const seg = text.slice(start, p);
        return prefix === null ? seg : prefix + seg;
      }
      const c = text.charCodeAt(p);
      if (c === 13 && text.charCodeAt(p + 1) !== 10) {
        fail('stray_cr');
        if (parts === null) parts = prefix === null ? [] : [prefix];
        parts.push(text.slice(start, p));
        kept += p - start;
        pos = p + 1;
        start = pos;
        continue;
      }
      kept += p - start;
      let value;
      if (parts !== null) {
        parts.push(text.slice(start, p));
        value = parts.join('');
      } else {
        const seg = text.slice(start, p);
        value = prefix === null ? seg : prefix + seg;
      }
      if (c === 44) {
        pos = p + 1;
        fieldEnd = COMMA_END;
      } else if (c === 10) {
        pos = p + 1;
        line += 1;
        fieldEnd = BREAK_END;
      } else {
        pos = p + 2;
        line += 1;
        fieldEnd = BREAK_END;
      }
      fieldKept = kept;
      return value;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let p = open + 1;
    let segStart = p;
    let parts = null;
    for (;;) {
      while (p < n) {
        const c = text.charCodeAt(p);
        if (c === 34 || c === 13 || c === 10) break;
        p += 1;
      }
      if (p >= n) {
        // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        fail('unterminated_quote');
        return readUnquoted('"');
      }
      const c = text.charCodeAt(p);
      if (c === 10) {
        line += 1;
        p += 1;
        continue;
      }
      if (c === 13) {
        // CRLF and a lone CR inside quotes are each one LF.
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, p), '\n');
        line += 1;
        p += text.charCodeAt(p + 1) === 10 ? 2 : 1;
        segStart = p;
        continue;
      }
      if (text.charCodeAt(p + 1) === 34) {
        // A doubled quote inside the field is one quote.
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, p), '"');
        p += 2;
        segStart = p;
        continue;
      }
      // The closing quote.
      let value;
      if (parts !== null) {
        parts.push(text.slice(segStart, p));
        value = parts.join('');
      } else {
        value = text.slice(open + 1, p);
      }
      pos = p + 1;
      if (pos >= n) {
        fieldEnd = TEXT_END;
        return value;
      }
      const d = text.charCodeAt(pos);
      if (d === 44) {
        pos += 1;
        fieldEnd = COMMA_END;
        return value;
      }
      if (d === 10) {
        pos += 1;
        line += 1;
        fieldEnd = BREAK_END;
        return value;
      }
      if (d === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fieldEnd = BREAK_END;
        return value;
      }
      // What follows the closing quote is appended as it stands, up to the next comma or line break.
      const junk = readUnquoted(value);
      if (fieldKept > 0) fail('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let value;
    do {
      quoted = text.charCodeAt(pos) === 34;
      value = quoted ? readQuoted() : readUnquoted(null);
      fields.push(value);
    } while (fieldEnd === COMMA_END);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
