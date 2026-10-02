import prettier from 'prettier/standalone';
import parserBabel from 'prettier/plugins/babel';
import parserEstree from 'prettier/plugins/estree';

export class CodeFormatter {
  public static async format(code: string, language: 'typescript' | 'sql' | 'json'): Promise<string> {
    if (!code || !code.trim()) return code;

    if (language === 'json') {
      try {
        const parsed = JSON.parse(code);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return code;
      }
    }

    if (language === 'typescript') {
      try {
        const formatted = await prettier.format(code, {
          parser: 'babel-ts',
          plugins: [parserBabel, parserEstree],
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'es5',
          printWidth: 90,
        });
        return formatted;
      } catch (e) {
        console.warn('Prettier format warning:', e);
        return code;
      }
    }

    if (language === 'sql') {
      return CodeFormatter.formatSql(code);
    }

    return code;
  }

  public static formatSql(sql: string): string {
    const keywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'GROUP BY',
      'ORDER BY',
      'HAVING',
      'LIMIT',
      'OFFSET',
      'LEFT JOIN',
      'RIGHT JOIN',
      'INNER JOIN',
      'FULL OUTER JOIN',
      'JOIN',
      'INSERT INTO',
      'VALUES',
      'UPDATE',
      'SET',
      'DELETE FROM',
      'CREATE TABLE',
      'CREATE INDEX',
      'ALTER TABLE',
      'DROP TABLE',
      'UNION ALL',
      'UNION',
    ];

    let formatted = sql.trim();

    // Replace keywords on newlines with standard capitalization
    keywords.forEach((kw) => {
      const regex = new RegExp(`(^|\\s+)(${kw})(\\s+|$)`, 'gi');
      formatted = formatted.replace(regex, (match, prefix, found, suffix) => {
        return `\n${kw} `;
      });
    });

    // Clean up multiple empty lines
    return formatted
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l, idx, arr) => !(l === '' && arr[idx - 1] === ''))
      .join('\n')
      .trim();
  }
}
