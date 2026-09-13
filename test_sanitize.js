function sanitizeTestCaseText(text) {
  if (!text) return '';
  let cleaned = String(text).trim();

  const codeBlockMatch = cleaned.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/```[a-zA-Z]*/g, '').trim();
    cleaned = cleaned.replace(/\*\*[\s\S]*$/g, '').trim();
  }

  const forbiddenPhrases = [
    'The input contains', 'Format:', 'Input Format', 'Output Format',
    'Constraints', 'Print the sum', 'Sample Input:', 'Sample Output:',
    'Input:', 'Output:', 'Hidden test cases'
  ];

  for (const phrase of forbiddenPhrases) {
    if (cleaned.includes(phrase)) {
      const lines = cleaned.split('\n').filter(line => {
        const trimmed = line.trim();
        return !forbiddenPhrases.some(p => trimmed.toLowerCase().includes(p.toLowerCase()));
      });
      cleaned = lines.join('\n').trim();
    }
  }
  cleaned = cleaned.replace(/\r\n/g, '\n');
  return cleaned;
}
console.log(JSON.stringify(sanitizeTestCaseText("Input:\n```text\n5\n1 2 3 4 5\n```")));
